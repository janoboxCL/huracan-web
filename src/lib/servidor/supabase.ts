/* Cliente mínimo de Supabase (PostgREST) para las Pages Functions, con `fetch`.
   Usa la clave de servicio: solo se importa desde `functions/`, nunca desde el navegador. */
import type { Entorno } from './entorno.ts';

export class ErrorSupabase extends Error {
  constructor(
    readonly estado: number,
    readonly mensaje: string,
  ) {
    super(`Supabase respondió ${estado}: ${mensaje}`);
  }
}

/** Correos que reciben copia oculta de cada inscripción (`ajustes_privados.correo_copia_oculta`).
 *  Nunca interrumpe la inscripción: ante cualquier falla devuelve una lista vacía. */
export async function leerCopiasOcultas(env: Entorno): Promise<string[]> {
  try {
    const respuesta = await fetch(`${env.SUPABASE_URL}/rest/v1/ajustes_privados?clave=eq.correo_copia_oculta&select=valor`, {
      headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!respuesta.ok) return [];
    const filas = (await respuesta.json()) as { valor: unknown }[];
    const valor = filas[0]?.valor;
    return Array.isArray(valor) ? valor.filter((c): c is string => typeof c === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) : [];
  } catch {
    return [];
  }
}

export async function rpc<T>(env: Entorno, funcion: string, argumentos: Record<string, unknown> = {}): Promise<T> {
  const respuesta = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${funcion}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(argumentos),
  });
  const texto = await respuesta.text();
  if (!respuesta.ok) throw new ErrorSupabase(respuesta.status, texto);
  return (texto ? JSON.parse(texto) : null) as T;
}
