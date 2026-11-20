/* Hilo de una observación.
   GET  /api/revision/respuestas/:numero → respuestas del club y del equipo.
   POST /api/revision/respuestas/:numero → agrega una respuesta; el equipo puede además decidir. */
import { endpoint, error, json, leerJson, type Peticion } from '../../../../src/servidor/revision/http';
import { leerRespuestas, responder } from '../../../../src/servidor/revision/revision';

function numeroDe({ contexto }: Peticion): number | null {
  const numero = Number(contexto.params['numero']);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

const NO_ENCONTRADA = 'Esa observación no pertenece a la ronda vigente.';

export const onRequestGet = endpoint(async (p) => {
  const numero = numeroDe(p);
  if (!numero) return error('Número de observación no válido.', 400);
  const respuestas = await leerRespuestas(p.gh, p.ronda, numero);
  return respuestas ? json(respuestas) : error(NO_ENCONTRADA, 404);
});

export const onRequestPost = endpoint(async (p) => {
  const numero = numeroDe(p);
  if (!numero) return error('Número de observación no válido.', 400);
  const resultado = await responder(p.gh, p.ronda, p.rol, numero, await leerJson(p.contexto.request));
  if (resultado === null) return error(NO_ENCONTRADA, 404);
  if (typeof resultado === 'string') return error(resultado, 422);
  return json(resultado);
});
