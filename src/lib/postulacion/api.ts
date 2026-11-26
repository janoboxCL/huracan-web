/* Capa de acceso de la postulación. La interfaz solo llama a estas funciones.

   Dos modos, según `PUBLIC_API_POSTULACION`:
   - `activa`: usa la API real (`/api/postulaciones` y `/api/jornadas`, ver functions/api/).
   - cualquier otro valor (por defecto): modo maqueta. Simula el envío en el navegador, sin
     guardar nada ni enviar correo, y usa `JORNADAS_INICIALES` como jornadas.
   Las funciones nunca lanzan al enviar: devuelven un resultado tipado para que la interfaz
   muestre un mensaje claro y no pierda lo escrito. */

import { comunaEfectiva, esMenorDeEdad, generarCodigo, type DatosPostulacion } from './formulario.ts';
import { JORNADAS_INICIALES, type GrupoJornada } from './reglas.ts';

/* ── Modo ───────────────────────────────────────────────────── */

export function modoApiActivo(): boolean {
  return import.meta.env?.PUBLIC_API_POSTULACION === 'activa';
}

export interface Dependencias {
  /** Fuerza el modo (para pruebas). Sin valor, se lee de la variable de entorno. */
  activa?: boolean;
  fetch?: typeof fetch;
}

/* ── Cuerpo del POST ────────────────────────────────────────── */

export interface CuerpoPostulacion {
  atletaNombre: string;
  atletaApellido: string;
  fechaNacimiento: string;
  sexo: 'dama' | 'varon' | 'otro' | '';
  comuna: string;
  esAntiguo: boolean;
  experiencia: 'ninguna' | 'basica' | 'con' | '';
  clubAnterior: string;
  aniosExperiencia: number | null;
  posicion: string;
  habilidades: string[];
  /** Vacío = que el sistema lo sugiera. */
  modalidad: string;
  equipoInteres: string;
  tipoPostulacion: 'individual' | 'dupla' | 'grupo';
  promociones: string[];
  contactoNombre: string;
  contactoParentesco: 'madre' | 'padre' | 'tutor' | 'otro' | 'propio';
  contactoTelefono: string;
  contactoCorreo: string;
  /** Solo si la evaluación es en una jornada; `null` en los demás casos. */
  jornadaId: string | null;
  /** Solo cuando la evaluación es en el horario habitual: el equipo elegido; `null` en los demás casos. */
  equipoEvaluacion: string | null;
  sitioWeb: string;
}

const TIPO_POR_FORMA: Record<DatosPostulacion['forma'], CuerpoPostulacion['tipoPostulacion']> = {
  individual: 'individual',
  'dupla-coed': 'dupla',
  'grupo-elevacion': 'grupo',
};

export function armarCuerpo(d: DatosPostulacion, jornadaId: string | null, equipoEvaluacion: string | null = null): CuerpoPostulacion {
  const con = d.experiencia === 'con';
  const menor = esMenorDeEdad(d.fechaNacimiento);
  const nombreCompleto = `${d.nombre.trim()} ${d.apellido.trim()}`.trim();
  return {
    atletaNombre: d.nombre.trim(),
    atletaApellido: d.apellido.trim(),
    fechaNacimiento: d.fechaNacimiento,
    sexo: d.sexo,
    comuna: comunaEfectiva(d),
    esAntiguo: d.esAntiguo === 'si',
    experiencia: d.experiencia,
    clubAnterior: con ? d.clubAnterior.trim() : '',
    aniosExperiencia: con && d.aniosExperiencia.trim() !== '' ? Number(d.aniosExperiencia) : null,
    posicion: con ? d.posicion : '',
    habilidades: con ? d.habilidades : [],
    modalidad: d.modalidad === 'auto' ? '' : d.modalidad,
    equipoInteres: d.equipoInteres,
    tipoPostulacion: TIPO_POR_FORMA[d.forma],
    promociones: d.promociones,
    contactoNombre: menor ? d.contactoNombre.trim() : nombreCompleto,
    contactoParentesco: menor && d.parentesco !== '' ? d.parentesco : 'propio',
    contactoTelefono: d.telefono.trim(),
    contactoCorreo: d.correo.trim(),
    jornadaId,
    equipoEvaluacion,
    sitioWeb: d.sitioWeb,
  };
}

/** Campo de la API → campo del formulario (para marcar el error junto al campo). */
export const CAMPO_API_A_FORMULARIO: Record<string, keyof DatosPostulacion> = {
  atletaNombre: 'nombre',
  atletaApellido: 'apellido',
  fechaNacimiento: 'fechaNacimiento',
  sexo: 'sexo',
  comuna: 'comuna',
  experiencia: 'experiencia',
  clubAnterior: 'clubAnterior',
  aniosExperiencia: 'aniosExperiencia',
  contactoNombre: 'contactoNombre',
  contactoParentesco: 'parentesco',
  contactoTelefono: 'telefono',
  contactoCorreo: 'correo',
  habilidades: 'habilidades',
  promociones: 'promociones',
  modalidad: 'modalidad',
};

