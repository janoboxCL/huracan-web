/* Descarga del reporte como libro de Excel (.xlsx). La librería se carga solo al pulsar el botón. */

import { hojasReporte, type Celda, type DatosReporte } from './reportes.ts';

function aCelda(c: Celda): Record<string, unknown> {
  if (c.tipo === 'numero' || c.tipo === 'dinero') {
    return { value: c.valor ?? undefined, type: Number, ...(c.tipo === 'dinero' ? { format: '"$"#,##0' } : {}), ...(c.negrita ? { fontWeight: 'bold' } : {}) };
  }
  return { value: c.valor === null || c.valor === '' ? undefined : String(c.valor), type: String, ...(c.negrita ? { fontWeight: 'bold' } : {}) };
}

export async function generarExcel(d: DatosReporte, generado: string): Promise<Blob> {
  const { default: escribir } = await import('write-excel-file/universal');
  const hojas = hojasReporte(d, generado).map((h) => ({
    sheet: h.nombre,
    data: h.filas.map((fila) => fila.map((c) => aCelda(c))),
    columns: h.columnas.map((width) => ({ width })),
    stickyRowsCount: h.nombre === 'Resumen' ? 0 : 1,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (escribir as any)(hojas).toBlob() as Promise<Blob>;
}
