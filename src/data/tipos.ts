/* Tipos del contenido oficial 2027.
   Reflejan la estructura de docs/contenido/huracan-2027.json. Si el JSON cambia
   de forma, `astro check` falla en contenido.ts hasta que estos tipos se ajusten. */

export interface Club {
  nombre: string;
  lema: string;
  fundacion: number;
  ciudad: string;
  colores: string[];
  edades: string;
  historia: string;
  mensajeClave: string;
}

export interface Contacto {
  whatsappHeadCoach: string;
  whatsappTexto: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  /** Puede ser un marcador `[así]` mientras el club no la confirme. */
  direccion: string;
}

export interface Hito {
  anio: number;
  texto: string;
}

export interface Directivo {
  nombre: string;
  rol: string;
  detalle: string[];
}

export interface Coach {
  nombre: string;
  detalle: string;
}

export interface Staff {
  direccion: Directivo[];
  coaches: Coach[];
  _notaCoaches: string;
  asistentes: string[];
}

export interface PasoSistema {
  n: string;
  titulo: string;
  texto: string;
}

export interface Sistema {
  resumen: string;
  pasos: PasoSistema[];
  clasesExtrasNota: string;
  procesoActualDelPdf: string[];
  _notaPago: string;
}

export type ProgramaId = 'recreativo' | 'novice' | 'prep' | 'international';

export interface Programa {
  id: ProgramaId;
  nombre: string;
  edadDesde: number;
  descripcion: string;
  mensualidad: number;
  /** Solo en Novice y Prep: mensualidad de la categoría Open. */
  mensualidadOpen?: number;
  detalle: string;
}

export type GeneroEquipo = 'mixto' | 'damas';

export interface Equipo {
  nombre: string;
  programa: ProgramaId;
  categoria: string;
  genero: GeneroEquipo;
  edadMin: number;
  /** `null`: sin límite de edad. */
  edadMax: number | null;
  rango: string;
  /** Grupos que no parten en la evaluación de diciembre (p. ej. «abril de 2027»). */
  inicio?: string;
  /** Aviso para mostrar junto al equipo (inicio, definición del grupo). */
  nota?: string;
}

export type TipoBloque = 'equipo' | 'extra' | 'gimnasia';

export interface BloqueHorario {
  inicio: string;
  fin: string;
  texto: string;
  tipo: TipoBloque;
}

export interface DiaHorario {
  dia: string;
  bloques: BloqueHorario[];
}

export interface ItemValor {
  item: string;
  /** `null`: valor por confirmar. */
  monto: number | null;
  detalle: string;
}

export type IdItemChecklist = 'puntualidad' | 'uniforme' | 'peinado' | 'maquillaje' | 'agua' | 'pagos';

export interface ChecklistEntrenamiento {
  _fuente: string;
  titulo: string;
  presentacion: string;
  requisitos: string[];
  items: { id: IdItemChecklist; titulo: string; detalle: string }[];
}

export interface Valores {
  inscripcion: { monto: number; detalle: string };
  vestimenta: ItemValor[];
  otros: ItemValor[];
  clasesExtras: {
    tipos: string[];
    pack: { monto: number; clases: number; minutos: number };
    suelta: number;
  };
  requisitos: string[];
}

export interface Promocion {
  nombre: string;
  descuento: string;
  texto: string;
}

export interface MesCalendario {
  mes: string;
  corto: string;
  /** `true`: mes con evento con público o competencia (amarillo sólido). */
  evento: boolean;
  porConfirmar?: string;
  hitos: string[];
}

export interface Viaje {
  pais: string;
  ciudad: string;
  nota: string;
}

export interface Documentos {
  protocolos: string;
  reglamento: string;
}

export interface Contenido {
  _fuente: string;
  _temporada: number;
  club: Club;
  contacto: Contacto;
  hitos: Hito[];
  logrosCinta: string[];
  staff: Staff;
  sistema: Sistema;
  programas: Programa[];
  _notaPagoMensualidad: string;
  equipos: Equipo[];
  _notaEquipos: string;
  horarios: DiaHorario[];
  _notaHorarios: string;
  checklistEntrenamiento: ChecklistEntrenamiento;
  valores: Valores;
  promociones: Promocion[];
  _notaPromociones: string;
  calendario: MesCalendario[];
  viajes: Viaje[];
  _notaViajes: string;
  proshop: string[];
  documentos: Documentos;
  noPublicar: string[];
}
