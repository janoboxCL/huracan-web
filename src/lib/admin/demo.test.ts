/* Pruebas de los datos de demostración: deben ser coherentes con el motor de reglas (`npm test`). */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { crearEstadoDemo, crearRepositorioDemo } from './demo.ts';
import { ESTADOS } from './estados.ts';
import { preciosDesdeContenido, type EquipoBase } from '../postulacion/reglas.ts';
import datos from '../../../docs/contenido/huracan-2027.json' with { type: 'json' };

const equipos = (datos as unknown as { equipos: EquipoBase[] }).equipos;
const precios = preciosDesdeContenido(datos as never);
const base = { equipos, precios };

test('hay 12 postulaciones de ejemplo, con códigos únicos y todos los estados', () => {
  const e = crearEstadoDemo(base);
  assert.equal(e.postulaciones.length, 12);
  assert.equal(new Set(e.postulaciones.map((p) => p.codigo)).size, 12);
  for (const estado of ESTADOS) assert.ok(e.postulaciones.some((p) => p.estado === estado), estado);
});

test('los equipos y jornadas existen y la jornada coincide con el tipo', () => {
  const e = crearEstadoDemo(base);
  const nombres = new Set(equipos.map((x) => x.nombre));
  const jornadas = new Set(e.jornadas.map((j) => j.id));
  for (const p of e.postulaciones) {
    for (const n of p.equipos_sugeridos) assert.ok(nombres.has(n), n);
    if (p.equipo_asignado) assert.ok(nombres.has(p.equipo_asignado));
    assert.equal(p.jornada_tipo === 'jornadas', p.jornada_id !== null, p.codigo);
    if (p.jornada_id) assert.ok(jornadas.has(p.jornada_id));
    assert.ok(Array.isArray(p.desglose));
  }
});

test('las postulaciones asignadas tienen equipo y los Tiny no tienen jornada', () => {
  const e = crearEstadoDemo(base);
  for (const p of e.postulaciones.filter((x) => x.estado === 'asignada')) assert.ok(p.equipo_asignado, p.codigo);
  const tiny = e.postulaciones.find((p) => p.edad_2027 <= 6);
  assert.equal(tiny?.jornada_tipo, 'sin-evaluacion');
});

test('el repositorio de demostración lista, actualiza y no toca la red', async () => {
  const repo = crearRepositorioDemo(base, null);
  assert.equal(repo.modo, 'demo');
  const lista = await repo.listarPostulaciones();
  const primera = lista[0];
  assert.ok(primera);
  const cambiada = await repo.actualizarPostulacion(primera.id, { notas_coach: 'Prueba' });
  assert.equal(cambiada.notas_coach, 'Prueba');
  assert.equal((await repo.obtenerPostulacion(primera.codigo))?.notas_coach, 'Prueba');
  const ocupacion = await repo.contarOcupacion();
  assert.ok(Object.values(ocupacion).reduce((a, b) => a + b, 0) > 0);
});

test('actualizar con una versión vieja lanza conflicto y no pisa los cambios', async () => {
  const repo = crearRepositorioDemo(base, null);
  const primera = (await repo.listarPostulaciones())[0];
  assert.ok(primera);
  const nueva = await repo.actualizarPostulacion(primera.id, { notas_coach: 'A' }, primera.actualizado_en);
  await assert.rejects(
    () => repo.actualizarPostulacion(primera.id, { notas_coach: 'B' }, primera.actualizado_en),
    (e: unknown) => e instanceof Error && (e as { tipo?: string }).tipo === 'conflicto',
  );
  assert.equal((await repo.obtenerPostulacion(primera.codigo))?.notas_coach, 'A');
  const ok = await repo.actualizarPostulacion(primera.id, { notas_coach: 'C' }, nueva.actualizado_en);
  assert.equal(ok.notas_coach, 'C');
});

test('confirmar un pago ya confirmado lanza conflicto', async () => {
  const repo = crearRepositorioDemo(base, null);
  const p = (await repo.listarPostulaciones()).find((x) => x.estado === 'pago_informado');
  assert.ok(p);
  const [pago] = await repo.listarPagos(p.id);
  assert.ok(pago);
  await repo.confirmarPago(pago.id, 'u1');
  await assert.rejects(() => repo.confirmarPago(pago.id, 'u2'), (e: unknown) => (e as { tipo?: string }).tipo === 'conflicto');
});
