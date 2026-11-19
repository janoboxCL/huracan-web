# Bitácora · Etapa 1

Registro del modo piloto automático: un bloque por entrada, con veredicto final, pendientes y capturas.
Las capturas viven en `.revision/` (ignorada por git) y se regeneran con `npm run capturas`.

## Datos pendientes detectados al construir

Consolidado al cierre de la etapa 1 (detalle por bloque más abajo):

- **Dirección del gimnasio** (hoy `[Dirección del gimnasio]`, visible en el footer).
- **Enlace publicable del reglamento y los protocolos** (el JSON solo remite al informativo, desde la pág. 33): el botón «Reglamento 2027» del Cierre y el enlace del footer están inactivos con `[enlace por confirmar]`.
- **URLs de Facebook y TikTok** (el JSON trae solo los nombres; hoy van como texto sin enlace).
- **Mes del viaje a Orlando y de la evaluación final** (febrero) y **fecha del showcase** (el PDF dice «sábado 9», pero el 9-9-2027 es jueves): `[por confirmar]` visible en el calendario.
- **Detalle de cada coach** (las columnas del PDF no se alinean con certeza; `_notaCoaches`, no publicada) y el de Christopher González (`[Detalle por confirmar]`).
- **Fotos del staff** y **fotos originales en alta resolución** (las del PDF rondan 1.100 px).
- **Logo en vector** (el PNG mide 247 px; el favicon es un recorte del emblema a 192 px).
- **Montos de ropa de abrigo y del pack de competencias internacionales** (`[por confirmar]`).
- **Asignación de Pink Ladies del viernes** (diagramación ambigua del PDF; no publicada).
- **Pago antes de la evaluación:** definir si el flujo online lo mantiene (no se publica el proceso actual).
- **Dominio definitivo:** hoy `SITE_URL` por defecto es `https://huracan-web.pages.dev`.
- **Textos que vienen de la maqueta v2 y no del JSON**, a validar con el club: ver «Decisiones de contenido» de cada bloque.

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

## Bloque 7 · Valores + promociones

- **Veredicto final:** Aprobado con cambios (1 ronda, sin Bloqueantes). Build y `astro check` sin errores.
- **Corregido:**
  - La tarjeta de inscripción perdía su inclinación al terminar el reveal por scroll (`.soplo` terminaba en `transform: none` y pisaba el `skewX` propio). Se separó el reveal (contenedor) del skew (hijo).
  - Mismo defecto en la caja inclinada de **Cómo funciona (bloque 5)**, que su revisión no detectó; corregido con el mismo patrón. El resto de secciones (Programas, Equipos, Club, Horarios, Temporada, Promociones) ya usaban el patrón correcto; skews verificados por medición con movimiento activo.
  - Rótulo accesible «Descuento:» engañoso en las promociones: ahora «Beneficio:».
  - `aria-labelledby` sobre `<dl>` eliminado.
- **Verificado:** inscripción, vestimenta, otros pagos, clases extras, requisitos y las 8 promociones coinciden con el JSON; `monto: null` se muestra como `[por confirmar]`; sin datos bancarios, `noPublicar` ni `_notaPromociones`; sin scroll horizontal de 360 a 1920 px.
- **Pendientes (Menor):**
  - Hueco de ~580 px bajo la columna derecha en escritorio (columna izquierda más larga); valorar `position: sticky` o mover «Requisitos».
  - Hover de las entradas de promociones sugiere un clic que no existe; valorar dejarlo solo con `@media (hover: hover)` o quitarlo.
  - `[por confirmar]` en montos se lee como texto secundario; unificar con la pastilla de Temporada.
  - Títulos de sección algo menores que en la v2; cifra de descuento apretada y cuerpo inclinado en 360-390 px.
  - Borde amarillo añadido al bloque negro de las entradas (no está en la v2); el revisor lo valora positivo.
- **Decisiones de contenido a validar:** títulos de grupo «Vestimenta», «Otros pagos», «Clases extras», «Requisitos»; rótulo «Clase suelta»; «Pack de 4 clases de 75 min» compuesto desde el JSON; mostrar las 8 promociones sin fusionar (la v2 mostraba 5 resumidas); no hay aviso sobre las condiciones de las becas (la lista de habilidades está solo en el informativo, págs. 30-31).
- **Datos pendientes del club:** montos de ropa de abrigo y pack de competencias internacionales.
- **Capturas 390 px:** `.revision/inicio-390-mov-14.png`, `.revision/inicio-390-mov-16.png`
- **Capturas 1440 px:** `.revision/inicio-1440-mov-10.png`, `.revision/inicio-1440-mov-11.png`

