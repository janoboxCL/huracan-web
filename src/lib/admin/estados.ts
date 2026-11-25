/* Estados de una postulación y sus transiciones válidas. Lógica pura (con pruebas). */

import { ESTADOS, type Estado } from './tipos.ts';

export { ESTADOS };

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  preinscrita: 'Preinscrita',
  pago_informado: 'Pago informado',
  pago_confirmado: 'Pago confirmado',
  evaluada: 'Evaluada',
  asignada: 'Asignada',
  cancelada: 'Cancelada',
};

/* Flujo normal: preinscrita → pago informado → pago confirmado → evaluada → asignada.
   Se permite saltar etapas hacia adelante (los Tiny y los grupos de inicio diferido no se
   evalúan) y retroceder un paso para corregir un error. Cancelar se puede desde cualquier
   estado activo; una cancelada solo se reactiva como preinscrita. */
const TRANSICIONES: Record<Estado, readonly Estado[]> = {
  preinscrita: ['pago_informado', 'pago_confirmado', 'cancelada'],
  pago_informado: ['preinscrita', 'pago_confirmado', 'cancelada'],
  pago_confirmado: ['pago_informado', 'evaluada', 'asignada', 'cancelada'],
  evaluada: ['pago_confirmado', 'asignada', 'cancelada'],
  asignada: ['evaluada', 'cancelada'],
  cancelada: ['preinscrita'],
};

export function transicionesDesde(estado: Estado): readonly Estado[] {
  return TRANSICIONES[estado];
}

export function transicionValida(de: Estado, a: Estado): boolean {
  return de === a || TRANSICIONES[de].includes(a);
}

export function esEstado(valor: unknown): valor is Estado {
  return typeof valor === 'string' && (ESTADOS as readonly string[]).includes(valor);
}

export interface EntradaGestion {
  estadoActual: Estado;
  estadoNuevo: Estado;
  equipoAsignado: string | null;
}

/** Devuelve el mensaje de error (en español) o `null` si el cambio se puede guardar. */
export function validarGestion(e: EntradaGestion): string | null {
  if (!transicionValida(e.estadoActual, e.estadoNuevo)) {
    return `No se puede pasar de «${ETIQUETA_ESTADO[e.estadoActual]}» a «${ETIQUETA_ESTADO[e.estadoNuevo]}».`;
  }
  if (e.estadoNuevo === 'asignada' && !(e.equipoAsignado ?? '').trim()) {
    return 'Para marcar la postulación como asignada, elige primero el equipo asignado.';
  }
  return null;
}

/** Tras confirmar un pago, el estado que corresponde proponer (o `null` si no hay nada que proponer). */
export function estadoTrasConfirmarPago(actual: Estado): Estado | null {
  return actual === 'preinscrita' || actual === 'pago_informado' ? 'pago_confirmado' : null;
}

/* ── Plan de un guardado de la gestión ───────────────────────── */

/** Estados en los que no corresponde conservar un equipo asignado. */
const ESTADOS_SIN_EQUIPO: readonly Estado[] = ['cancelada', 'preinscrita', 'pago_informado'];

export interface EntradaPlan extends EntradaGestion {
  /** Cupos y ocupación de la jornada de la postulación (`null` si no tiene jornada). */
  jornada?: { cupos: number | null; ocupados: number } | null;
}

export interface PlanGestion {
  /** Mensaje de error: si existe, no se guarda. */
  error: string | null;
  /** Equipo asignado con el que se guarda (se limpia al pasar a un estado sin equipo). */
  equipoFinal: string | null;
  /** Texto para pedir confirmación antes de guardar, o `null` si no hace falta. */
  confirmacion: string | null;
  /** Aviso (no bloquea) para mostrar tras guardar. */
  aviso: string | null;
}

/** ¿La jornada quedaría sin cupo si se reactiva una postulación cancelada? */
export function avisoCupoAlReactivar(e: EntradaPlan): string | null {
  if (e.estadoActual !== 'cancelada' || e.estadoNuevo === 'cancelada' || !e.jornada) return null;
  const { cupos, ocupados } = e.jornada;
  if (cupos === null || ocupados < cupos) return null;
  return ocupados === cupos
    ? `La jornada de evaluación ya está llena (${ocupados} de ${cupos} cupos): al reactivar la postulación queda sobre el cupo.`
    : `La jornada de evaluación ya está sobre el cupo (${ocupados} de ${cupos} cupos): al reactivar la postulación queda aún más llena.`;
}

/** Valida un guardado y resuelve qué hacer con el equipo asignado y qué avisar. */
export function planearGestion(e: EntradaPlan): PlanGestion {
  const error = validarGestion(e);
  const equipo = (e.equipoAsignado ?? '').trim() || null;
  if (error) return { error, equipoFinal: equipo, confirmacion: null, aviso: null };

  const cambiaEstado = e.estadoNuevo !== e.estadoActual;
  const debeQuitarEquipo = cambiaEstado && equipo !== null && ESTADOS_SIN_EQUIPO.includes(e.estadoNuevo);
  return {
    error: null,
    equipoFinal: debeQuitarEquipo ? null : equipo,
    confirmacion: debeQuitarEquipo
      ? `La postulación tiene asignado el equipo «${equipo}». Al pasar a «${ETIQUETA_ESTADO[e.estadoNuevo]}» se quitará el equipo asignado en este mismo guardado. ¿Continuar?`
      : null,
    aviso: avisoCupoAlReactivar(e),
  };
}
