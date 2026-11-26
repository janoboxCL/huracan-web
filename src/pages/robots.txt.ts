import type { APIRoute } from 'astro';

// robots.txt generado en el build: la URL del sitemap sale de `site` (dominio del club), así
// sigue al dominio configurado en astro.config.mjs.
export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://huracanallstars.cl');
  const cuerpo = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${new URL('sitemap-index.xml', base).href}\n`;
  return new Response(cuerpo, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
