/* Pruebas de las reglas de postulación. Se ejecutan con `npm test` (node:test).
   Leen el JSON oficial, así que si el contenido cambia de equipos o precios, fallan aquí. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  HABILIDADES,
  calcularIngreso,
  edadEnTemporada,
  conceptosInicioDiferido,
  evaluarPostulacion,
  nivelAlcanzado,
  preciosDesdeContenido,
  sugerirEquipos,
  type EquipoBase,
  type ContenidoPrecios,
} from './reglas.ts';

const json = JSON.parse(readFileSync(new URL('../../../docs/contenido/huracan-2027.json', import.meta.url), 'utf8')) as {
  equipos: EquipoBase[];
} & ContenidoPrecios;
const equipos = json.equipos;
const precios = preciosDesdeContenido(json);
const nombres = (lista: readonly EquipoBase[]) => lista.map((e) => e.nombre.replace('Huracán ', ''));

test('edad en 2027 sale del año de nacimiento', () => {
  assert.equal(edadEnTemporada('2017-03-09'), 10);
  assert.equal(edadEnTemporada('2007-12-31'), 20);
});

test('precios salen del contenido oficial', () => {
  assert.equal(precios.inscripcion, 15000);
  assert.equal(precios.vestimentaEntrenamiento, 50000);
  assert.equal(precios.cinta, 10000);
  assert.deepEqual(precios.mensualidad, { recreativo: 25000, novice: 45000, prep: 45000, international: 32000 });
  assert.equal(precios.mensualidadOpen, 32000);
});

test('niña de 4 años: Baby Storm y Pink Ladies, sin evaluación', () => {
  const r = evaluarPostulacion(equipos, precios, { edad: 4, genero: 'dama', experiencia: 'ninguna' });
  assert.deepEqual(nombres(r.equipos).sort(), ['Baby Storm', 'Pink Ladies']);
  assert.deepEqual(r.jornada, { tipo: 'sin-evaluacion', motivo: 'tiny' });
});

test('niño de 4 años: solo Baby Storm (Pink Ladies es de damas); a los 3 años no hay equipo', () => {
  const r = evaluarPostulacion(equipos, precios, { edad: 4, genero: 'varon', experiencia: 'ninguna' });
  assert.deepEqual(nombres(r.equipos), ['Baby Storm']);
  assert.equal(evaluarPostulacion(equipos, precios, { edad: 3, genero: 'varon', experiencia: 'ninguna' }).equipos.length, 0);
});

test('10 años sin experiencia: Novice y jornada «sin experiencia» del sábado', () => {
  const r = evaluarPostulacion(equipos, precios, { edad: 10, genero: 'dama', experiencia: 'ninguna' });
  assert.deepEqual(nombres(r.equipos).sort(), ['Blackout', 'Xplotion']);
  assert.deepEqual(r.jornada, { tipo: 'jornadas', grupos: ['sin-experiencia-7-19'] });
});

test('10 años con experiencia: solo Prep, jornada Youth/Junior/Senior', () => {
  const r = evaluarPostulacion(equipos, precios, { edad: 10, genero: 'varon', experiencia: 'con' });
  assert.ok(r.equipos.length > 0);
  assert.ok(r.equipos.every((e) => e.programa === 'prep'));
  assert.deepEqual(r.jornada, { tipo: 'jornadas', grupos: ['youth-junior-senior-prep'] });
});

test('varón de 25 sin experiencia: Ice Bullets y evaluación Novice del sábado (sin experiencia)', () => {
  const r = evaluarPostulacion(equipos, precios, { edad: 25, genero: 'varon', experiencia: 'ninguna' });
  assert.deepEqual(nombres(r.equipos), ['Ice Bullets']);
  assert.deepEqual(r.jornada, { tipo: 'jornadas', grupos: ['sin-experiencia-7-19'] });
  assert.equal(r.ingresoEstimado?.mensualidad, 32000);
  assert.equal(r.ingresoEstimado?.total, 15000 + 32000 + 25000);
});

test('los equipos de damas no se sugieren a varones', () => {
  const r = sugerirEquipos(equipos, { edad: 22, genero: 'varon', experiencia: 'con' });
  assert.ok(r.every((e) => e.genero === 'mixto'));
});

test('monto de una niña Novice: inscripción + 45.000 + 25.000 de ropa + cinta', () => {
  const r = evaluarPostulacion(equipos, precios, { edad: 10, genero: 'dama', experiencia: 'ninguna' });
  assert.equal(r.ingresoEstimado?.total, 15000 + 45000 + 25000 + 10000);
  assert.equal(r.ingresoEstimado?.promo, null);
});

test('Recreativo: la mensualidad va en efectivo y no suma a la transferencia', () => {
  const baby = equipos.find((e) => e.nombre === 'Huracán Baby Storm');
  assert.ok(baby);
  const i = calcularIngreso(precios, baby, { edad: 5, genero: 'varon', experiencia: 'ninguna' });
  assert.equal(i.mensualidad, 25000);
  assert.equal(i.mensualidadEnEfectivo, true);
  assert.equal(i.total, 15000 + 25000);
});

test('habilidades: una individual basta; en grupo deben estar todas', () => {
  assert.deepEqual(nivelAlcanzado(['n3-flic-salto-flic']), { gimnasia: 3, grupo: 0, dupla: false });
  assert.deepEqual(nivelAlcanzado(['g3-desmonte-giro', 'g3-switch-up-hell-stretch']), { gimnasia: 0, grupo: 0, dupla: false });
  assert.deepEqual(
    nivelAlcanzado(['g3-desmonte-giro', 'g3-switch-up-hell-stretch', 'g3-tic-toc-cintura']),
    { gimnasia: 0, grupo: 3, dupla: false },
  );
  assert.equal(nivelAlcanzado(['d-walk-in-toss-prep']).dupla, true);
  assert.equal(new Set(HABILIDADES.map((h) => h.id)).size, HABILIDADES.length, 'ids únicos');
});

test('dama de 17 con experiencia y nivel 3: Prep e International, promos de $25.000', () => {
  const r = evaluarPostulacion(equipos, precios, {
    edad: 17,
    genero: 'dama',
    experiencia: 'con',
    habilidades: ['n3-rondat-flic-mortal-agrupado'],
  });
  const n = nombres(r.equipos);
  assert.ok(n.includes('Lady Jags'));
  assert.ok(n.includes('Velocity Lightning'));
  assert.ok(!n.includes('Five Elite'), 'Five Elite exige nivel 4, grupo completo o dupla');
  const promo = (nombre: string) => r.ingresos.find((i) => i.equipo === `Huracán ${nombre}`)?.promo;
  assert.equal(promo('Lady Jags')?.mensualidad, 25000);
  assert.equal(promo('Velocity Lightning')?.mensualidad, 25000);
  assert.equal(r.jornada.tipo, 'jornadas');
  if (r.jornada.tipo === 'jornadas') assert.ok(r.jornada.grupos.includes('open'));
});

test('Five Elite: mensualidad gratis con nivel 4 o dupla', () => {
  const five = equipos.find((e) => e.nombre === 'Huracán Five Elite');
  assert.ok(five);
  const base = { edad: 20, genero: 'varon', experiencia: 'con' } as const;
  assert.equal(calcularIngreso(precios, five, { ...base, habilidades: ['n4-flic-mortal-agrupado'] }).promo?.mensualidad, 0);
  assert.equal(calcularIngreso(precios, five, { ...base, habilidades: ['d-walk-in-toss-prep'] }).promo?.mensualidad, 0);
  assert.equal(calcularIngreso(precios, five, { ...base, habilidades: ['n3-flic-salto-flic'] }).promo, null);
});

test('Super Mafia: la promoción de $25.000 aplica a externos y antiguos (informativo maestro)', () => {
  const mafia = equipos.find((e) => e.nombre === 'Huracán Super Mafia');
  assert.ok(mafia);
  const base = { edad: 11, genero: 'dama', experiencia: 'con', habilidades: ['n2-handvault'] } as const;
  assert.equal(calcularIngreso(precios, mafia, base).promo?.mensualidad, 25000);
  assert.equal(calcularIngreso(precios, mafia, { ...base, esAntiguo: true }).promo?.mensualidad, 25000);
});

test('Five Elite se sugiere con nivel 4 o dupla, y siempre si la modalidad elegida es International', () => {
  const base = { edad: 20, genero: 'varon', experiencia: 'con' } as const;
  const con = (h: string[]) => nombres(sugerirEquipos(equipos, { ...base, habilidades: h }));
  assert.ok(con(['n4-flic-mortal-agrupado']).includes('Five Elite'));
  assert.ok(con(['d-walk-in-toss-prep']).includes('Five Elite'));
  assert.ok(!con(['n3-flic-salto-flic']).includes('Five Elite'));
  assert.ok(con(['n3-flic-salto-flic']).includes('Velocity Lightning'));
  const explicita = nombres(sugerirEquipos(equipos, { ...base, modalidad: 'international' }));
  assert.deepEqual(explicita.sort(), ['Five Elite', 'Velocity Lightning']);
});

test('Titanium Black (Senior prep 2.2, 12 a 19): se sugiere con experiencia y la promoción aplica también a atletas antiguos (informativo maestro)', () => {
  const r = evaluarPostulacion(equipos, precios, { edad: 16, genero: 'varon', experiencia: 'con', habilidades: ['n2-handvault'] });
  assert.ok(nombres(r.equipos).includes('Titanium Black'));
  const promo = (esAntiguo: boolean) =>
    evaluarPostulacion(equipos, precios, { edad: 16, genero: 'varon', experiencia: 'con', habilidades: ['n2-handvault'], esAntiguo }).ingresos.find((i) => i.equipo === 'Huracán Titanium Black')?.promo;
  assert.equal(promo(false)?.mensualidad, 25000);
  assert.equal(promo(true)?.mensualidad, 25000);
});

test('Los Senior son de 12 a 19 años (confirmado por Franco) y Xtreme Force de 9 a 12', () => {
  const con = (edad: number) => nombres(sugerirEquipos(equipos, { edad, genero: 'varon', experiencia: 'con', habilidades: [] }));
  assert.ok(!con(11).includes('Super Models'));
  assert.ok(con(12).includes('Super Models'));
  assert.ok(con(12).includes('Titanium Black'));
  assert.ok(!con(8).includes('Xtreme Force'));
  assert.ok(con(9).includes('Xtreme Force'));
  const runway = (edad: number) => nombres(sugerirEquipos(equipos, { edad, genero: 'dama', experiencia: 'ninguna', habilidades: [] }));
  assert.ok(!runway(11).includes('Runway Diva'));
  assert.ok(runway(12).includes('Runway Diva'));
});

test('Spirit y Team Parent no pasan por la evaluación: comienzan en abril y enero', () => {
  const spirit = evaluarPostulacion(equipos, precios, { edad: 10, genero: 'dama', experiencia: 'ninguna', modalidad: 'recreativo' });
  assert.deepEqual(nombres(spirit.equipos), ['Spirit']);
  assert.deepEqual(spirit.jornada, { tipo: 'inicio-diferido', inicios: [{ equipo: 'Huracán Spirit', inicio: 'abril de 2027' }] });
  const adulto = evaluarPostulacion(equipos, precios, { edad: 38, genero: 'dama', experiencia: 'ninguna', modalidad: 'recreativo' });
  assert.deepEqual(nombres(adulto.equipos).sort(), ['Spirit', 'Team Parent']);
  assert.equal(adulto.jornada.tipo, 'inicio-diferido');
});

test('inicio diferido: Spirit paga inscripción y vestimenta; Team Parent solo vestimenta', () => {
  assert.equal(conceptosInicioDiferido([{ nombre: 'Huracán Spirit' }]), 'inscripción y vestimenta de entrenamiento');
  assert.equal(conceptosInicioDiferido([{ nombre: 'Huracán Team Parent' }]), 'vestimenta de entrenamiento');
});

test('experiencia muy básica: misma vía Novice que sin experiencia', () => {
  const basica = evaluarPostulacion(equipos, precios, { edad: 10, genero: 'dama', experiencia: 'basica' });
  const ninguna = evaluarPostulacion(equipos, precios, { edad: 10, genero: 'dama', experiencia: 'ninguna' });
  assert.deepEqual(basica.equipos.map((e) => e.nombre), ninguna.equipos.map((e) => e.nombre));
  assert.ok(basica.equipos.every((e) => e.programa === 'novice'));
  assert.deepEqual(basica.jornada, ninguna.jornada);
});

test('sexo «otro»: solo equipos mixtos', () => {
  const r = evaluarPostulacion(equipos, precios, { edad: 10, genero: 'otro', experiencia: 'ninguna' });
  assert.ok(r.equipos.length > 0);
  assert.ok(r.equipos.every((e) => e.genero === 'mixto'));
});

test('7 años con experiencia: sin Prep para su edad, se sugiere Novice y su evaluación del sábado', () => {
  const r = evaluarPostulacion(equipos, precios, { edad: 7, genero: 'dama', experiencia: 'con' });
  assert.ok(r.equipos.length > 0);
  assert.ok(r.equipos.every((e) => e.programa === 'novice'));
  assert.deepEqual(r.jornada, { tipo: 'jornadas', grupos: ['sin-experiencia-7-19'] });
});

test('sin equipo sugerido (3 años): no hay jornada que elegir y el ingreso queda sin estimar', () => {
  const r = evaluarPostulacion(equipos, precios, { edad: 3, genero: 'dama', experiencia: 'ninguna' });
  assert.equal(r.equipos.length, 0);
  assert.equal(r.ingresoEstimado, null);
  assert.deepEqual(r.jornada, { tipo: 'sin-evaluacion', motivo: 'sin-equipo' });
});
