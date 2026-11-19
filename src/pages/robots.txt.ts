import type { APIRoute } from 'astro';

// robots.txt generado en el build: la URL del sitemap sale de `site` (SITE_URL), así
// cambia sola cuando el club defina su dominio.
export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://huracan-web.pages.dev');
  const cuerpo = `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap-index.xml', base).href}\n`;
  return new Response(cuerpo, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
