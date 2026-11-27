/* Pruebas de la capa de acceso: armado del cuerpo, mapeo de errores y modo maqueta (`npm test`).
   `fetch` se simula; no hay red. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { armarCuerpo, cargarJornadas, enviarPostulacion, interpretarRespuesta, CAMPO_API_A_FORMULARIO } from './api.ts';
import { datosVacios, textoDiaJornada, validarCampo, type DatosPostulacion } from './formulario.ts';

const menor: DatosPostulacion = {
  ...datosVacios(),
  nombre: ' Ana ',
  apellido: 'Pérez',
  fechaNacimiento: '2017-06-10',
  sexo: 'dama',
  comuna: 'La Cisterna',
  esAntiguo: 'no',
  experiencia: 'ninguna',
  clubAnterior: 'Resto de un club anterior',
  habilidades: ['n2-handvault'],
  forma: 'dupla-coed',
  contactoNombre: 'Rosa Pérez',
  parentesco: 'madre',
  telefono: '+56 9 1234 5678',
  correo: 'rosa@correo.cl',
};

const respuesta = (estado: number, cuerpo: unknown) => async () => new Response(JSON.stringify(cuerpo), { status: estado });

test('cuerpo de una menor sin experiencia', () => {
  const c = armarCuerpo(menor, '2026-12-05-1200');
  assert.equal(c.atletaNombre, 'Ana');
  assert.equal(c.esAntiguo, false);
  assert.equal(c.tipoPostulacion, 'dupla');
  assert.equal(c.contactoNombre, 'Rosa Pérez');
  assert.equal(c.contactoParentesco, 'madre');
  assert.equal(c.modalidad, '');
  assert.equal(c.jornadaId, '2026-12-05-1200');
  assert.equal(c.sitioWeb, '');
  /* Sin experiencia no se envían datos de experiencia aunque queden en el formulario. */
  assert.equal(c.clubAnterior, '');
  assert.deepEqual(c.habilidades, []);
  assert.equal(c.aniosExperiencia, null);
});

test('cuerpo de una persona mayor de edad: contacto propio', () => {
  const c = armarCuerpo(
    { ...menor, fechaNacimiento: '2000-01-15', experiencia: 'con', clubAnterior: 'Club X', aniosExperiencia: '3', posicion: 'flyer', modalidad: 'prep', forma: 'grupo-elevacion', promociones: ['hermanos'] },
    null,
  );
  assert.equal(c.contactoParentesco, 'propio');
  assert.equal(c.contactoNombre, 'Ana Pérez');
  assert.equal(c.aniosExperiencia, 3);
  assert.equal(c.posicion, 'flyer');
  assert.equal(c.modalidad, 'prep');
  assert.equal(c.tipoPostulacion, 'grupo');
  assert.deepEqual(c.promociones, ['hermanos']);
  assert.equal(c.jornadaId, null);
});

test('interpretarRespuesta mapea cada caso del contrato', () => {
  assert.deepEqual(interpretarRespuesta(201, { codigo: 'HUR-ABC234', correoEnviado: true, ingresoEstimado: 95000 }), {
    ok: true,
    codigo: 'HUR-ABC234',
    correoEnviado: true,
    ingresoEstimado: 95000,
    simulada: false,
  });
  const sinCorreo = interpretarRespuesta(201, { codigo: 'HUR-ABC234', correoEnviado: false });
  assert.ok(sinCorreo.ok && sinCorreo.correoEnviado === false);
  assert.deepEqual(interpretarRespuesta(400, { error: 'datos_invalidos', campos: ['contactoTelefono', 'jornadaId'] }), {
    ok: false,
    error: 'datos_invalidos',
    campos: ['contactoTelefono', 'jornadaId'],
  });
  assert.deepEqual(interpretarRespuesta(409, { error: 'jornada_sin_cupo' }), { ok: false, error: 'jornada_sin_cupo' });
  assert.deepEqual(interpretarRespuesta(409, { error: 'jornada_no_disponible' }), { ok: false, error: 'jornada_no_disponible' });
  assert.deepEqual(interpretarRespuesta(422, { error: 'sin_equipo_sugerido' }), { ok: false, error: 'sin_equipo_sugerido' });
  for (const estado of [500, 503, 413]) assert.deepEqual(interpretarRespuesta(estado, { error: 'x' }), { ok: false, error: 'servidor' });
  assert.deepEqual(interpretarRespuesta(201, {}), { ok: false, error: 'servidor' });
});

test('enviarPostulacion en modo API envía JSON y devuelve el resultado', async () => {
  let visto: { url: string; init: RequestInit | undefined } | null = null;
  const fetchFalso = (async (url: string, init?: RequestInit) => {
    visto = { url, init };
    return new Response(JSON.stringify({ codigo: 'HUR-ZZZ222', correoEnviado: true, ingresoEstimado: 95000 }), { status: 201 });
  }) as unknown as typeof fetch;
  const r = await enviarPostulacion(menor, 'j1', { activa: true, fetch: fetchFalso });
  assert.ok(r.ok && r.codigo === 'HUR-ZZZ222');
  assert.equal(visto!.url, '/api/postulaciones');
  assert.equal(visto!.init?.method, 'POST');
  assert.equal(JSON.parse(String(visto!.init?.body)).jornadaId, 'j1');
});

