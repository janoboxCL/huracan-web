/* Modo revisión del cliente: catálogo de secciones, clasificaciones y tipos
   compartidos entre la interfaz (src/revision/) y la API (functions/api/revision/).

   Para abrir una ronda nueva basta con subir RONDA_ACTUAL y publicar: los
   comentarios de rondas anteriores quedan en sus issues y no se mezclan. */

/** Ronda de revisión vigente. Cada comentario queda etiquetado con `ronda-N`. */
export const RONDA_ACTUAL = 1;

export interface SeccionRevision {
  /** Identificador estable: va en la etiqueta `seccion:<id>` del issue. */
  id: string;
  /** Número visible, igual a la etiqueta `/// 0N` del sitio cuando existe. */
  numero: string;
  nombre: string;
  /** Elemento del sitio que corresponde a la sección. `null` = toda la página. */
  selector: string | null;
  /** `false` para elementos fijos (header, botón flotante): sin marcador sobre la página. */
  marcador: boolean;
  /** Preguntas que orientan la revisión. No contienen datos: los datos los valida el club. */
  preguntas: string[];
}

export const SECCIONES: readonly SeccionRevision[] = [
  {
    id: 'general',
    numero: '00',
    nombre: 'General',
    selector: null,
    marcador: false,
    preguntas: [
      '¿La página transmite la identidad de Huracán: colores, energía y tema del viento?',
      '¿El orden de las secciones cuenta la historia del club como quieres contarla?',
      '¿Se lee y se recorre bien en tu teléfono?',
    ],
  },
  {
    id: 'header',
    numero: '—',
    nombre: 'Encabezado y menú',
    selector: '.header',
    marcador: false,
    preguntas: [
      '¿El menú tiene los accesos que buscaría un apoderado o una deportista?',
      '¿El botón principal lleva adonde esperas?',
    ],
  },
  {
    id: 'hero',
    numero: '—',
    nombre: 'Portada',
    selector: '#inicio',
    marcador: true,
    preguntas: [
      '¿El titular es lo primero que quieres que lea alguien que llega al sitio?',
      '¿La imagen y las cifras representan bien al club?',
      '¿Los botones invitan a la acción correcta?',
    ],
  },
  {
    id: 'cintas',
    numero: '—',
    nombre: 'Cintas de logros',
    selector: '.cintas',
    marcador: true,
    preguntas: [
      '¿Los logros que aparecen son los que quieres destacar y están bien escritos?',
      '¿El lema se lee como corresponde?',
    ],
  },
  {
    id: 'club',
    numero: '01',
    nombre: 'El club',
    selector: '#club',
    marcador: true,
    preguntas: [
      '¿La historia y los hitos están completos y con las fechas correctas?',
      '¿El largo del texto es adecuado o conviene una versión más corta?',
    ],
  },
  {
    id: 'programas',
    numero: '02',
    nombre: 'Programas',
    selector: '#programas',
    marcador: true,
    preguntas: [
      '¿Niveles, edades y valores coinciden con el informativo 2027?',
      '¿Se entiende la diferencia entre un programa y otro?',
    ],
  },
  {
    id: 'equipos',
    numero: '03',
    nombre: 'Equipos',
    selector: '#equipos',
    marcador: true,
    preguntas: [
      '¿Están todos los equipos de la temporada, con sus edades correctas?',
      '¿El buscador por edad muestra los equipos que esperarías?',
    ],
  },
  {
    id: 'como-funciona',
    numero: '04',
    nombre: 'Cómo funciona',
    selector: '#como-funciona',
    marcador: true,
    preguntas: [
      '¿Los pasos del ingreso son correctos y están en el orden real?',
      '¿Queda claro el mensaje «Todos quedan seleccionados»?',
    ],
  },
  {
    id: 'temporada',
    numero: '05',
    nombre: 'Temporada',
    selector: '#temporada',
    marcador: true,
    preguntas: [
      '¿Las fechas y eventos del calendario son correctos?',
      '¿Falta algún hito importante de la temporada?',
    ],
  },
  {
    id: 'horarios',
    numero: '06',
    nombre: 'Horarios',
    selector: '#horarios',
    marcador: true,
    preguntas: [
      '¿Días, horas y equipos coinciden con la planificación real?',
      '¿La tabla se entiende bien en el teléfono?',
    ],
  },
  {
    id: 'checklist',
    numero: '07',
    nombre: 'Checklist de entrenamiento',
    selector: '#checklist',
    marcador: true,
    preguntas: [
      '¿La lista tiene lo que realmente se le pide a cada deportista?',
      '¿Falta o sobra algún elemento?',
    ],
  },
  {
    id: 'valores',
    numero: '08',
    nombre: 'Valores y promociones',
    selector: '#valores',
    marcador: true,
    preguntas: [
      '¿Montos, conceptos y promociones coinciden con el informativo 2027?',
      '¿Hay algún valor que no debería publicarse en el sitio?',
    ],
  },
  {
    id: 'staff',
    numero: '09',
    nombre: 'Staff',
    selector: '#staff',
    marcador: true,
    preguntas: [
      '¿Nombres, cargos y descripciones del equipo técnico son correctos?',
      '¿Tienes fotos del staff para reemplazar las actuales?',
    ],
  },
  {
    id: 'viajes',
    numero: '10',
    nombre: 'Viajes internacionales',
    selector: '#viajes',
    marcador: true,
    preguntas: [
      '¿Destinos, fechas y condiciones de los viajes son correctos?',
      '¿La información es suficiente para que una familia decida?',
    ],
  },
  {
    id: 'cierre',
    numero: '11',
    nombre: 'Tu ingreso (cierre)',
    selector: '#cierre',
    marcador: true,
    preguntas: [
      '¿El llamado final invita con claridad a agendar la evaluación?',
      '¿Los enlaces (reglamento, contacto) son los correctos?',
    ],
  },
  {
    id: 'agenda-flotante',
    numero: '—',
    nombre: 'Botón flotante de agenda',
    selector: '.agenda-flotante',
    marcador: false,
    preguntas: ['¿El botón flotante ayuda o molesta mientras se recorre la página?'],
  },
  {
    id: 'footer',
    numero: '—',
    nombre: 'Pie de página',
    selector: '.pie',
    marcador: true,
    preguntas: ['¿Contacto, redes sociales y dirección están correctos y completos?'],
  },
];

