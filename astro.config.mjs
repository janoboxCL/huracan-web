// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// URL pública del sitio: siempre el dominio del club. SITE_URL (Cloudflare Pages) solo puede
// reemplazarlo por otro dominio propio; se ignora si está vacía o apunta a *.pages.dev, para que
// los enlaces canónicos, las vistas previas (WhatsApp, Instagram) y el sitemap nunca lleven al sitio de desarrollo.
const DOMINIO = 'https://huracanallstars.cl';
const definida = (process.env.SITE_URL ?? '').trim();
const site = definida && !definida.includes('pages.dev') ? definida : DOMINIO;

export default defineConfig({
  site,
  integrations: [sitemap({ filter: (pagina) => !pagina.includes('/postula') && !pagina.includes('/admin') })],
  output: 'static',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
});
