/* Reglas de postulación 2027: sugerencia de equipos, jornada de evaluación,
   monto estimado de ingreso y promociones por habilidades.

   Son funciones puras (sin DOM ni red) para poder probarlas con `npm test` y usarlas
   igual en el navegador (vista previa del resultado) y en el servidor (la API
   recalcula y no confía en lo que envía el navegador).

   Fuentes: informativo 2027 (págs. 13 a 16, 24 a 30) y los flyers de equipos de
   nov 2026. Detalle y decisiones en docs/flujo-postulacion.md. El coach siempre tiene la
   decisión final: aquí solo se sugiere. */

export type ProgramaId = 'recreativo' | 'novice' | 'prep' | 'international';
export type Genero = 'dama' | 'varon' | 'otro';
/** `basica`: ha practicado muy poco y a nivel básico; se evalúa por la vía Novice, igual que «ninguna». */
export type Experiencia = 'ninguna' | 'basica' | 'con';

/** Forma mínima de un equipo del JSON de contenido (docs/contenido/huracan-2027.json). */
export interface EquipoBase {
  nombre: string;
  programa: ProgramaId;
  categoria: string;
  genero: 'mixto' | 'damas';
  edadMin: number;
  /** `null`: sin límite de edad. */
  edadMax: number | null;
  /** Grupo que comienza más adelante (p. ej. «abril de 2027»): no pasa por la evaluación. */
  inicio?: string;
}

/** Montos que salen del contenido oficial (nunca se escriben a mano en la interfaz). */
export interface Precios {
  inscripcion: number;
  /** Valor total de la vestimenta de entrenamiento; se paga en 2 cuotas iguales. */
  vestimentaEntrenamiento: number;
  cinta: number;
  mensualidad: Record<ProgramaId, number>;
  /** Mensualidad de los equipos Open de Novice y Prep. */
  mensualidadOpen: number;
}

/** Forma mínima del contenido para derivar los precios. */
export interface ContenidoPrecios {
  programas: { id: ProgramaId; mensualidad: number; mensualidadOpen?: number }[];
  valores: {
    inscripcion: { monto: number };
    vestimenta: { item: string; monto: number | null }[];
  };
}

export function preciosDesdeContenido(c: ContenidoPrecios): Precios {
  const programa = (id: ProgramaId) => {
    const p = c.programas.find((x) => x.id === id);
    if (!p) throw new Error(`Programa sin mensualidad: ${id}`);
    return p;
  };
  const item = (inicio: string) => {
    const v = c.valores.vestimenta.find((x) => x.item.startsWith(inicio));
    if (!v || v.monto === null) throw new Error(`Valor de vestimenta no disponible: ${inicio}`);
    return v.monto;
  };
  return {
    inscripcion: c.valores.inscripcion.monto,
    vestimentaEntrenamiento: item('Vestimenta de entrenamiento'),
    cinta: item('Cinta de entrenamiento'),
    mensualidad: {
      recreativo: programa('recreativo').mensualidad,
      novice: programa('novice').mensualidad,
      prep: programa('prep').mensualidad,
      international: programa('international').mensualidad,
    },
    mensualidadOpen: programa('novice').mensualidadOpen ?? programa('novice').mensualidad,
  };
}

/* ── Habilidades ────────────────────────────────────────────── */

export type TipoHabilidad = 'individual' | 'grupo' | 'dupla';

export interface Habilidad {
  id: string;
  tipo: TipoHabilidad;
  /** Nivel de gimnasia (individual) o conjunto de elevación (grupo: 3 o 4); 0 para dupla. */
  nivel: 0 | 2 | 3 | 4;
  texto: string;
}

/* Catálogo tomado de los flyers de equipos y de las págs. 29 y 30 del informativo.
   En individuales basta una habilidad; en grupo deben manejarse todas las de su nivel. */
