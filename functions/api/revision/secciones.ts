/* POST /api/revision/secciones → el club registra su veredicto sobre una sección. Solo rol cliente. */
import { endpoint, error, json, leerJson } from '../../../src/servidor/revision/http';
import { registrarEstadoSeccion } from '../../../src/servidor/revision/revision';

export const onRequestPost = endpoint(async ({ gh, ronda, contexto }) => {
  const resultado = await registrarEstadoSeccion(gh, ronda, await leerJson(contexto.request));
  if (typeof resultado === 'string') return error(resultado, 422);
  return json(resultado);
}, ['cliente']);
