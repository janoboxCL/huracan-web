/* Horario habitual por equipo (leído del contenido oficial). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { franjasPorEquipo, textoHorarioEquipo, type DiaHorario } from './horarios.ts';

const json = JSON.parse(readFileSync(new URL('../../../docs/contenido/huracan-2027.json', import.meta.url), 'utf8')) as {
  horarios: DiaHorario[];
  equipos: { nombre: string }[];
};
const franjas = franjasPorEquipo(json.horarios, json.equipos.map((e) => e.nombre));

test('Xplotion practica miércoles y sábado, en horarios distintos a los de Blackout', () => {
  assert.deepEqual(franjas['Huracán Xplotion']?.map((f) => `${f.dia} ${f.inicio}`), ['Miércoles 18:00', 'Sábado 10:00']);
  assert.deepEqual(franjas['Huracán Blackout']?.map((f) => `${f.dia} ${f.inicio}`), ['Lunes 18:00', 'Sábado 08:00']);
});

test('Spirit y Team Parent no tienen horario todavía', () => {
  assert.deepEqual(franjas['Huracán Spirit'], []);
  assert.match(textoHorarioEquipo('Huracán Spirit', []), /head coach te lo confirmará/);
});

test('texto del horario habitual', () => {
  assert.equal(
    textoHorarioEquipo('Huracán Rockstar', franjas['Huracán Rockstar'] ?? []),
    'el horario habitual de Rockstar: Viernes 18:00 a 20:00; Sábado 12:00 a 14:00',
  );
});

test('Informativo maestro: Pink Ladies practica el viernes 18:00 y el sábado 14:00', () => {
  assert.deepEqual(franjas['Huracán Pink Ladies']?.map((f) => `${f.dia} ${f.inicio}-${f.fin}`), ['Viernes 18:00-19:00', 'Sábado 14:00-15:00']);
});