export const HABILIDADES: readonly Habilidad[] = [
  { id: 'n2-flic-una-pierna', tipo: 'individual', nivel: 2, texto: 'Flic flac a una pierna' },
  { id: 'n2-inversion-atras', tipo: 'individual', nivel: 2, texto: 'Inversión atrás' },
  { id: 'n2-inversion-atras-flic', tipo: 'individual', nivel: 2, texto: 'Inversión atrás + flic flac' },
  { id: 'n2-rondat-flic-una-pierna', tipo: 'individual', nivel: 2, texto: 'Rondat + flic flac a una pierna' },
  { id: 'n2-handvault', tipo: 'individual', nivel: 2, texto: 'Handvault' },
  { id: 'n2-inversion-adelante-rondat-flic', tipo: 'individual', nivel: 2, texto: 'Inversión adelante + rondat + flic flac' },

  { id: 'n3-flic-salto-flic', tipo: 'individual', nivel: 3, texto: 'Flic flac + salto + flic flac' },
  { id: 'n3-flic-una-pierna-serie', tipo: 'individual', nivel: 3, texto: 'Flic flac a una pierna / serie de flic flac' },
  { id: 'n3-rondat-flic-mortal-agrupado', tipo: 'individual', nivel: 3, texto: 'Rondat + flic flac + mortal agrupado' },
  { id: 'n3-inversion-rondat-flic-mortal-agrupado', tipo: 'individual', nivel: 3, texto: 'Inversión adelante + rondat + flic flac + mortal agrupado' },

  { id: 'n4-flic-mortal-agrupado', tipo: 'individual', nivel: 4, texto: 'Flic flac + mortal agrupado' },
  { id: 'n4-salto-flic-mortal-agrupado', tipo: 'individual', nivel: 4, texto: 'Salto avanzado + flic flac + mortal agrupado' },
  { id: 'n4-rondat-flic-mortal-extendido', tipo: 'individual', nivel: 4, texto: 'Rondat + flic flac + mortal extendido' },
  { id: 'n4-mortal-adelante-rondat-flic-extendido', tipo: 'individual', nivel: 4, texto: 'Mortal adelante + rondat + flic flac + mortal extendido' },

  { id: 'g3-desmonte-giro', tipo: 'grupo', nivel: 3, texto: 'Desmonte en giro desde extensión' },
  { id: 'g3-switch-up-hell-stretch', tipo: 'grupo', nivel: 3, texto: 'Switch up a hell stretch a nivel de prep' },
  { id: 'g3-tic-toc-cintura', tipo: 'grupo', nivel: 3, texto: 'Tic toc desde nivel de cintura hacia nivel de prep a hell stretch' },

  { id: 'g4-desmonte-doble-giro', tipo: 'grupo', nivel: 4, texto: 'Desmonte en doble giro de extensión y/o desmonte en pateo giro desde nivel prep' },
  { id: 'g4-tic-toc-ascendente', tipo: 'grupo', nivel: 4, texto: 'Tic toc ascendente desde nivel prep hacia extensión a hell stretch' },
  { id: 'g4-tic-toc-descendente', tipo: 'grupo', nivel: 4, texto: 'Tic toc descendente desde extensión a nivel prep, de hell stretch a hell stretch' },

  { id: 'd-walk-in-toss-prep', tipo: 'dupla', nivel: 0, texto: 'Walk in o toss prep / extensión a un pie' },
  { id: 'd-walk-in-toss-extension', tipo: 'dupla', nivel: 0, texto: 'Walk in o toss a extensión a un pie' },
];

export interface NivelAlcanzado {
  /** Mayor nivel de gimnasia individual declarado (0 si ninguno). */
  gimnasia: 0 | 2 | 3 | 4;
  /** Conjunto de elevación completo declarado (0 si ninguno). */
  grupo: 0 | 3 | 4;
  dupla: boolean;
}

export function nivelAlcanzado(ids: readonly string[]): NivelAlcanzado {
  const declaradas = new Set(ids);
  const delTipo = (tipo: TipoHabilidad) => HABILIDADES.filter((h) => h.tipo === tipo);

  let gimnasia: NivelAlcanzado['gimnasia'] = 0;
  for (const h of delTipo('individual')) {
    if (declaradas.has(h.id) && h.nivel > gimnasia) gimnasia = h.nivel as NivelAlcanzado['gimnasia'];
  }

  const completo = (nivel: 3 | 4) => {
    const lista = delTipo('grupo').filter((h) => h.nivel === nivel);
    return lista.length > 0 && lista.every((h) => declaradas.has(h.id));
  };
  const grupo: NivelAlcanzado['grupo'] = completo(4) ? 4 : completo(3) ? 3 : 0;
  const dupla = delTipo('dupla').some((h) => declaradas.has(h.id));

  return { gimnasia, grupo, dupla };
}

/* ── Promociones por habilidades (flyers de nov 2026) ───────── */

export interface PromoHabilidades {
  equipo: string;
  nombre: string;
  /** Mensualidad con la promoción, todo el año. */
  mensualidad: number;
  /** Solo para atletas externos al club (flyers de Super Mafia y Titanium Black). */
  soloExternos: boolean;
  califica: (n: NivelAlcanzado) => boolean;
}

