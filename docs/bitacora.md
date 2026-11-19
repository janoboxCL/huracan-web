# Bitácora · Etapa 1

Registro del modo piloto automático: un bloque por entrada, con veredicto final, pendientes y capturas.
Las capturas viven en `.revision/` (ignorada por git) y se regeneran con `npm run capturas`.

## Datos pendientes detectados al construir

_(se completa bloque a bloque)_

---

## Bloque 1 · Hero + cintas cruzadas

- **Veredicto final:** Aprobado con cambios (2 rondas, sin Bloqueantes tras la corrección). Build y `astro check` sin errores.
- **Corregido en la ronda 1:** bloque amarillo pisando el texto entre 864 y 1400 px (ahora aparece desde 88 rem), nav del header en dos filas, barra de cifras bajo el pliegue, cinta del lema leída 8 veces por lectores de pantalla; además marquee con pausa y objetivos táctiles de la nav de 44 px.
- **Pendientes (Importante, dependen de otras secciones):** los CTA «Agenda tu evaluación» y la navegación apuntan a anclas que aún no existen (`#cierre`, `#club`, `#programas`, `#equipos`, `#temporada`, `#valores`); se resuelve al construir cada sección (`src/data/enlaces.ts`).
- **Pendientes (Menor):**
  - Hero apretado entre 1408 y 1440 px (botón secundario a ~10 px de la franja); valorar breakpoint 90 rem.
  - Imagen del atleta se descarga con el hero en modo móvil/tablet aunque esté oculta; `sizes` y `alt` por afinar.
  - Cortina distinta de la v2 (`fixed`, parte en −120 %, sin retardo de 0,1 s).
  - Cinta oscura de los lemas: `top` y `height` ~18 px sobre la v2.
  - Logo de baja resolución (247 px): pedir el vector al club.
- **Marcadores `[así]`:** ninguno activo (la barra del hero cae en `[dato por confirmar]` solo si falta un hito).
- **Capturas 390 px:** `.revision/inicio-390-sin-movimiento.png`, `.revision/inicio-390-mov-00.png`, `.revision/inicio-390-mov-01.png`
- **Capturas 1440 px:** `.revision/inicio-1440-sin-movimiento.png`, `.revision/inicio-1440-mov-00.png`, `.revision/inicio-1440-mov-01.png`

---

## Bloque 2 · El club + hitos

- **Veredicto final:** Aprobado con cambios (1 ronda, sin Bloqueantes). Build y `astro check` sin errores.
- **Corregido:** el recorte del dúo caía bajo el texto entre 992 y 1100 px (ahora aparece desde 70 rem); `role="list"` en la lista de hitos.
- **Pendientes (Menor):**
  - La corriente de viento cruza el texto de los hitos (2003, 2010, 2017); bajar `top` o la opacidad.
  - El párrafo de historia es el texto oficial completo, mucho más largo que la síntesis de la v2 y repite los hitos de abajo. Decidir con el club; si se acorta, agregar un campo `historiaCorta` al JSON (no se inventa).
  - El botón «Conoce al staff» apunta a `#staff`, que aún no existe (se resuelve en el bloque 8).
  - Hueco amarillo de ~250 px bajo el texto a 1440 px.
  - La sección mide más de 1500 px a 1120 y 1280 px; revisar en la revisión final.
  - Clase `.sobre-negro` usada pero sin definir en `base.css` (no hace nada hoy).
- **Marcadores `[así]`:** ninguno.
- **Capturas 390 px:** `.revision/inicio-390-sin-movimiento.png`, `.revision/inicio-390-mov-00.png`, `.revision/inicio-390-mov-01.png`
- **Capturas 1440 px:** `.revision/inicio-1440-sin-movimiento.png`, `.revision/inicio-1440-mov-00.png`, `.revision/inicio-1440-mov-01.png`

---

## Bloque 3 · Programas

- **Veredicto final:** Aprobado con cambios (1 ronda, sin Bloqueantes). Build y `astro check` sin errores.
- **Corregido:** nombre «International» desbordaba su caja en escritorio (ahora `12cqi`, sin desborde a 390, 1280, 1440 y 1920 px); detalle duplicado en Novice y Prep (se quitó el chip «Open» y queda el `detalle` del JSON tal cual); foto de fondo casi invisible (filtro `contrast(1.2) brightness(0.45)`, velo 45 %); línea tenue entre hitos y Programas (`margin-top: -1px`).
- **Pendientes / decisiones a validar con el club (Menor):**
  - Textos que no salen del JSON: la bajada «Cuatro niveles, un mismo camino: del juego y la motricidad a la élite internacional.», el «al mes» junto al precio y el prefijo «Desde N años» (todos vienen de la maqueta v2).
  - «Hasta Senior» no se explica en la sección; el JSON lo trae así.
  - Las tarjetas muestran descripción y detalle completos del JSON, más largos que los resúmenes de la v2.
  - Tarjeta de Recreativo con vacío central a 1440 px (altura igualada).
- **Marcadores `[así]`:** ninguno.
- **Capturas 390 px:** `.revision/inicio-390-sin-movimiento.png`, `.revision/inicio-390-mov-00.png`, `.revision/inicio-390-mov-01.png`
- **Capturas 1440 px:** `.revision/inicio-1440-sin-movimiento.png`, `.revision/inicio-1440-mov-00.png`, `.revision/inicio-1440-mov-01.png`, `.revision/prog-check.png` (sección Programas con la foto cargada)

---
