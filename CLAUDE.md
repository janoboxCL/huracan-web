# Huracán All Stars · sitio web 2027

Sitio público del club de cheerleading Huracán All Stars (Santiago, Chile) para la temporada 2027, preparado para crecer hacia un CRM propio con contenido editable y pre-inscripción online.

Idioma del proyecto: **español de Chile, registro profesional**. Textos, comentarios, commits y nombres de archivos de contenido en español. Sin modismos.

## Reglas del proyecto

1. **Proyecto standalone.** Repositorio, base de datos y despliegue propios. Firehouse (`janoboxCL/firehouse-web`) y Powerhouse (`janoboxCL/powerhouse`) son solo **referencia** de arquitectura y patrones: no se copian sus datos, claves, textos, marcas ni migraciones, y no se agregan como dependencia.
2. **El contenido no se inventa.** Toda cifra, fecha, nombre, precio o categoría sale de `docs/contenido/huracan-2027.json` (fuente: `docs/contenido/informativo-2027.txt`, el PDF oficial del club). Si falta un dato, se deja un marcador visible `[así]` y se anota en "Datos pendientes".
3. **El diseño manda.** La referencia visual aprobada es la **v2 "Ráfaga"**: `docs/diseno/referencia/MainV2.dc.html` y la especificación en `docs/diseno/README.md`. Los `.dc.html` son un formato de maqueta (no ejecutable fuera del lienzo): se leen como especificación de estructura, estilos, textos y animaciones; no se copian tal cual.
4. **Nada de secretos en el repositorio.** Claves de Supabase `service_role`, Resend, etc. solo como variables cifradas de Cloudflare. La clave publicable de Supabase sí puede ir en el código.
5. **Accesible y liviano.** Contraste AA, foco visible, HTML semántico, `prefers-reduced-motion` respetado siempre, imágenes optimizadas por Astro, sin librerías de animación pesadas en la etapa 1 (CSS primero).

## Stack

- **Astro 5 + TypeScript** (salida estática). Componentes `.astro`; islas de JS mínimas solo donde hay interacción (buscador de equipos, agenda).
- **Cloudflare Pages** (build `npm run build`, salida `dist`), con **Pages Functions** en `functions/` para todo lo que escribe datos (desde la etapa 3).
- **Supabase** (Postgres + Auth + RLS + Storage) desde la etapa 2. **Resend** para correos desde el dominio del club (etapa 3).

## Estructura objetivo

```
src/
  layouts/Base.astro          # <head>, fuentes, SEO, header y footer
  components/
    ui/                       # Boton, Etiqueta, TituloSeccion, Cinta (marquee), Corrientes (SVG viento), Tornado (SVG)
    secciones/                # Hero, Cintas, Club, Programas, Equipos, Sistema, Temporada, Horarios, Valores, Staff, Viajes, Cierre
  data/                       # contenido tipado, leído desde docs/contenido/huracan-2027.json (etapa 1); luego desde Supabase
  styles/tokens.css           # variables de marca
  styles/movimiento.css       # keyframes, reveals por scroll, reduced-motion
  assets/img/                 # imágenes procesadas por astro:assets
  pages/index.astro           # inicio
functions/                    # API (etapa 3+)
supabase/migrations/          # esquema (etapa 2+)
docs/                         # diseño, contenido, decisiones
scripts/capturas.mjs          # capturas para el revisor
```

## Marca

- Colores: negro `#0A0A0A`, amarillo `#FFF30B`, blanco `#FFFFFF`; superficies `#141414`, `#1A1A1A`; texto secundario sobre negro `#D4D4D4`/`#A3A3A3`. Nunca texto amarillo sobre blanco.
- Tipografía: **Barlow Condensed** cursiva 800/900 en mayúsculas para títulos (`.disp`), **Barlow** 400–800 para texto. Google Fonts con `display=swap`.
- Gestos de marca: diagonales (`skewX(-8° a -16°)`), cortes diagonales entre secciones (`clip-path`), etiqueta de sección `/// 0N · NOMBRE`, alternancia negro / amarillo / foto.
- Lema: "The power from the wind". Mensaje clave: "Todos quedan seleccionados".

