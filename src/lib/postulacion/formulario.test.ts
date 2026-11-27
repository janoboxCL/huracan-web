/* Pruebas de la lógica del formulario de preinscripción (`npm test`). */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COMUNAS_RM, COMUNA_OTRA } from './comunas.ts';
import {
  ALFABETO_CODIGO,
  comunaEfectiva,
  datosVacios,
  edadAl,
  edadTemporada,
  esMenorDeEdad,
  formatoCelular,
  generarCodigo,
  leerFecha,
  mensajeWhatsapp,
  normalizarCelular,
  validarCampo,
  validarTodo,
} from './formulario.ts';

test('leerFecha rechaza días inexistentes', () => {
  assert.ok(leerFecha('2016-02-29'));
  assert.equal(leerFecha('2017-02-29'), null);
  assert.equal(leerFecha('2017-13-01'), null);
  assert.equal(leerFecha('01/02/2017'), null);
});

test('menor de edad se mide al 5-dic-2026', () => {
  assert.equal(esMenorDeEdad('2008-12-05'), false); // cumple 18 ese día
  assert.equal(esMenorDeEdad('2008-12-06'), true);
  assert.equal(edadAl('2008-12-06'), 17);
  assert.equal(esMenorDeEdad('2000-01-01'), false);
});

test('edad que cumple en 2027', () => {
  assert.equal(edadTemporada('2017-06-10'), 10);
  assert.equal(edadTemporada('2017-02-30'), null);
});

test('celular chileno', () => {
  assert.equal(normalizarCelular('+56 9 1234 5678'), '912345678');
  assert.equal(normalizarCelular('9 1234 5678'), '912345678');
  assert.equal(normalizarCelular('56912345678'), '912345678');
  assert.equal(normalizarCelular('812345678'), null);
  assert.equal(normalizarCelular('91234567'), null);
  assert.equal(formatoCelular('912345678'), '+56 9 1234 5678');
});

test('apoderado solo es obligatorio para menores', () => {
  const menor = { ...datosVacios(), fechaNacimiento: '2017-06-10' };
  assert.ok(validarCampo('contactoNombre', menor, '2026-11-25'));
  assert.ok(validarCampo('parentesco', menor, '2026-11-25'));
  const mayor = { ...datosVacios(), fechaNacimiento: '2001-06-10' };
  assert.equal(validarCampo('contactoNombre', mayor, '2026-11-25'), null);
  assert.equal(validarCampo('parentesco', mayor, '2026-11-25'), null);
  assert.ok(validarCampo('telefono', mayor, '2026-11-25'));
});

test('validarTodo acepta un formulario completo', () => {
  const d = {
    ...datosVacios(),
    nombre: 'Ana',
    apellido: 'Pérez',
    fechaNacimiento: '2017-06-10',
    sexo: 'dama' as const,
    comuna: 'La Cisterna',
    esAntiguo: 'no' as const,
    experiencia: 'ninguna' as const,
    contactoNombre: 'Rosa Pérez',
    parentesco: 'madre' as const,
    telefono: '+56 9 1234 5678',
    correo: 'rosa@correo.cl',
  };
  assert.deepEqual(validarTodo(d, '2026-11-25'), {});
  assert.ok(validarCampo('fechaNacimiento', { ...d, fechaNacimiento: '2030-01-01' }, '2026-11-25'));
});

test('código de postulación sin caracteres ambiguos', () => {
  for (let i = 0; i < 200; i++) {
    const c = generarCodigo();
    assert.match(c, /^HUR-[A-Z2-9]{6}$/);
    assert.doesNotMatch(c.slice(4), /[01OI]/);
  }
  assert.equal(ALFABETO_CODIGO.length, 32);
});

test('mensaje de WhatsApp incluye código, jornada y equipos', () => {
  const m = mensajeWhatsapp({
    atleta: 'Ana Pérez',
    codigo: 'HUR-ABC234',
    jornada: 'Sábado 5 de diciembre, 12:00 a 14:00',
    equipos: ['Huracán Rockstar'],
    contacto: 'Rosa Pérez',
  });
  assert.match(m, /HUR-ABC234/);
  assert.match(m, /12:00 a 14:00/);
  assert.match(m, /Rockstar/);
});

test('mensaje de WhatsApp para grupos de inicio diferido no habla de comprobante ni jornada', () => {
  const m = mensajeWhatsapp({
    atleta: 'Marta Díaz',
    codigo: 'HUR-ABC234',
    jornada: 'Spirit en abril de 2027; Team Parent en enero de 2027',
    equipos: ['Huracán Spirit', 'Huracán Team Parent'],
    contacto: 'Marta Díaz',
    inicioDiferido: true,
  });
  assert.match(m, /HUR-ABC234/);
  assert.match(m, /Inicio: Spirit en abril de 2027/);
  assert.doesNotMatch(m, /comprobante|Jornada/);
});

test('la lista de comunas tiene las 52 de la Región Metropolitana, ordenadas y sin repetidas', () => {
  assert.equal(COMUNAS_RM.length, 52);
  assert.equal(new Set(COMUNAS_RM).size, 52);
  assert.deepEqual([...COMUNAS_RM], [...COMUNAS_RM].sort((a, b) => a.localeCompare(b, 'es')));
  for (const c of ['Ñuñoa', 'Peñalolén', 'Maipú', 'Peñaflor', 'San Joaquín', 'Conchalí']) assert.ok((COMUNAS_RM as readonly string[]).includes(c), c);
});

test('comuna: exige una de la lista u «Otra comuna o región» con texto', () => {
  const d = datosVacios();
  assert.equal(validarCampo('comuna', d, '2026-11-25'), 'Selecciona la comuna.');
  assert.equal(validarCampo('comuna', { ...d, comuna: 'Ñuñoa' }, '2026-11-25'), null);
  assert.equal(validarCampo('comuna', { ...d, comuna: 'Texto libre' }, '2026-11-25'), 'Selecciona la comuna.');
  assert.equal(validarCampo('comunaOtra', { ...d, comuna: 'Ñuñoa' }, '2026-11-25'), null);
  assert.ok(validarCampo('comunaOtra', { ...d, comuna: COMUNA_OTRA, comunaOtra: '  ' }, '2026-11-25'));
  assert.equal(validarCampo('comunaOtra', { ...d, comuna: COMUNA_OTRA, comunaOtra: 'Rancagua' }, '2026-11-25'), null);
});

test('comunaEfectiva envía la lista o el texto de «¿Cuál?»', () => {
  assert.equal(comunaEfectiva({ comuna: 'Maipú', comunaOtra: 'ignorado' }), 'Maipú');
  assert.equal(comunaEfectiva({ comuna: COMUNA_OTRA, comunaOtra: ' Rancagua, O’Higgins ' }), 'Rancagua, O’Higgins');
});

test('edad mínima: rechaza de 0 a 3 años en 2027 y acepta desde 4, sin límite superior nuevo', () => {
  const d = datosVacios();
  for (const fechaNacimiento of ['2026-01-01', '2025-01-01', '2024-01-01', '2024-12-31']) {
    const datos = { ...d, fechaNacimiento };
    assert.match(validarCampo('fechaNacimiento', datos, '2026-11-27') ?? '', /edad mínima.*4 años.*2027/);
    assert.ok(validarTodo(datos, '2026-11-27').fechaNacimiento);
  }
  for (const fechaNacimiento of ['2023-12-31', '2023-01-01', '1985-01-01']) {
    assert.equal(validarCampo('fechaNacimiento', { ...d, fechaNacimiento }, '2026-11-27'), null);
  }
});
