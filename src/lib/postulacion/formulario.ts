/* Lógica del formulario de preinscripción sin DOM ni red: validaciones en español,
   formato de teléfono chileno, mayoría de edad, código de postulación y mensaje de WhatsApp.
   Se prueba con `npm test` y la usa la isla `src/components/postula/postula.ts`. */

import { edadEnTemporada } from './reglas.ts';

/** Fecha de la primera jornada de evaluación: referencia para saber si hay que pedir apoderado. */
export const FECHA_EVALUACION = '2026-12-05';
export const EDAD_MAYORIA = 18;

/* ── Fechas ─────────────────────────────────────────────────── */

export interface FechaPartes {
  anio: number;
  mes: number;
  dia: number;
}

/** Lee `AAAA-MM-DD` y comprueba que sea un día real del calendario. */
export function leerFecha(valor: string): FechaPartes | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim());
  if (!m) return null;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  if (f.getUTCFullYear() !== anio || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== dia) return null;
  return { anio, mes, dia };
}

/** Edad cumplida en una fecha de referencia (`AAAA-MM-DD`). */
export function edadAl(fechaNacimiento: string, referencia: string = FECHA_EVALUACION): number | null {
  const n = leerFecha(fechaNacimiento);
  const r = leerFecha(referencia);
  if (!n || !r) return null;
  let edad = r.anio - n.anio;
  if (r.mes < n.mes || (r.mes === n.mes && r.dia < n.dia)) edad -= 1;
  return edad;
}

/** Menor de 18 en la fecha de evaluación: debe inscribirla un apoderado. */
export function esMenorDeEdad(fechaNacimiento: string): boolean {
  const edad = edadAl(fechaNacimiento);
  return edad !== null && edad < EDAD_MAYORIA;
}

/** Edad que cumple en 2027, o `null` si la fecha no es válida. */
export function edadTemporada(fechaNacimiento: string): number | null {
  return leerFecha(fechaNacimiento) ? edadEnTemporada(fechaNacimiento) : null;
}

/* ── Teléfono chileno ───────────────────────────────────────── */

/** Devuelve los 9 dígitos del celular (sin 56) o `null` si no cumple el formato. */
export function normalizarCelular(texto: string): string | null {
  let d = texto.replace(/\D/g, '');
  if (d.startsWith('56') && d.length === 11) d = d.slice(2);
  return /^9\d{8}$/.test(d) ? d : null;
}

/** `912345678` → `+56 9 1234 5678`. */
export function formatoCelular(nueve: string): string {
  return `+56 ${nueve[0]} ${nueve.slice(1, 5)} ${nueve.slice(5)}`;
}

export function correoValido(texto: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(texto.trim());
}

/* ── Datos del formulario ───────────────────────────────────── */

export type Parentesco = 'madre' | 'padre' | 'tutor' | 'otro';
export type Posicion = '' | 'flyer' | 'base-principal' | 'base-secundaria' | 'backspot';
export type FormaPostulacion = 'individual' | 'dupla-coed' | 'grupo-elevacion';
export type ModalidadElegida = 'auto' | 'recreativo' | 'novice' | 'prep' | 'international';

export const ETIQUETAS_PARENTESCO: Record<Parentesco, string> = {
  madre: 'Madre',
  padre: 'Padre',
  tutor: 'Tutor/a',
  otro: 'Otro',
};
export const ETIQUETAS_POSICION: Record<Exclude<Posicion, ''>, string> = {
  flyer: 'Flyer',
  'base-principal': 'Base principal',
  'base-secundaria': 'Base secundaria',
  backspot: 'Backspot',
};
export const ETIQUETAS_FORMA: Record<FormaPostulacion, string> = {
  individual: 'Individualmente',
  'dupla-coed': 'Con dupla coed',
  'grupo-elevacion': 'Con grupo de elevación',
};

export const PROMOCIONES_DECLARABLES = ['hermanos', 'otra-region', 'varones-externos', 'familiar'] as const;
export type PromocionId = (typeof PROMOCIONES_DECLARABLES)[number];

