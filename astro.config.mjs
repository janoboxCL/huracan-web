// @ts-check
import { defineConfig } from 'astro/config';

// URL pública del sitio. Se ajusta cuando el club defina su dominio
// (o con la variable SITE_URL en Cloudflare Pages).
const site = process.env.SITE_URL ?? 'https://huracan-web.pages.dev';

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'auto' },
});
