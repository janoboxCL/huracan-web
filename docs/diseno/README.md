# Especificación de diseño · Inicio v2 "Ráfaga"

Referencia: `referencia/MainV2.dc.html` (inicio), `referencia/Agenda.dc.html` (flujo de evaluación, etapa 3) y `referencia/Crm.dc.html` (editor de contenido, etapa 5). Imágenes en `assets/`.

Concepto: **el viento como motor**. Energía deportiva, alternancia constante negro / amarillo / foto, diagonales y movimiento que "sopla" el contenido hacia adentro.

## Imágenes

| Archivo | Uso | Tratamiento |
|---|---|---|
| `bg-escenario.jpg` | Fondo del hero | Escala de grises, contraste 1,25, brillo 0,42 + velo negro 35 % |
| `bg-models.jpg` | Fondo de Programas | Grises, brillo 0,35 + velo negro 55 %, parallax |
| `bg-stunt.jpg` | Fondo de Cómo funciona | Duotono: grises + `mix-blend-mode: multiply` sobre amarillo, parallax |
| `bg-playa.jpg` | Fondo de Viajes | Grises, brillo 0,4, parallax |
| `cut-atleta.png` | Hero, figura principal | Flota suave; sombra dura negra |
| `cut-duo2.png` | El club | Sombra dura negra 16 px |
| `cut-flyer.png` | Equipos | Lado derecho, solo escritorio |
| `cut-duo.png` | Cierre | Flota suave |
| `logo.png` | Header, footer | Resolución baja (247 px): pedir el vector al club |
| Otros recortes | Reserva para páginas internas | — |

Las fotos vienen del PDF y rondan 1.100 px de ancho: suficientes para la maqueta, no para producción. Pedir originales.

## Secciones del inicio, en orden

1. **Hero** (foto + negro + amarillo). Fondo `bg-escenario`. Bloque amarillo diagonal a la derecha (`skewX(-16deg)`) con dos franjas finas paralelas. Corrientes de viento SVG (4 trazos, 2 amarillos y 2 blancos, duraciones 3–5 s). Tornado de 8 elipses negras sobre el bloque amarillo. Recorte `cut-atleta` flotando. Header transparente encima con botón negro de borde amarillo. Etiqueta amarilla "Temporada 2027 · Inscripciones abiertas". `h1` "The power / from the / **Wind**///" (Wind en amarillo y 1,35 em). Bajada, botón amarillo "Agenda tu evaluación →" y botón de contorno "¿Qué equipo es para mí?". Barra inferior negra con borde amarillo: 2002 · 5° Worlds 2009 · 1° The Experience 2026 · 14 equipos. **Entrada**: cortina amarilla que barre de izquierda a derecha (1,1 s) y luego el titular entra palabra por palabra con desenfoque y skew (`gust`, escalonado cada 0,12 s).
2. **Cintas cruzadas** (negro). Cinta amarilla rotada −2,5° con logros en marquee (30 s). Cinta oscura rotada +2° con el lema en contorno amarillo, en sentido inverso (38 s).
3. **01 · El club** (amarillo). "2002" gigante en contorno de fondo. Título "25 temporadas soplando fuerte", texto de historia, botón negro "Conoce al staff". Recorte `cut-duo2`. Debajo, franja negra con corte diagonal superior y línea de hitos (7 años) sobre una corriente de viento horizontal.
4. **02 · Programas** (foto oscura). Título "Sube de **categoría**". 4 tarjetas con `skewX(-3deg)` alternando amarillo / negro (borde amarillo), número gigante en contorno, edad, nombre, descripción, mensualidad y detalle. Hover: sube 10 px + sombra dura (blanca en amarillas, amarilla en negras).
5. **03 · Equipos** (amarillo, corte diagonal superior). "¿Qué equipo es para ti?". Botones de edad 3–20+ (activo: negro con texto amarillo). Resultados en tarjetas negras filtradas por edad cumplida en 2027. Botón "Agenda la evaluación para esta edad". Recorte `cut-flyer` a la derecha. **Isla interactiva**.
6. **04 · Cómo funciona** (duotono amarillo con `bg-stunt`). Caja negra inclinada con "Nadie queda fuera. **Todos quedan seleccionados.**". 4 pasos en cajas negras con número amarillo gigante y borde inferior amarillo. Franja "¿Partes desde cero?".
7. **05 · Temporada 2027** (negro). Dos corrientes de viento cruzando. 12 meses en fila (desplazable): meses con evento con público o competencia en **amarillo sólido**, meses de entrenamiento en gris oscuro. Leyenda explícita.
8. **06 · Horarios** (amarillo, corte diagonal). Encabezados de día negros con texto amarillo. Bloques de equipo negros; clases extras y gimnasia en contorno negro sin relleno.
9. **07 · Valores** (negro). "Sin letra **chica**". Tarjeta amarilla inclinada con la inscripción $15.000. Lista de valores. A la derecha, promociones como entradas: bloque negro con el descuento en amarillo + cuerpo amarillo.
10. **08 · Staff** (amarillo, corte diagonal). "Staff" gigante en contorno de fondo. Tarjeta de Franco Pinto (head coach) y Mónica Cofré en negro; coaches en tarjetas de contorno negro. Fotos del staff: pendientes (no atribuir fotos sin confirmar quién es quién).
11. **09 · Viajes** (foto `bg-playa`). "El viento **cruza fronteras**". 4 destinos como pasajes amarillos con línea punteada.
12. **10 · Cierre** (amarillo, corte diagonal). Tornado grande girando al 25 %. "Súmate al huracán", botones negros (agenda y reglamento), recorte `cut-duo`.
13. **Footer** (negro): logo, lema, contacto, redes, enlaces de familias.

## Movimiento

| Efecto | Dónde | Detalle |
|---|---|---|
| Cortina | Hero, al cargar | Panel amarillo `skewX(-18deg)` que sale a la derecha en 1,1 s |
| Ráfaga (`gust`) | Titular y CTA del hero | `translateX(-140px) skewX(-32deg)` + blur → normal, 0,9 s, escalonado |
| Corrientes | Hero, hitos, temporada, viajes | `stroke-dasharray` + `stroke-dashoffset` animado, lineal, infinito |
| Tornado | Hero, cierre | Elipses con trazo discontinuo, `stroke-dashoffset` a distintas velocidades |
| Soplo (reveal) | Bloques de cada sección | `animation-timeline: view()`, desde `translateX(-110px) skewX(-18deg)` y opacidad 0 |
| Parallax | Fondos con foto | `translateY(-9% → 9%)` ligado a la vista |
| Marquee | Cintas | `translateX(0 → -50%)` lineal, contenido duplicado |
| Hover | Botones y tarjetas | Skew extra, brillo que cruza, sombra dura |

Siempre: solo `transform`/`opacity`, `@supports (animation-timeline: view())` para los reveals y todo desactivado con `prefers-reduced-motion: reduce`.
