/* Formato de textos, fechas y enlaces del CRM. Funciones puras (con pruebas). */

import { enlaceWhatsappCon, textoDiaJornada } from '../postulacion/formulario.ts';
import type { GrupoJornadaClave, JornadaAdmin, Postulacion, ProgramaClave, TipoJornada } from './tipos.ts';

/** Escapa texto para insertarlo en HTML. */
export function esc(valor: unknown): string {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export const ETIQUETA_GRUPO: Record<GrupoJornadaClave, string> = {
  'youth-junior-senior-prep': 'Youth, Junior y Senior Prep',
  open: 'Open, Open Coed Novice, Prep e International',
  'sin-experiencia-7-19': 'Sin experiencia, 7 a 19 años',
};

export const ETIQUETA_PROGRAMA: Record<ProgramaClave, string> = {
  recreativo: 'Recreativo',
  novice: 'Novice',
  prep: 'Prep',
  international: 'International',
};

export const ETIQUETA_TIPO_JORNADA: Record<TipoJornada, string> = {
  jornadas: 'Jornada de evaluación',
  'sin-evaluacion': 'Sin evaluación (primera práctica)',
  'inicio-diferido': 'Inicio diferido',
};

export const ETIQUETA_TIPO_POSTULACION: Record<Postulacion['tipo_postulacion'], string> = {
  individual: 'Individual',
  dupla: 'Dupla coed',
  grupo: 'Grupo de elevación',
};

export const ETIQUETA_PARENTESCO: Record<string, string> = {
  madre: 'Madre',
  padre: 'Padre',
  tutor: 'Tutor o tutora',
  otro: 'Otro',
  propio: 'La propia persona',
};

export const ETIQUETA_POSICION: Record<string, string> = {
  flyer: 'Flyer',
  'base-principal': 'Base principal',
  'base-secundaria': 'Base secundaria',
  backspot: 'Backspot',
};

export const ETIQUETA_ROL: Record<string, string> = {
  head_coach: 'Head coach',
  administracion: 'Administración',
  coach: 'Coach',
};

/** `18:00:00` o `18:00` → `18:00`. */
export function horaCorta(hora: string): string {
  return hora.slice(0, 5);
}

/** `2026-12-04` → `vie 4 dic`. */
export function fechaCorta(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) return fecha;
  return new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))))
    .replaceAll('.', '')
    .replace(',', '');
}

/** `2026-11-25T17:30:00Z` → `25 nov 2026, 14:30` (hora de Chile). */
export function fechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const fecha = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Santiago' })
    .format(d)
    .replaceAll('.', '');
  const hora = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Santiago' }).format(d);
  return `${fecha}, ${hora}`;
}

/** `2026-11-25T17:30:00Z` → `25 nov`. */
export function fechaDiaMes(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', timeZone: 'America/Santiago' }).format(d).replaceAll('.', '');
}

export function peso(monto: number): string {
  return `$${monto.toLocaleString('es-CL')}`;
}

/** `Viernes 4 de diciembre · 18:00 a 20:00`. */
export function textoJornada(j: Pick<JornadaAdmin, 'fecha' | 'inicio' | 'fin'>): string {
  return `${textoDiaJornada(j.fecha)} · ${horaCorta(j.inicio)} a ${horaCorta(j.fin)}`;
}

/** `+56912345678` → `+56 9 1234 5678`; si no calza con el formato, lo devuelve tal cual. */
export function telefonoLegible(telefono: string): string {
  const d = telefono.replace(/\D/g, '');
  const m = /^56(9)(\d{4})(\d{4})$/.exec(d);
  return m ? `+56 ${m[1]} ${m[2]} ${m[3]}` : telefono;
}

export function nombreAtleta(p: Pick<Postulacion, 'atleta_nombre' | 'atleta_apellido'>): string {
  return `${p.atleta_nombre} ${p.atleta_apellido}`.trim();
}

/** Enlace de WhatsApp al apoderado (o a la propia persona) con un mensaje inicial. `null` si el teléfono no sirve. */
export function enlaceWhatsappApoderado(p: Postulacion, jornada: string | null): string | null {
  const digitos = p.contacto_telefono.replace(/\D/g, '');
  if (!/^569\d{8}$/.test(digitos)) return null;
  const lineas = [
    `Hola ${p.contacto_nombre}, te escribimos del club Huracán All Stars.`,
    `Sobre la postulación ${p.codigo} de ${nombreAtleta(p)}.`,
  ];
  if (jornada) lineas.push(`Jornada de evaluación: ${jornada}.`);
  return enlaceWhatsappCon(digitos, lineas.join('\n'));
}

export const ETIQUETA_PROMOCION_DECLARADA: Record<string, string> = {
  hermanos: 'Hermanos',
  'otra-region': 'Otra región',
  'varones-externos': 'Varones externos',
  familiar: 'Familiar',
};

/** Fecha de hoy en Chile, `AAAA-MM-DD`. */
export function hoyChile(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}

/** Hora actual en Chile, `HH:MM`. */
export function horaChile(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false }).format(ahora);
}
