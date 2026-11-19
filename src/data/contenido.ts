/* Carga tipada del contenido oficial 2027.
   Fuente única: docs/contenido/huracan-2027.json (a su vez extraído del PDF del club).
   En la etapa 2 esta capa pasará a leer desde Supabase sin cambiar a los consumidores. */

import datos from '../../docs/contenido/huracan-2027.json';
import type { Contenido, Equipo, Programa, ProgramaId } from './tipos';

export type * from './tipos';

export const contenido = datos as Contenido;

/* Verificación en el build: el JSON es editable a mano, así que se comprueba
   lo que los tipos no pueden garantizar. */
function validar(c: Contenido): void {
  const ids = new Set<ProgramaId>(c.programas.map((p) => p.id));
  for (const e of c.equipos) {
    if (!ids.has(e.programa)) {
      throw new Error(`Contenido inválido: el equipo "${e.nombre}" apunta al programa "${e.programa}", que no existe.`);
    }
    if (e.edadMax !== null && e.edadMax < e.edadMin) {
      throw new Error(`Contenido inválido: el equipo "${e.nombre}" tiene edadMax menor que edadMin.`);
    }
  }
  if (c.calendario.length !== 13) {
    throw new Error(`Contenido inválido: el calendario debe tener 13 meses (nov 2026 a nov 2027) y tiene ${c.calendario.length}.`);
  }
}

validar(contenido);

/* ── Consultas ─────────────────────────────────────────────── */

export function programaPorId(id: ProgramaId): Programa {
  const programa = contenido.programas.find((p) => p.id === id);
  if (!programa) throw new Error(`Programa inexistente: ${id}`);
  return programa;
}

export function equiposDelPrograma(id: ProgramaId): Equipo[] {
  return contenido.equipos.filter((e) => e.programa === id);
}

/** Equipos que admiten a una persona que cumple `edad` años durante 2027. */
export function equiposPorEdad(edad: number): Equipo[] {
  return contenido.equipos.filter((e) => edad >= e.edadMin && (e.edadMax === null || edad <= e.edadMax));
}

/* ── Formato ───────────────────────────────────────────────── */

const formatoPesos = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

/** `25000` → `$25.000`. Un monto `null` se muestra como marcador visible. */
export function formatearPesos(monto: number | null): string {
  return monto === null ? '[por confirmar]' : formatoPesos.format(monto);
}

/** Detecta un marcador `[así]`: dato que el club aún debe confirmar. */
export function esPendiente(texto: string): boolean {
  return /\[[^\]]+\]/.test(texto);
}

/** Enlace de WhatsApp al head coach, con mensaje opcional. */
export function enlaceWhatsapp(mensaje?: string): string {
  const numero = contenido.contacto.whatsappHeadCoach.replace(/\D/g, '');
  const consulta = mensaje ? `?text=${encodeURIComponent(mensaje)}` : '';
  return `https://wa.me/${numero}${consulta}`;
}

export function enlaceInstagram(): string {
  return `https://www.instagram.com/${contenido.contacto.instagram}`;
}
