/* Filtros, búsqueda y orden de la lista de postulaciones. Funciones puras (con pruebas). */

import { esEstado } from './estados.ts';
import type { Estado, Postulacion, ProgramaClave } from './tipos.ts';

export const SIN_JORNADA = 'sin';

export interface Filtros {
  estado: Estado | '';
  /** Id de jornada, `SIN_JORNADA` (sin jornada de evaluación) o vacío para todas. */
  jornada: string;
  programa: ProgramaClave | '';
  busqueda: string;
  orden: 'recientes' | 'antiguas';
}

export const FILTROS_VACIOS: Filtros = { estado: '', jornada: '', programa: '', busqueda: '', orden: 'recientes' };

const PROGRAMAS = ['recreativo', 'novice', 'prep', 'international'] as const;

/** Minúsculas, sin tildes y con espacios colapsados: «  Cámila  Rojas » → «camila rojas». */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function coincideBusqueda(p: Postulacion, busqueda: string): boolean {
  const consulta = normalizarTexto(busqueda);
  if (consulta === '') return true;
  const pajar = normalizarTexto(
    [p.codigo, p.codigo.replace(/^HUR-/i, ''), p.atleta_nombre, p.atleta_apellido, p.contacto_nombre].join(' '),
  );
  return consulta.split(' ').every((parte) => pajar.includes(parte));
}

export function filtrarPostulaciones(lista: readonly Postulacion[], f: Filtros): Postulacion[] {
  const resultado = lista.filter((p) => {
    if (f.estado !== '' && p.estado !== f.estado) return false;
    if (f.jornada === SIN_JORNADA && p.jornada_id !== null) return false;
    if (f.jornada !== '' && f.jornada !== SIN_JORNADA && p.jornada_id !== f.jornada) return false;
    if (f.programa !== '' && p.programa_sugerido !== f.programa) return false;
    return coincideBusqueda(p, f.busqueda);
  });
  const signo = f.orden === 'recientes' ? -1 : 1;
  return resultado.sort((a, b) => signo * (Date.parse(a.creado_en) - Date.parse(b.creado_en)) || a.codigo.localeCompare(b.codigo));
}

export function contarPorEstado(lista: readonly Postulacion[]): Record<Estado, number> {
  const cuentas: Record<Estado, number> = {
    preinscrita: 0,
    pago_informado: 0,
    pago_confirmado: 0,
    evaluada: 0,
    asignada: 0,
    cancelada: 0,
  };
  for (const p of lista) cuentas[p.estado] += 1;
  return cuentas;
}

/** Lee los filtros de la URL; los valores desconocidos se ignoran. */
export function filtrosDesdeParametros(parametros: URLSearchParams): Filtros {
  const estado = parametros.get('estado') ?? '';
  const programa = parametros.get('programa') ?? '';
  return {
    estado: esEstado(estado) ? estado : '',
    jornada: parametros.get('jornada') ?? '',
    programa: (PROGRAMAS as readonly string[]).includes(programa) ? (programa as ProgramaClave) : '',
    busqueda: (parametros.get('q') ?? '').slice(0, 80),
    orden: parametros.get('orden') === 'antiguas' ? 'antiguas' : 'recientes',
  };
}

/** Parámetros de URL de los filtros no vacíos (la URL queda corta y compartible). */
export function filtrosAParametros(f: Filtros): URLSearchParams {
  const p = new URLSearchParams();
  if (f.estado) p.set('estado', f.estado);
  if (f.jornada) p.set('jornada', f.jornada);
  if (f.programa) p.set('programa', f.programa);
  if (f.busqueda.trim()) p.set('q', f.busqueda.trim());
  if (f.orden !== 'recientes') p.set('orden', f.orden);
  return p;
}

export function hayFiltros(f: Filtros): boolean {
  return f.estado !== '' || f.jornada !== '' || f.programa !== '' || f.busqueda.trim() !== '';
}
