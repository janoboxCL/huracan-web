/* Piezas de interfaz compartidas por las páginas del CRM (HTML como texto, siempre escapado). */

import { ETIQUETA_ESTADO } from '../../lib/admin/estados.ts';
import { esc } from '../../lib/admin/formato.ts';
import type { EstadoOcupacion } from '../../lib/admin/jornadas.ts';
import type { Estado } from '../../lib/admin/tipos.ts';

export function insignia(estado: Estado): string {
  return `<span class="adm-insignia adm-insignia--${estado}">${esc(ETIQUETA_ESTADO[estado])}</span>`;
}

export function barraOcupacion(o: EstadoOcupacion): string {
  const barra =
    o.cupos === null
      ? ''
      : `<span class="adm-barra" aria-hidden="true"><span class="adm-barra__relleno adm-barra__relleno--${o.nivel}" style="transform: scaleX(${o.porcentaje / 100})"></span></span>`;
  return `<div class="adm-ocupacion adm-ocupacion--${o.nivel}">${barra}<span class="adm-ocupacion__texto">${esc(o.texto)}</span></div>`;
}

export function opciones(lista: readonly { valor: string; texto: string }[], seleccionado: string): string {
  return lista.map((o) => `<option value="${esc(o.valor)}"${o.valor === seleccionado ? ' selected' : ''}>${esc(o.texto)}</option>`).join('');
}

export type TipoAviso = 'ok' | 'error' | 'info';

/** Escribe un mensaje en una región `aria-live` (la región debe existir en el HTML). */
export function avisar(zona: HTMLElement | null, tipo: TipoAviso, texto: string): void {
  if (!zona) return;
  zona.className = `adm-aviso adm-aviso--${tipo}`;
  zona.textContent = texto;
  zona.hidden = texto === '';
}

/** Bloquea un botón mientras dura una operación y devuelve una función que lo libera. */
export function ocupar(boton: HTMLButtonElement | null, textoOcupado: string): () => void {
  if (!boton) return () => undefined;
  const original = boton.textContent;
  boton.disabled = true;
  boton.textContent = textoOcupado;
  boton.setAttribute('aria-busy', 'true');
  return () => {
    boton.disabled = false;
    boton.textContent = original;
    boton.removeAttribute('aria-busy');
  };
}

export function consulta<T extends HTMLElement>(selector: string, raiz: ParentNode = document): T {
  const el = raiz.querySelector<T>(selector);
  if (!el) throw new Error(`Falta el elemento ${selector} en la página.`);
  return el;
}

/** Lleva el foco a una región de aviso (`role=status`) para no perderlo tras repintar. */
export function enfocarAviso(zona: HTMLElement | null): void {
  if (!zona || zona.hidden) return;
  zona.setAttribute('tabindex', '-1');
  zona.focus();
}

/** Texto de pista que se muestra bajo las tablas con desplazamiento lateral. */
const TEXTO_PISTA = 'Desliza la tabla hacia los lados para ver todas las columnas.';
let escuchandoRedimension = false;

function actualizarPista(contenedor: HTMLElement): void {
  const pista = contenedor.nextElementSibling instanceof HTMLElement && contenedor.nextElementSibling.hasAttribute('data-pista-scroll') ? contenedor.nextElementSibling : null;
  const desborda = contenedor.scrollWidth > contenedor.clientWidth + 1;
  if (!desborda) {
    pista?.setAttribute('hidden', '');
    return;
  }
  const el = pista ?? contenedor.insertAdjacentElement('afterend', Object.assign(document.createElement('p'), { className: 'adm-pista-scroll', textContent: TEXTO_PISTA }));
  if (!el) return;
  el.setAttribute('data-pista-scroll', '');
  el.removeAttribute('hidden');
  contenedor.dataset['desplazable'] = 'true';
  contenedor.addEventListener('scroll', () => el.setAttribute('hidden', ''), { once: true, passive: true });
}

/** Muestra una pista de desplazamiento bajo cada tabla que desborda su contenedor. */
export function activarPistas(raiz: ParentNode = document): void {
  raiz.querySelectorAll<HTMLElement>('.adm-tabla-contenedor').forEach(actualizarPista);
  if (escuchandoRedimension) return;
  escuchandoRedimension = true;
  window.addEventListener('resize', () => document.querySelectorAll<HTMLElement>('.adm-tabla-contenedor').forEach(actualizarPista), { passive: true });
}

/** Clave de sessionStorage con los filtros de la lista de postulaciones, para «← Volver». */
export const CLAVE_FILTROS = 'huracan-admin-filtros';