test('enviarPostulacion maneja 409, 400 y red caída sin lanzar', async () => {
  const conEstado = (e: number, c: unknown) => ({ activa: true, fetch: respuesta(e, c) as unknown as typeof fetch });
  assert.deepEqual(await enviarPostulacion(menor, 'j1', conEstado(409, { error: 'jornada_sin_cupo' })), { ok: false, error: 'jornada_sin_cupo' });
  const r400 = await enviarPostulacion(menor, null, conEstado(400, { error: 'datos_invalidos', campos: ['contactoCorreo'] }));
  assert.ok(!r400.ok && r400.error === 'datos_invalidos' && r400.campos[0] === 'contactoCorreo');
  const caida = (async () => {
    throw new TypeError('Failed to fetch');
  }) as unknown as typeof fetch;
  assert.deepEqual(await enviarPostulacion(menor, null, { activa: true, fetch: caida }), { ok: false, error: 'red' });
  /* Respuesta sin JSON (por ejemplo un 502 del proxy). */
  const html = (async () => new Response('<html>', { status: 502 })) as unknown as typeof fetch;
  assert.deepEqual(await enviarPostulacion(menor, null, { activa: true, fetch: html }), { ok: false, error: 'servidor' });
});

test('modo maqueta simula el envío y no llama a fetch', async () => {
  const noDebeLlamarse = (async () => {
    throw new Error('no debería llamarse');
  }) as unknown as typeof fetch;
  const r = await enviarPostulacion(menor, null, { activa: false, fetch: noDebeLlamarse });
  assert.ok(r.ok && r.simulada && r.correoEnviado === null);
  assert.match(r.ok ? r.codigo : '', /^HUR-[A-Z2-9]{6}$/);
  const j = await cargarJornadas({ activa: false, fetch: noDebeLlamarse });
  assert.equal(j.length, 5);
  assert.ok(j.every((x) => x.disponibles === null));
});

test('cargarJornadas en modo API valida la respuesta', async () => {
  const buena = [{ id: 'a', fecha: '2026-12-04', inicio: '18:00', fin: '20:00', grupo: 'open', cupos: 20, disponibles: 3 }];
  const j = await cargarJornadas({ activa: true, fetch: respuesta(200, buena) as unknown as typeof fetch });
  assert.equal(j[0]?.disponibles, 3);
  await assert.rejects(cargarJornadas({ activa: true, fetch: respuesta(503, { error: 'no_disponible' }) as unknown as typeof fetch }));
  await assert.rejects(cargarJornadas({ activa: true, fetch: respuesta(200, [{ id: 1 }]) as unknown as typeof fetch }));
});

test('campos de la API se asocian a campos del formulario', () => {
  assert.equal(CAMPO_API_A_FORMULARIO['contactoTelefono'], 'telefono');
  assert.equal(CAMPO_API_A_FORMULARIO['atletaNombre'], 'nombre');
  assert.equal(CAMPO_API_A_FORMULARIO['contactoParentesco'], 'parentesco');
});

test('años de experiencia: solo enteros', () => {
  const d = { ...menor, experiencia: 'con' as const, clubAnterior: 'X' };
  assert.equal(validarCampo('aniosExperiencia', { ...d, aniosExperiencia: '3' }, '2026-11-25'), null);
  assert.ok(validarCampo('aniosExperiencia', { ...d, aniosExperiencia: '2,5' }, '2026-11-25'));
  assert.ok(validarCampo('aniosExperiencia', { ...d, aniosExperiencia: '41' }, '2026-11-25'));
});

test('texto del día de una jornada', () => {
  assert.equal(textoDiaJornada('2026-12-04'), 'Viernes 4 de diciembre');
  assert.equal(textoDiaJornada('2026-12-05'), 'Sábado 5 de diciembre');
});

test('el cuerpo de un grupo de inicio diferido no lleva jornada', () => {
  const adulta = { ...menor, fechaNacimiento: '1988-05-10', modalidad: 'recreativo' as const };
  const c = armarCuerpo(adulta, null);
  assert.equal(c.jornadaId, null);
  assert.equal(c.modalidad, 'recreativo');
  assert.equal(c.contactoParentesco, 'propio');
});

test('con «Otra comuna o región» el cuerpo lleva el texto de «¿Cuál?» como comuna', () => {
  const c = armarCuerpo({ ...menor, comuna: 'Otra comuna o región', comunaOtra: ' Rancagua ' }, null);
  assert.equal(c.comuna, 'Rancagua');
  assert.equal(armarCuerpo({ ...menor, comuna: 'Maipú', comunaOtra: 'x' }, null).comuna, 'Maipú');
});

test('respuesta exitosa sin equipo sugerido ni monto estimado', () => {
  assert.deepEqual(interpretarRespuesta(201, { codigo: 'HUR-ABC234', correoEnviado: true, ingresoEstimado: null }), {
    ok: true, codigo: 'HUR-ABC234', correoEnviado: true, ingresoEstimado: null, simulada: false,
  });
});
