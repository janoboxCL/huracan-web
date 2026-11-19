/* POST /api/revision/secciones → registra el veredicto del cliente sobre una sección. */
import { endpoint, error, json, leerJson } from '../../../src/servidor/revision/http';
import { registrarEstadoSeccion } from '../../../src/servidor/revision/revision';

export const onRequestPost = endpoint(async (gh, ronda, { request }) => {
  const resultado = await registrarEstadoSeccion(gh, ronda, await leerJson(request));
  if (typeof resultado === 'string') return error(resultado, 422);
  return json(resultado);
});
