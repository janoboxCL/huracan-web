/* Validación de lo que envía el navegador. El servidor no confía en nada: normaliza,
   acota largos y descarta lo que no reconoce. Los montos, equipos y jornadas NO se leen
   del cuerpo: se recalculan con las reglas (src/lib/postulacion/reglas.ts). */
import { HABILIDADES, type Experiencia, type Genero, type ProgramaId } from '../postulacion/reglas.ts';

export const PROMOCIONES_DECLARABLES = ['hermanos', 'otra-region', 'varones-externos', 'familiar'] as const;
const POSICIONES = ['flyer', 'base-principal', 'base-secundaria', 'backspot'] as const;
const PARENTESCOS = ['madre', 'padre', 'tutor', 'otro', 'propio'] as const;
const MODALIDADES: readonly ProgramaId[] = ['recreativo', 'novice', 'prep', 'international'];
const TIPOS_POSTULACION = ['individual', 'dupla', 'grupo'] as const;

export interface DatosPostulacion {
  atletaNombre: string;
  atletaApellido: string;
  /** AAAA-MM-DD. */
  fechaNacimiento: string;
  sexo: Genero;
  comuna: string;
  esAntiguo: boolean;
  experiencia: Experiencia;
  clubAnterior: string | null;
  aniosExperiencia: number | null;
  posicion: (typeof POSICIONES)[number] | null;
  habilidades: string[];
  modalidad: ProgramaId | null;
  equipoInteres: string | null;
  tipoPostulacion: (typeof TIPOS_POSTULACION)[number];
  promociones: (typeof PROMOCIONES_DECLARABLES)[number][];
  contactoNombre: string;
  contactoParentesco: (typeof PARENTESCOS)[number] | null;
  /** Normalizado: +569XXXXXXXX. */
  contactoTelefono: string;
  contactoCorreo: string;
  jornadaId: string | null;
}

export type ResultadoValidacion = { ok: true; datos: DatosPostulacion } | { ok: false; campos: string[] };

type Crudo = Record<string, unknown>;

const texto = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const limpio = v.replace(/\s+/g, ' ').trim();
  return limpio.length > 0 && limpio.length <= max ? limpio : null;
};

const opcional = (v: unknown, max: number): string | null => (v === undefined || v === null || v === '' ? null : texto(v, max));

function enLista<T extends string>(v: unknown, lista: readonly T[]): T | null {
  return typeof v === 'string' && (lista as readonly string[]).includes(v) ? (v as T) : null;
}

export function normalizarTelefono(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const digitos = v.replace(/\D/g, '');
  if (/^9\d{8}$/.test(digitos)) return `+56${digitos}`;
  if (/^569\d{8}$/.test(digitos)) return `+${digitos}`;
  return null;
}

function fechaValida(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const fecha = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== v) return null;
  const anio = Number(v.slice(0, 4));
  return anio >= 1925 && anio <= 2026 ? v : null;
}

export function validarPostulacion(cuerpo: unknown): ResultadoValidacion {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) return { ok: false, campos: ['cuerpo'] };
  const c = cuerpo as Crudo;
  const errores: string[] = [];
  const exigir = <T>(campo: string, valor: T | null): T => {
    if (valor === null) errores.push(campo);
    return valor as T;
  };

  const idsValidos = new Set(HABILIDADES.map((h) => h.id));
  const habilidades = Array.isArray(c['habilidades']) ? (c['habilidades'] as unknown[]) : [];
  const habilidadesOk = habilidades.length <= 40 && habilidades.every((h) => typeof h === 'string' && idsValidos.has(h));
  if (!habilidadesOk) errores.push('habilidades');

  const promociones = Array.isArray(c['promociones']) ? (c['promociones'] as unknown[]) : [];
  const promocionesOk = promociones.every((p) => enLista(p, PROMOCIONES_DECLARABLES) !== null);
  if (!promocionesOk) errores.push('promociones');

  const anios = c['aniosExperiencia'];
  const aniosOk = anios === undefined || anios === null || anios === '' || (Number.isInteger(Number(anios)) && Number(anios) >= 0 && Number(anios) <= 60);
  if (!aniosOk) errores.push('aniosExperiencia');

  const modalidadCruda = c['modalidad'];
  const modalidad = modalidadCruda === undefined || modalidadCruda === null || modalidadCruda === '' ? null : enLista(modalidadCruda, MODALIDADES);
  if (modalidadCruda !== undefined && modalidadCruda !== null && modalidadCruda !== '' && modalidad === null) errores.push('modalidad');

  const correo = texto(c['contactoCorreo'], 120);
  const correoOk = correo !== null && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) ? correo.toLowerCase() : null;

  const datos = {
    atletaNombre: exigir('atletaNombre', texto(c['atletaNombre'], 60)),
    atletaApellido: exigir('atletaApellido', texto(c['atletaApellido'], 60)),
    fechaNacimiento: exigir('fechaNacimiento', fechaValida(c['fechaNacimiento'])),
    sexo: exigir('sexo', enLista(c['sexo'], ['dama', 'varon'] as const)),
    comuna: exigir('comuna', texto(c['comuna'], 60)),
    esAntiguo: c['esAntiguo'] === true,
    experiencia: exigir('experiencia', enLista(c['experiencia'], ['ninguna', 'con'] as const)),
    clubAnterior: opcional(c['clubAnterior'], 80),
    aniosExperiencia: aniosOk && anios !== undefined && anios !== null && anios !== '' ? Number(anios) : null,
    posicion: opcional(c['posicion'], 30) === null ? null : enLista(c['posicion'], POSICIONES),
    habilidades: habilidadesOk ? (habilidades as string[]) : [],
    modalidad,
    equipoInteres: opcional(c['equipoInteres'], 60),
    tipoPostulacion: enLista(c['tipoPostulacion'], TIPOS_POSTULACION) ?? 'individual',
    promociones: promocionesOk ? (promociones as DatosPostulacion['promociones']) : [],
    contactoNombre: exigir('contactoNombre', texto(c['contactoNombre'], 100)),
    contactoParentesco: enLista(c['contactoParentesco'], PARENTESCOS),
    contactoTelefono: exigir('contactoTelefono', normalizarTelefono(c['contactoTelefono'])),
    contactoCorreo: exigir('contactoCorreo', correoOk),
    jornadaId: opcional(c['jornadaId'], 40),
  };

  if (errores.length > 0) return { ok: false, campos: errores };
  return { ok: true, datos: datos as DatosPostulacion };
}
