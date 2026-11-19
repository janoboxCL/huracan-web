/* Simulador local de la API de GitHub para probar el modo revisión sin tocar
   el repositorio real. Implementa solo lo que usa src/servidor/revision/.

   Uso:
     node scripts/revision-simulador.mjs            # escucha en http://127.0.0.1:8789
     PUERTO=9000 node scripts/revision-simulador.mjs

   En .dev.vars (para `npm run revision:local`): ver .dev.vars.example.

   Extras para probar el lado del desarrollador:
     POST /_simular/cerrar/:numero   {"motivo":"completed"|"not_planned"}
     POST /_simular/responder/:numero {"texto":"..."}
     POST /_simular/etiquetar/:numero {"etiqueta":"decision:aceptada"}
     GET  /_simular/estado            (todo el almacén) */

import { createServer } from 'node:http';

const PUERTO = Number(process.env.PUERTO ?? 8789);
const issues = [];
const etiquetas = new Map();
const comentarios = new Map();
let siguiente = 1;
const ahora = () => new Date().toISOString();

function etiqueta(nombre) {
  if (!etiquetas.has(nombre.toLowerCase())) etiquetas.set(nombre.toLowerCase(), { name: nombre, color: 'ededed' });
  return etiquetas.get(nombre.toLowerCase());
}

function responder(res, estado, datos) {
  res.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(datos === undefined ? '' : JSON.stringify(datos));
}

async function leer(req) {
  let texto = '';
  for await (const parte of req) texto += parte;
  return texto ? JSON.parse(texto) : {};
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;
  const metodo = req.method;
  try {
    let m;
    if (p === '/_simular/estado') return responder(res, 200, { issues, etiquetas: [...etiquetas.values()], comentarios: Object.fromEntries(comentarios) });
    if ((m = p.match(/^\/_simular\/(cerrar|responder|etiquetar)\/(\d+)$/)) && metodo === 'POST') {
      const issue = issues.find((i) => i.number === Number(m[2]));
      if (!issue) return responder(res, 404, { message: 'Not Found' });
      const cuerpo = await leer(req);
      if (m[1] === 'cerrar') Object.assign(issue, { state: 'closed', state_reason: cuerpo.motivo ?? 'completed' });
      if (m[1] === 'etiquetar') issue.labels.push(etiqueta(cuerpo.etiqueta));
      if (m[1] === 'responder') {
        comentarios.get(issue.number).push({ body: cuerpo.texto, created_at: ahora(), user: { login: 'janoboxCL' } });
        issue.comments++;
      }
      return responder(res, 200, issue);
    }

    if (!req.headers.authorization?.startsWith('Bearer ')) return responder(res, 401, { message: 'Bad credentials' });
    const base = p.match(/^\/repos\/[^/]+\/[^/]+(\/.*)$/);
    if (!base) return responder(res, 404, { message: 'Not Found' });
    const ruta = base[1];

    if (ruta === '/labels' && metodo === 'GET') {
      const pagina = Number(url.searchParams.get('page') ?? 1);
      return responder(res, 200, [...etiquetas.values()].slice((pagina - 1) * 100, pagina * 100));
    }
    if (ruta === '/labels' && metodo === 'POST') {
      const cuerpo = await leer(req);
      if (etiquetas.has(cuerpo.name.toLowerCase())) return responder(res, 422, { message: 'Validation Failed' });
      etiquetas.set(cuerpo.name.toLowerCase(), { name: cuerpo.name, color: cuerpo.color });
      return responder(res, 201, etiquetas.get(cuerpo.name.toLowerCase()));
    }
    if (ruta === '/issues' && metodo === 'GET') {
      const filtro = (url.searchParams.get('labels') ?? '').split(',').filter(Boolean);
      const pagina = Number(url.searchParams.get('page') ?? 1);
      const lista = issues.filter((i) => filtro.every((f) => i.labels.some((e) => e.name === f)));
      return responder(res, 200, lista.slice((pagina - 1) * 100, pagina * 100));
    }
    if (ruta === '/issues' && metodo === 'POST') {
      const cuerpo = await leer(req);
      const numero = siguiente++;
      const issue = {
        number: numero,
        html_url: `https://github.com/simulado/issues/${numero}`,
        title: cuerpo.title,
        body: cuerpo.body,
        state: 'open',
        state_reason: null,
        labels: (cuerpo.labels ?? []).map(etiqueta),
        comments: 0,
        created_at: ahora(),
      };
      issues.push(issue);
      comentarios.set(numero, []);
      console.log(`issue #${numero}: ${issue.title}`);
      return responder(res, 201, issue);
    }
    if ((m = ruta.match(/^\/issues\/(\d+)(\/comments|\/labels)?$/))) {
      const issue = issues.find((i) => i.number === Number(m[1]));
      if (!issue) return responder(res, 404, { message: 'Not Found' });
      if (!m[2] && metodo === 'GET') return responder(res, 200, issue);
      if (!m[2] && metodo === 'PATCH') {
        Object.assign(issue, await leer(req));
        return responder(res, 200, issue);
      }
      if (m[2] === '/comments' && metodo === 'GET') return responder(res, 200, comentarios.get(issue.number));
      if (m[2] === '/comments' && metodo === 'POST') {
        const cuerpo = await leer(req);
        comentarios.get(issue.number).push({ body: cuerpo.body, created_at: ahora(), user: { login: 'bot-revision' } });
        issue.comments++;
        return responder(res, 201, {});
      }
      if (m[2] === '/labels' && metodo === 'PUT') {
        const cuerpo = await leer(req);
        issue.labels = cuerpo.labels.map(etiqueta);
        return responder(res, 200, issue.labels);
      }
      if (m[2] === '/labels' && metodo === 'POST') {
        const cuerpo = await leer(req);
        for (const n of cuerpo.labels) if (!issue.labels.some((e) => e.name === n)) issue.labels.push(etiqueta(n));
        return responder(res, 200, issue.labels);
      }
    }
    responder(res, 404, { message: 'Not Found' });
  } catch (e) {
    console.error(e);
    responder(res, 500, { message: String(e) });
  }
});

servidor.listen(PUERTO, '127.0.0.1', () => console.log(`Simulador de GitHub en http://127.0.0.1:${PUERTO}`));
