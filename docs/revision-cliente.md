# Modo revisión del cliente

Revisión guiada del sitio **sobre el sitio real** (con animaciones, versión móvil y todo). El cliente abre un enlace con una clave, recorre la página y deja comentarios clasificados por sección. Cada comentario se convierte en un **issue de GitHub** en este repositorio, así que los comentarios del cliente pasan a ser directamente las tareas pendientes del desarrollo.

## Qué ve el cliente

- **Barra inferior**: muestra la sección que está mirando, con el botón «Comentar», el resumen de la ronda (secciones con veredicto / total), un botón para ocultar los marcadores y otro para salir.
- **Marcador al inicio de cada sección** con el número de comentarios y un punto de color según su veredicto.
- **Panel de la sección**:
  - preguntas guía;
  - formulario: tipo, prioridad, comentario, «Señalar en la página» (toca un elemento y se adjunta su texto y ubicación). El dispositivo y el tamaño de pantalla se registran solos;
  - comentarios de la ronda con su estado de atención y las respuestas del equipo;
  - veredicto de la sección: Aprobada · Aprobada con cambios · Rehacer.
- **Resumen de la ronda**: avance por sección, conteo por estado y tipo, y el botón **Entregar revisión**.

Clasificaciones (se editan en `src/data/revision.ts`):

| Tipo | Uso |
|---|---|
| Contenido | Textos, datos, precios, fechas o nombres |
| Diseño | Colores, imágenes, tamaños u orden visual |
| Funcionalidad | Botones, enlaces, buscador o formularios |
| Error | Algo se ve roto o no funciona |
| Idea nueva | Fuera de alcance: va a la lista aparte y **no entra a la ronda** |

Prioridad: Imprescindible · Deseable · Puede esperar.

## Cómo queda en GitHub

- **Issue de control por ronda**: «Revisión del sitio · Ronda N» (etiquetas `revision`, `revision:ronda`, `ronda-N`). Su cuerpo tiene la tabla de veredictos por sección; cada cambio deja un comentario con el historial. Al entregar se agrega `ronda-entregada`.
- **Un issue por comentario**: título `[R1 · Programas] Contenido: …`, etiquetas `revision`, `ronda-N`, `seccion:*`, `tipo:*`, `prioridad:*`. El cuerpo incluye revisor, dispositivo, elemento señalado, URL y **versión del sitio revisada** (commit y rama de Cloudflare).
- Las etiquetas se crean solas, con sus colores, la primera vez que se usa una ronda.

### Cómo respondes tú (el cliente lo ve en el panel)

| Quieres que el cliente vea | Haz esto en el issue |
|---|---|
| En curso | Etiqueta `en-curso` |
| Pospuesto | Etiqueta `pospuesto` y un comentario con el motivo |
| Resuelto | Cerrar como **completado** |
| Descartado | Cerrar como **no planificado** («Close as not planned») y comentar el motivo |
| Una respuesta | Comentar en el issue: **el cliente lee esos comentarios**, escríbelos para él |

Si reclasificas un comentario cambiando sus etiquetas `tipo:*` o `prioridad:*`, el panel muestra la clasificación nueva.

### Trabajar los comentarios con Claude Code

Ejemplos de encargo:

> Lista con `gh issue list --label ronda-1 --label prioridad:imprescindible --state open` y resuelve los de tipo contenido uno por uno, respetando CLAUDE.md. Al terminar cada uno, comenta en el issue qué cambió (en lenguaje para el cliente) y ciérralo como completado. Las ideas nuevas no se tocan.

> Haz un resumen de la ronda 1 por sección: cuántos comentarios hay por tipo y prioridad, y qué secciones quedaron en «Rehacer».

## Puesta en marcha (una vez)

1. **Token de GitHub** (fine-grained): GitHub → Settings → Developer settings → Fine-grained tokens → Generate.
   - Repository access: *Only select repositories* → `huracan-web`.
   - Permissions → Repository → **Issues: Read and write** (Metadata: Read se agrega solo).
   - Elige una expiración y anótala: cuando venza, el modo revisión dejará de guardar.
