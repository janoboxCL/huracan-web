/* Pruebas de la lógica del formulario de preinscripción (`npm test`). */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ALFABETO_CODIGO,
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
