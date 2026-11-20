// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// URL pública del sitio. Se ajusta cuando el club defina su dominio
// (o con la variable SITE_URL en Cloudflare Pages).
const site = process.env.SITE_URL ?? 'https://huracan-web.pages.dev';

// Versión del sitio que ve el modo revisión: cada comentario del cliente queda
// asociado al commit y la rama publicados (variables de Cloudflare Pages).
const versionSitio = {
  commit: (process.env.CF_PAGES_COMMIT_SHA ?? 'local').slice(0, 7),
  rama: process.env.CF_PAGES_BRANCH ?? 'local',
  publicada: new Date().toISOString(),
};

export default defineConfig({
  site,
  integrations: [sitemap()],
  output: 'static',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
  vite: {
    define: { __VERSION_SITIO__: JSON.stringify(versionSitio) },
  },
});