2. **Clave del enlace**: una cadena larga y aleatoria, por ejemplo `openssl rand -hex 16`.
3. **Cloudflare Pages** → proyecto `huracan-web` → Settings → Variables and Secrets. Agrega en **Production y Preview**, como *Secret*:
   - `GITHUB_TOKEN` = el token
   - `GITHUB_REPO` = `janoboxCL/huracan-web`
   - `REVISION_CLAVE` = la clave
4. Vuelve a desplegar (los cambios de variables se aplican en el siguiente despliegue).
5. Comprueba: abre `https://huracan-web.pages.dev/?revision=<clave>`. Debe aparecer la barra inferior sin mensajes de error.

Las Functions de `functions/api/revision/` se publican solas con el sitio (Cloudflare detecta la carpeta `functions/`). Solo esas rutas ejecutan código; el resto del sitio sigue siendo estático.

## Enviar el enlace al cliente

```
https://huracan-web.pages.dev/?revision=<clave>
```

o, para revisar una rama antes de publicarla, su URL de vista previa: `https://<rama>.huracan-web.pages.dev/?revision=<clave>`.

- La clave se guarda en el navegador del cliente y desaparece de la barra de direcciones, así que puede volver otro día entrando al sitio normal.
- `?revision=salir` (o el botón de salir) desactiva el modo en ese navegador.
- Para cortar el acceso: cambia `REVISION_CLAVE` en Cloudflare y vuelve a desplegar.
- El público general no carga nada del modo revisión (solo un script de ~1,5 kB que revisa la URL).

Mensaje sugerido para el cliente: «Te comparto el sitio en modo revisión. Recorre cada sección en tu teléfono y en el computador; en cada una verás preguntas guía. Deja un comentario por tema, elige su tipo y prioridad, y marca el veredicto de la sección. Las ideas nuevas son bienvenidas, pero quedan para una etapa siguiente. Cuando termines, entra a "Resumen" y presiona "Entregar revisión". Plazo: [fecha]».

## Reglas de la ronda

1. Rondas numeradas con plazo. **Un solo revisor** del lado del club, que consolida.
2. Las **ideas nuevas** no entran a la ronda en curso: tú decides cuándo se abordan.
3. Sección **aprobada** = congelada. Cambiarla después es una solicitud nueva.
4. Cada comentario recibe respuesta: resuelto, descartado (con motivo) o pospuesto.
5. **Nueva ronda**: sube `RONDA_ACTUAL` en `src/data/revision.ts` y publica. El issue de control de la ronda nueva se crea con el primer comentario o veredicto; los de rondas anteriores quedan como registro.

## Notificaciones

Los issues se crean con **tu** token, así que GitHub no te avisa (no notifica la actividad propia). Opciones:
- Revisar el issue de control de la ronda (ahí queda la entrega) o filtrar `label:revision` en GitHub.
- Si quieres correos, crea una cuenta de GitHub aparte para el modo revisión, agrégala como colaboradora del repositorio y usa un token suyo. Como el repositorio es de tu cuenta personal, ese token tiene que ser **classic** con el permiso `repo`.

## Probar en local sin tocar GitHub

```bash
cp .dev.vars.example .dev.vars           # usa el simulador y la clave «prueba»
npm run revision:simulador               # terminal 1: GitHub simulado en :8789
npm run revision:local                   # terminal 2: build + Pages Functions en :8788
```

Abre `http://localhost:8788/?revision=prueba`. El simulador acepta además `POST /_simular/responder/:n`, `/_simular/cerrar/:n` y `/_simular/etiquetar/:n` para ver cómo le aparecen al cliente las respuestas y los estados.

## Archivos

| Archivo | Rol |
|---|---|
| `src/data/revision.ts` | Ronda vigente, secciones (selector y preguntas guía), tipos, prioridades y tipos de la API |
| `src/components/revision/ActivadorRevision.astro` | Detecta `?revision=` y carga la interfaz bajo demanda |
| `src/revision/` | Interfaz: barra, marcadores, panel, señalar elemento y estilos |
| `functions/api/revision/` | Endpoints: `estado`, `comentarios`, `secciones`, `entregar`, `respuestas/:n` |
| `src/servidor/revision/` | Clave de acceso, cliente de GitHub y formato de los issues |
| `scripts/revision-simulador.mjs` | GitHub simulado para pruebas locales |

Si agregas o renombras una sección del sitio, actualiza su entrada en `SECCIONES` (el `selector` debe apuntar al elemento de la sección).
