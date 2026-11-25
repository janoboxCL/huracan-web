/* Reglas de las jornadas de evaluación en el CRM: ocupación, id y validación. Funciones puras. */

import type { GrupoJornadaClave, JornadaAdmin } from './tipos.ts';

export const GRUPOS: readonly GrupoJornadaClave[] = ['youth-junior-senior-prep', 'open', 'sin-experiencia-7-19'];

/** Cuenta las postulaciones activas (no canceladas) por jornada. */
export function ocupacionPorJornada(postulaciones: readonly { jornada_id: string | null; estado: string }[]): Record<string, number> {
  const cuenta: Record<string, number> = {};
  for (const p of postulaciones) {
    if (p.jornada_id !== null && p.estado !== 'cancelada') cuenta[p.jornada_id] = (cuenta[p.jornada_id] ?? 0) + 1;
  }
  return cuenta;
}

export type NivelOcupacion = 'sin-limite' | 'disponible' | 'ultimos' | 'llena' | 'sobrecupo';

export interface EstadoOcupacion {
  nivel: NivelOcupacion;
  ocupados: number;
  cupos: number | null;
  /** `null` si no hay límite. */
  disponibles: number | null;
  /** 0 a 100 (acotado) para la barra; 0 si no hay límite. */
  porcentaje: number;
  texto: string;
}

export function estadoOcupacion(cupos: number | null, ocupados: number): EstadoOcupacion {
  if (cupos === null) {
    return { nivel: 'sin-limite', ocupados, cupos, disponibles: null, porcentaje: 0, texto: `${ocupados} ${ocupados === 1 ? 'postulación' : 'postulaciones'} · sin límite de cupos` };
  }
  const disponibles = Math.max(cupos - ocupados, 0);
  const porcentaje = cupos === 0 ? 100 : Math.min(Math.round((ocupados / cupos) * 100), 100);
  let nivel: NivelOcupacion = 'disponible';
  if (ocupados > cupos) nivel = 'sobrecupo';
  else if (ocupados === cupos) nivel = 'llena';
  else if (cupos > 0 && disponibles / cupos <= 0.2) nivel = 'ultimos';
  const texto =
    nivel === 'sobrecupo'
      ? `${ocupados} de ${cupos} cupos (${ocupados - cupos} sobre el cupo)`
      : nivel === 'llena'
        ? `${ocupados} de ${cupos} cupos · llena`
        : `${ocupados} de ${cupos} cupos · ${disponibles} ${disponibles === 1 ? 'disponible' : 'disponibles'}`;
  return { nivel, ocupados, cupos, disponibles, porcentaje, texto };
}

/** Id de una jornada nueva: `2026-12-12-1800`; si ya existe, se agrega el grupo. */
export function generarIdJornada(fecha: string, inicio: string, grupo: GrupoJornadaClave, existentes: readonly string[]): string {
  const base = `${fecha}-${inicio.slice(0, 5).replace(':', '')}`;
  if (!existentes.includes(base)) return base;
  const conGrupo = `${base}-${grupo}`;
  if (!existentes.includes(conGrupo)) return conGrupo;
  let n = 2;
  while (existentes.includes(`${conGrupo}-${n}`)) n += 1;
  return `${conGrupo}-${n}`;
}

export interface EntradaJornada {
  fecha: string;
  inicio: string;
  fin: string;
  grupo: string;
  /** Texto del campo: vacío = sin límite. */
  cupos: string;
  abierta: boolean;
}

export type ErroresJornada = Partial<Record<'fecha' | 'inicio' | 'fin' | 'grupo' | 'cupos', string>>;

export interface ResultadoJornada {
  errores: ErroresJornada;
  avisos: string[];
  valor: JornadaAdmin | null;
}

function fechaReal(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const hora = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** Valida el formulario. `id` es el de la jornada (nueva o existente); `ocupados` sirve para avisar de sobrecupo. */
export function validarJornada(e: EntradaJornada, id: string, ocupados: number): ResultadoJornada {
  const errores: ErroresJornada = {};
  const avisos: string[] = [];

  if (!fechaReal(e.fecha)) errores.fecha = 'Indica una fecha válida.';
  if (!hora(e.inicio)) errores.inicio = 'Indica la hora de inicio (por ejemplo 18:00).';
  if (!hora(e.fin)) errores.fin = 'Indica la hora de término (por ejemplo 20:00).';
  if (!errores.inicio && !errores.fin && e.fin <= e.inicio) errores.fin = 'La hora de término debe ser posterior al inicio.';
  if (!(GRUPOS as readonly string[]).includes(e.grupo)) errores.grupo = 'Elige quién evalúa en esta jornada.';

  let cupos: number | null = null;
  const textoCupos = e.cupos.trim();
  if (textoCupos !== '') {
    if (!/^\d{1,4}$/.test(textoCupos)) errores.cupos = 'Los cupos son un número entero, o déjalos vacíos si no hay límite.';
    else cupos = Number(textoCupos);
  }
  if (cupos !== null && cupos < ocupados) {
    avisos.push(`Ya hay ${ocupados} postulaciones en esta jornada: quedará con sobrecupo y no recibirá nuevas.`);
  }

  if (Object.keys(errores).length > 0) return { errores, avisos, valor: null };
  return {
    errores,
    avisos,
    valor: { id, fecha: e.fecha, inicio: e.inicio, fin: e.fin, grupo: e.grupo as GrupoJornadaClave, cupos, abierta: e.abierta },
  };
}

/** Jornadas que aún no pasan (desde `hoy`, AAAA-MM-DD), ordenadas. */
export function jornadasProximas(jornadas: readonly JornadaAdmin[], hoy: string): JornadaAdmin[] {
  return jornadas.filter((j) => j.fecha >= hoy).sort(compararJornadas);
}

export function compararJornadas(a: JornadaAdmin, b: JornadaAdmin): number {
  return a.fecha.localeCompare(b.fecha) || a.inicio.localeCompare(b.inicio) || a.id.localeCompare(b.id);
}
