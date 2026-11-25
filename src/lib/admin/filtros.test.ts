/* Pruebas de filtros, búsqueda y orden de la lista de postulaciones (`npm test`). */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contarPorEstado, FILTROS_VACIOS, filtrarPostulaciones, filtrosAParametros, filtrosDesdeParametros, hayFiltros, normalizarTexto, SIN_JORNADA } from './filtros.ts';
import type { Postulacion } from './tipos.ts';

function post(parcial: Partial<Postulacion>): Postulacion {
  return {
    id: 'x', codigo: 'HUR-AAAAAA', estado: 'preinscrita', atleta_nombre: 'Ana', atleta_apellido: 'Pérez', fecha_nacimiento: '2015-01-01',
    edad_2027: 12, sexo: 'dama', comuna: 'La Cisterna', es_antiguo: false, experiencia: 'ninguna', club_anterior: null, anios_experiencia: null,
    posicion: null, habilidades: [], modalidad_deseada: null, equipo_interes: null, tipo_postulacion: 'individual', promociones_declaradas: [],
    contacto_nombre: 'Rosa Pérez', contacto_parentesco: 'madre', contacto_telefono: '+56912345678', contacto_correo: 'r@x.cl',
    programa_sugerido: 'novice', equipos_sugeridos: [], jornada_id: '2026-12-05-1200', jornada_tipo: 'jornadas', monto_estimado: 0, desglose: [],
    equipo_asignado: null, promocion_validada: null, notas_coach: null, creado_en: '2026-11-25T12:00:00Z', actualizado_en: '2026-11-25T12:00:00Z',
    ...parcial,
  };
}

const lista = [
  post({ id: '1', codigo: 'HUR-K7P2XA', atleta_nombre: 'María José', atleta_apellido: 'Núñez', creado_en: '2026-11-20T10:00:00Z' }),
  post({ id: '2', codigo: 'HUR-B3C4DE', atleta_nombre: 'Tomás', atleta_apellido: 'Soto', estado: 'pago_informado', programa_sugerido: 'prep', jornada_id: '2026-12-04-1800', creado_en: '2026-11-22T10:00:00Z' }),
  post({ id: '3', codigo: 'HUR-Z9Y8WV', atleta_nombre: 'Antonia', atleta_apellido: 'Rojas', estado: 'cancelada', programa_sugerido: 'recreativo', jornada_id: null, jornada_tipo: 'sin-evaluacion', creado_en: '2026-11-24T10:00:00Z' }),
];

const ids = (l: Postulacion[]) => l.map((p) => p.id);

test('sin filtros devuelve todo, de la más reciente a la más antigua', () => {
  assert.deepEqual(ids(filtrarPostulaciones(lista, FILTROS_VACIOS)), ['3', '2', '1']);
});

test('el orden «antiguas» invierte el resultado', () => {
  assert.deepEqual(ids(filtrarPostulaciones(lista, { ...FILTROS_VACIOS, orden: 'antiguas' })), ['1', '2', '3']);
});

test('filtra por estado, programa y jornada', () => {
  assert.deepEqual(ids(filtrarPostulaciones(lista, { ...FILTROS_VACIOS, estado: 'pago_informado' })), ['2']);
  assert.deepEqual(ids(filtrarPostulaciones(lista, { ...FILTROS_VACIOS, programa: 'recreativo' })), ['3']);
  assert.deepEqual(ids(filtrarPostulaciones(lista, { ...FILTROS_VACIOS, jornada: '2026-12-04-1800' })), ['2']);
  assert.deepEqual(ids(filtrarPostulaciones(lista, { ...FILTROS_VACIOS, jornada: SIN_JORNADA })), ['3']);
});

test('los filtros se combinan', () => {
  assert.deepEqual(ids(filtrarPostulaciones(lista, { ...FILTROS_VACIOS, estado: 'cancelada', programa: 'prep' })), []);
});

test('la búsqueda ignora tildes y mayúsculas y acepta nombre y apellido en cualquier orden', () => {
  assert.deepEqual(ids(filtrarPostulaciones(lista, { ...FILTROS_VACIOS, busqueda: 'maria jose nunez' })), ['1']);
  assert.deepEqual(ids(filtrarPostulaciones(lista, { ...FILTROS_VACIOS, busqueda: 'NUÑEZ maría' })), ['1']);
});

test('la búsqueda por código funciona con o sin el prefijo HUR-', () => {
  assert.deepEqual(ids(filtrarPostulaciones(lista, { ...FILTROS_VACIOS, busqueda: 'hur-b3c4de' })), ['2']);
  assert.deepEqual(ids(filtrarPostulaciones(lista, { ...FILTROS_VACIOS, busqueda: 'z9y8' })), ['3']);
});

test('la búsqueda también encuentra al apoderado', () => {
  assert.equal(filtrarPostulaciones(lista, { ...FILTROS_VACIOS, busqueda: 'rosa' }).length, 3);
});

test('normalizarTexto', () => {
  assert.equal(normalizarTexto('  Cámila   ÑUÑOZ '), 'camila nunoz');
});

test('contarPorEstado cuenta los seis estados', () => {
  const c = contarPorEstado(lista);
  assert.equal(c.preinscrita, 1);
  assert.equal(c.pago_informado, 1);
  assert.equal(c.cancelada, 1);
  assert.equal(c.asignada, 0);
});

test('los filtros viajan por la URL y se ignoran los valores desconocidos', () => {
  const f = { estado: 'evaluada' as const, jornada: SIN_JORNADA, programa: 'prep' as const, busqueda: ' ana ', orden: 'antiguas' as const };
  const url = filtrosAParametros(f);
  assert.equal(url.toString(), 'estado=evaluada&jornada=sin&programa=prep&q=ana&orden=antiguas');
  assert.deepEqual(filtrosDesdeParametros(url), { ...f, busqueda: 'ana' });
  assert.deepEqual(filtrosDesdeParametros(new URLSearchParams('estado=inventado&programa=x&orden=y')), FILTROS_VACIOS);
  assert.equal(filtrosAParametros(FILTROS_VACIOS).toString(), '');
});

test('hayFiltros', () => {
  assert.equal(hayFiltros(FILTROS_VACIOS), false);
  assert.equal(hayFiltros({ ...FILTROS_VACIOS, busqueda: ' ' }), false);
  assert.equal(hayFiltros({ ...FILTROS_VACIOS, estado: 'asignada' }), true);
});
