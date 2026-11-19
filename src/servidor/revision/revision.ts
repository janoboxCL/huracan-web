/* Lógica del modo revisión sobre GitHub Issues: control de cambios entre el
   club (rol cliente) y el equipo de desarrollo (rol equipo).

   Modelo:
   - Un issue de control por ronda («Revisión del sitio · Ronda N», etiquetas
     `revision`, `revision:ronda`, `ronda-N`) con la tabla del veredicto del club
     por sección y la entrega. Cada cambio deja un comentario como historial.
   - Un issue por observación del club (solo el club las crea), con etiquetas
     `revision`, `ronda-N`, `seccion:*`, `tipo:*`, `prioridad:*`.
   - El hilo de la observación son los comentarios del issue: los que se envían
     desde el sitio llevan rol y autor en un bloque oculto; los escritos
     directamente en GitHub se consideran del equipo.
   - Decisión del equipo: etiqueta `decision:aclaracion|aceptada|pospuesta`;
     «rechazada» cierra el issue como no planificado e «implementada» como
     completado. Sin decisión, la observación está «por responder».
   - Turno: `esperando:equipo` o `esperando:cliente` indica quién debe responder.
   - El cambio acordado (al aceptar) se guarda en el cuerpo del issue y es lo
     que entra al consolidado para Claude Code. */

import {
  DECISIONES,
  ESTADOS_SECCION,
  LIMITES,
  PRIORIDADES,
  ROLES,
  SECCIONES,
  TIPOS,
  buscarSeccion,
  nombreSeccion,
  type Comentario,
  type ComentarioNuevo,
  type Entrega,
  type EstadoRonda,
  type EstadoSeccionRegistrado,
  type IdDecision,
  type IdEstadoComentario,
  type IdEstadoSeccion,
  type IdPrioridad,
  type IdTipo,
  type Respuesta,
  type Rol,
} from '../../data/revision';
import { ErrorGitHub, GitHub, nombresEtiquetas, type Issue } from './github';

export const ETIQUETA_REVISION = 'revision';
export const ETIQUETA_CONTROL = 'revision:ronda';
export const ETIQUETA_ENTREGADA = 'ronda-entregada';
const PREFIJO_DECISION = 'decision:';
const PREFIJO_ESPERANDO = 'esperando:';

export const etiquetaRonda = (ronda: number) => `ronda-${ronda}`;

/** Decisiones que se expresan como etiqueta (las otras cierran el issue). */
const DECISIONES_ABIERTAS = ['aclaracion', 'aceptada', 'pospuesta'] as const;

/** Catálogo completo de etiquetas, con color y descripción. */
export function catalogoEtiquetas(ronda: number) {
  return [
    { name: ETIQUETA_REVISION, color: '0a0a0a', description: 'Observación del modo revisión del sitio' },
    { name: ETIQUETA_CONTROL, color: '5319e7', description: 'Issue de control de una ronda de revisión' },
    { name: etiquetaRonda(ronda), color: 'fff30b', description: `Ronda ${ronda} de revisión del club` },
    { name: ETIQUETA_ENTREGADA, color: '0e8a16', description: 'El club entregó su revisión de la ronda' },
    { name: `${PREFIJO_DECISION}aclaracion`, color: 'fbca04', description: DECISIONES.aclaracion.ayuda },
    { name: `${PREFIJO_DECISION}aceptada`, color: '0e8a16', description: DECISIONES.aceptada.ayuda },
    { name: `${PREFIJO_DECISION}pospuesta`, color: 'bfd4f2', description: DECISIONES.pospuesta.ayuda },
    { name: `${PREFIJO_ESPERANDO}equipo`, color: 'd93f0b', description: 'Le toca responder al equipo' },
    { name: `${PREFIJO_ESPERANDO}cliente`, color: 'c5def5', description: 'Le toca responder al club' },
    ...Object.entries(TIPOS).map(([id, t]) => ({ name: `tipo:${id}`, color: t.color, description: t.ayuda })),
    ...Object.entries(PRIORIDADES).map(([id, p]) => ({
      name: `prioridad:${id}`,
      color: p.color,
      description: p.ayuda,
    })),
    ...SECCIONES.map((s) => ({ name: `seccion:${s.id}`, color: 'ededed', description: nombreSeccion(s) })),
  ];
}