/* ── Envío ──────────────────────────────────────────────────── */

export type ErrorEnvio = 'jornada_sin_cupo' | 'jornada_no_disponible' | 'sin_equipo_sugerido' | 'servidor' | 'red';

export type ResultadoEnvio =
  | {
      ok: true;
      codigo: string;
      /** `null` en modo maqueta (no se envía correo). */
      correoEnviado: boolean | null;
      ingresoEstimado: number | null;
      simulada: boolean;
    }
  | { ok: false; error: 'datos_invalidos'; campos: string[] }
  | { ok: false; error: ErrorEnvio };

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Traduce la respuesta HTTP de `POST /api/postulaciones` a un resultado tipado. */
export function interpretarRespuesta(estado: number, cuerpo: unknown): ResultadoEnvio {
  const c = esObjeto(cuerpo) ? cuerpo : {};
  if (estado === 201) {
    if (typeof c['codigo'] !== 'string') return { ok: false, error: 'servidor' };
    return {
      ok: true,
      codigo: c['codigo'],
      correoEnviado: c['correoEnviado'] === true,
      ingresoEstimado: typeof c['ingresoEstimado'] === 'number' ? c['ingresoEstimado'] : null,
      simulada: false,
    };
  }
  if (estado === 400 && c['error'] === 'datos_invalidos') {
    const campos = Array.isArray(c['campos']) ? c['campos'].filter((x): x is string => typeof x === 'string') : [];
    return { ok: false, error: 'datos_invalidos', campos };
  }
  if (estado === 409) {
    return { ok: false, error: c['error'] === 'jornada_sin_cupo' ? 'jornada_sin_cupo' : 'jornada_no_disponible' };
  }
  if (estado === 422) return { ok: false, error: 'sin_equipo_sugerido' };
  return { ok: false, error: 'servidor' };
}

/** Crea la postulación (una sola vez, con la jornada ya elegida). Nunca lanza. */
export async function enviarPostulacion(datos: DatosPostulacion, jornadaId: string | null, deps: Dependencias = {}, equipoEvaluacion: string | null = null): Promise<ResultadoEnvio> {
  if (!(deps.activa ?? modoApiActivo())) {
    return { ok: true, codigo: generarCodigo(), correoEnviado: null, ingresoEstimado: null, simulada: true };
  }
  const llamar = deps.fetch ?? globalThis.fetch.bind(globalThis);
  let respuesta: Response;
  try {
    respuesta = await llamar('/api/postulaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(armarCuerpo(datos, jornadaId, equipoEvaluacion)),
    });
  } catch {
    return { ok: false, error: 'red' };
  }
  let cuerpo: unknown = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    /* respuesta sin JSON: se interpreta solo por el estado */
  }
  return interpretarRespuesta(respuesta.status, cuerpo);
}

/* ── Jornadas ───────────────────────────────────────────────── */

export interface JornadaCupo {
  id: string;
  /** AAAA-MM-DD. */
  fecha: string;
  inicio: string;
  fin: string;
  grupo: GrupoJornada;
  cupos: number | null;
  /** Cupos restantes; `null` = sin límite. */
  disponibles: number | null;
}

function jornadaValida(v: unknown): v is JornadaCupo {
  return (
    esObjeto(v) &&
    typeof v['id'] === 'string' &&
    typeof v['fecha'] === 'string' &&
    typeof v['inicio'] === 'string' &&
    typeof v['fin'] === 'string' &&
    typeof v['grupo'] === 'string' &&
    (v['disponibles'] === null || typeof v['disponibles'] === 'number')
  );
}

/** Jornadas abiertas con su cupo. En modo maqueta usa `JORNADAS_INICIALES` sin límite de cupo.
    En modo API lanza si no se pueden leer (la interfaz ofrece WhatsApp como alternativa). */
export async function cargarJornadas(deps: Dependencias = {}): Promise<JornadaCupo[]> {
  if (!(deps.activa ?? modoApiActivo())) {
    return JORNADAS_INICIALES.map((j) => ({ id: j.id, fecha: j.fecha, inicio: j.inicio, fin: j.fin, grupo: j.grupo, cupos: j.cupos, disponibles: null }));
  }
  const llamar = deps.fetch ?? globalThis.fetch.bind(globalThis);
  const respuesta = await llamar('/api/jornadas');
  if (!respuesta.ok) throw new Error(`jornadas: ${respuesta.status}`);
  const datos: unknown = await respuesta.json();
  if (!Array.isArray(datos) || !datos.every(jornadaValida)) throw new Error('jornadas: respuesta inesperada');
  return datos;
}
