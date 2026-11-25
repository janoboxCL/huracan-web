/* Traduce los errores de Supabase a mensajes claros en español. */

export type TipoError = 'permisos' | 'red' | 'duplicado' | 'no-encontrado' | 'conflicto' | 'otro';

export const MENSAJE_CONFLICTO = 'Otra persona modificó esta postulación; recarga la ficha para ver los cambios antes de guardar.';

export class ErrorAdmin extends Error {
  readonly tipo: TipoError;

  constructor(mensaje: string, tipo: TipoError = 'otro') {
    super(mensaje);
    this.name = 'ErrorAdmin';
    this.tipo = tipo;
  }
}

interface ErrorSupabase {
  code?: string;
  message?: string;
  status?: number;
}

export function traducirError(error: unknown): ErrorAdmin {
  if (error instanceof ErrorAdmin) return error;
  const e = (typeof error === 'object' && error !== null ? error : {}) as ErrorSupabase;
  const texto = `${e.message ?? ''}`.toLowerCase();
  if (e.code === '23505') return new ErrorAdmin('Ya existe un registro con esos datos (por ejemplo, una jornada con la misma fecha, hora y grupo).', 'duplicado');
  if (e.code === '42501' || e.status === 401 || e.status === 403 || texto.includes('row-level security') || texto.includes('jwt')) {
    return new ErrorAdmin('No tienes permiso para hacer esto o tu sesión venció. Vuelve a iniciar sesión.', 'permisos');
  }
  if (texto.includes('failed to fetch') || texto.includes('network') || texto.includes('load failed') || e.status === 0) {
    return new ErrorAdmin('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.', 'red');
  }
  return new ErrorAdmin('Ocurrió un error inesperado. Inténtalo de nuevo; si persiste, avisa a quien administra el sitio.', 'otro');
}