export const PROMOS_HABILIDADES: readonly PromoHabilidades[] = [
  { equipo: 'Huracán Super Mafia', nombre: 'Junior coed prep 2.2', mensualidad: 25000, soloExternos: true, califica: (n) => n.gimnasia >= 2 },
  { equipo: 'Huracán Titanium Black', nombre: 'Senior coed prep 2.2', mensualidad: 25000, soloExternos: true, califica: (n) => n.gimnasia >= 2 },
  { equipo: 'Huracán Lady Jags', nombre: 'Open prep 3.2', mensualidad: 25000, soloExternos: false, califica: (n) => n.gimnasia >= 2 || n.grupo >= 3 },
  { equipo: 'Huracán Velocity Lightning', nombre: 'International Open Coed 3', mensualidad: 25000, soloExternos: false, califica: (n) => n.gimnasia >= 3 || n.grupo >= 3 },
  { equipo: 'Huracán Five Elite', nombre: 'International Open Coed 4', mensualidad: 0, soloExternos: false, califica: (n) => n.gimnasia >= 4 || n.grupo >= 4 || n.dupla },
];

/* ── Entrada y resultado ────────────────────────────────────── */

export interface Postulante {
  /** Edad que cumple durante 2027. */
  edad: number;
  genero: Genero;
  experiencia: Experiencia;
  /** Si la persona ya eligió una modalidad; sin valor, el sistema la deduce. */
  modalidad?: ProgramaId;
  /** Ids de `HABILIDADES` declaradas. */
  habilidades?: readonly string[];
  /** Atleta antiguo de Huracán (afecta las promociones «solo externos»). */
  esAntiguo?: boolean;
}

export const ANIO_TEMPORADA = 2027;

export function edadEnTemporada(fechaNacimiento: string, anio: number = ANIO_TEMPORADA): number {
  const nacimiento = Number.parseInt(fechaNacimiento.slice(0, 4), 10);
  if (!Number.isFinite(nacimiento)) throw new Error(`Fecha de nacimiento inválida: ${fechaNacimiento}`);
  return anio - nacimiento;
}

const ORDEN_PROGRAMA: Record<ProgramaId, number> = { recreativo: 0, novice: 1, prep: 2, international: 3 };
const EDAD_MAX_TINY = 6;

/** Sin experiencia, o con experiencia muy básica: sigue la vía Novice. */
function esNovice(p: Postulante): boolean {
  return p.experiencia === 'ninguna' || p.experiencia === 'basica';
}

function cabeEnEdad(e: EquipoBase, edad: number): boolean {
  return edad >= e.edadMin && (e.edadMax === null || edad <= e.edadMax);
}

function esOpen(e: EquipoBase): boolean {
  return /\bopen\b/i.test(e.categoria);
}

/** Programas que se consideran para el postulante, en orden de preferencia. */
function programasCandidatos(p: Postulante, nivel: NivelAlcanzado): ProgramaId[] {
  if (p.modalidad) return [p.modalidad];
  if (p.edad <= EDAD_MAX_TINY) return ['recreativo', 'novice'];
  if (esNovice(p)) return ['novice'];
  const calificaInternational = p.edad >= 15 && (nivel.gimnasia >= 3 || nivel.grupo >= 3 || nivel.dupla);
  return calificaInternational ? ['prep', 'international'] : ['prep'];
}

/** Cuando la modalidad se deduce, los equipos International piden el nivel de su categoría
    (Open Coed 3: nivel 3; Open Coed 4: nivel 4, grupo completo o dupla). */
function cumpleNivelInternational(nombre: string, n: NivelAlcanzado): boolean {
  if (nombre === 'Huracán Velocity Lightning') return n.gimnasia >= 3 || n.grupo >= 3;
  if (nombre === 'Huracán Five Elite') return n.gimnasia >= 4 || n.grupo >= 4 || n.dupla;
  return true;
}

export function sugerirEquipos(equipos: readonly EquipoBase[], p: Postulante): EquipoBase[] {
  const nivel = nivelAlcanzado(p.habilidades ?? []);
  const programas = programasCandidatos(p, nivel);
  const resultado = filtrarEquipos(equipos, p, nivel, programas);
  /* Con experiencia pero sin equipo Prep para su edad (por ejemplo, 7 años): se sugiere Novice. */
  if (resultado.length === 0 && !p.modalidad && !programas.includes('novice')) {
    return filtrarEquipos(equipos, p, nivel, ['novice']);
  }
  return resultado;
}

