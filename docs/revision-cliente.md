# Modo revisión: control de cambios con el club

El club revisa el sitio **real** (animaciones, versión móvil, todo) y deja observaciones por sección. Tú respondes y decides sobre cada una en un hilo. Lo aceptado se junta en un **consolidado** listo para pasárselo a Claude Code. Todo queda registrado como **issues de GitHub** en este repositorio.

## Roles

La clave del enlace define el rol:

| | Club (`REVISION_CLAVE`) | Equipo (`REVISION_CLAVE_EQUIPO`) |
|---|---|---|
| Crear observaciones | Sí | No |
| Veredicto por sección y entrega de la ronda | Sí | Solo ve |
| Responder en el hilo | Sí | Sí |
| Decidir (aceptar, aclarar, posponer, rechazar, implementada) | No | Sí |
| Bandeja y consolidado para Claude Code | No | Sí |

## Ciclo de una observación

```
Club crea la observación ─▶ Por responder (le toca al equipo)
   Equipo responde y decide:
   ├─ Requiere aclaración ─▶ le toca al club ─▶ el club responde ─▶ le toca al equipo
   ├─ Aceptada + cambio acordado ─▶ entra al consolidado
   │      └─ Claude Code lo implementa y cierra el issue ─▶ Implementada
   ├─ Pospuesta (con motivo)
   └─ Rechazada (con motivo) ─▶ issue cerrado como «no planificado»
El club puede responder en cualquier momento. Si responde sobre algo cerrado, se reabre y vuelve a «Por responder».
```

- **Cambio acordado**: al aceptar, el equipo escribe la instrucción concreta («Agregar Mini Level 1, 5 a 8 años, al listado de equipos»). Eso, y no el texto original del club, es lo que entra al consolidado. Si después de conversar cambia lo acordado, vuelve a aceptar con el texto nuevo.
- **Turno**: cada observación indica a quién le toca responder. La barra inferior y las pestañas muestran cuántas esperan tu respuesta.

## Qué ve cada uno

**Club**
- Barra inferior con la sección que está mirando, «Comentar», el resumen (secciones con veredicto y respuestas pendientes), ocultar marcadores y salir.
- Marcador al inicio de cada sección con el número de observaciones; en rojo si alguna espera su respuesta.
- Panel de sección: preguntas guía, formulario (tipo, prioridad, «Señalar en la página»; el dispositivo se registra solo), observaciones con su hilo y el veredicto de la sección (Aprobada · Aprobada con cambios · Rehacer).
- Resumen: observaciones filtrables (esperan tu respuesta, esperando al equipo, aceptadas, etc.), avance por sección y botón **Entregar revisión**.

**Equipo**
- La misma página, sin formulario de observaciones.
- **Bandeja**: observaciones filtrables (por responder, esperando al club, aceptadas, pospuestas, cerradas), cada una con «Responder o decidir». También muestra si el club ya entregó y sus veredictos por sección.
- **Consolidado**: las observaciones aceptadas y no implementadas, ordenadas por sección y prioridad, en Markdown con instrucciones para Claude Code. Botones **Copiar para Claude Code** y **Descargar .md**.

Clasificaciones (se editan en `src/data/revision.ts`): tipo (Contenido, Diseño, Funcionalidad, Error, Idea nueva) y prioridad (Imprescindible, Deseable, Puede esperar).

## Pasarle los cambios a Claude Code

1. En la pestaña **Consolidado**, presiona **Copiar para Claude Code** y pégalo en una sesión de Claude Code sobre este repositorio.
2. El texto le indica implementar cada cambio según `CLAUDE.md`, hacer un commit por cambio y cerrar cada issue con un comentario para el club:
   `gh issue close <número> --reason completed --comment "<qué cambió>"`
3. Al cerrarse, la observación pasa a **Implementada** y el club ve ese comentario en el hilo.
4. Si Claude Code no puede hacer un cambio, comenta en el issue y lo deja abierto. Ese comentario aparece en el hilo como respuesta del equipo.

## Cómo queda en GitHub

- **Issue de control por ronda**: «Revisión del sitio · Ronda N» (`revision`, `revision:ronda`, `ronda-N`). Tiene la tabla de veredictos por sección y la entrega, con un comentario por cada cambio.
- **Un issue por observación**: `[R1 · Equipos] Contenido: …`, con etiquetas `revision`, `ronda-N`, `seccion:*`, `tipo:*` y `prioridad:*`. Además:
  - `decision:aclaracion`, `decision:aceptada` o `decision:pospuesta`;
  - `esperando:equipo` o `esperando:cliente`;
  - cerrado como completado = Implementada; cerrado como «no planificado» = Rechazada.
- El cuerpo del issue incluye la observación, el elemento señalado, el **cambio acordado** y la versión del sitio revisada (commit y rama).
- Los comentarios enviados desde el sitio llevan rol y autor. Los que escribes directamente en GitHub (o los de Claude Code) aparecen como respuesta del equipo.
- Las etiquetas se crean solas, con sus colores, la primera vez que se usa una ronda.

Conviene decidir desde el panel y no editando etiquetas a mano: así se mantienen la decisión y el turno de forma coherente.

## Puesta en marcha (una vez)

