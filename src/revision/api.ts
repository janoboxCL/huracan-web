/* Llamadas del modo revisión a /api/revision/* (Cloudflare Pages Functions). */

import type {
  Comentario,
  ComentarioNuevo,
  Entrega,
  EstadoRonda,
  EstadoSeccionRegistrado,
  IdEstadoSeccion,
  Respuesta,
  RespuestaNueva,
} from '../data/revision';

export class ErrorApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

export function crearApi(clave: string) {
  async function pedir<T>(metodo: 'GET' | 'POST', ruta: string, cuerpo?: unknown): Promise<T> {
    const init: RequestInit = {
      method: metodo,
      headers: { 'X-Revision-Clave': clave, ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
      cache: 'no-store',
    };
    if (cuerpo !== undefined) init.body = JSON.stringify(cuerpo);
    let respuesta: Response;
    try {
      respuesta = await fetch(`/api/revision/${ruta}`, init);
    } catch {
      throw new ErrorApi(0, 'Sin conexión con el registro de revisión. Revisa tu internet e inténtalo de nuevo.');
    }
    const tipo = respuesta.headers.get('Content-Type') ?? '';
    if (!tipo.includes('application/json')) {
      throw new ErrorApi(
        respuesta.status,
        'El registro de revisión no está disponible en esta publicación del sitio.',
      );
    }
    const datos = (await respuesta.json()) as T & { error?: string };
    if (!respuesta.ok) throw new ErrorApi(respuesta.status, datos.error ?? 'No se pudo completar la acción.');
    return datos;
  }

  return {
    estado: () => pedir<EstadoRonda>('GET', 'estado'),
    comentar: (c: ComentarioNuevo) => pedir<Comentario>('POST', 'comentarios', c),
    veredicto: (d: { ronda: number; seccion: string; estado: IdEstadoSeccion; revisor: string; nota: string }) =>
      pedir<EstadoSeccionRegistrado>('POST', 'secciones', d),
    entregar: (d: { ronda: number; revisor: string; mensaje: string }) => pedir<Entrega>('POST', 'entregar', d),
    respuestas: (numero: number) => pedir<Respuesta[]>('GET', `respuestas/${numero}`),
    responder: (numero: number, r: RespuestaNueva) => pedir<Comentario>('POST', `respuestas/${numero}`, r),
  };
}

export type Api = ReturnType<typeof crearApi>;