function filtrarEquipos(equipos: readonly EquipoBase[], p: Postulante, nivel: NivelAlcanzado, programas: readonly ProgramaId[]): EquipoBase[] {
  return equipos
    .filter((e) => programas.includes(e.programa))
    .filter((e) => cabeEnEdad(e, p.edad))
    .filter((e) => p.modalidad === 'international' || e.programa !== 'international' || cumpleNivelInternational(e.nombre, nivel))
    .filter((e) => e.genero === 'mixto' || p.genero === 'dama')
    /* Team Parent es solo para apoderados y parientes: no se sugiere a menores. */
    .filter((e) => e.nombre !== 'Huracán Team Parent' || p.edad >= 18)
    .sort(
      (a, b) =>
        ORDEN_PROGRAMA[a.programa] - ORDEN_PROGRAMA[b.programa] ||
        (a.edadMax ?? 99) - (a.edadMin) - ((b.edadMax ?? 99) - b.edadMin),
    );
}

/* ── Jornadas de evaluación ─────────────────────────────────── */

export type GrupoJornada = 'youth-junior-senior-prep' | 'open' | 'sin-experiencia-7-19';

export interface Jornada {
  id: string;
  /** AAAA-MM-DD. */
  fecha: string;
  dia: string;
  inicio: string;
  fin: string;
  grupo: GrupoJornada;
  /** `null` mientras el club no defina cupos. */
  cupos: number | null;
}

/* Jornadas de la primera semana (flyer «Días de postulación»). Las siguientes las crea el
   club desde el CRM; esta lista es la semilla de la tabla `evaluacion_jornadas`. */
export const JORNADAS_INICIALES: readonly Jornada[] = [
  { id: '2026-12-04-1800', fecha: '2026-12-04', dia: 'Viernes 4 de diciembre', inicio: '18:00', fin: '20:00', grupo: 'youth-junior-senior-prep', cupos: null },
  { id: '2026-12-04-2000', fecha: '2026-12-04', dia: 'Viernes 4 de diciembre', inicio: '20:00', fin: '22:00', grupo: 'open', cupos: null },
  { id: '2026-12-05-1000', fecha: '2026-12-05', dia: 'Sábado 5 de diciembre', inicio: '10:00', fin: '12:00', grupo: 'youth-junior-senior-prep', cupos: null },
  { id: '2026-12-05-1200', fecha: '2026-12-05', dia: 'Sábado 5 de diciembre', inicio: '12:00', fin: '14:00', grupo: 'sin-experiencia-7-19', cupos: null },
  { id: '2026-12-05-1400', fecha: '2026-12-05', dia: 'Sábado 5 de diciembre', inicio: '14:00', fin: '16:00', grupo: 'open', cupos: null },
];

export type ResultadoJornada =
  /** Los Tiny pasan directo a su primera práctica. */
  | { tipo: 'sin-evaluacion'; motivo: 'tiny' | 'sin-equipo' }
  /** Grupos que comienzan más adelante (Spirit en abril, Team Parent en enero): sin jornada. */
  | { tipo: 'inicio-diferido'; inicios: { equipo: string; inicio: string }[] }
  | { tipo: 'jornadas'; grupos: GrupoJornada[] };

/** Edad hasta la que aplica la jornada «sin experiencia» del sábado. */

export function resolverJornada(p: Postulante, sugeridos: readonly EquipoBase[]): ResultadoJornada {
  /* Sin equipo sugerido no hay jornada que elegir: la preinscripción se guarda y el head coach orienta. */
  if (sugeridos.length === 0) return { tipo: 'sin-evaluacion', motivo: 'sin-equipo' };
  if (p.edad <= EDAD_MAX_TINY) return { tipo: 'sin-evaluacion', motivo: 'tiny' };
  if (sugeridos.length > 0 && sugeridos.every((e) => e.inicio !== undefined)) {
    return { tipo: 'inicio-diferido', inicios: sugeridos.map((e) => ({ equipo: e.nombre, inicio: e.inicio ?? '' })) };
  }
  if (esNovice(p) || (sugeridos.length > 0 && sugeridos.every((e) => e.programa === 'novice'))) {
    /* El club confirmó (25 nov 2026) que los mayores de 19 sin experiencia también van a la
       evaluación Novice del sábado, es decir, la jornada de atletas sin experiencia. */
    return { tipo: 'jornadas', grupos: ['sin-experiencia-7-19'] };
  }
  const grupos = new Set<GrupoJornada>();
  for (const e of sugeridos) grupos.add(esOpen(e) || e.programa === 'international' ? 'open' : 'youth-junior-senior-prep');
  if (grupos.size === 0) grupos.add(p.edad >= 20 ? 'open' : 'youth-junior-senior-prep');
  return { tipo: 'jornadas', grupos: [...grupos] };
}

