/* GET /api/revision/respuestas/:numero → respuestas del equipo a un comentario. */
import { endpoint, error, json } from '../../../../src/servidor/revision/http';
import { leerRespuestas } from '../../../../src/servidor/revision/revision';

export const onRequestGet = endpoint(async (gh, ronda, { params }) => {
  const numero = Number(params['numero']);
  if (!Number.isInteger(numero) || numero < 1) return error('Número de comentario no válido.', 400);
  const respuestas = await leerRespuestas(gh, ronda, numero);
  if (!respuestas) return error('Ese comentario no pertenece a la ronda vigente.', 404);
  return json(respuestas);
});
