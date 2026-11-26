/* Tipos del CRM /admin. Reflejan las tablas de supabase/migrations (sin `token_gestion`,
   que es el enlace secreto de la familia y el CRM nunca lo necesita). */

export const ESTADOS = ['preinscrita', 'pago_informado', 'pago_confirmado', 'evaluada', 'asignada', 'cancelada'] as const;
export type Estado = (typeof ESTADOS)[number];

export type ProgramaClave = 'recreativo' | 'novice' | 'prep' | 'international';
export type GrupoJornadaClave = 'youth-junior-senior-prep' | 'open' | 'sin-experiencia-7-19';
export type TipoJornada = 'jornadas' | 'sin-evaluacion' | 'inicio-diferido' | 'horario-equipo';

export interface Postulacion {
  id: string;
  codigo: string;
  estado: Estado;
  atleta_nombre: string;
  atleta_apellido: string;
  fecha_nacimiento: string;
  edad_2027: number;
  sexo: 'dama' | 'varon' | 'otro';
  comuna: string;
  es_antiguo: boolean;
  experiencia: 'ninguna' | 'basica' | 'con';
  club_anterior: string | null;
  anios_experiencia: number | null;
  posicion: string | null;
  habilidades: string[];
  modalidad_deseada: ProgramaClave | null;
  equipo_interes: string | null;
  tipo_postulacion: 'individual' | 'dupla' | 'grupo';
  promociones_declaradas: string[];
  contacto_nombre: string;
  contacto_parentesco: string | null;
  contacto_telefono: string;
  contacto_correo: string;
  programa_sugerido: ProgramaClave | null;
  equipos_sugeridos: string[];
  jornada_id: string | null;
  jornada_tipo: TipoJornada;
  /** Equipo en cuyo horario habitual se evalúa (tipo `horario-equipo`). */
  equipo_evaluacion: string | null;
  monto_estimado: number;
  /** Lo guarda la API: un `Ingreso` por equipo sugerido (ver reglas.ts). */
  desglose: unknown;
  equipo_asignado: string | null;
  promocion_validada: string | null;
  notas_coach: string | null;
  creado_en: string;
  actualizado_en: string;
}

/** Campos que el coach puede cambiar desde el CRM. */
export interface CambiosPostulacion {
  estado?: Estado;
  equipo_asignado?: string | null;
  promocion_validada?: string | null;
  notas_coach?: string | null;
}

export interface Pago {
  id: string;
  postulacion_id: string;
  concepto: string;
  monto: number;
  comprobante_url: string | null;
  confirmado_por: string | null;
  confirmado_en: string | null;
  creado_en: string;
}

export interface JornadaAdmin {
  id: string;
  /** AAAA-MM-DD. */
  fecha: string;
  /** HH:MM. */
  inicio: string;
  fin: string;
  grupo: GrupoJornadaClave;
  /** `null`: sin límite de cupos. */
  cupos: number | null;
  abierta: boolean;
}

export interface Administrador {
  user_id: string;
  nombre: string;
  rol: 'head_coach' | 'administracion' | 'coach';
}

export interface Banner {
  visible: boolean;
  texto: string;
  enlace: string;
}

export interface Inscripciones {
  estado: 'abiertas' | 'cerradas';
}

export interface Ajustes {
  banner: Banner;
  inscripciones: Inscripciones;
}

export interface Usuario {
  id: string;
  correo: string;
}
