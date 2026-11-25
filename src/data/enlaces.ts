/* Destinos internos del sitio. Un solo lugar para cambiarlos cuando existan
   las páginas definitivas. Las anclas (#...) son del inicio: en otras páginas el
   header y el footer les anteponen `/`. */

export const enlaces = {
  inicio: '#inicio',
  /** Flujo de postulación: informativo, preinscripción y resultado. */
  agenda: '/postula',
  equipos: '#equipos',
  staff: '#staff',
} as const;

/** Navegación principal del header: anclas de las secciones del inicio. */
export const navegacion = [
  { texto: 'El club', href: '#club' },
  { texto: 'Programas', href: '#programas' },
  { texto: 'Equipos', href: '#equipos' },
  { texto: 'Temporada', href: '#temporada' },
  { texto: 'Horarios', href: '#horarios' },
  { texto: 'Valores', href: '#valores' },
  { texto: 'Staff', href: '#staff' },
  { texto: 'Viajes', href: '#viajes' },
] as const;
