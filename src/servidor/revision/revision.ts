/* Lógica del modo revisión sobre GitHub Issues.

   Modelo:
   - Un issue de control por ronda («Revisión · Ronda N», etiquetas `revision`,
     `revision:ronda`, `ronda-N`). Su cuerpo lleva la tabla con el veredicto del
     cliente por sección y, al final, los mismos datos en un comentario HTML
     legible por máquina. Cada cambio de veredicto deja además un comentario
     en ese issue, para conservar el historial.
   - Un issue por comentario del cliente, con etiquetas `revision`, `ronda-N`,
     `seccion:*`, `tipo:*` y `prioridad:*`. El estado de atención se deriva del
     issue: abierto = pendiente; `en-curso` o `pospuesto` como etiqueta;
     cerrado como completado = resuelto; cerrado como «no planificado» = descartado. */

import {
  ESTADOS_SECCION,
  LIMITES,
  PRIORIDADES,
  SECCIONES,
  TIPOS,
  buscarSeccion,
  nombreSeccion,
  type Comentario,
  type ComentarioNuevo,
  type Entrega,
  type EstadoRonda,
  type EstadoSeccionRegistrado,
  type IdEstadoComentario,
  type IdEstadoSeccion,
  type IdPrioridad,
  type IdTipo,
  type Respuesta,
} from '../../data/revision';
import { ErrorGitHub, GitHub, nombresEtiquetas, type Issue } from './github';

export const ETIQUETA_REVISION = 'revision';
export const ETIQUETA_CONTROL = 'revision:ronda';
export const ETIQUETA_ENTREGADA = 'ronda-entregada';
export const ETIQUETA_EN_CURSO = 'en-curso';
export const ETIQUETA_POSPUESTO = 'pospuesto';

export const etiquetaRonda = (ronda: number) => `ronda-${ronda}`;