export const TIPOS = {
  contenido: { nombre: 'Contenido', ayuda: 'Textos, datos, precios, fechas o nombres.', color: '1d76db' },
  diseno: { nombre: 'Diseño', ayuda: 'Colores, imágenes, tamaños u orden visual.', color: '8250df' },
  funcionalidad: { nombre: 'Funcionalidad', ayuda: 'Botones, enlaces, buscador o formularios.', color: '0e8a16' },
  error: { nombre: 'Error', ayuda: 'Algo se ve roto o no funciona.', color: 'd73a4a' },
  idea: {
    nombre: 'Idea nueva',
    ayuda: 'Algo que no estaba considerado. Queda en una lista aparte y no entra a esta ronda.',
    color: 'fbca04',
  },
} as const;

export const PRIORIDADES = {
  imprescindible: { nombre: 'Imprescindible', ayuda: 'Debe resolverse antes de publicar.', color: 'b60205' },
  deseable: { nombre: 'Deseable', ayuda: 'Mejora clara, pero no bloquea.', color: 'd93f0b' },
  'puede-esperar': { nombre: 'Puede esperar', ayuda: 'Para una etapa posterior.', color: 'c2e0c6' },
} as const;

/** Veredicto del revisor sobre una sección completa. */
export const ESTADOS_SECCION = {
  'sin-revisar': { nombre: 'Sin revisar' },
  aprobada: { nombre: 'Aprobada' },
  'aprobada-con-cambios': { nombre: 'Aprobada con cambios' },
  rehacer: { nombre: 'Rehacer' },
} as const;

