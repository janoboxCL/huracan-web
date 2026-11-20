/* GET /api/revision/estado → observaciones, veredictos y rol de quien consulta. */
import { endpoint, json } from '../../../src/servidor/revision/http';
import { leerEstado } from '../../../src/servidor/revision/revision';

export const onRequestGet = endpoint(async ({ gh, ronda, rol }) => json(await leerEstado(gh, ronda, rol)));
