/* Pruebas de jornadas y ajustes del CRM (`npm test`). */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enlaceValido, leerBanner, leerInscripciones, MAX_TEXTO_BANNER, validarBanner } from './ajustes.ts';
import { compararJornadas, estadoOcupacion, generarIdJornada, jornadasProximas, ocupacionPorJornada, validarJornada } from './jornadas.ts';
import type { JornadaAdmin } from './tipos.ts';

test('la ocupación no cuenta las canceladas ni las postulaciones sin jornada', () => {
  const o = ocupacionPorJornada([
    { jornada_id: 'a', estado: 'preinscrita' },
    { jornada_id: 'a', estado: 'asignada' },
    { jornada_id: 'a', estado: 'cancelada' },
    { jornada_id: 'b', estado: 'evaluada' },
    { jornada_id: null, estado: 'preinscrita' },
  ]);
  assert.deepEqual(o, { a: 2, b: 1 });
});

test('estadoOcupacion: sin límite, disponible, últimos, llena y sobrecupo', () => {
  assert.equal(estadoOcupacion(null, 3).nivel, 'sin-limite');
  assert.equal(estadoOcupacion(null, 1).texto, '1 postulación · sin límite de cupos');
  const d = estadoOcupacion(10, 4);
  assert.equal(d.nivel, 'disponible');
  assert.equal(d.disponibles, 6);
  assert.equal(d.porcentaje, 40);
  assert.equal(estadoOcupacion(10, 8).nivel, 'ultimos');
  assert.equal(estadoOcupacion(10, 10).nivel, 'llena');
  const s = estadoOcupacion(10, 12);
  assert.equal(s.nivel, 'sobrecupo');
  assert.equal(s.porcentaje, 100);
  assert.match(s.texto, /2 sobre el cupo/);
  assert.equal(estadoOcupacion(0, 0).nivel, 'llena');
});

test('generarIdJornada evita colisiones', () => {
  assert.equal(generarIdJornada('2026-12-12', '10:00', 'open', []), '2026-12-12-1000');
  assert.equal(generarIdJornada('2026-12-12', '10:00', 'open', ['2026-12-12-1000']), '2026-12-12-1000-open');
  assert.equal(generarIdJornada('2026-12-12', '10:00', 'open', ['2026-12-12-1000', '2026-12-12-1000-open']), '2026-12-12-1000-open-2');
});

const entrada = { fecha: '2026-12-12', inicio: '10:00', fin: '12:00', grupo: 'open', cupos: '15', abierta: true };

test('validarJornada acepta una jornada correcta y convierte los cupos', () => {
  const r = validarJornada(entrada, 'j1', 0);
  assert.deepEqual(r.errores, {});
  assert.deepEqual(r.valor, { id: 'j1', fecha: '2026-12-12', inicio: '10:00', fin: '12:00', grupo: 'open', cupos: 15, abierta: true });
});

test('cupos vacíos significan sin límite', () => {
  assert.equal(validarJornada({ ...entrada, cupos: ' ' }, 'j1', 0).valor?.cupos, null);
});

test('validarJornada rechaza fecha, horas, grupo y cupos inválidos', () => {
  const r = validarJornada({ fecha: '2026-02-30', inicio: '25:00', fin: '', grupo: 'otro', cupos: '-3', abierta: true }, 'j1', 0);
  assert.equal(r.valor, null);
  assert.ok(r.errores.fecha && r.errores.inicio && r.errores.fin && r.errores.grupo && r.errores.cupos);
});

test('el término debe ser posterior al inicio', () => {
  assert.match(validarJornada({ ...entrada, fin: '10:00' }, 'j1', 0).errores.fin ?? '', /posterior/);
  assert.match(validarJornada({ ...entrada, fin: '09:00' }, 'j1', 0).errores.fin ?? '', /posterior/);
});

test('bajar los cupos bajo la ocupación avisa pero no bloquea', () => {
  const r = validarJornada({ ...entrada, cupos: '3' }, 'j1', 5);
  assert.ok(r.valor);
  assert.match(r.avisos[0] ?? '', /sobrecupo/);
});

const j = (id: string, fecha: string, inicio: string): JornadaAdmin => ({ id, fecha, inicio, fin: '23:00', grupo: 'open', cupos: null, abierta: true });

test('jornadasProximas filtra por fecha y ordena', () => {
  const lista = [j('c', '2026-12-05', '14:00'), j('a', '2026-11-20', '10:00'), j('b', '2026-12-04', '18:00'), j('d', '2026-12-05', '10:00')];
  assert.deepEqual(jornadasProximas(lista, '2026-12-01').map((x) => x.id), ['b', 'd', 'c']);
  assert.ok(compararJornadas(lista[0] as JornadaAdmin, lista[1] as JornadaAdmin) > 0);
});

test('leerBanner e leerInscripciones toleran datos incompletos', () => {
  assert.deepEqual(leerBanner(null), { visible: false, texto: '', enlace: '' });
  assert.deepEqual(leerBanner({ visible: true, texto: 'Hola', enlace: 5 }), { visible: true, texto: 'Hola', enlace: '' });
  assert.deepEqual(leerInscripciones({ estado: 'cerradas' }), { estado: 'cerradas' });
  assert.deepEqual(leerInscripciones({ estado: 'otra' }), { estado: 'abiertas' });
});

test('validarBanner exige texto si está visible y revisa el enlace', () => {
  assert.ok(validarBanner({ visible: true, texto: ' ', enlace: '' }).texto);
  assert.deepEqual(validarBanner({ visible: false, texto: '', enlace: '' }), {});
  assert.ok(validarBanner({ visible: true, texto: 'x'.repeat(MAX_TEXTO_BANNER + 1), enlace: '' }).texto);
  assert.ok(validarBanner({ visible: true, texto: 'Hola', enlace: 'javascript:alert(1)' }).enlace);
  assert.ok(validarBanner({ visible: true, texto: 'Hola', enlace: 'http://x.cl' }).enlace);
  assert.deepEqual(validarBanner({ visible: true, texto: 'Hola', enlace: '/postula' }), {});
});

test('enlaceValido', () => {
  for (const ok of ['', '/postula', '#contacto', 'https://huracan.cl/postula']) assert.ok(enlaceValido(ok), ok);
  for (const mal of ['postula', 'ftp://x.cl', '//otro.cl/x y', 'javascript:alert(1)']) assert.equal(enlaceValido(mal), false, mal);
});