---

## Bloque 8 · Staff + Viajes

- **Veredicto final:** Rechazado en la ronda 2 por un Importante residual (sin Bloqueantes). Se agotaron las 2 rondas; el residuo se anota aquí y se verifica con el bloque 9. Build y `astro check` sin errores.
- **Ronda 1 (Rechazado, Bloqueante):** los reveals por scroll quedaban atascados a medio animar en Staff y Viajes. Causa: `overflow: hidden` en la sección la convertía en contenedor de scroll del `animation-timeline: view()`. Corregido cambiando a `overflow: clip` en Staff, Viajes y, tras auditar, también en Club, Cómo funciona, Equipos, Horarios, Programas y Temporada (los rieles con scroll horizontal propio no se tocaron). Los 55 elementos con reveal completan la animación a 390, 1024 y 1440 px; sin regresiones de recorte, parallax ni layout.
- **Ronda 1 (Importante):** la corriente amarilla de Viajes cruzaba el título a 1440 px; corregida (ahora ocupa solo la franja inferior; bbox verificado de 390 a 1920 px). Foto de Viajes subida a brillo 0,6 y velo 0,4; contraste AA medido sobre la foto renderizada: mínimo 5,41:1.
- **Pendiente (Importante, ronda 2):** el último pasaje (Cancún) queda a medio reveal (opacidad ~0,83, desplazado ~19 px) al llegar al fondo de la página en 360-1024 px, porque el scroll máximo no alcanza el final del `view()` timeline. En 1280 px o más termina bien y con reduced-motion está completo. Debe resolverse solo al construir el Cierre (deja de ser lo último de la página); si no, sobrescribir `animation-range: entry 0% entry 70%` en `.pasaje-ancla`. **Verificar tras el bloque 9.**
- **Pendientes (Menor):**
  - La corriente amarilla inferior de Viajes casi no se percibe (hilo de 2-3 px); subir grosor a 4-5 px.
  - «STAFF» gigante en contorno compite un poco con los chips de Asistentes; bajar a 0,07 o desplazarlo.
  - Medallones con iniciales (FP, MC) pueden leerse como avatares de relleno; reemplazar cuando haya fotos autorizadas.
  - Hover de las tarjetas de dirección sin ser clicables (incoherente con coaches y pasajes).
  - El header no enlaza `#horarios`, `#staff` ni `#viajes`.
- **Decisiones de contenido a validar:** «Quién entrena a tus hijos», «08 · Staff», «Coaches», «Asistentes», «09 · Viajes internacionales», «El viento cruza fronteras», rótulo «Destino» y las iniciales de los medallones.
- **Datos pendientes del club:** fotos del staff (pendientes; no se atribuyen fotos sin confirmar quién es quién); qué detalle corresponde a cada coach (`_notaCoaches`: las columnas del PDF no se alinean con certeza; la advertencia NO se publica); detalle de Christopher González («[Detalle por confirmar]» visible).
- **Marcadores `[así]`:** «[Detalle por confirmar]» (viene del JSON).
- **Capturas 390 px:** `.revision/inicio-390-mov-17.png`, `.revision/inicio-390-mov-20.png`, `.revision/inicio-390-mov-21.png`
- **Capturas 1440 px:** `.revision/inicio-1440-mov-13.png`, `.revision/inicio-1440-mov-14.png`, `.revision/inicio-1440-mov-15.png`

---

## Bloque 9 · Cierre + footer + nav del header

