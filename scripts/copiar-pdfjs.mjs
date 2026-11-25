// Copia a public/pdfjs/wasm los decodificadores de PDF.js (JBIG2, JPEG 2000 y color).
// El informativo trae imágenes JBIG2 y PDF.js las pide en tiempo de ejecución (`wasmUrl`).
// Se ejecuta antes de `dev` y `build`; la carpeta de destino no se versiona.
import { cp, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const origen = join('node_modules', 'pdfjs-dist', 'wasm');
const destino = join('public', 'pdfjs', 'wasm');
const necesarios = /^(jbig2|openjpeg|qcms_bg|LICENSE_)/;

await mkdir(destino, { recursive: true });
for (const nombre of await readdir(origen)) {
  if (necesarios.test(nombre)) await cp(join(origen, nombre), join(destino, nombre));
}
console.log(`PDF.js: decodificadores copiados a ${destino}`);
