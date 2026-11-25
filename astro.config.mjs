// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// URL pública del sitio. Se ajusta cuando el club defina su dominio
// (o con la variable SITE_URL en Cloudflare Pages).
const site = process.env.SITE_URL ?? 'https://huracan-web.pages.dev';

export default defineConfig({
  site,
  integrations: [sitemap({ filter: (pagina) => !pagina.includes('/postula') && !pagina.includes('/admin') })],
  output: 'static',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
});