/** Decisiones del equipo sobre una observación. Solo el equipo las toma. */
export const DECISIONES = {
  aclaracion: { nombre: 'Requiere aclaración', ayuda: 'Se le pregunta algo al club antes de decidir.' },
  aceptada: { nombre: 'Aceptada', ayuda: 'Se hará. Define el cambio acordado: es lo que va al consolidado.' },
  pospuesta: { nombre: 'Pospuesta', ayuda: 'Válida, pero para una etapa posterior.' },
  rechazada: { nombre: 'Rechazada', ayuda: 'No se hará. Explica el motivo al club.' },
  implementada: { nombre: 'Implementada', ayuda: 'El cambio ya está publicado.' },
} as const;

/** Estado de cada observación: «Por responder» mientras el equipo no decide. */
export const ESTADOS_COMENTARIO = {
  pendiente: { nombre: 'Por responder' },
  ...DECISIONES,
} as const;

/** Quién usa el modo revisión: lo determina la clave del enlace. */
export type Rol = 'cliente' | 'equipo';
export const ROLES = { cliente: 'Club', equipo: 'Equipo' } as const;

export type IdTipo = keyof typeof TIPOS;
export type IdPrioridad = keyof typeof PRIORIDADES;
export type IdEstadoSeccion = keyof typeof ESTADOS_SECCION;
export type IdEstadoComentario = keyof typeof ESTADOS_COMENTARIO;
export type IdDecision = keyof typeof DECISIONES;

export const LIMITES = { comentario: 4000, revisor: 80, nota: 1000, elemento: 400, respuesta: 4000, cambio: 2000 } as const;

export function buscarSeccion(id: string): SeccionRevision | undefined {
  return SECCIONES.find((s) => s.id === id);
}

export function nombreSeccion(s: SeccionRevision): string {
  return s.numero === '—' ? s.nombre : `${s.numero} · ${s.nombre}`;
}

/* ── Contratos de la API ─────────────────────────────────────────────── */

export interface ComentarioNuevo {
  ronda: number;
  seccion: string;
  tipo: IdTipo;
  prioridad: IdPrioridad;
  comentario: string;
  revisor: string;
  /** Ej. "Móvil · 390 × 844". */
  dispositivo: string;
  /** Descripción del elemento señalado en la página, si lo hay. */
  elemento?: string;
  url: string;
  /** Versión del sitio revisada (commit y rama). */
  version: string;
}

export interface Comentario {
  numero: number;
  enlace: string;
  seccion: string;
  tipo: IdTipo | null;
  prioridad: IdPrioridad | null;
  estado: IdEstadoComentario;
  /** Quién debe responder ahora; `null` si nadie (cerrada o decisión informada). */
  turno: Rol | null;
  comentario: string;
  revisor: string;
  elemento: string | null;
  fecha: string;
  /** Cambio acordado por el equipo al aceptar: es lo que entra al consolidado. */
  cambio: string;
  respuestas: number;
}

export interface EstadoSeccionRegistrado {
  estado: IdEstadoSeccion;
  revisor: string;
  fecha: string;
  nota: string;
}

export interface Entrega {
  revisor: string;
  fecha: string;
  mensaje: string;
}

export interface EstadoRonda {
  ronda: number;
  rol: Rol;
  issueRonda: { numero: number; enlace: string } | null;
  secciones: Record<string, EstadoSeccionRegistrado>;
  entregada: Entrega | null;
  comentarios: Comentario[];
}

export interface Respuesta {
  rol: Rol;
  autor: string;
  fecha: string;
  texto: string;
  decision: IdDecision | null;
  cambio: string;
}

export interface RespuestaNueva {
  ronda: number;
  autor: string;
  texto: string;
  /** Solo equipo. */
  decision?: IdDecision;
  /** Solo equipo, con decisión «aceptada». */
  cambio?: string;
}