- **Veredicto final:** Aprobado con cambios (2 rondas de revisión). La ronda 1 fue «Rechazado» por un Bloqueante; la ronda 2 quedó sin Bloqueantes y con 2 Importantes que se corrigieron sin una tercera revisión (verificados por medición, ver abajo). Build y `astro check` sin errores.
- **Ronda 1 (Bloqueante, corregido):** a 360 y 390 px la nav de 8 entradas, en 3 filas, tapaba texto del hero. Ahora la nav móvil va en una sola fila con scroll propio y degradado; variable `--alto-header-movil` reservada en el hero; el header mide 140 px a 360 px (antes 321 px). Cero solape de texto del hero de 360 a 1920 px.
- **Ronda 1 (Importante, corregido):** el header es absoluto y la navegación solo estaba arriba; se añadió un botón flotante «Agenda tu evaluación» (solo <70 rem; aparece tras el hero y se retira al llegar al Cierre).
- **Ronda 2 (Importantes corregidos sin tercera revisión):** foco oculto en la nav móvil (`scroll-padding-inline` y `focusin` con `scrollIntoView`; medido que los 8 enlaces quedan completos a 360 y 390 px); botón flotante que quedaba fijo con movimiento reducido o sin soporte de `animation-timeline` (ahora solo existe con soporte y se oculta en el Cierre y el footer también con movimiento reducido; verificado por la sesión principal a 390 px en ambos modos); `scroll-padding-top` a 1 rem. Estas tres correcciones NO pasaron por una tercera revisión del revisor.
- **Pendiente cerrado:** el último pasaje de Viajes ya termina su reveal (opacidad 1, transform identidad) con el Cierre debajo; 57 elementos con reveal completos a 360, 390, 820, 1024, 1440 y 1920 px.
- **Pendientes (Menor):** el botón flotante tapa de forma transitoria chips de edad, tarjetas de Equipos y rieles al desplazarse (fricción, no bloqueo; valorar etiqueta corta «Agenda» u opacidad 0,92); tornado del Cierre más discreto que en la v2; Facebook y TikTok solo como texto (sin URL en el JSON); el botón de reglamento inactivo y su `aria-disabled` (cambiar a `<a href>` cuando exista el enlace).
- **Estado de la construcción (anotado por el constructor):** build y `astro check` sin errores.
- **Cierre (`#cierre`):** amarillo con corte diagonal como Horarios en la v2 (esquina baja a la izquierda), tornado al 25 % detrás del recorte `cut-duo` (que flota), botón negro «Agenda tu evaluación →» y «Reglamento 2027» como botón inactivo (`aria-disabled`) con `[enlace por confirmar]`. Los CTA del hero, header, equipos y cómo funciona caen aquí (`enlaces.agenda`).
- **Footer:** logo (96 px; el original es de 247 px, pedir el vector), lema, WhatsApp, Instagram, Facebook y TikTok solo como texto, dirección `[Dirección del gimnasio]` tal cual, anclas de familias. Sin datos bancarios.
- **Header:** añadidas Horarios, Staff y Viajes (8 entradas). Entre 70 y 90 rem la nav va en una fila a 14 px; desde 90 rem a 16 px. Medido sin desborde a 1120, 1280 y 1440 px. En móvil la nav ocupa unas 3 filas.
- **Viajes (pendiente cerrado):** el último pasaje termina en opacidad 1 y transform identidad a 360, 390, 820 y 1024 px con el Cierre debajo; no hizo falta tocar `animation-range`.
- **Pendientes / decisiones a validar:** bajada del cierre y etiqueta «10 · Tu ingreso» vienen de la v2, no del JSON; «Reglamento 2027» y «Reglamento y protocolos» sin enlace hasta tener URL o archivo publicable (`documentos.reglamento` solo remite al informativo, desde la pág. 33); dirección del gimnasio; URLs de Facebook y TikTok; la v2 traía «Proshop» y «Portal de familias» en el footer, se omitieron por no existir en el JSON.

## Revisión de la página completa, pulido y cierre de la etapa 1

- **Revisión de la página completa (revisor nuevo, contexto fresco):** Aprobado con cambios, **sin Bloqueantes**. 4 Importantes y 6 Menores. axe-core: 0 violaciones. 0 errores de consola, 0 recursos 404, sin scroll horizontal de 320 a 1920 px, 57 reveals completos a 390, 820, 1024 y 1440 px, sin JS se ven el hero y los 14 equipos. Contraste AA medido por píxel: sin combinaciones bajo AA (salvo falsos positivos por cajas inclinadas). Las 4 diagonales (Equipos, Horarios, Staff, Cierre) tienen la orientación de la v2, sin líneas ni huecos de 320 a 1920 px.
- **Importantes corregidos:**
  - Notas internas del PDF accesibles para lectores de pantalla (`porConfirmar` de febrero y septiembre): ahora solo se oye «Por confirmar». Búsqueda en `dist/index.html` de «el PDF», «informativo», «Verificar» y `porConfirmar`: 0 coincidencias («Jueves» es el encabezado del día).
  - CLS por el cambio de fuente en el hero: fuentes de respaldo con métricas ajustadas. Antes → después: 0,053 → 0,0017 (390 px), 0,097 → 0,0032 (1440 px), 0,385 → 0,0083 (1920 px).
  - Anillo de foco blanco sobre amarillo (≈1,16:1): doble anillo negro y blanco en logo, nav, CTA del header, enlace «Saltar al contenido» y botón flotante.
  - SEO: sitemap (`@astrojs/sitemap`), `Sitemap:` en `robots.txt` (ahora endpoint que deriva de `site`), `image` en el JSON-LD, favicon y apple-touch-icon (recorte del emblema del logo).
