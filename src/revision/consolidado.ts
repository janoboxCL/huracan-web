/* Consolidado de cambios acordados: Markdown listo para pegar en Claude Code.
   Solo incluye observaciones con decisión «Aceptada» (aún no implementadas). */

import {
  PRIORIDADES,
  SECCIONES,
  TIPOS,
  buscarSeccion,
  nombreSeccion,
  type Comentario,
  type IdPrioridad,
} from '../data/revision';

const ORDEN_PRIORIDAD: Record<IdPrioridad, number> = { imprescindible: 0, deseable: 1, 'puede-esperar': 2 };

const limpio = (texto: string) => texto.replace(/​/g, '').trim();
const ordenSeccion = (id: string) => {
  const i = SECCIONES.findIndex((s) => s.id === id);
  return i === -1 ? SECCIONES.length : i;
};

export function aceptadas(comentarios: Comentario[]): Comentario[] {
  return comentarios
    .filter((c) => c.estado === 'aceptada')
    .sort(
      (a, b) =>
        ordenSeccion(a.seccion) - ordenSeccion(b.seccion) ||
        ORDEN_PRIORIDAD[a.prioridad ?? 'puede-esperar'] - ORDEN_PRIORIDAD[b.prioridad ?? 'puede-esperar'] ||
        a.numero - b.numero,
    );
}

export function generarConsolidado(comentarios: Comentario[], ronda: number, version: string): string {
  const lista = aceptadas(comentarios);
  const fecha = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
  const lineas: string[] = [
    `# Cambios acordados con el club · Ronda ${ronda}`,
    '',
    `Generado el ${fecha} · versión revisada: ${version} · ${lista.length} cambio${lista.length === 1 ? '' : 's'}.`,
    '',
    '## Instrucciones',
    '',
    '- Implementa cada cambio respetando CLAUDE.md: contenido solo desde `docs/contenido/huracan-2027.json` y diseño según la referencia v2.',
    '- Si un cambio pide un dato que no está en el contenido oficial, no lo inventes: deja el marcador `[así]` y anótalo en «Datos pendientes».',
    '- Trabaja en una rama nueva y haz un commit por cambio (cita el número, p. ej. `#12`).',
    '- Al terminar cada cambio, ciérralo como implementado con un comentario breve **para el club** (lo lee en el panel de revisión):',
    '  `gh issue close <número> --reason completed --comment "<qué cambió>"`',
    '- Si un cambio no se puede hacer como está descrito, no lo cierres: comenta en el issue la duda o el impedimento.',
    '',
  ];

  let seccionActual = '';
  for (const c of lista) {
    if (c.seccion !== seccionActual) {
      seccionActual = c.seccion;
      const s = buscarSeccion(c.seccion);
      lineas.push(`## ${s ? nombreSeccion(s) : c.seccion}`, '');
    }
    const tipo = c.tipo ? TIPOS[c.tipo].nombre : 'Sin tipo';
    const prioridad = c.prioridad ? PRIORIDADES[c.prioridad].nombre : 'Sin prioridad';
    lineas.push(
      `### #${c.numero} · ${tipo} · ${prioridad}`,
      '',
      `**Cambio acordado:** ${limpio(c.cambio)}`,
      '',
      `Observación original del club (${limpio(c.revisor)}):`,
      ...limpio(c.comentario)
        .split('\n')
        .map((l) => `> ${l}`),
      ...(c.elemento ? ['', `Elemento señalado: \`${limpio(c.elemento).replace(/`/g, "'")}\``] : []),
      '',
    );
  }

  if (!lista.length) lineas.push('_No hay cambios aceptados pendientes de implementar._', '');
  return lineas.join('\n');
}
