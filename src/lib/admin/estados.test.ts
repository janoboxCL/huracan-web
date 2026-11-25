/* Pruebas de los estados de postulación (`npm test`). */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ESTADOS, avisoCupoAlReactivar, esEstado, estadoTrasConfirmarPago, planearGestion, transicionesDesde, transicionValida, validarGestion } from './estados.ts';

test('el flujo normal avanza paso a paso', () => {
  assert.ok(transicionValida('preinscrita', 'pago_informado'));
  assert.ok(transicionValida('pago_informado', 'pago_confirmado'));
  assert.ok(transicionValida('pago_confirmado', 'evaluada'));
  assert.ok(transicionValida('evaluada', 'asignada'));
});

test('se puede saltar la evaluación (Tiny y grupos de inicio diferido) y retroceder un paso', () => {
  assert.ok(transicionValida('pago_confirmado', 'asignada'));
  assert.ok(transicionValida('asignada', 'evaluada'));
  assert.ok(transicionValida('pago_confirmado', 'pago_informado'));
});

test('no se puede pasar de preinscrita a asignada ni de asignada a preinscrita', () => {
  assert.equal(transicionValida('preinscrita', 'asignada'), false);
  assert.equal(transicionValida('preinscrita', 'evaluada'), false);
  assert.equal(transicionValida('asignada', 'preinscrita'), false);
});

test('toda postulación activa se puede cancelar y una cancelada solo se reactiva como preinscrita', () => {
  for (const e of ESTADOS.filter((x) => x !== 'cancelada')) assert.ok(transicionValida(e, 'cancelada'), e);
  assert.deepEqual(transicionesDesde('cancelada'), ['preinscrita']);
  assert.equal(transicionValida('cancelada', 'asignada'), false);
});

test('quedarse en el mismo estado es válido', () => {
  for (const e of ESTADOS) assert.ok(transicionValida(e, e));
});

test('esEstado reconoce solo los seis estados', () => {
  assert.ok(esEstado('evaluada'));
  assert.equal(esEstado('pagada'), false);
  assert.equal(esEstado(undefined), false);
});

test('validarGestion: transición inválida', () => {
  const m = validarGestion({ estadoActual: 'preinscrita', estadoNuevo: 'asignada', equipoAsignado: 'Huracán X' });
  assert.match(m ?? '', /No se puede pasar de «Preinscrita» a «Asignada»/);
});

test('validarGestion: asignada exige equipo', () => {
  assert.match(validarGestion({ estadoActual: 'evaluada', estadoNuevo: 'asignada', equipoAsignado: null }) ?? '', /equipo asignado/);
  assert.match(validarGestion({ estadoActual: 'evaluada', estadoNuevo: 'asignada', equipoAsignado: '  ' }) ?? '', /equipo asignado/);
  assert.equal(validarGestion({ estadoActual: 'evaluada', estadoNuevo: 'asignada', equipoAsignado: 'Huracán X' }), null);
});

test('validarGestion: guardar notas sin cambiar el estado es válido', () => {
  assert.equal(validarGestion({ estadoActual: 'cancelada', estadoNuevo: 'cancelada', equipoAsignado: null }), null);
});

test('tras confirmar un pago se propone pasar a pago confirmado solo desde los estados iniciales', () => {
  assert.equal(estadoTrasConfirmarPago('preinscrita'), 'pago_confirmado');
  assert.equal(estadoTrasConfirmarPago('pago_informado'), 'pago_confirmado');
  assert.equal(estadoTrasConfirmarPago('evaluada'), null);
  assert.equal(estadoTrasConfirmarPago('cancelada'), null);
});

test('planearGestion: cancelar con equipo asignado pide confirmación y limpia el equipo', () => {
  for (const nuevo of ['cancelada', 'preinscrita', 'pago_informado'] as const) {
    const de = nuevo === 'preinscrita' ? 'pago_informado' : 'pago_confirmado';
    const plan = planearGestion({ estadoActual: de, estadoNuevo: nuevo, equipoAsignado: 'Huracán X' });
    assert.equal(plan.error, null, nuevo);
    assert.equal(plan.equipoFinal, null, nuevo);
    assert.match(plan.confirmacion ?? '', /Huracán X/, nuevo);
  }
});

test('planearGestion: sin equipo, o sin cambio de estado, no hay confirmación ni se limpia nada', () => {
  assert.equal(planearGestion({ estadoActual: 'asignada', estadoNuevo: 'cancelada', equipoAsignado: null }).confirmacion, null);
  const mismo = planearGestion({ estadoActual: 'pago_informado', estadoNuevo: 'pago_informado', equipoAsignado: 'Huracán X' });
  assert.equal(mismo.confirmacion, null);
  assert.equal(mismo.equipoFinal, 'Huracán X');
  const asignar = planearGestion({ estadoActual: 'evaluada', estadoNuevo: 'asignada', equipoAsignado: ' Huracán X ' });
  assert.equal(asignar.equipoFinal, 'Huracán X');
  assert.equal(asignar.confirmacion, null);
});

test('planearGestion: un error de validación se devuelve sin plan de guardado', () => {
  const plan = planearGestion({ estadoActual: 'evaluada', estadoNuevo: 'asignada', equipoAsignado: null });
  assert.match(plan.error ?? '', /equipo asignado/);
  assert.equal(plan.confirmacion, null);
});

test('reactivar una cancelada avisa si la jornada está llena, sin bloquear', () => {
  const llena = { cupos: 3, ocupados: 3 };
  assert.match(avisoCupoAlReactivar({ estadoActual: 'cancelada', estadoNuevo: 'preinscrita', equipoAsignado: null, jornada: llena }) ?? '', /llena/);
  const sobre = planearGestion({ estadoActual: 'cancelada', estadoNuevo: 'preinscrita', equipoAsignado: null, jornada: { cupos: 3, ocupados: 4 } });
  assert.equal(sobre.error, null);
  assert.match(sobre.aviso ?? '', /sobre el cupo/);
});

test('reactivar no avisa si hay cupo, si no hay límite o si no se reactiva', () => {
  const base = { estadoActual: 'cancelada', estadoNuevo: 'preinscrita', equipoAsignado: null } as const;
  assert.equal(avisoCupoAlReactivar({ ...base, jornada: { cupos: 3, ocupados: 2 } }), null);
  assert.equal(avisoCupoAlReactivar({ ...base, jornada: { cupos: null, ocupados: 50 } }), null);
  assert.equal(avisoCupoAlReactivar({ ...base, jornada: null }), null);
  assert.equal(avisoCupoAlReactivar({ estadoActual: 'preinscrita', estadoNuevo: 'pago_informado', equipoAsignado: null, jornada: { cupos: 1, ocupados: 1 } }), null);
});