export function jornadasDelGrupo(jornadas: readonly Jornada[], grupos: readonly GrupoJornada[]): Jornada[] {
  return jornadas.filter((j) => grupos.includes(j.grupo));
}

/* ── Monto de ingreso ───────────────────────────────────────── */

export interface Ingreso {
  equipo: string;
  programa: ProgramaId;
  inscripcion: number;
  /** Mensualidad estándar del programa (sin promociones). */
  mensualidad: number;
  /** Primera de dos cuotas de la vestimenta de entrenamiento. */
  ropaPrimeraCuota: number;
  /** Cinta del cabello (solo damas). */
  cinta: number;
  /** Lo que se transfiere para ingresar. En Recreativo la mensualidad se paga en efectivo. */
  total: number;
  /** Recreativo: la mensualidad se paga en efectivo al head coach en la primera clase. */
  mensualidadEnEfectivo: boolean;
  /** Mensualidad con una promoción por habilidades, si corresponde. La valida el coach. */
  promo: { nombre: string; mensualidad: number } | null;
}

export function calcularIngreso(precios: Precios, equipo: EquipoBase, p: Postulante): Ingreso {
  const mensualidad =
    equipo.programa === 'novice' || equipo.programa === 'prep'
      ? esOpen(equipo)
        ? precios.mensualidadOpen
        : precios.mensualidad[equipo.programa]
      : precios.mensualidad[equipo.programa];

  const enEfectivo = equipo.programa === 'recreativo';
  const ropaPrimeraCuota = Math.round(precios.vestimentaEntrenamiento / 2);
  const cinta = p.genero === 'dama' ? precios.cinta : 0;

  const nivel = nivelAlcanzado(p.habilidades ?? []);
  const regla = PROMOS_HABILIDADES.find((r) => r.equipo === equipo.nombre);
  const aplicaPromo = regla !== undefined && regla.califica(nivel) && !(regla.soloExternos && p.esAntiguo === true);

  return {
    equipo: equipo.nombre,
    programa: equipo.programa,
    inscripcion: precios.inscripcion,
    mensualidad,
    ropaPrimeraCuota,
    cinta,
    total: precios.inscripcion + (enEfectivo ? 0 : mensualidad) + ropaPrimeraCuota + cinta,
    mensualidadEnEfectivo: enEfectivo,
    promo: aplicaPromo && regla ? { nombre: regla.nombre, mensualidad: regla.mensualidad } : null,
  };
}

/* ── Resultado completo ─────────────────────────────────────── */

export interface Evaluacion {
  edad: number;
  equipos: EquipoBase[];
  jornada: ResultadoJornada;
  ingresos: Ingreso[];
  /** Monto estimado que se muestra: el mayor entre los equipos sugeridos, para no subestimar. */
  ingresoEstimado: Ingreso | null;
}

export function evaluarPostulacion(equipos: readonly EquipoBase[], precios: Precios, p: Postulante): Evaluacion {
  const sugeridos = sugerirEquipos(equipos, p);
  const ingresos = sugeridos.map((e) => calcularIngreso(precios, e, p));
  const ingresoEstimado = ingresos.reduce<Ingreso | null>((mayor, i) => (mayor === null || i.total > mayor.total ? i : mayor), null);
  return { edad: p.edad, equipos: sugeridos, jornada: resolverJornada(p, sugeridos), ingresos, ingresoEstimado };
}

export function formatoPeso(monto: number): string {
  return `$${monto.toLocaleString('es-CL')}`;
}

/**
 * Conceptos que pagan por transferencia los grupos de inicio diferido (confirmado por el club,
 * 25 nov 2026): Spirit paga inscripción y vestimenta; Team Parent, solo vestimenta. Los valores
 * se informarán más adelante.
 */
export function conceptosInicioDiferido(equipos: { nombre: string }[]): string {
  const incluyeSpirit = equipos.some((e) => e.nombre === 'Huracán Spirit');
  return incluyeSpirit ? 'inscripción y vestimenta de entrenamiento' : 'vestimenta de entrenamiento';
}
