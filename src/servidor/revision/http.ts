/* Envoltorio común de los endpoints /api/revision/*: configuración, clave de
   acceso, respuestas JSON y manejo de errores. */

import { RONDA_ACTUAL } from '../../data/revision';
import { ErrorGitHub, GitHub, type Entorno } from './github';

/** Subconjunto del contexto de Cloudflare Pages Functions que se usa aquí. */
export interface ContextoPages {
  request: Request;
  env: Entorno;
  params: Record<string, string | string[]>;
}

export type Manejador = (contexto: ContextoPages) => Promise<Response>;

const CABECERAS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
};

export function json(datos: unknown, estado = 200): Response {
  return new Response(JSON.stringify(datos), { status: estado, headers: CABECERAS });
}

export const error = (mensaje: string, estado: number) => json({ error: mensaje }, estado);

async function resumen(texto: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto)));
}

/** Compara la clave recibida con la configurada sin filtrar información por tiempos. */
async function claveValida(recibida: string | null, esperada: string): Promise<boolean> {
  if (!recibida) return false;
  const [a, b] = await Promise.all([resumen(recibida), resumen(esperada)]);
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) diferencia |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diferencia === 0;
}

export async function leerJson(request: Request): Promise<unknown> {
  const texto = await request.text();
  if (texto.length > 20_000) throw new RangeError('Cuerpo demasiado grande');
  return JSON.parse(texto);
}

/** Ejecuta un endpoint del modo revisión tras validar configuración y clave. */
export function endpoint(
  fn: (gh: GitHub, ronda: number, contexto: ContextoPages) => Promise<Response>,
): Manejador {
  return async (contexto) => {
    const { env, request } = contexto;
    if (!env.GITHUB_TOKEN || !env.GITHUB_REPO || !env.REVISION_CLAVE) {
      return error('El modo revisión no está configurado en este despliegue.', 503);
    }
    if (!(await claveValida(request.headers.get('X-Revision-Clave'), env.REVISION_CLAVE))) {
      return error('El enlace de revisión no es válido o expiró.', 401);
    }
    try {
      const gh = new GitHub({ ...env, GITHUB_TOKEN: env.GITHUB_TOKEN, GITHUB_REPO: env.GITHUB_REPO });
      return await fn(gh, RONDA_ACTUAL, contexto);
    } catch (e) {
      if (e instanceof SyntaxError || e instanceof RangeError) return error('Solicitud mal formada.', 400);
      if (e instanceof ErrorGitHub) {
        console.error(e.message, JSON.stringify(e.detalle));
        if (e.estado === 404) return error('No se encontró el registro solicitado.', 404);
        return error('No se pudo guardar en el registro de revisión. Inténtalo de nuevo en unos minutos.', 502);
      }
      console.error(e);
      return error('Error inesperado del servidor.', 500);
    }
  };
}
