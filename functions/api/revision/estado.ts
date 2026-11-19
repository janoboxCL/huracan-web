/* GET /api/revision/estado → comentarios y veredictos de la ronda vigente. */
import { endpoint, json } from '../../../src/servidor/revision/http';
import { leerEstado } from '../../../src/servidor/revision/revision';

export const onRequestGet = endpoint(async (gh, ronda) => json(await leerEstado(gh, ronda)));
