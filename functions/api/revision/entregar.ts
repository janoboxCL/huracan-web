/* POST /api/revision/entregar → el club da por terminada su revisión de la ronda. Solo rol cliente. */
import { endpoint, error, json, leerJson } from '../../../src/servidor/revision/http';
import { entregarRonda } from '../../../src/servidor/revision/revision';

export const onRequestPost = endpoint(async ({ gh, ronda, contexto }) => {
  const resultado = await entregarRonda(gh, ronda, await leerJson(contexto.request));
  if (typeof resultado === 'string') return error(resultado, 422);
  return json(resultado);
}, ['cliente']);
