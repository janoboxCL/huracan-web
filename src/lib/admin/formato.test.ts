/* Pruebas de formato del CRM (`npm test`). */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enlaceWhatsappApoderado, esc, fechaCorta, fechaHora, horaChile, horaCorta, hoyChile, nombreAtleta, peso, telefonoLegible, textoJornada } from './formato.ts';
import type { Postulacion } from './tipos.ts';

test('esc neutraliza HTML', () => {
  assert.equal(esc('<img src=x onerror="a()"> & \'b\''), '&lt;img src=x onerror=&quot;a()&quot;&gt; &amp; &#39;b&#39;');
  assert.equal(esc(null), '');
});

test('peso usa punto de miles', () => {
  assert.equal(peso(25000), '$25.000');
  assert.equal(peso(0), '$0');
});

test('horaCorta y fechaCorta', () => {
  assert.equal(horaCorta('18:00:00'), '18:00');
  assert.equal(fechaCorta('2026-12-04'), 'vie 4 dic');
  assert.equal(fechaCorta('basura'), 'basura');
});

test('textoJornada', () => {
  assert.equal(textoJornada({ fecha: '2026-12-04', inicio: '18:00', fin: '20:00' }), 'Viernes 4 de diciembre · 18:00 a 20:00');
});

test('fechaHora usa la hora de Chile (verano: UTC-3)', () => {
  assert.equal(fechaHora('2026-12-04T21:30:00Z'), '4 dic 2026, 18:30');
  assert.equal(fechaHora('no-fecha'), 'no-fecha');
});

test('hoyChile y horaChile', () => {
  /* 1 de diciembre 02:30 UTC todavía es 30 de noviembre en Chile (UTC-3). */
  const d = new Date('2026-12-01T02:30:00Z');
  assert.equal(hoyChile(d), '2026-11-30');
  assert.equal(horaChile(d), '23:30');
});

test('telefonoLegible', () => {
  assert.equal(telefonoLegible('+56912345678'), '+56 9 1234 5678');
  assert.equal(telefonoLegible('12345'), '12345');
});

const base = {
  codigo: 'HUR-K7P2XA', atleta_nombre: 'Ana', atleta_apellido: 'Pérez', contacto_nombre: 'Rosa Pérez', contacto_telefono: '+56912345678',
} as Postulacion;

test('el enlace de WhatsApp apunta al apoderado con el código y la jornada', () => {
  const url = enlaceWhatsappApoderado(base, 'Viernes 4 de diciembre · 18:00 a 20:00');
  assert.ok(url?.startsWith('https://wa.me/56912345678?text='));
  const texto = decodeURIComponent(url?.split('text=')[1] ?? '');
  assert.match(texto, /Rosa Pérez/);
  assert.match(texto, /HUR-K7P2XA/);
  assert.match(texto, /Ana Pérez/);
  assert.match(texto, /Jornada de evaluación: Viernes 4/);
});

test('sin jornada el mensaje no la menciona y un teléfono inválido no genera enlace', () => {
  assert.doesNotMatch(decodeURIComponent(enlaceWhatsappApoderado(base, null)?.split('text=')[1] ?? ''), /Jornada/);
  assert.equal(enlaceWhatsappApoderado({ ...base, contacto_telefono: '12345' }, null), null);
});

test('nombreAtleta', () => {
  assert.equal(nombreAtleta(base), 'Ana Pérez');
});
