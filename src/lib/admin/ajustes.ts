/* Ajustes editables del sitio (tabla ajustes_sitio): banner e inscripciones. Funciones puras.
   Hoy el sitio público todavía no los lee; el CRM solo los guarda. */

import type { Ajustes, Banner, Inscripciones } from './tipos.ts';

export const AJUSTES_POR_DEFECTO: Ajustes = {
  banner: { visible: false, texto: '', enlace: '' },
  inscripciones: { estado: 'abiertas' },
};

export const MAX_TEXTO_BANNER = 160;

/** Lee `valor` (jsonb) con tolerancia: lo que falte o venga mal se reemplaza por el valor por defecto. */
export function leerBanner(valor: unknown): Banner {
  const v = (typeof valor === 'object' && valor !== null ? valor : {}) as Record<string, unknown>;
  return {
    visible: v['visible'] === true,
    texto: typeof v['texto'] === 'string' ? v['texto'] : '',
    enlace: typeof v['enlace'] === 'string' ? v['enlace'] : '',
  };
}

export function leerInscripciones(valor: unknown): Inscripciones {
  const v = (typeof valor === 'object' && valor !== null ? valor : {}) as Record<string, unknown>;
  return { estado: v['estado'] === 'cerradas' ? 'cerradas' : 'abiertas' };
}

export type ErroresBanner = Partial<Record<'texto' | 'enlace', string>>;

/** El enlace puede ser una ruta del sitio (`/postula`, `#contacto`) o una dirección `https://`. */
export function enlaceValido(enlace: string): boolean {
  if (enlace === '') return true;
  if (/^(\/|#)[^\s]*$/.test(enlace)) return true;
  try {
    return new URL(enlace).protocol === 'https:';
  } catch {
    return false;
  }
}

export function validarBanner(b: Banner): ErroresBanner {
  const errores: ErroresBanner = {};
  const texto = b.texto.trim();
  if (b.visible && texto === '') errores.texto = 'Escribe el texto del banner o desactiva «Mostrar banner».';
  if (texto.length > MAX_TEXTO_BANNER) errores.texto = `El texto admite hasta ${MAX_TEXTO_BANNER} caracteres.`;
  if (!enlaceValido(b.enlace.trim())) errores.enlace = 'Usa una ruta del sitio (por ejemplo /postula) o una dirección que empiece con https://.';
  return errores;
}