/* ── Utilidades de texto ─────────────────────────────────────────────── */

/** Limpia texto de usuario: normaliza saltos de línea, recorta y evita menciones a cuentas de GitHub. */
export function limpiar(texto: unknown, maximo: number): string {
  if (typeof texto !== 'string') return '';
  return texto
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maximo)
    .replace(/@(?=[\w-])/g, '@\u200b');
}

const unaLinea = (texto: string) => texto.replace(/\s+/g, ' ').trim();
/** Texto de usuario dentro del Markdown del issue: sin HTML (un `<!--` suelto ocultaría el resto). */
const md = (texto: string) => texto.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const celda = (texto: string) => md(unaLinea(texto)).replace(/\|/g, '\\|') || ' ';
const cita = (texto: string) =>
  md(texto)
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');

/** JSON seguro dentro de un comentario HTML (no puede cerrarlo antes de tiempo). */
function jsonEnComentario(marca: string, datos: unknown): string {
  const json = JSON.stringify(datos).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  return `<!-- ${marca} ${json} -->`;
}

function leerJsonDeComentario<T>(marca: string, cuerpo: string | null): T | null {
  if (!cuerpo) return null;
  const encontrado = cuerpo.match(new RegExp(`<!-- ${marca} (\\{.*?\\}) -->`, 's'));
  if (!encontrado?.[1]) return null;
  try {
    return JSON.parse(encontrado[1]) as T;
  } catch {
    return null;
  }
}

function fechaChile(iso: string): string {
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Santiago',
  }).format(new Date(iso));
}

const verificarRonda = (entrada: Record<string, unknown>, ronda: number) =>
  entrada['ronda'] === ronda ? null : 'La ronda no coincide con la ronda vigente. Recarga la página.';

/* ── Issue de control de la ronda ────────────────────────────────────── */

interface DatosRonda {
  secciones: Record<string, EstadoSeccionRegistrado>;
  entregada: Entrega | null;
}

function cuerpoRonda(ronda: number, datos: DatosRonda): string {
  const filas = SECCIONES.map((s) => {
    const r = datos.secciones[s.id];
    const estado = r ? ESTADOS_SECCION[r.estado].nombre : ESTADOS_SECCION['sin-revisar'].nombre;
    return `| ${celda(nombreSeccion(s))} | ${estado} | ${celda(r?.revisor ?? '')} | ${r ? fechaChile(r.fecha) : ' '} | ${celda(r?.nota ?? '')} |`;
  });
  const entrega = datos.entregada
    ? `**Revisión entregada** el ${fechaChile(datos.entregada.fecha)} por ${md(datos.entregada.revisor)}.` +
      (datos.entregada.mensaje ? `\n\n${cita(datos.entregada.mensaje)}` : '')
    : '**Revisión entregada:** todavía no.';

  return [
    `## Revisión del sitio · Ronda ${ronda}`,
    '',
    'Issue de control de la ronda. Lo actualiza el modo revisión del sitio: registra el veredicto del club por sección y la entrega final. Las observaciones están en issues aparte con la etiqueta `' +
      etiquetaRonda(ronda) +
      '`.',
    '',
    '| Sección | Veredicto | Revisor | Fecha | Nota |',
    '|---|---|---|---|---|',
    ...filas,
    '',
    entrega,
    '',
    jsonEnComentario('revision-ronda', datos),
  ].join('\n');
}

function datosDeRonda(issue: Issue): DatosRonda {
  const leidos = leerJsonDeComentario<Partial<DatosRonda>>('revision-ronda', issue.body);
  return { secciones: leidos?.secciones ?? {}, entregada: leidos?.entregada ?? null };
}

async function prepararEtiquetas(gh: GitHub, ronda: number): Promise<void> {
  const existentes = new Set((await gh.listarEtiquetas()).map((e) => e.name.toLowerCase()));
  for (const etiqueta of catalogoEtiquetas(ronda)) {
    if (existentes.has(etiqueta.name.toLowerCase())) continue;
    try {
      await gh.crearEtiqueta(etiqueta);
    } catch (e) {
      // 422 = ya existe (carrera con otra petición): no es un problema.
      if (!(e instanceof ErrorGitHub && e.estado === 422)) throw e;
    }
  }
}

