/* Comunas de la Región Metropolitana de Santiago (52), en orden alfabético del español,
   y la opción de cierre para quien vive en otra comuna o región. Compartido entre el
   formulario del navegador y la validación del servidor. */
export const COMUNAS_RM = [
  'Alhué', 'Buin', 'Calera de Tango', 'Cerrillos', 'Cerro Navia', 'Colina', 'Conchalí', 'Curacaví',
  'El Bosque', 'El Monte', 'Estación Central', 'Huechuraba', 'Independencia', 'Isla de Maipo',
  'La Cisterna', 'La Florida', 'La Granja', 'La Pintana', 'La Reina', 'Lampa', 'Las Condes',
  'Lo Barnechea', 'Lo Espejo', 'Lo Prado', 'Macul', 'Maipú', 'María Pinto', 'Melipilla', 'Ñuñoa',
  'Padre Hurtado', 'Paine', 'Pedro Aguirre Cerda', 'Peñaflor', 'Peñalolén', 'Pirque', 'Providencia',
  'Pudahuel', 'Puente Alto', 'Quilicura', 'Quinta Normal', 'Recoleta', 'Renca', 'San Bernardo',
  'San Joaquín', 'San José de Maipo', 'San Miguel', 'San Pablo', 'San Ramón', 'Santiago', 'Talagante',
  'Tiltil', 'Vitacura',
] as const;

/** Valor de la última opción de la lista. */
export const COMUNA_OTRA = 'Otra comuna o región';

export const esComunaDeLista = (v: string): boolean => (COMUNAS_RM as readonly string[]).includes(v);
