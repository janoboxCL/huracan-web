/* «Señalar un elemento»: el revisor toca o hace clic en una parte concreta de la
   página y se guarda una descripción legible (texto visible + ruta CSS corta). */

const LIMITE_TEXTO = 120;

function textoVisible(el: Element): string {
  const candidato =
    el.getAttribute('aria-label') ||
    (el instanceof HTMLImageElement ? el.alt && `Imagen: ${el.alt}` : '') ||
    (el instanceof HTMLElement ? el.innerText : el.textContent) ||
    '';
  const limpio = candidato.replace(/\s+/g, ' ').trim();
  return limpio.length > LIMITE_TEXTO ? `${limpio.slice(0, LIMITE_TEXTO - 1)}…` : limpio;
}

function ruta(el: Element): string {
  const partes: string[] = [];
  let actual: Element | null = el;
  while (actual && actual !== document.body && partes.length < 4) {
    let parte = actual.tagName.toLowerCase();
    if (actual.id) {
      partes.unshift(`${parte}#${actual.id}`);
      break;
    }
    const clase = [...actual.classList].find((c) => !c.startsWith('astro-'));
    if (clase) parte += `.${clase}`;
    partes.unshift(parte);
    actual = actual.parentElement;
  }
  return partes.join(' > ');
}

export function describirElemento(el: Element): string {
  const texto = textoVisible(el);
  return texto ? `«${texto}» — ${ruta(el)}` : ruta(el);
}

/** Activa el modo señalar. Resuelve con el elemento elegido o `null` si se cancela. */
export function senalar(esUi: (el: Element) => boolean): Promise<Element | null> {
  return new Promise((resolver) => {
    const marco = document.createElement('div');
    marco.className = 'rv-raiz rv-senalar-marco';
    const aviso = document.createElement('div');
    aviso.className = 'rv-raiz rv-senalar-aviso';
    aviso.setAttribute('role', 'status');
    aviso.textContent = 'Toca o haz clic en la parte de la página que quieres señalar.';
    const cancelar = document.createElement('button');
    cancelar.type = 'button';
    cancelar.className = 'rv-boton rv-boton--claro';
    cancelar.textContent = 'Cancelar';
    aviso.append(cancelar);
    document.body.append(marco, aviso);
    document.documentElement.classList.add('rv-senalando');

    const objetivo = (e: Event): Element | null => {
      const el = e.target instanceof Element ? e.target : null;
      return el && !esUi(el) ? el : null;
    };
    const dibujar = (el: Element) => {
      const r = el.getBoundingClientRect();
      Object.assign(marco.style, {
        display: 'block',
        transform: `translate(${r.left - 3}px, ${r.top - 3}px)`,
        width: `${r.width + 6}px`,
        height: `${r.height + 6}px`,
      });
    };
    const mover = (e: PointerEvent) => {
      const el = objetivo(e);
      if (el) dibujar(el);
    };
    const bloquear = (e: Event) => {
      if (objetivo(e)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const elegir = (e: MouseEvent) => {
      const el = objetivo(e);
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      dibujar(el);
      terminar(el);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') terminar(null);
    };
    function terminar(el: Element | null) {
      window.removeEventListener('pointermove', mover, true);
      window.removeEventListener('pointerdown', bloquear, true);
      window.removeEventListener('click', elegir, true);
      window.removeEventListener('keydown', tecla, true);
      document.documentElement.classList.remove('rv-senalando');
      setTimeout(() => marco.remove(), el ? 450 : 0);
      aviso.remove();
      resolver(el);
    }
    cancelar.addEventListener('click', () => terminar(null));
    window.addEventListener('pointermove', mover, true);
    window.addEventListener('pointerdown', bloquear, true);
    window.addEventListener('click', elegir, true);
    window.addEventListener('keydown', tecla, true);
    cancelar.focus();
  });
}
