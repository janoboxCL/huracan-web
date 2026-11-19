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
