/* POST /api/revision/comentarios → el club crea una observación (un issue). Solo rol cliente. */
import { endpoint, error, json, leerJson } from '../../../src/servidor/revision/http';
import { crearComentario, validarComentario } from '../../../src/servidor/revision/revision';

export const onRequestPost = endpoint(async ({ gh, ronda, contexto }) => {
  const datos = validarComentario(await leerJson(contexto.request), ronda);
  if (typeof datos === 'string') return error(datos, 422);
  return json(await crearComentario(gh, ronda, datos), 201);
}, ['cliente']);
