/* Cifras y hojas del reporte del CRM. Lógica pura (con pruebas): el navegador la usa para
   la pantalla «Reportes» y para armar el Excel. */

import { ETIQUETA_ESTADO } from './estados.ts';
import { ETIQUETA_GRUPO, ETIQUETA_PROGRAMA, ETIQUETA_TIPO_JORNADA, fechaHora, nombreAtleta, textoJornada } from './formato.ts';
import { ESTADOS, type Estado, type JornadaAdmin, type Pago, type Postulacion } from './tipos.ts';

export interface DatosReporte {
  postulaciones: readonly Postulacion[];
  pagos: readonly Pago[];
  jornadas: readonly JornadaAdmin[];
  /** Postulaciones no canceladas por id de jornada. */
  ocupacion: Readonly<Record<string, number>>;
}

export interface FilaConteo {
  etiqueta: string;
  n: number;
}

export interface FilaJornadaReporte {
  texto: string;
  grupo: string;
  abierta: boolean;
  cupos: number | null;
  inscritas: number;
}

export interface Resumen {
  /** Todas las postulaciones, incluidas las canceladas. */
  total: number;
  /** Postulaciones no canceladas. */
  activas: number;
  canceladas: number;
  porEstado: Record<Estado, number>;
  /** Postulaciones activas con al menos un pago confirmado. */
  conPagoConfirmado: number;
  /** Suma de los montos estimados de las postulaciones activas. */
  montoEstimado: number;
  /** Suma de los pagos confirmados de las postulaciones activas. */
  montoConfirmado: number;
  /** Lo que falta por confirmar: por postulación, el estimado menos lo confirmado (nunca negativo). */
  montoPorConfirmar: number;
  porPrograma: FilaConteo[];
  /** Equipo asignado; si todavía no tiene, «Sin asignar». Solo postulaciones activas. */
  porEquipoAsignado: FilaConteo[];
  /** Cuántas postulaciones activas tienen cada equipo entre sus sugeridos. */
  porEquipoSugerido: FilaConteo[];
  porJornada: FilaJornadaReporte[];
  jornadasTotal: number;
  jornadasAbiertas: number;
}

const contar = (valores: readonly string[]): FilaConteo[] => {
  const mapa = new Map<string, number>();
  for (const v of valores) mapa.set(v, (mapa.get(v) ?? 0) + 1);
  return [...mapa.entries()].map(([etiqueta, n]) => ({ etiqueta, n })).sort((a, b) => b.n - a.n || a.etiqueta.localeCompare(b.etiqueta, 'es'));
};

export function calcularResumen(d: DatosReporte): Resumen {
  const activas = d.postulaciones.filter((p) => p.estado !== 'cancelada');
  const idsActivas = new Set(activas.map((p) => p.id));
  const porEstado = Object.fromEntries(ESTADOS.map((e) => [e, 0])) as Record<Estado, number>;
  for (const p of d.postulaciones) porEstado[p.estado] += 1;

  const confirmadoPorPostulacion = new Map<string, number>();
  for (const pago of d.pagos) {
    if (!pago.confirmado_en || !idsActivas.has(pago.postulacion_id)) continue;
    confirmadoPorPostulacion.set(pago.postulacion_id, (confirmadoPorPostulacion.get(pago.postulacion_id) ?? 0) + pago.monto);
  }
  let montoEstimado = 0;
  let montoPorConfirmar = 0;
  for (const p of activas) {
    montoEstimado += p.monto_estimado;
    montoPorConfirmar += Math.max(0, p.monto_estimado - (confirmadoPorPostulacion.get(p.id) ?? 0));
  }
  const montoConfirmado = [...confirmadoPorPostulacion.values()].reduce((a, b) => a + b, 0);

  return {
    total: d.postulaciones.length,
    activas: activas.length,
    canceladas: porEstado.cancelada,
    porEstado,
    conPagoConfirmado: confirmadoPorPostulacion.size,
    montoEstimado,
    montoConfirmado,
    montoPorConfirmar,
    porPrograma: contar(activas.map((p) => (p.programa_sugerido ? ETIQUETA_PROGRAMA[p.programa_sugerido] : 'Sin programa'))),
    porEquipoAsignado: contar(activas.map((p) => p.equipo_asignado?.trim() || 'Sin asignar')),
    porEquipoSugerido: contar(activas.flatMap((p) => p.equipos_sugeridos)),
    porJornada: [...d.jornadas]
      .sort((a, b) => `${a.fecha}${a.inicio}`.localeCompare(`${b.fecha}${b.inicio}`))
      .map((j) => ({ texto: textoJornada(j), grupo: ETIQUETA_GRUPO[j.grupo], abierta: j.abierta, cupos: j.cupos, inscritas: d.ocupacion[j.id] ?? 0 })),
    jornadasTotal: d.jornadas.length,
    jornadasAbiertas: d.jornadas.filter((j) => j.abierta).length,
  };
}