- **Menores aplicados:** `tabindex` de la lista de equipos solo si desborda; corrientes del hero móvil a opacidad 0,16 (ya no cruzan texto); `cut-atleta` lazy (transferido a 390 px: 417 → 370 KB); enlaces del footer de 44 × 44 px; los 7 «Agenda tu evaluación» con `aria-label` diferenciado por origen.
- **Pulido (criterio de `impeccable polish` aplicado a mano, sin ejecutar el lanzador del skill, que descarga un binario):** hover solo con `@media (hover: hover)`, estados `:active` en botones y edades, `text-wrap: balance` en títulos y `pretty` en párrafos, interlineado del título de Equipos (el «¿» tocaba la segunda línea), eliminada la clase `.sobre-negro` sin CSS. No se ejecutó `/impeccable polish` como comando.
- **Pendientes tras el pulido:**
  - `bg-models` (Programas) sigue descargándose en la carga inicial en Chromium headless (queda dentro del umbral de lazy-load); no comprobado en un navegador real.
  - El anillo blanco del CTA del hero (sobre foto oscura) y las capturas de foco del botón flotante y del salto quedaron dadas por buenas por barrido de contraste, sin verlas en imagen.
  - Menores aún abiertos de los bloques 1 a 9 (ver cada entrada), p. ej.: hero apretado entre 1408 y 1440 px, hueco de ~600 px bajo Equipos con pocas tarjetas, página de ~19.300 px en móvil, corriente inferior de Viajes poco visible, hover en tarjetas no interactivas, buscador de edades sin flechas de teclado (`radiogroup`).
  - Los CTA de agenda apuntan a `#cierre`; pasarán a `/agenda` en la etapa 3.
  - Las 3 correcciones del bloque 9 (foco de la nav, botón flotante, `scroll-padding`) y estas últimas no pasaron por una revisión externa posterior.
- **Capturas 390 px:** `.revision/inicio-390-sin-movimiento.png`, `.revision/inicio-390-mov-00.png` a `.revision/inicio-390-mov-24.png`
- **Capturas 1440 px:** `.revision/inicio-1440-sin-movimiento.png`, `.revision/inicio-1440-mov-00.png` a `.revision/inicio-1440-mov-17.png`, `.revision/foco-header-1440.png`

## Resumen final de la etapa 1

| Bloque | Commit | Veredicto final |
|---|---|---|
| Base (Astro 5, tokens, layout, contenido tipado) | `4fefde8` | n/a |
| 1 · Hero + cintas cruzadas | `d5274bc` | Aprobado con cambios (2 rondas) |
| 2 · El club + hitos | `4cc44f1` | Aprobado con cambios |
| 3 · Programas | `71a3dc5` | Aprobado con cambios |
| 4 · Equipos con buscador | `19d87dc` | Aprobado con cambios |
| 5 · Cómo funciona | `d9f4a6c` | Aprobado con cambios |
| 6 · Temporada + horarios | `ba6fd65` | Aprobado con cambios |
| 7 · Valores + promociones | `64a409d` | Aprobado con cambios |
| 8 · Staff + viajes | `f76f1eb` | Rechazado en ronda 2 por un Importante residual; cerrado con el bloque 9 |
| 9 · Cierre + footer + nav | `1df8179` | Aprobado con cambios (2 rondas) |
| Página completa + pulido | (este commit) | Aprobado con cambios, sin Bloqueantes |

- **Defectos transversales encontrados por la revisión y corregidos en todo el sitio:** el `.soplo` pisaba el `skewX` de tarjetas inclinadas (bloques 5 y 7), y `overflow: hidden` en secciones rompía los reveals ligados al scroll (`animation-timeline: view()`); se pasó a `overflow: clip`.
- **Cómo se trabajó:** los subagentes `constructor-ui` y `revisor-diseno` de `.claude/agents/` no estaban registrados como tipos de agente en esta sesión; se usaron agentes genéricos que leían y seguían sus instrucciones (el revisor sin editar archivos).
- **Sin `git push` ni merge a `main`.** Todo vive en la rama local `etapa-1`.
