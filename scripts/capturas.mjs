// Capturas para revisión visual.
// Uso: npm run preview (en otra terminal) y luego: npm run capturas [-- /ruta1,/ruta2]
// Requiere: npm i -D playwright && npx playwright install chromium
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.env.URL || 'http://localhost:4321';
const rutas = (process.argv[2] || '/').split(',').map((r) => r.trim()).filter(Boolean);
const anchos = [390, 820, 1440];
const salida = '.revision';

await mkdir(salida, { recursive: true });
const browser = await chromium.launch();

for (const ruta of rutas) {
  const nombre = ruta === '/' ? 'inicio' : ruta.replace(/^\/|\/$/g, '').replace(/\//g, '-');
  for (const ancho of anchos) {
    // Sin movimiento: página completa (todo debe verse sin animaciones).
    const quieto = await browser.newContext({ viewport: { width: ancho, height: 900 }, reducedMotion: 'reduce' });
    const p1 = await quieto.newPage();
    await p1.goto(base + ruta, { waitUntil: 'networkidle' });
    await p1.screenshot({ path: `${salida}/${nombre}-${ancho}-sin-movimiento.png`, fullPage: true });
    await quieto.close();

    // Con movimiento: una captura por pantalla mientras se hace scroll,
    // porque los reveals ligados al scroll solo se ven dentro de la vista.
    const movil = await browser.newContext({ viewport: { width: ancho, height: 900 }, reducedMotion: 'no-preference' });
    const p2 = await movil.newPage();
    await p2.goto(base + ruta, { waitUntil: 'networkidle' });
    await p2.waitForTimeout(2200); // entrada del hero
    const alto = await p2.evaluate(() => document.documentElement.scrollHeight);
    let i = 0;
    for (let y = 0; y < alto; y += 800) {
      await p2.evaluate((pos) => window.scrollTo(0, pos), y);
      await p2.waitForTimeout(450);
      await p2.screenshot({ path: `${salida}/${nombre}-${ancho}-mov-${String(i).padStart(2, '0')}.png` });
      i += 1;
    }
    await movil.close();
  }
}

await browser.close();
console.log(`Capturas listas en ${salida}/`);