## Movimiento (tema viento)

- Corrientes de viento: trazos SVG con `stroke-dasharray` animado; tornado: elipses con trazo discontinuo girando.
- Entrada del hero: cortina amarilla que barre + titular "soplado" palabra por palabra.
- Reveals por scroll con `animation-timeline: view()` **dentro de `@supports`** (sin soporte, el contenido se ve normal). Parallax suave en fondos.
- Solo animar `transform` y `opacity`. Todo se desactiva con `prefers-reduced-motion: reduce`.

## Trabajo con agentes

Hay dos subagentes en `.claude/agents/`:

- **`constructor-ui`**: implementa secciones y componentes. Puede editar código.
- **`revisor-diseno`**: revisa con ojos frescos contra la referencia y la checklist. **No edita código**; entrega hallazgos priorizados.

**Ciclo por sección** (lo dirige la sesión principal):
1. Delegar a `constructor-ui` una sección concreta (por ejemplo "Hero + cintas").
2. Al terminar, delegar a `revisor-diseno` la revisión de esa sección (sin pasarle el razonamiento del constructor, solo qué sección revisar).
3. Pasar los hallazgos **Bloqueantes e Importantes** a `constructor-ui` para corregir.
4. Una segunda revisión solo si hubo Bloqueantes. Máximo 2 rondas por sección; lo que quede se anota en `docs/pendientes.md`.
5. Commit por sección en una rama de trabajo; merge a `main` cuando la etapa esté revisada.

## Comandos

- `npm run dev` · `npm run build` · `npm run preview`
- `npm run capturas` → capturas en `.revision/` a 390, 820 y 1440 px, con y sin movimiento (requiere `npm run preview` corriendo).
- `npx astro check` antes de cada commit.

## Etapas

1. **Sitio estático v2**: base Astro, tokens, layout, las 12 secciones del inicio con contenido desde el JSON, buscador de equipos (isla), publicación en Cloudflare Pages (`*.pages.dev`).
2. **Supabase**: tablas de catálogo (programas, equipos, horarios, valores, promociones, calendario, staff, logros, viajes, documentos, ajustes) y lectura en el build.
3. **Agenda tu evaluación**: formulario de 3 pasos, cupos en vivo, correo de confirmación, enlace para reagendar o cancelar.
4. **CRM `/admin`**: login, evaluaciones y reservas, fichas de familias, asignación a equipos (titular/reserva).
5. **Contenido editable**: secciones con borrador/publicado e historial; botón "Publicar" que dispara el deploy hook de Cloudflare.
6. Pagos en línea y portal de familias.

## Definición de "terminado" para una sección

- Coincide con la referencia v2 en estructura, colores, textos y animaciones.
- Se ve bien a 390, 820 y 1440 px, sin desbordes horizontales.
- Funciona con teclado, contraste AA, `alt` correctos, un solo `h1` en la página.
- Con `prefers-reduced-motion` no hay animaciones y todo el contenido es visible.
- `npm run build` y `npx astro check` sin errores.
- Aprobada por `revisor-diseno` (sin Bloqueantes).

## Datos pendientes (confirmar con el club)

- Dirección del gimnasio (no aparece en el PDF).
- Showcase: el PDF dice "sábado 9 de septiembre", pero el 9-9-2027 es jueves.
- Viaje a Orlando: el PDF menciona "competencia en Orlando" en febrero y "marzo Disney 2027" en enero y marzo. Confirmar mes.
- Fechas reales de evaluación de diciembre y sus cupos.
- Fotos originales en alta resolución (las del PDF rondan 1.100 px de ancho).
- Proceso de pago: hoy el club pide pagar inscripción, mensualidad y ropa **antes** de la evaluación; definir si el flujo online lo mantiene.
- Los datos bancarios del PDF no van en el sitio público.
