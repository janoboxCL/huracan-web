import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { onRequestPost } from './usuarios.ts';

const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'servicio' };
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

interface Config {
  sesion?: boolean;
  rol?: string | null;
  crear?: { status: number; cuerpo: unknown };
  insertar?: number;
}

/** Simula Supabase Auth y PostgREST; devuelve las llamadas hechas. */
function simular(c: Config): { url: string; metodo: string; cuerpo?: string }[] {
  const llamadas: { url: string; metodo: string; cuerpo?: string }[] = [];
  globalThis.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = String(entrada);
    const metodo = init?.method ?? 'GET';
    llamadas.push({ url, metodo, ...(typeof init?.body === 'string' ? { cuerpo: init.body } : {}) });
    if (url.endsWith('/auth/v1/user')) return c.sesion === false ? new Response('{}', { status: 401 }) : Response.json({ id: 'llamador-1' });
    if (url.includes('/rest/v1/administradores?user_id=')) return Response.json(c.rol ? [{ rol: c.rol }] : []);
    if (url.endsWith('/auth/v1/admin/users') && metodo === 'POST') return Response.json(c.crear?.cuerpo ?? { id: 'nuevo-1' }, { status: c.crear?.status ?? 200 });
    if (url.endsWith('/rest/v1/administradores') && metodo === 'POST') return new Response(null, { status: c.insertar ?? 201 });
    if (url.includes('/auth/v1/admin/users/') && metodo === 'DELETE') return new Response(null, { status: 200 });
    return new Response('?', { status: 500 });
  }) as typeof fetch;
  return llamadas;
}

const pedir = (cuerpo: unknown, token: string | null = 'token-valido') =>
  onRequestPost({
    request: new Request('https://huracanallstars.cl/api/admin/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(cuerpo),
    }),
    env,
  });

const valido = { nombre: 'Franco Cartes', correo: 'Franco@Ejemplo.cl', rol: 'head_coach', clave: 'Temporal1234' };

describe('POST /api/admin/usuarios', () => {
  it('sin sesión responde 401', async () => {
    simular({});
    assert.equal((await pedir(valido, null)).status, 401);
  });

  it('con una sesión inválida responde 401', async () => {
    simular({ sesion: false });
    assert.equal((await pedir(valido)).status, 401);
  });

  it('un coach (no jefatura) recibe 403 y no se crea nada', async () => {
    const llamadas = simular({ rol: 'coach' });
    assert.equal((await pedir(valido)).status, 403);
    assert.ok(!llamadas.some((l) => l.url.endsWith('/auth/v1/admin/users')));
  });

  it('quien no es administrador recibe 403', async () => {
    simular({ rol: null });
    assert.equal((await pedir(valido)).status, 403);
  });

  it('valida los datos', async () => {
    simular({ rol: 'administracion' });
    assert.equal((await pedir({ ...valido, correo: 'no-es-correo' })).status, 400);
    assert.equal((await pedir({ ...valido, rol: 'superadmin' })).status, 400);
    assert.equal((await pedir({ ...valido, clave: 'corta' })).status, 400);
    assert.equal((await pedir({ ...valido, nombre: ' ' })).status, 400);
  });

  it('crea la cuenta marcada para cambiar la contraseña y la registra como administrador', async () => {
    const llamadas = simular({ rol: 'head_coach' });
    const r = await pedir(valido);
    assert.equal(r.status, 201);
    const cuerpo = (await r.json()) as { administrador: { correo: string; rol: string } };
    assert.equal(cuerpo.administrador.correo, 'franco@ejemplo.cl');
    assert.equal(cuerpo.administrador.rol, 'head_coach');
    const alta = JSON.parse(llamadas.find((l) => l.url.endsWith('/auth/v1/admin/users'))?.cuerpo ?? '{}');
    assert.equal(alta.user_metadata.debe_cambiar_clave, true);
    assert.equal(alta.email_confirm, true);
    assert.equal(alta.email, 'franco@ejemplo.cl');
    const fila = JSON.parse(llamadas.find((l) => l.url.endsWith('/rest/v1/administradores') && l.metodo === 'POST')?.cuerpo ?? '{}');
    assert.equal(fila.user_id, 'nuevo-1');
  });

  it('un correo ya registrado responde 409', async () => {
    simular({ rol: 'head_coach', crear: { status: 422, cuerpo: { msg: 'A user with this email address has already been registered' } } });
    assert.equal((await pedir(valido)).status, 409);
  });

  it('si falla el registro como administrador, borra la cuenta recién creada', async () => {
    const llamadas = simular({ rol: 'head_coach', insertar: 500 });
    assert.equal((await pedir(valido)).status, 502);
    assert.ok(llamadas.some((l) => l.metodo === 'DELETE' && l.url.endsWith('/auth/v1/admin/users/nuevo-1')));
  });
});
