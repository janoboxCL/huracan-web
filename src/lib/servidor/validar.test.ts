/* Pruebas de la validación del servidor y del correo de confirmación. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluarPostulacion, preciosDesdeContenido, type ContenidoPrecios, type EquipoBase } from '../postulacion/reglas.ts';
import { readFileSync } from 'node:fs';
import { construirCorreo } from './correo.ts';
import { normalizarTelefono, validarPostulacion } from './validar.ts';

const base = {
  atletaNombre: 'Sofía',
  atletaApellido: 'Pérez',
  fechaNacimiento: '2016-05-20',
  sexo: 'dama',
  comuna: 'San Miguel',
  esAntiguo: false,
  experiencia: 'ninguna',
  habilidades: [],
  contactoNombre: 'Carolina Soto',
  contactoParentesco: 'madre',
  contactoTelefono: '9 1234 5678',
  contactoCorreo: 'Carolina@Correo.cl',
  jornadaId: '2026-12-05-1200',
};

test('normaliza teléfonos chilenos', () => {
  assert.equal(normalizarTelefono('9 1234 5678'), '+56912345678');
  assert.equal(normalizarTelefono('+56 9 1234 5678'), '+56912345678');
  assert.equal(normalizarTelefono('212345678'), null);
  assert.equal(normalizarTelefono(912345678), null);
});

test('acepta una postulación válida y normaliza correo y teléfono', () => {
  const r = validarPostulacion(base);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.datos.contactoTelefono, '+56912345678');
    assert.equal(r.datos.contactoCorreo, 'carolina@correo.cl');
    assert.equal(r.datos.tipoPostulacion, 'individual');
  }
});

test('rechaza campos faltantes, fechas imposibles y habilidades desconocidas', () => {
  const r = validarPostulacion({ ...base, atletaNombre: '', fechaNacimiento: '2016-02-31', habilidades: ['inventada'] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(r.campos.sort(), ['atletaNombre', 'fechaNacimiento', 'habilidades']);
});

test('rechaza cuerpos que no son objetos', () => {
  assert.equal(validarPostulacion(null).ok, false);
  assert.equal(validarPostulacion([]).ok, false);
  assert.equal(validarPostulacion('x').ok, false);
});

test('el correo escapa HTML y no incluye datos bancarios si no se configuran', () => {
  const json = JSON.parse(readFileSync(new URL('../../../docs/contenido/huracan-2027.json', import.meta.url), 'utf8')) as { equipos: EquipoBase[] } & ContenidoPrecios;
  const evaluacion = evaluarPostulacion(json.equipos, preciosDesdeContenido(json), { edad: 10, genero: 'dama', experiencia: 'ninguna' });
  const c = construirCorreo(
    { codigo: 'HUR-ABC234', atleta: '<b>Sofía</b>', para: 'a@b.cl', evaluacion, jornadaTexto: 'Sábado 5 de diciembre, 12:00 a 14:00', whatsappHeadCoach: '+56954959681', whatsappTexto: '+56 9 5495 9681' },
    undefined,
  );
  assert.ok(!c.html.includes('<b>Sofía</b>'));
  assert.ok(c.html.includes('&lt;b&gt;'));
  assert.ok(c.texto.includes('HUR-ABC234'));
  assert.ok(c.texto.includes('Los datos de transferencia te los enviará el head coach.'));
  assert.ok(c.texto.includes('$95.000'));
});
