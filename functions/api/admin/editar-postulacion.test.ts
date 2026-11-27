import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequestPost } from './editar-postulacion.ts';

const id = '11111111-1111-4111-8111-111111111111';
const version = '2026-11-27T14:00:00+00:00';
const p = {
  id, codigo: 'HUR-ABC234', actualizado_en: version, estado: 'preinscrita',
  atleta_nombre: 'Atleta', atleta_apellido: 'Prueba', fecha_nacimiento: '2026-01-01', edad_2027: 1,
  sexo: 'dama', comuna: 'San Miguel', es_antiguo: false, experiencia: 'ninguna', habilidades: [],
  tipo_postulacion: 'individual', promociones_declaradas: [], contacto_nombre: 'Contacto Prueba',
  contacto_parentesco: 'madre', contacto_telefono: '+56912345678', contacto_correo: 'familia@example.com',
  equipos_sugeridos: [], desglose: [], jornada_id: null, jornada_tipo: 'sin-evaluacion', equipo_asignado: null,
};
const env = { SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'fake', RESEND_API_KEY: 'fake', CORREO_ORIGEN: 'hola@example.test', DATOS_TRANSFERENCIA: 'Banco Prueba' };
async function probar(b: object, o: { rol?: string; sinToken?: boolean; falloCorreo?: boolean; fila?: object; conflicto?: boolean } = {}) {
  const original = globalThis.fetch;
  const llamadas: { ruta: string; metodo: string; cuerpo: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const ruta = new URL(url).pathname;
    const metodo = init?.method ?? 'GET';
    const cuerpo = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    llamadas.push({ ruta, metodo, cuerpo });
    if (ruta === '/auth/v1/user') return Response.json({ id: 'actor' });
    if (ruta === '/rest/v1/administradores') return Response.json([{ rol: o.rol ?? 'administracion' }]);
    if (ruta === '/rest/v1/postulaciones' && metodo === 'GET') return Response.json([o.fila ?? p]);
    if (ruta === '/rest/v1/postulaciones' && metodo === 'PATCH') return Response.json(o.conflicto ? [] : [{ id }]);
    if (ruta === '/rest/v1/pagos') return Response.json([{ id: 'pago-existente' }]);
    if (ruta === '/rest/v1/ajustes_privados') return Response.json([]);
    if (ruta === '/emails') return Response.json({}, { status: o.falloCorreo ? 500 : 200 });
    throw Error('Ruta inesperada: ' + ruta);
  }) as typeof fetch;
  try {
    const request = new Request('https://example.test/api/admin/editar-postulacion', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(o.sinToken ? {} : { Authorization: 'Bearer fake' }) }, body: JSON.stringify(b) });
    const r = await onRequestPost({ env, request });
    return { status: r.status, cuerpo: await r.json(), llamadas };
  } finally { globalThis.fetch = original; }
}
const solicitud = { id, version, accion: 'editar', datos: { fechaNacimiento: '2017-06-01' }, enviarCorreo: true };

test('requiere sesión y rol de jefatura', async () => {
  assert.equal((await probar(solicitud, { sinToken: true })).status, 401);
  const r = await probar(solicitud, { rol: 'coach' });
  assert.equal(r.status, 403);
  assert.ok(r.llamadas.every(x => x.ruta !== '/rest/v1/postulaciones'));
});
test('rechaza una edad inferior a cuatro años sin guardar ni enviar', async () => {
  const r = await probar({ ...solicitud, datos: { fechaNacimiento: '2025-01-01' } });
  assert.equal(r.status, 400);
  assert.ok(r.llamadas.every(x => x.metodo !== 'PATCH' && x.ruta !== '/emails'));
});
test('corrige edad y monto en la misma fila, deja evaluación pendiente y no altera pagos', async () => {
  const r = await probar(solicitud);
  assert.equal(r.status, 200);
  assert.deepEqual(r.cuerpo, { ok: true, guardado: true, correoEnviado: true, jornadaPendiente: true });
  const patch = r.llamadas.find(x => x.metodo === 'PATCH')!;
  assert.equal(patch.cuerpo['edad_2027'], 10);
  assert.equal(patch.cuerpo['jornada_id'], null);
  assert.equal(patch.cuerpo['jornada_tipo'], 'horario-equipo');
  assert.ok(Number(patch.cuerpo['monto_estimado']) > 0);
  for (const k of ['id','codigo','estado','equipo_asignado','notas_coach']) assert.ok(!(k in patch.cuerpo));
  assert.ok(r.llamadas.filter(x => x.ruta === '/rest/v1/pagos').every(x => x.metodo === 'GET'));
  const correo = r.llamadas.find(x => x.ruta === '/emails')!;
  assert.deepEqual(correo.cuerpo['to'], ['familia@example.com']);
  assert.doesNotMatch(String(correo.cuerpo['text']), /Banco Prueba|Total a transferir/);
});
test('si la versión cambió no envía correo; si Resend falla conserva guardado', async () => {
  const conflicto = await probar(solicitud, { conflicto: true });
  assert.equal(conflicto.status, 409);
  assert.ok(conflicto.llamadas.every(x => x.ruta !== '/emails'));
  const r = await probar(solicitud, { falloCorreo: true });
  assert.deepEqual(r.cuerpo, { ok: true, guardado: true, correoEnviado: false, jornadaPendiente: true });
});
test('reenviar usa el correo almacenado y no vuelve a escribir la postulación', async () => {
  const r = await probar({ id, version, accion: 'reenviar', datos: { contactoCorreo: 'otro@example.com' } }, { fila: { ...p, fecha_nacimiento: '2023-01-01', edad_2027: 4 } });
  assert.equal(r.status, 200);
  assert.ok(r.llamadas.every(x => x.metodo !== 'PATCH'));
  assert.deepEqual(r.llamadas.find(x => x.ruta === '/emails')!.cuerpo['to'], ['familia@example.com']);
});
