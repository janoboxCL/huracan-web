/* Cifras y hojas del reporte. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calcularResumen, hojasReporte, type DatosReporte } from './reportes.ts';
import type { JornadaAdmin, Pago, Postulacion } from './tipos.ts';

const base = {
  fecha_nacimiento: '2015-01-01', edad_2027: 12, sexo: 'dama', comuna: 'La Cisterna', es_antiguo: false, experiencia: 'ninguna',
  club_anterior: null, anios_experiencia: null, posicion: null, habilidades: [], modalidad_deseada: null, equipo_interes: null,
  tipo_postulacion: 'individual', promociones_declaradas: [], contacto_nombre: 'Apoderada', contacto_parentesco: 'madre',
  contacto_telefono: '+56911111111', contacto_correo: 'a@b.cl', programa_sugerido: 'novice', equipos_sugeridos: ['Huracán Blackout'],
  jornada_id: null, jornada_tipo: 'horario-equipo', equipo_evaluacion: 'Huracán Blackout', monto_estimado: 80000, desglose: [],
  equipo_asignado: null, promocion_validada: null, notas_coach: null, creado_en: '2026-11-26T12:00:00Z', actualizado_en: '2026-11-26T12:00:00Z',
} as const;

const post = (extra: Partial<Postulacion>): Postulacion => ({ ...base, id: 'x', codigo: 'HUR-AAAAAA', estado: 'preinscrita', atleta_nombre: 'Ana', atleta_apellido: 'Pérez', ...extra }) as Postulacion;
const pago = (extra: Partial<Pago>): Pago => ({ id: 'p', postulacion_id: 'a', concepto: 'Inscripción', monto: 30000, comprobante_url: null, confirmado_por: null, confirmado_en: null, creado_en: '2026-11-26T13:00:00Z', ...extra });
const jornada: JornadaAdmin = { id: 'j1', fecha: '2026-12-04', inicio: '18:00', fin: '20:00', grupo: 'open', cupos: 10, abierta: true };

const datos: DatosReporte = {
  postulaciones: [
    post({ id: 'a', codigo: 'HUR-A', estado: 'pago_confirmado', equipo_asignado: 'Huracán Blackout' }),
    post({ id: 'b', codigo: 'HUR-B', estado: 'preinscrita', monto_estimado: 50000, programa_sugerido: 'prep', equipos_sugeridos: ['Huracán Blackout', 'Huracán Xplotion'] }),
    post({ id: 'c', codigo: 'HUR-C', estado: 'cancelada', monto_estimado: 99000 }),
  ],
  pagos: [pago({ id: 'p1', postulacion_id: 'a', monto: 30000, confirmado_en: '2026-11-26T14:00:00Z' }), pago({ id: 'p2', postulacion_id: 'a', monto: 70000 }), pago({ id: 'p3', postulacion_id: 'c', monto: 5000, confirmado_en: '2026-11-26T14:00:00Z' })],
  jornadas: [jornada],
  ocupacion: { j1: 2 },
};

test('cifras: activas, canceladas y pagos confirmados excluyen lo cancelado', () => {
  const r = calcularResumen(datos);
  assert.equal(r.total, 3);
  assert.equal(r.activas, 2);
  assert.equal(r.canceladas, 1);
  assert.equal(r.conPagoConfirmado, 1);
  assert.equal(r.montoEstimado, 130000);
  assert.equal(r.montoConfirmado, 30000);
  assert.equal(r.montoPorConfirmar, 100000);
});

test('conteos por equipo y programa', () => {
  const r = calcularResumen(datos);
  assert.deepEqual(r.porEquipoAsignado, [{ etiqueta: 'Huracán Blackout', n: 1 }, { etiqueta: 'Sin asignar', n: 1 }]);
  assert.deepEqual(r.porEquipoSugerido[0], { etiqueta: 'Huracán Blackout', n: 2 });
  assert.equal(r.porPrograma.length, 2);
  assert.equal(r.porJornada[0]?.inscritas, 2);
});

test('hojas del Excel: Resumen, Postulaciones, Pagos y Jornadas', () => {
  const hojas = hojasReporte(datos, '26 nov 2026, 09:00');
  assert.deepEqual(hojas.map((h) => h.nombre), ['Resumen', 'Postulaciones', 'Pagos', 'Jornadas']);
  const post = hojas[1]!;
  assert.equal(post.filas.length, 4); // cabecera + 3 postulaciones
  assert.ok(post.filas.every((f) => f.length === post.filas[0]!.length), 'todas las filas tienen las mismas columnas');
  assert.equal(hojas[2]!.filas.length, 4);
  assert.equal(hojas[3]!.filas[1]?.[5]?.valor, 8);
});
