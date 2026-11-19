/* POST /api/revision/entregar → el cliente da por terminada su revisión de la ronda. */
import { endpoint, error, json, leerJson } from '../../../src/servidor/revision/http';
import { entregarRonda } from '../../../src/servidor/revision/revision';

export const onRequestPost = endpoint(async (gh, ronda, { request }) => {
  const resultado = await entregarRonda(gh, ronda, await leerJson(request));
  if (typeof resultado === 'string') return error(resultado, 422);
  return json(resultado);
});