export async function buscarIssueRonda(gh: GitHub, ronda: number): Promise<Issue | null> {
  const encontrados = await gh.listarIssues([ETIQUETA_CONTROL, etiquetaRonda(ronda)]);
  return encontrados[0] ?? null;
}

/** Devuelve el issue de control de la ronda; si no existe, prepara las etiquetas y lo crea. */
export async function asegurarIssueRonda(gh: GitHub, ronda: number): Promise<Issue> {
  const existente = await buscarIssueRonda(gh, ronda);
  if (existente) return existente;
  await prepararEtiquetas(gh, ronda);
  return gh.crearIssue({
    title: `Revisión del sitio · Ronda ${ronda}`,
    body: cuerpoRonda(ronda, { secciones: {}, entregada: null }),
    labels: [ETIQUETA_REVISION, ETIQUETA_CONTROL, etiquetaRonda(ronda)],
  });
}

/* ── Observaciones ───────────────────────────────────────────────────── */

interface DatosComentario {
  seccion: string;
  tipo: IdTipo;
  prioridad: IdPrioridad;
  comentario: string;
  revisor: string;
  dispositivo: string;
  elemento: string | null;
  url: string;
  version: string;
  fecha: string;
  /** Cambio acordado por el equipo (al aceptar). */
  cambio?: string;
  cambioPor?: string;
  cambioFecha?: string;
}

export function validarComentario(entrada: unknown, ronda: number): DatosComentario | string {
  const e = (entrada ?? {}) as Partial<Record<keyof ComentarioNuevo, unknown>>;
  const errorRonda = verificarRonda(e as Record<string, unknown>, ronda);
  if (errorRonda) return errorRonda;
  if (typeof e.seccion !== 'string' || !buscarSeccion(e.seccion)) return 'Sección desconocida.';
  if (typeof e.tipo !== 'string' || !(e.tipo in TIPOS)) return 'Tipo de observación no válido.';
  if (typeof e.prioridad !== 'string' || !(e.prioridad in PRIORIDADES)) return 'Prioridad no válida.';
  const comentario = limpiar(e.comentario, LIMITES.comentario);
  if (comentario.length < 3) return 'La observación está vacía.';
  const revisor = limpiar(e.revisor, LIMITES.revisor);
  if (!revisor) return 'Falta el nombre de quien revisa.';
  return {
    seccion: e.seccion,
    tipo: e.tipo as IdTipo,
    prioridad: e.prioridad as IdPrioridad,
    comentario,
    revisor,
    dispositivo: limpiar(e.dispositivo, 80),
    elemento: limpiar(e.elemento, LIMITES.elemento) || null,
    url: limpiar(e.url, 300),
    version: limpiar(e.version, 80),
    fecha: new Date().toISOString(),
  };
}

