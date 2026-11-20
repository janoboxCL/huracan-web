/* Mini ayudante para crear DOM sin innerHTML: todo texto de usuario entra como texto. */

type Hijo = Node | string | number | null | undefined | false;
type Atributos = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  atributos: Atributos = {},
  ...hijos: Array<Hijo | Hijo[]>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(etiqueta);
  for (const [nombre, valor] of Object.entries(atributos)) {
    if (valor === undefined || valor === null || valor === false) continue;
    if (nombre.startsWith('on') && typeof valor === 'function') {
      el.addEventListener(nombre.slice(2).toLowerCase(), valor as EventListener);
    } else if (nombre === 'class') {
      el.className = String(valor);
    } else if (nombre === 'value' && 'value' in el) {
      (el as HTMLInputElement).value = String(valor);
    } else if (nombre === 'checked' && 'checked' in el) {
      (el as HTMLInputElement).checked = Boolean(valor);
    } else {
      el.setAttribute(nombre, valor === true ? '' : String(valor));
    }
  }
  for (const hijo of hijos.flat()) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    el.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return el;
}

/** SVG fijo del propio código (nunca texto de usuario). */
export function icono(svg: string): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = 'rv-icono';
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = svg;
  return s;
}

export const ICONOS = {
  globo:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.5-4.8A8 8 0 1 1 21 12Z"/></svg>',
  cerrar:
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  mira:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>',
  lista:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  ojo:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  salir:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>',
};

export function formatearFecha(iso: string): string {
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}
