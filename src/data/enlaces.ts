/* Destinos internos del sitio. Un solo lugar para cambiarlos cuando existan
   las páginas definitivas (la agenda llega en la etapa 3). */

export const enlaces = {
  inicio: '#inicio',
  /** Provisorio: lleva al cierre, que tiene los botones de agenda. Pasará a `/agenda`. */
  agenda: '#cierre',
  equipos: '#equipos',
  staff: '#staff',
} as const;

/** Navegación principal del header: anclas de las secciones del inicio. */
export const navegacion = [
  { texto: 'El club', href: '#club' },
  { texto: 'Programas', href: '#programas' },
  { texto: 'Equipos', href: '#equipos' },
  { texto: 'Temporada', href: '#temporada' },
  { texto: 'Valores', href: '#valores' },
] as const;