function cuerpoComentario(ronda: number, d: DatosComentario): string {
  const seccion = buscarSeccion(d.seccion);
  return [
    `**Sección:** ${seccion ? nombreSeccion(seccion) : md(d.seccion)}  `,
    `**Tipo:** ${TIPOS[d.tipo].nombre} · **Prioridad:** ${PRIORIDADES[d.prioridad].nombre}  `,
    `**Revisor:** ${md(d.revisor)} · **Dispositivo:** ${md(d.dispositivo) || 'sin dato'}`,
    '',
    '### Observación del club',
    '',
    cita(d.comentario),
    ...(d.elemento ? ['', '### Elemento señalado', '', '```text', d.elemento.replace(/```/g, "'''"), '```'] : []),
    ...(d.cambio
      ? [
          '',
          '### Cambio acordado',
          '',
          md(d.cambio),
          '',
          `<sub>Acordado por ${md(d.cambioPor ?? 'el equipo')}${d.cambioFecha ? ` · ${fechaChile(d.cambioFecha)}` : ''}</sub>`,
        ]
      : []),
    '',
    '---',
    `<sub>Ronda ${ronda} · versión ${md(d.version) || 'sin dato'} · ${fechaChile(d.fecha)} · ${md(d.url)}</sub>`,
    '',
    jsonEnComentario('revision-datos', d),
  ].join('\n');
}

export async function crearComentario(gh: GitHub, ronda: number, d: DatosComentario): Promise<Comentario> {
  await asegurarIssueRonda(gh, ronda);
  const seccion = buscarSeccion(d.seccion)!;
  const resumen = unaLinea(d.comentario);
  const titulo = `[R${ronda} · ${seccion.nombre}] ${TIPOS[d.tipo].nombre}: ${
    resumen.length > 72 ? `${resumen.slice(0, 71)}…` : resumen
  }`;
  const issue = await gh.crearIssue({
    title: titulo,
    body: cuerpoComentario(ronda, d),
    labels: [
      ETIQUETA_REVISION,
      etiquetaRonda(ronda),
      `seccion:${d.seccion}`,
      `tipo:${d.tipo}`,
      `prioridad:${d.prioridad}`,
      `${PREFIJO_ESPERANDO}equipo`,
    ],
  });
  return aComentario(issue)!;
}

function estadoComentario(issue: Issue, etiquetas: string[]): IdEstadoComentario {
  if (issue.state === 'closed') return issue.state_reason === 'not_planned' ? 'rechazada' : 'implementada';
  const decision = etiquetas.find((e) => e.startsWith(PREFIJO_DECISION))?.slice(PREFIJO_DECISION.length);
  return decision && (DECISIONES_ABIERTAS as readonly string[]).includes(decision)
    ? (decision as IdEstadoComentario)
    : 'pendiente';
}

function turnoComentario(issue: Issue, etiquetas: string[]): Rol | null {
  if (issue.state === 'closed') return null;
  if (etiquetas.includes(`${PREFIJO_ESPERANDO}cliente`)) return 'cliente';
  if (etiquetas.includes(`${PREFIJO_ESPERANDO}equipo`)) return 'equipo';
  return null;
}

/** Convierte un issue de observación al formato de la interfaz. Tipo y prioridad
    se leen de las etiquetas, para respetar una reclasificación hecha en GitHub. */
export function aComentario(issue: Issue): Comentario | null {
  const etiquetas = nombresEtiquetas(issue);
  if (etiquetas.includes(ETIQUETA_CONTROL)) return null;
  const datos = leerJsonDeComentario<Partial<DatosComentario>>('revision-datos', issue.body);
  const deEtiqueta = (prefijo: string) => etiquetas.find((e) => e.startsWith(prefijo))?.slice(prefijo.length);
  const tipo = deEtiqueta('tipo:') ?? datos?.tipo;
  const prioridad = deEtiqueta('prioridad:') ?? datos?.prioridad;
  return {
    numero: issue.number,
    enlace: issue.html_url,
    seccion: datos?.seccion ?? deEtiqueta('seccion:') ?? 'general',
    tipo: tipo && tipo in TIPOS ? (tipo as IdTipo) : null,
    prioridad: prioridad && prioridad in PRIORIDADES ? (prioridad as IdPrioridad) : null,
    estado: estadoComentario(issue, etiquetas),
    turno: turnoComentario(issue, etiquetas),
    comentario: datos?.comentario ?? issue.title,
    revisor: datos?.revisor ?? '',
    elemento: datos?.elemento ?? null,
    fecha: datos?.fecha ?? issue.created_at,
    cambio: datos?.cambio ?? '',
    respuestas: issue.comments,
  };
}

/** Lee una observación de la ronda (no el issue de control). `null` si no corresponde. */
async function obtenerObservacion(gh: GitHub, ronda: number, numero: number): Promise<Issue | null> {
  const issue = await gh.obtenerIssue(numero);
  const etiquetas = nombresEtiquetas(issue);
  const deLaRonda = etiquetas.includes(ETIQUETA_REVISION) && etiquetas.includes(etiquetaRonda(ronda));
  return deLaRonda && !etiquetas.includes(ETIQUETA_CONTROL) ? issue : null;
}

/* ── Hilo de respuestas ──────────────────────────────────────────────── */

interface DatosRespuesta {
  rol: Rol;
  autor: string;
  texto: string;
  decision: IdDecision | null;
  cambio: string;
}

export async function leerRespuestas(gh: GitHub, ronda: number, numero: number): Promise<Respuesta[] | null> {
  if (!(await obtenerObservacion(gh, ronda, numero))) return null;
  const comentarios = await gh.listarComentarios(numero);
  return comentarios.map((c) => {
    const datos = leerJsonDeComentario<Partial<DatosRespuesta>>('revision-respuesta', c.body);
    if (datos?.rol) {
      return {
        rol: datos.rol,
        autor: datos.autor ?? '',
        fecha: c.created_at,
        texto: datos.texto ?? '',
        decision: datos.decision ?? null,
        cambio: datos.cambio ?? '',
      };
    }
    // Escrito directamente en GitHub (o por Claude Code): cuenta como respuesta del equipo.
    return {
      rol: 'equipo' as const,
      autor: c.user?.login ?? '',
      fecha: c.created_at,
      texto: (c.body ?? '').replace(/<!--[\s\S]*?-->/g, '').trim(),
      decision: null,
      cambio: '',
    };
  });
}

/** Agrega una respuesta al hilo. El equipo puede además decidir; el club solo responde. */
export async function responder(
  gh: GitHub,
  ronda: number,
  rol: Rol,
  numero: number,
  entrada: unknown,
): Promise<Comentario | string | null> {
  const e = (entrada ?? {}) as Record<string, unknown>;
  const errorRonda = verificarRonda(e, ronda);
  if (errorRonda) return errorRonda;
  const autor = limpiar(e['autor'], LIMITES.revisor);
  if (!autor) return 'Falta el nombre de quien responde.';
  const texto = limpiar(e['texto'], LIMITES.respuesta);

  let decision: IdDecision | null = null;
  if (e['decision'] !== undefined && e['decision'] !== null && e['decision'] !== '') {
    if (rol !== 'equipo') return 'Solo el equipo puede decidir sobre una observación.';
    if (typeof e['decision'] !== 'string' || !(e['decision'] in DECISIONES)) return 'Decisión no válida.';
    decision = e['decision'] as IdDecision;
  }
  const cambio = decision === 'aceptada' ? limpiar(e['cambio'], LIMITES.cambio) : '';
  if (decision === 'aceptada' && cambio.length < 3) return 'Describe el cambio acordado antes de aceptar.';
  if (!texto && !decision) return 'Escribe una respuesta.';
  if ((decision === 'rechazada' || decision === 'aclaracion' || decision === 'pospuesta') && !texto) {
    return decision === 'aclaracion' ? 'Escribe la pregunta para el club.' : 'Explica el motivo al club.';
  }

  const issue = await obtenerObservacion(gh, ronda, numero);
  if (!issue) return null;

  // 1. Comentario del hilo
  const encabezado =
    `**${ROLES[rol]} · ${md(autor)}**` + (decision ? ` — Decisión: **${DECISIONES[decision].nombre}**` : '');
  await gh.comentar(
    numero,
    [
      encabezado,
      ...(texto ? ['', cita(texto)] : []),
      ...(cambio ? ['', `**Cambio acordado:** ${md(cambio)}`] : []),
      '',
      jsonEnComentario('revision-respuesta', { rol, autor, texto, decision, cambio } satisfies DatosRespuesta),
    ].join('\n'),
  );

  // 2. Etiquetas: decisión vigente y a quién le toca responder.
  const actuales = nombresEtiquetas(issue);
  const decisionActual = actuales.find((x) => x.startsWith(PREFIJO_DECISION));
  const etiquetas = actuales.filter((x) => !x.startsWith(PREFIJO_ESPERANDO) && !x.startsWith(PREFIJO_DECISION));
  if (decision && (DECISIONES_ABIERTAS as readonly string[]).includes(decision)) {
    etiquetas.push(`${PREFIJO_DECISION}${decision}`);
  } else if (!decision && decisionActual && issue.state === 'open') {
    etiquetas.push(decisionActual); // una respuesta sin decisión mantiene la decisión vigente
  }
  const cerrar = decision === 'implementada' || decision === 'rechazada';
  if (rol === 'cliente') etiquetas.push(`${PREFIJO_ESPERANDO}equipo`);
  else if (decision === 'aclaracion' || (!decision && !cerrar)) etiquetas.push(`${PREFIJO_ESPERANDO}cliente`);
  await gh.reemplazarEtiquetas(numero, etiquetas);

  // 3. Estado del issue y cambio acordado.
  const cambios: Parameters<GitHub['editarIssue']>[1] = {};
  if (cerrar) {
    cambios.state = 'closed';
    cambios.state_reason = decision === 'rechazada' ? 'not_planned' : 'completed';
  } else if (issue.state === 'closed' && (rol === 'cliente' || decision)) {
    // El club responde sobre algo cerrado, o el equipo cambia la decisión: se reabre.
    cambios.state = 'open';
    cambios.state_reason = 'reopened';
  }
  if (cambio) {
    const datos = leerJsonDeComentario<DatosComentario>('revision-datos', issue.body);
    if (datos) cambios.body = cuerpoComentario(ronda, { ...datos, cambio, cambioPor: autor, cambioFecha: new Date().toISOString() });
  }
  const final = Object.keys(cambios).length ? await gh.editarIssue(numero, cambios) : await gh.obtenerIssue(numero);
  return aComentario(final);
}

/* ── Consultas y acciones de la ronda ────────────────────────────────── */

export async function leerEstado(gh: GitHub, ronda: number, rol: Rol): Promise<EstadoRonda> {
  const issues = await gh.listarIssues([ETIQUETA_REVISION, etiquetaRonda(ronda)]);
  const control = issues.find((i) => nombresEtiquetas(i).includes(ETIQUETA_CONTROL)) ?? null;
  const datos = control ? datosDeRonda(control) : { secciones: {}, entregada: null };
  return {
    ronda,
    rol,
    issueRonda: control ? { numero: control.number, enlace: control.html_url } : null,
    secciones: datos.secciones,
    entregada: datos.entregada,
    comentarios: issues.map(aComentario).filter((c): c is Comentario => c !== null),
  };
}

export async function registrarEstadoSeccion(
  gh: GitHub,
  ronda: number,
  entrada: unknown,
): Promise<EstadoSeccionRegistrado | string> {
  const e = (entrada ?? {}) as Record<string, unknown>;
  const errorRonda = verificarRonda(e, ronda);
  if (errorRonda) return errorRonda;
  const seccion = typeof e['seccion'] === 'string' ? buscarSeccion(e['seccion']) : undefined;
  if (!seccion) return 'Sección desconocida.';
  const estado = e['estado'];
  if (typeof estado !== 'string' || !(estado in ESTADOS_SECCION)) return 'Veredicto no válido.';
  const revisor = limpiar(e['revisor'], LIMITES.revisor);
  if (!revisor) return 'Falta el nombre de quien revisa.';

  const registro: EstadoSeccionRegistrado = {
    estado: estado as IdEstadoSeccion,
    revisor,
    fecha: new Date().toISOString(),
    nota: limpiar(e['nota'], LIMITES.nota),
  };

  const issue = await asegurarIssueRonda(gh, ronda);
  // Se relee el issue justo antes de editar para no pisar un cambio reciente.
  const actual = datosDeRonda(await gh.obtenerIssue(issue.number));
  if (registro.estado === 'sin-revisar') delete actual.secciones[seccion.id];
  else actual.secciones[seccion.id] = registro;
  await gh.editarIssue(issue.number, { body: cuerpoRonda(ronda, actual) });
  await gh.comentar(
    issue.number,
    `**${nombreSeccion(seccion)}** → ${ESTADOS_SECCION[registro.estado].nombre} · ${md(revisor)}` +
      (registro.nota ? `\n\n${cita(registro.nota)}` : ''),
  );
  return registro;
}

export async function entregarRonda(gh: GitHub, ronda: number, entrada: unknown): Promise<Entrega | string> {
  const e = (entrada ?? {}) as Record<string, unknown>;
  const errorRonda = verificarRonda(e, ronda);
  if (errorRonda) return errorRonda;
  const revisor = limpiar(e['revisor'], LIMITES.revisor);
  if (!revisor) return 'Falta el nombre de quien revisa.';
  const entrega: Entrega = { revisor, fecha: new Date().toISOString(), mensaje: limpiar(e['mensaje'], LIMITES.nota) };

  const issue = await asegurarIssueRonda(gh, ronda);
  const actual = datosDeRonda(await gh.obtenerIssue(issue.number));
  actual.entregada = entrega;
  await gh.editarIssue(issue.number, { body: cuerpoRonda(ronda, actual) });
  await gh.agregarEtiquetas(issue.number, [ETIQUETA_ENTREGADA]);
  await gh.comentar(
    issue.number,
    `**Revisión de la ronda ${ronda} entregada** por ${md(revisor)}.` +
      (entrega.mensaje ? `\n\n${cita(entrega.mensaje)}` : ''),
  );
  return entrega;
}