1. **Token de GitHub** (fine-grained): GitHub → Settings → Developer settings → Fine-grained tokens → Generate.
   - Repository access: *Only select repositories* → `huracan-web`.
   - Permissions → Repository → **Issues: Read and write** (Metadata: Read se agrega solo).
   - Anota la expiración: cuando venza, el modo revisión deja de guardar.
2. **Dos claves** distintas, largas y aleatorias (por ejemplo `openssl rand -hex 16`): una para el club y otra para ti.
3. **Cloudflare Pages** → proyecto `huracan-web` → Settings → Variables and Secrets. Agrega en **Production y Preview**, como *Secret*:
   - `GITHUB_TOKEN` = el token
   - `GITHUB_REPO` = `janoboxCL/huracan-web`
   - `REVISION_CLAVE` = clave del club
   - `REVISION_CLAVE_EQUIPO` = tu clave
4. Vuelve a desplegar (los cambios de variables se aplican en el siguiente despliegue).
5. Comprueba con ambos enlaces que aparezca la barra inferior con «Club» o «Equipo».

Las Functions de `functions/api/revision/` se publican solas con el sitio. Solo esas rutas ejecutan código; el resto del sitio sigue siendo estático.

## Enlaces

```
Club:   https://huracan-web.pages.dev/?revision=<clave del club>
Equipo: https://huracan-web.pages.dev/?revision=<tu clave>
```

Para revisar una rama antes de publicarla: `https://<rama>.huracan-web.pages.dev/?revision=<clave>`.

- La clave queda guardada en ese navegador y desaparece de la barra de direcciones. Se puede volver otro día entrando al sitio normal.
- Un navegador recuerda un solo rol. Para cambiar de rol, abre el enlace con la otra clave. `?revision=salir` (o el botón de salir) desactiva el modo.
- Para cortar el acceso del club, cambia `REVISION_CLAVE` en Cloudflare y vuelve a desplegar.
- El público general no carga nada del modo revisión, salvo un script de ~1,5 kB que revisa la URL.

Mensaje sugerido para el club: «Te comparto el sitio en modo revisión. Recorre cada sección en tu teléfono y en el computador; en cada una verás preguntas guía. Deja una observación por tema, con su tipo y prioridad, y marca el veredicto de la sección. Te voy a responder en cada observación; si te pregunto algo, la verás marcada como "Esperando tu respuesta". Las ideas nuevas son bienvenidas, pero quedan para una etapa siguiente. Cuando termines, entra a "Resumen" y presiona "Entregar revisión". Plazo: [fecha]».

## Reglas de la ronda

1. Rondas numeradas con plazo. **Un solo revisor** del lado del club, que consolida.
2. Solo el club crea observaciones; el equipo responde y decide.
3. Las **ideas nuevas** no entran a la ronda en curso salvo que el equipo las acepte expresamente.
4. Sección **aprobada** = congelada. Cambiarla después es una observación nueva.
5. Toda observación termina con decisión: implementada, rechazada (con motivo) o pospuesta.
6. **Nueva ronda**: sube `RONDA_ACTUAL` en `src/data/revision.ts` y publica. El issue de control nuevo se crea con la primera acción; los de rondas anteriores quedan como registro.

## Notificaciones

Los issues y comentarios se crean con **tu** token, y GitHub no notifica la actividad propia. Para saber si hay algo nuevo, mira el contador de la barra con tu enlace de equipo o filtra `label:esperando:equipo` en GitHub. Si quieres correos, crea una cuenta de GitHub aparte para el modo revisión, agrégala como colaboradora del repositorio y usa un token suyo. Como el repositorio es de tu cuenta personal, ese token tiene que ser **classic** con el permiso `repo`.

## Probar en local sin tocar GitHub

```bash
cp .dev.vars.example .dev.vars           # claves «prueba» (club) y «equipo-prueba» (equipo)
npm run revision:simulador               # terminal 1: GitHub simulado en :8789
npm run revision:local                   # terminal 2: build + Pages Functions en :8788
```

Abre `http://localhost:8788/?revision=prueba` (club) y, en otro navegador o ventana privada, `http://localhost:8788/?revision=equipo-prueba` (equipo). El simulador acepta además `POST /_simular/responder/:n` y `/_simular/cerrar/:n` para imitar lo que haría Claude Code.

## Archivos

| Archivo | Rol |
|---|---|
| `src/data/revision.ts` | Ronda vigente, secciones (selector y preguntas guía), tipos, prioridades, decisiones, roles y tipos de la API |
| `src/components/revision/ActivadorRevision.astro` | Detecta `?revision=` y carga la interfaz bajo demanda |
| `src/revision/` | Interfaz: barra, marcadores, panel, hilos, bandeja, consolidado, señalar elemento y estilos |
| `functions/api/revision/` | Endpoints: `estado`, `comentarios` (club), `secciones` (club), `entregar` (club), `respuestas/:n` (GET y POST) |
| `src/servidor/revision/` | Claves y roles, cliente de GitHub, formato de los issues y reglas de decisión y turno |
| `scripts/revision-simulador.mjs` | GitHub simulado para pruebas locales |

Si agregas o renombras una sección del sitio, actualiza su entrada en `SECCIONES` (el `selector` debe apuntar al elemento de la sección).