/* ── Hojas del Excel ────────────────────────────────────────── */

export type TipoCelda = 'texto' | 'numero' | 'dinero';

export interface Celda {
  valor: string | number | null;
  tipo?: TipoCelda;
  negrita?: boolean;
}

export interface Hoja {
  nombre: string;
  columnas: number[]; // anchos
  filas: Celda[][];
}

const t = (valor: string | null | undefined): Celda => ({ valor: valor ?? '', tipo: 'texto' });
const n = (valor: number | null | undefined): Celda => ({ valor: valor ?? null, tipo: 'numero' });
const din = (valor: number): Celda => ({ valor, tipo: 'dinero' });
const cab = (...titulos: string[]): Celda[] => titulos.map((valor) => ({ valor, tipo: 'texto', negrita: true }));
const SEXO = { dama: 'Dama', varon: 'Varón', otro: 'Otro' } as const;
const EXPERIENCIA = { ninguna: 'Sin experiencia', basica: 'Muy básica', con: 'Con experiencia' } as const;

export function hojasReporte(d: DatosReporte, generado: string): Hoja[] {
  const r = calcularResumen(d);
  const porCodigo = new Map(d.postulaciones.map((p) => [p.id, p]));
  const jornadaPorId = new Map(d.jornadas.map((j) => [j.id, j]));

  const resumen: Celda[][] = [
    [{ valor: 'Huracán All Stars · Reporte de postulaciones 2027', tipo: 'texto', negrita: true }],
    [t(`Generado: ${generado}`)],
    [],
    cab('Indicador', 'Valor'),
    [t('Postulaciones recibidas (todas)'), n(r.total)],
    [t('Postulaciones activas (sin canceladas)'), n(r.activas)],
    [t('Canceladas'), n(r.canceladas)],
    [t('Con al menos un pago confirmado'), n(r.conPagoConfirmado)],
    [t('Monto estimado de ingreso (activas)'), din(r.montoEstimado)],
    [t('Monto confirmado'), din(r.montoConfirmado)],
    [t('Monto por confirmar'), din(r.montoPorConfirmar)],
    [t('Jornadas de evaluación'), n(r.jornadasTotal)],
    [t('Jornadas abiertas'), n(r.jornadasAbiertas)],
    [],
    cab('Estado', 'Postulaciones'),
    ...ESTADOS.map((e) => [t(ETIQUETA_ESTADO[e]), n(r.porEstado[e])]),
    [],
    cab('Programa sugerido (activas)', 'Postulaciones'),
    ...r.porPrograma.map((f) => [t(f.etiqueta), n(f.n)]),
    [],
    cab('Equipo asignado (activas)', 'Postulaciones'),
    ...r.porEquipoAsignado.map((f) => [t(f.etiqueta), n(f.n)]),
    [],
    cab('Equipo sugerido (activas)', 'Postulaciones'),
    ...r.porEquipoSugerido.map((f) => [t(f.etiqueta), n(f.n)]),
  ];

  const postulaciones: Celda[][] = [
    cab(
      'Código', 'Estado', 'Atleta', 'Fecha de nacimiento', 'Edad en 2027', 'Sexo', 'Comuna', 'Estuvo en Huracán',
      'Experiencia', 'Club anterior', 'Años de experiencia', 'Programa sugerido', 'Equipos sugeridos', 'Equipo asignado',
      'Evaluación', 'Contacto', 'Parentesco', 'Teléfono', 'Correo', 'Monto estimado', 'Pagos confirmados', 'Promociones declaradas',
      'Promoción validada', 'Notas del coach', 'Creada',
    ),
    ...[...d.postulaciones]
      .sort((a, b) => Date.parse(b.creado_en) - Date.parse(a.creado_en))
      .map((p): Celda[] => {
        const confirmado = d.pagos.filter((x) => x.postulacion_id === p.id && x.confirmado_en).reduce((s, x) => s + x.monto, 0);
        const j = p.jornada_id ? jornadaPorId.get(p.jornada_id) : undefined;
        const evaluacion = j ? textoJornada(j) : p.jornada_tipo === 'horario-equipo' ? `Horario de ${(p.equipo_evaluacion ?? '').replace('Huracán ', '')}`.trim() : ETIQUETA_TIPO_JORNADA[p.jornada_tipo];
        return [
          t(p.codigo), t(ETIQUETA_ESTADO[p.estado]), t(nombreAtleta(p)), t(p.fecha_nacimiento), n(p.edad_2027), t(SEXO[p.sexo]), t(p.comuna),
          t(p.es_antiguo ? 'Sí' : 'No'), t(EXPERIENCIA[p.experiencia]), t(p.club_anterior), n(p.anios_experiencia),
          t(p.programa_sugerido ? ETIQUETA_PROGRAMA[p.programa_sugerido] : ''), t(p.equipos_sugeridos.join(', ')), t(p.equipo_asignado),
          t(evaluacion), t(p.contacto_nombre), t(p.contacto_parentesco), t(p.contacto_telefono), t(p.contacto_correo), din(p.monto_estimado),
          din(confirmado), t(p.promociones_declaradas.join(', ')), t(p.promocion_validada), t(p.notas_coach), t(fechaHora(p.creado_en)),
        ];
      }),
  ];

  const pagos: Celda[][] = [
    cab('Código', 'Atleta', 'Concepto', 'Monto', 'Estado del pago', 'Confirmado', 'Registrado'),
    ...[...d.pagos]
      .sort((a, b) => Date.parse(b.creado_en) - Date.parse(a.creado_en))
      .map((x): Celda[] => {
        const p = porCodigo.get(x.postulacion_id);
        return [t(p?.codigo), t(p ? nombreAtleta(p) : ''), t(x.concepto), din(x.monto), t(x.confirmado_en ? 'Confirmado' : 'Por confirmar'), t(x.confirmado_en ? fechaHora(x.confirmado_en) : ''), t(fechaHora(x.creado_en))];
      }),
  ];

  const jornadas: Celda[][] = [
    cab('Jornada', 'Grupo', 'Abierta', 'Cupos', 'Inscritas', 'Disponibles'),
    ...r.porJornada.map((j): Celda[] => [t(j.texto), t(j.grupo), t(j.abierta ? 'Sí' : 'No'), j.cupos === null ? t('Sin límite') : n(j.cupos), n(j.inscritas), j.cupos === null ? t('Sin límite') : n(Math.max(0, j.cupos - j.inscritas))]),
  ];

  return [
    { nombre: 'Resumen', columnas: [46, 16], filas: resumen },
    { nombre: 'Postulaciones', columnas: [12, 16, 26, 14, 10, 8, 18, 12, 16, 20, 10, 16, 38, 22, 30, 26, 12, 16, 30, 14, 14, 26, 18, 36, 20], filas: postulaciones },
    { nombre: 'Pagos', columnas: [12, 26, 38, 14, 16, 20, 20], filas: pagos },
    { nombre: 'Jornadas', columnas: [34, 40, 10, 12, 12, 14], filas: jornadas },
  ];
}
