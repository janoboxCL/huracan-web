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

## Bloque 4 · Equipos con buscador interactivo

- **Veredicto final:** Aprobado con cambios (1 ronda, sin Bloqueantes). Build y `astro check` sin errores. Filtro verificado contra el JSON en 8 edades (3, 4, 7, 9, 10, 15, 19, 20+) y de nuevo tras las correcciones (3, 9, 10, 15, 20+).
- **Corregido:** salto de altura de la sección al filtrar (el script reserva el peor caso medido, sin valores fijos; altura idéntica para todas las edades en 390, 1024 y 1440 px); textos que no tenían sentido sin JavaScript (ahora hay bajada y CTA neutros, y la versión «Toca la edad…» solo con JS); `aria-label="20+ años"`.
- **Decisiones de diseño a validar:**
  - En móvil (menos de 40 rem) la lista de equipos es una fila deslizable con `scroll-snap`, para no reservar un hueco enorme.
  - En escritorio, con pocas tarjetas (p. ej. 3 años: 1 equipo) quedan ~600 px de amarillo vacío bajo la tarjeta, costo de no mover el layout. Reevaluar en la revisión final.
  - Edad inicial 10 y tope «20+» vienen de la maqueta, no del JSON; confirmar con el club.
  - Textos fuera del JSON: bajada «Toca la edad…», formato del contador, mapa de género (Mixto/Damas), prefijo «Programa · Categoría».
  - La nota «Categorías y niveles tentativos 2027» (`_notaEquipos` del JSON) no se muestra en la sección; valorar mostrarla.
- **Pendientes:** el CTA «Agenda…» apunta a `#cierre` (provisorio, bloque 9) y no pasa la edad elegida; separación superior ~190 px frente a 170 px de la maqueta.
- **Marcadores `[así]`:** ninguno.
- **Capturas 390 px:** `.revision/inicio-390-sin-movimiento.png`, `.revision/inicio-390-mov-00.png`, `.revision/inicio-390-mov-01.png`
- **Capturas 1440 px:** `.revision/inicio-1440-sin-movimiento.png`, `.revision/inicio-1440-mov-00.png`, `.revision/inicio-1440-mov-01.png`

---

## Bloque 5 · Cómo funciona

- **Veredicto final:** Aprobado con cambios (1 ronda, sin Bloqueantes ni Importantes). Build y `astro check` sin errores. No hubo ronda de correcciones: solo hallazgos Menores.
- **Verificado:** los 4 pasos, el resumen y la franja salen del JSON; `procesoActualDelPdf` y `_notaPago` NO se publican (0 coincidencias en `dist/index.html`, tampoco datos bancarios). Contraste AA independiente de la foto (todo el texto va sobre cajas negras).
- **Pendientes (Menor):**
  - La caja inclinada sobresale ~3 px del viewport en móvil (390 px); ampliar margen derecho a ~1 rem.
  - «Pre-inscripción» se parte en dos líneas entre ~1100 y 1250 px; usar `clamp()` en el tamaño del título del paso.
  - La caja negra tapa buena parte del sujeto de la foto a 1440 px; ajustar `object-position`.
  - El botón «Agenda tu evaluación →» de la franja es un añadido (no está en la v2) y apunta a `#cierre`, provisorio.
- **Decisiones de contenido a validar con el club:**
  - Textos que no salen del JSON: «Nadie queda fuera.», «¿Partes desde cero?» y la etiqueta «04 · Cómo funciona» (de la maqueta).
  - La franja usa `clasesExtrasNota` del JSON en vez del texto de la maqueta («Clases extras de flyer, gimnasia y preparación física…»); confirmar cuál prefiere el club.
  - `sistema.resumen` (4 frases) se muestra bajo el título; la v2 no lo tenía.
  - Definir si el flujo online mantiene el pago antes de la evaluación (hoy el PDF lo exige); no se publica hasta decidirlo.
- **Marcadores `[así]`:** ninguno.
- **Capturas 390 px:** `.revision/inicio-390-sin-movimiento.png`, `.revision/inicio-390-mov-00.png`, `.revision/inicio-390-mov-01.png`
- **Capturas 1440 px:** `.revision/inicio-1440-sin-movimiento.png`, `.revision/inicio-1440-mov-00.png`, `.revision/inicio-1440-mov-01.png`

---

## Bloque 6 · Temporada + Horarios

- **Veredicto final:** Aprobado con cambios (1 ronda, sin Bloqueantes). Build y `astro check` sin errores. Revisor distinto al de los bloques 1-5 (contexto fresco).
- **Corregido:** la corriente de viento cruzaba el título y la leyenda de Temporada a 1440 px (ahora el SVG va anclado bajo los meses; con movimiento reducido tampoco cruza); corte diagonal de Horarios espejado respecto de la v2 (corregido; se verificó que el de Equipos coincide con la v2 y no se tocó); alineación de etiquetas y hitos entre meses; pista «Desliza…» y `tabindex` del riel de Horarios solo cuando hay desborde.
- **Verificado:** 13 meses del JSON (el JSON trae 13: nov 2026 a nov 2027); `[por confirmar]` visible en febrero y septiembre; `[confirmar mes]` ×2 y `[fecha por confirmar]` tal como vienen; la advertencia interna sobre Pink Ladies NO se publica; «Horarios tentativos.» sí. Sin scroll horizontal de página de 390 a 1920 px; los rieles desplazan por dentro con nombre accesible y foco visible.
- **Pendientes (Menor):**
  - La extracción del aviso «tentativos» depende del orden y del prefijo («Verificar…») de `_notaHorarios`; validar en `contenido.ts` o separar el pendiente interno en otro campo del JSON.
  - Extras y gimnasia se distinguen solo por trazo sólido/discontinuo; valorar microetiqueta visible.
  - Etiqueta «/// 06 · HORARIOS 2027» (la v2 dice «HORARIOS TENTATIVOS»); tamaños de título algo menores en móvil que la v2; «Tu semana Huracán» con salto de línea forzado.
  - Las corrientes de Temporada se ven menos que en la maqueta (solo asoman bajo los meses).
- **Datos pendientes del club:** mes del viaje a Orlando y de la evaluación final (febrero); fecha del showcase (septiembre); asignación de Pink Ladies del viernes (diagramación ambigua del PDF).
- **Capturas 390 px:** `.revision/inicio-390-mov-10.png`, `.revision/inicio-390-mov-11.png`, `.revision/inicio-390-mov-12.png`
- **Capturas 1440 px:** `.revision/inicio-1440-mov-08.png`, `.revision/inicio-1440-mov-09.png`, `.revision/inicio-1440-mov-10.png`

---
