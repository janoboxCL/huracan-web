/* GET /api/jornadas: jornadas de evaluación abiertas con su cupo restante.
   No expone datos de postulantes. */
import { rpc } from '../../src/lib/servidor/supabase.ts';
import type { ContextoFuncion } from '../../src/lib/servidor/entorno.ts';

interface FilaJornada {
  id: string;
  fecha: string;
  inicio: string;
  fin: string;
  grupo: string;
  cupos: number | null;
  ocupados: number;
  disponibles: number | null;
}

export const onRequestGet = async ({ env }: ContextoFuncion): Promise<Response> => {
  try {
    const filas = await rpc<FilaJornada[]>(env, 'jornadas_disponibles');
    return Response.json(
      filas.map((f) => ({
        id: f.id,
        fecha: f.fecha,
        inicio: f.inicio.slice(0, 5),
        fin: f.fin.slice(0, 5),
        grupo: f.grupo,
        cupos: f.cupos,
        disponibles: f.disponibles,
      })),
      { headers: { 'Cache-Control': 'public, max-age=30' } },
    );
  } catch (error) {
    console.error('No se pudo leer jornadas_disponibles', error instanceof Error ? error.message : 'error');
    return Response.json({ error: 'no_disponible' }, { status: 503 });
  }
};
