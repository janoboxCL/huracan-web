/* POST /api/revision/comentarios → crea un issue por comentario del cliente. */
import { endpoint, error, json, leerJson } from '../../../src/servidor/revision/http';
import { crearComentario, validarComentario } from '../../../src/servidor/revision/revision';

export const onRequestPost = endpoint(async (gh, ronda, { request }) => {
  const datos = validarComentario(await leerJson(request), ronda);
  if (typeof datos === 'string') return error(datos, 422);
  return json(await crearComentario(gh, ronda, datos), 201);
});
