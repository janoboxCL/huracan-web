/* Capa de acceso a datos del CRM. Las páginas solo conocen esta interfaz: hay una
   implementación real (Supabase, `supabase.ts`) y una de demostración en memoria (`demo.ts`). */

import type { Administrador, Ajustes, CambiosPostulacion, JornadaAdmin, Pago, Postulacion, Usuario } from './tipos.ts';

export type ResultadoLogin = { ok: true } | { ok: false; motivo: 'credenciales' | 'red' | 'otro' };

export interface Repositorio {
  readonly modo: 'supabase' | 'demo';
  obtenerUsuario(): Promise<Usuario | null>;
  iniciarSesion(correo: string, clave: string): Promise<ResultadoLogin>;
  cerrarSesion(): Promise<void>;
  /** Envía el correo con el enlace para definir una nueva contraseña. No revela si el correo existe. */
  pedirRecuperacion(correo: string, volverA: string): Promise<'ok' | 'red' | 'otro'>;
  /** Toma la sesión temporal que trae el enlace del correo. `false` si el enlace no es válido o venció. */
  abrirSesionDeRecuperacion(): Promise<boolean>;
  cambiarClave(clave: string): Promise<'ok' | 'debil' | 'red' | 'otro'>;
  /** Fila del usuario en `administradores`; `null` si no es administrador. */
  obtenerAdministrador(usuarioId: string): Promise<Administrador | null>;

  listarPostulaciones(): Promise<Postulacion[]>;
  obtenerPostulacion(codigo: string): Promise<Postulacion | null>;
  /** `version` es el `actualizado_en` que vio quien edita: si cambió, lanza `ErrorAdmin` de tipo `conflicto` sin pisar. */
  actualizarPostulacion(id: string, cambios: CambiosPostulacion, version?: string): Promise<Postulacion>;

  listarPagos(postulacionId: string): Promise<Pago[]>;
  crearPago(postulacionId: string, concepto: string, monto: number): Promise<Pago>;
  confirmarPago(pagoId: string, usuarioId: string): Promise<Pago>;

  /** Todas las jornadas (abiertas, cerradas y pasadas), sin filtrar. */
  listarJornadas(): Promise<JornadaAdmin[]>;
  /** Ocupación por id de jornada: postulaciones no canceladas. */
  contarOcupacion(): Promise<Record<string, number>>;
  crearJornada(jornada: JornadaAdmin): Promise<JornadaAdmin>;
  actualizarJornada(jornada: JornadaAdmin): Promise<JornadaAdmin>;

  obtenerAjustes(): Promise<Ajustes>;
  guardarAjuste(clave: 'banner' | 'inscripciones', valor: unknown, usuarioId: string): Promise<void>;
}