/** Catálogo completo de etiquetas, con color y descripción. */
export function catalogoEtiquetas(ronda: number) {
  return [
    { name: ETIQUETA_REVISION, color: '0a0a0a', description: 'Comentario del modo revisión del sitio' },
    { name: ETIQUETA_CONTROL, color: '5319e7', description: 'Issue de control de una ronda de revisión' },
    { name: etiquetaRonda(ronda), color: 'fff30b', description: `Ronda ${ronda} de revisión del cliente` },
    { name: ETIQUETA_ENTREGADA, color: '0e8a16', description: 'El cliente entregó su revisión de la ronda' },
    { name: ETIQUETA_EN_CURSO, color: '0075ca', description: 'Comentario en trabajo' },
    { name: ETIQUETA_POSPUESTO, color: 'bfd4f2', description: 'Comentario pospuesto para una etapa posterior' },
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
    'Issue de control de la ronda. Lo actualiza el modo revisión del sitio: registra el veredicto del cliente por sección y la entrega final. Los comentarios puntuales están en issues aparte con la etiqueta `' +
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

/* ── Comentarios ─────────────────────────────────────────────────────── */

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
}

export function validarComentario(entrada: unknown, ronda: number): DatosComentario | string {
  const e = (entrada ?? {}) as Partial<Record<keyof ComentarioNuevo, unknown>>;
  if (e.ronda !== ronda) return 'La ronda del comentario no coincide con la ronda vigente. Recarga la página.';
  if (typeof e.seccion !== 'string' || !buscarSeccion(e.seccion)) return 'Sección desconocida.';
  if (typeof e.tipo !== 'string' || !(e.tipo in TIPOS)) return 'Tipo de comentario no válido.';
  if (typeof e.prioridad !== 'string' || !(e.prioridad in PRIORIDADES)) return 'Prioridad no válida.';
  const comentario = limpiar(e.comentario, LIMITES.comentario);
  if (comentario.length < 3) return 'El comentario está vacío.';
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

export async function crearComentario(gh: GitHub, ronda: number, d: DatosComentario): Promise<Comentario> {
  await asegurarIssueRonda(gh, ronda);
  const seccion = buscarSeccion(d.seccion)!;
  const resumen = unaLinea(d.comentario);
  const titulo = `[R${ronda} · ${seccion.nombre}] ${TIPOS[d.tipo].nombre}: ${
    resumen.length > 72 ? `${resumen.slice(0, 71)}…` : resumen
  }`;

  const cuerpo = [
    `**Sección:** ${nombreSeccion(seccion)}  `,
    `**Tipo:** ${TIPOS[d.tipo].nombre} · **Prioridad:** ${PRIORIDADES[d.prioridad].nombre}  `,
    `**Revisor:** ${md(d.revisor)} · **Dispositivo:** ${md(d.dispositivo) || 'sin dato'}`,
    '',
    '### Comentario',
    '',
    cita(d.comentario),
    ...(d.elemento ? ['', '### Elemento señalado', '', '```text', d.elemento.replace(/```/g, "'''"), '```'] : []),
    '',
    '---',
    `<sub>Ronda ${ronda} · versión ${md(d.version) || 'sin dato'} · ${fechaChile(d.fecha)} · ${md(d.url)}</sub>`,
    '',
    jsonEnComentario('revision-datos', d),
  ].join('\n');

  const etiquetas = [
    ETIQUETA_REVISION,
    etiquetaRonda(ronda),
    `seccion:${d.seccion}`,
    `tipo:${d.tipo}`,
    `prioridad:${d.prioridad}`,
  ];
  const issue = await gh.crearIssue({ title: titulo, body: cuerpo, labels: etiquetas });
  return aComentario(issue)!;
}

function estadoComentario(issue: Issue, etiquetas: string[]): IdEstadoComentario {
  if (issue.state === 'closed') return issue.state_reason === 'not_planned' ? 'descartado' : 'resuelto';
  if (etiquetas.includes(ETIQUETA_POSPUESTO)) return 'pospuesto';
  if (etiquetas.includes(ETIQUETA_EN_CURSO)) return 'en-curso';
  return 'pendiente';
}

/** Convierte un issue de comentario al formato de la interfaz. Tipo y prioridad
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
    comentario: datos?.comentario ?? issue.title,
    revisor: datos?.revisor ?? '',
    elemento: datos?.elemento ?? null,
    fecha: datos?.fecha ?? issue.created_at,
    respuestas: issue.comments,
  };
}

/* ── Consultas y acciones ────────────────────────────────────────────── */

export async function leerEstado(gh: GitHub, ronda: number): Promise<EstadoRonda> {
  const issues = await gh.listarIssues([ETIQUETA_REVISION, etiquetaRonda(ronda)]);
  const control = issues.find((i) => nombresEtiquetas(i).includes(ETIQUETA_CONTROL)) ?? null;
  const datos = control ? datosDeRonda(control) : { secciones: {}, entregada: null };
  return {
    ronda,
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
  if (e['ronda'] !== ronda) return 'La ronda no coincide con la ronda vigente. Recarga la página.';
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
  if (e['ronda'] !== ronda) return 'La ronda no coincide con la ronda vigente. Recarga la página.';
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
    `**Revisión de la ronda ${ronda} entregada** por ${md(revisor)}.` + (entrega.mensaje ? `\n\n${cita(entrega.mensaje)}` : ''),
  );
  return entrega;
}

/** Respuestas (comentarios de GitHub) de un issue de revisión. Solo issues de la ronda. */
export async function leerRespuestas(gh: GitHub, ronda: number, numero: number): Promise<Respuesta[] | null> {
  const issue = await gh.obtenerIssue(numero);
  const etiquetas = nombresEtiquetas(issue);
  const deLaRonda = etiquetas.includes(ETIQUETA_REVISION) && etiquetas.includes(etiquetaRonda(ronda));
  if (!deLaRonda || etiquetas.includes(ETIQUETA_CONTROL)) return null;
  const comentarios = await gh.listarComentarios(numero);
  return comentarios.map((c) => ({
    autor: c.user?.login ?? '',
    fecha: c.created_at,
    texto: (c.body ?? '').replace(/<!--[\s\S]*?-->/g, '').trim(),
  }));
}