export interface DatosPostulacion {
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
  sexo: '' | 'dama' | 'varon';
  comuna: string;
  esAntiguo: '' | 'si' | 'no';
  experiencia: '' | 'ninguna' | 'con';
  clubAnterior: string;
  aniosExperiencia: string;
  posicion: Posicion;
  habilidades: string[];
  modalidad: ModalidadElegida;
  equipoInteres: string;
  forma: FormaPostulacion;
  promociones: PromocionId[];
  contactoNombre: string;
  parentesco: '' | Parentesco;
  telefono: string;
  correo: string;
  /** Trampa para bots: campo oculto que una persona nunca llena. Debe ir vacío. */
  sitioWeb: string;
}

export function datosVacios(): DatosPostulacion {
  return {
    nombre: '',
    apellido: '',
    fechaNacimiento: '',
    sexo: '',
    comuna: '',
    esAntiguo: '',
    experiencia: '',
    clubAnterior: '',
    aniosExperiencia: '',
    posicion: '',
    habilidades: [],
    modalidad: 'auto',
    equipoInteres: '',
    forma: 'individual',
    promociones: [],
    contactoNombre: '',
    parentesco: '',
    telefono: '',
    correo: '',
    sitioWeb: '',
  };
}

export type Errores = Partial<Record<keyof DatosPostulacion, string>>;

const MIN_NACIMIENTO = '1930-01-01';

/** Valida un campo. `hoy` es `AAAA-MM-DD` (se inyecta para poder probarlo). */
export function validarCampo(campo: keyof DatosPostulacion, d: DatosPostulacion, hoy: string): string | null {
  const vacio = (t: string) => t.trim().length === 0;
  switch (campo) {
    case 'nombre':
      return vacio(d.nombre) ? 'Escribe el nombre de la deportista.' : null;
    case 'apellido':
      return vacio(d.apellido) ? 'Escribe el apellido de la deportista.' : null;
    case 'fechaNacimiento': {
      if (vacio(d.fechaNacimiento)) return 'Indica la fecha de nacimiento.';
      if (!leerFecha(d.fechaNacimiento)) return 'La fecha no es válida. Usa el formato día/mes/año.';
      if (d.fechaNacimiento > hoy) return 'La fecha de nacimiento no puede ser futura.';
      if (d.fechaNacimiento < MIN_NACIMIENTO) return 'Revisa el año de nacimiento.';
      return null;
    }
    case 'sexo':
      return d.sexo === '' ? 'Selecciona una opción.' : null;
    case 'comuna':
      return vacio(d.comuna) ? 'Indica la comuna.' : null;
    case 'esAntiguo':
      return d.esAntiguo === '' ? 'Indica si es atleta antigua o antiguo de Huracán.' : null;
    case 'experiencia':
      return d.experiencia === '' ? 'Indica si ha practicado cheerleading.' : null;
    case 'clubAnterior':
      return d.experiencia === 'con' && vacio(d.clubAnterior) ? 'Escribe el club donde practicó.' : null;
    case 'aniosExperiencia': {
      if (d.experiencia !== 'con') return null;
      if (vacio(d.aniosExperiencia)) return 'Indica los años de experiencia.';
      if (!/^\d{1,2}$/.test(d.aniosExperiencia.trim()) || Number(d.aniosExperiencia) > 40) return 'Escribe un número entero de años, entre 0 y 40.';
      return null;
    }
    case 'contactoNombre':
      if (!esMenorDeEdad(d.fechaNacimiento)) return null;
      return vacio(d.contactoNombre) ? 'Escribe el nombre completo del apoderado.' : null;
    case 'parentesco':
      if (!esMenorDeEdad(d.fechaNacimiento)) return null;
      return d.parentesco === '' ? 'Selecciona el parentesco.' : null;
    case 'telefono':
      if (vacio(d.telefono)) return 'Escribe un celular de contacto.';
      return normalizarCelular(d.telefono)
        ? null
        : 'El celular debe tener 9 dígitos y partir con 9. Ejemplo: +56 9 1234 5678.';
    case 'correo':
      if (vacio(d.correo)) return 'Escribe un correo de contacto.';
      return correoValido(d.correo) ? null : 'El correo no parece válido. Ejemplo: nombre@correo.cl.';
    default:
      return null;
  }
}

