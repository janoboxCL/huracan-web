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