export const CAMPOS_VALIDABLES: (keyof DatosPostulacion)[] = [
  'nombre',
  'apellido',
  'fechaNacimiento',
  'sexo',
  'comuna',
  'esAntiguo',
  'experiencia',
  'clubAnterior',
  'aniosExperiencia',
  'contactoNombre',
  'parentesco',
  'telefono',
  'correo',
];

export function validarTodo(d: DatosPostulacion, hoy: string): Errores {
  const errores: Errores = {};
  for (const campo of CAMPOS_VALIDABLES) {
    const e = validarCampo(campo, d, hoy);
    if (e) errores[campo] = e;
  }
  return errores;
}

/* ── Código de postulación ──────────────────────────────────── */

/** Sin 0, O, 1 ni I para que se pueda dictar o leer sin confusiones. */
export const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generarCodigo(aleatorio: (n: number) => number[] = bytesAleatorios): string {
  const bytes = aleatorio(6);
  let c = '';
  for (const b of bytes) c += ALFABETO_CODIGO[b % ALFABETO_CODIGO.length];
  return `HUR-${c}`;
}

function bytesAleatorios(n: number): number[] {
  const a = new Uint8Array(n);
  globalThis.crypto.getRandomValues(a);
  return [...a];
}

/* ── Mensaje de WhatsApp ────────────────────────────────────── */

export interface DatosMensaje {
  atleta: string;
  codigo: string;
  /** Texto de la jornada elegida o, en los grupos de inicio diferido, de cuándo comienzan. */
  jornada: string;
  equipos: string[];
  /** Quien escribe: apoderado o la propia deportista. */
  contacto: string;
  /** Grupos que comienzan más adelante (Spirit, Team Parent): no hay comprobante ni jornada. */
  inicioDiferido?: boolean;
}

export function mensajeWhatsapp(m: DatosMensaje): string {
  const equipos = m.equipos.length > 0 ? m.equipos.join(', ') : 'por definir con el coach';
  if (m.inicioDiferido) {
    return [`Hola, soy ${m.contacto}.`, `Preinscribí a ${m.atleta} (código ${m.codigo}).`, `Equipos sugeridos: ${equipos}.`, `Inicio: ${m.jornada}.`].join('\n');
  }
  return [
    `Hola, soy ${m.contacto}.`,
    `Envío el comprobante de pago de la postulación ${m.codigo} de ${m.atleta}.`,
    `Jornada: ${m.jornada}.`,
    `Equipos sugeridos: ${equipos}.`,
  ].join('\n');
}

export function enlaceWhatsappCon(telefonoSinMas: string, mensaje: string): string {
  return `https://wa.me/${telefonoSinMas}?text=${encodeURIComponent(mensaje)}`;
}

/** Mensaje cuando la familia no pudo completar la preinscripción en el sitio. */
export function mensajeWhatsappSinCodigo(m: { atleta: string; contacto: string }): string {
  return [`Hola, soy ${m.contacto}.`, `Quise preinscribir a ${m.atleta} desde el sitio y no pude completar el proceso. ¿Me ayudas a coordinarlo?`].join('\n');
}

/* ── Texto de jornadas ──────────────────────────────────────── */

/** `2026-12-04` → `Viernes 4 de diciembre` (para jornadas que no están en la lista inicial). */
export function textoDiaJornada(fecha: string): string {
  const f = leerFecha(fecha);
  if (!f) return fecha;
  const texto = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(f.anio, f.mes - 1, f.dia)))
    .replace(',', '');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
