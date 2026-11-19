# Primeros pasos con Claude Code

## 1. Crear el repositorio

1. En GitHub, crea un repositorio privado vacío, por ejemplo `janoboxCL/huracan-web`.
2. Clónalo en tu equipo y copia dentro **todo el contenido de este kit** (incluida la carpeta oculta `.claude/`).
3. Primer commit: `git add . && git commit -m "Kit inicial: diseño v2, contenido 2027 y agentes"` y `git push`.

## 2. Abrir Claude Code

Desde la carpeta del repositorio ejecuta `claude`. Claude Code lee `CLAUDE.md` y detecta los dos agentes de `.claude/agents/`. Para comprobarlo, pregúntale: "¿Qué subagentes y skills tienes disponibles en este proyecto?".

Si los nombres de tus skills difieren de los que usan los agentes (taste, Hallmark, emil-design-eng, impeccable), ajústalos en `.claude/agents/*.md`. Opcional: agrega un campo `skills:` en el encabezado de cada agente con los nombres exactos para que se carguen al iniciar.

## 3. Prompt 1 · Base del proyecto (lo hace la sesión principal)

> Lee CLAUDE.md, docs/diseno/README.md y docs/contenido/huracan-2027.json. Crea el proyecto Astro 5 con TypeScript estricto en esta carpeta sin borrar docs/, scripts/ ni .claude/. Configura: tokens de marca (src/styles/tokens.css), movimiento base (src/styles/movimiento.css), layout Base con fuentes Barlow y Barlow Condensed, SEO básico en español, carga tipada del contenido desde el JSON en src/data/, y los scripts npm "capturas" (node scripts/capturas.mjs) e instalación de Playwright como dependencia de desarrollo. Mueve las imágenes de docs/diseno/assets a src/assets/img. No construyas secciones todavía. Al final, compila y muéstrame la estructura.

## 4. Prompt 2 · Ciclo por sección (repítelo para cada bloque)

> Sigue el ciclo por sección de CLAUDE.md para: **Hero + cintas cruzadas**.
> 1. Delega la implementación a @agent-constructor-ui.
> 2. Cuando termine, levanta `npm run preview` y delega la revisión a @agent-revisor-diseno, indicándole solo qué sección revisar.
> 3. Pasa los hallazgos Bloqueantes e Importantes a @agent-constructor-ui.
> 4. Si hubo Bloqueantes, una segunda revisión. Luego haz commit en la rama `etapa-1`.
> Muéstrame el veredicto final y las capturas a 390 y 1440 px.

Orden sugerido de bloques:
1. Hero + cintas cruzadas
2. El club + hitos
3. Programas
4. Equipos (buscador interactivo)
5. Cómo funciona
6. Temporada + horarios
7. Valores + promociones
8. Staff + viajes
9. Cierre + footer
10. Revisión de la página completa con @agent-revisor-diseno y pulido final (`/impeccable polish`)

## 5. Publicar en Cloudflare Pages

1. Cloudflare → Workers & Pages → Crear → Pages → Conectar con Git → elige `huracan-web`.
2. Framework: Astro · comando de build `npm run build` · carpeta de salida `dist`.
3. Cada rama genera una URL de vista previa; `main` publica en `huracan-web.pages.dev` (o el nombre que quede disponible).
4. Cuando el club tenga dominio, se agrega en "Dominios personalizados".

## Consejos

- Una sección por ciclo: los agentes rinden mejor con encargos acotados.
- El revisor no debe ver el razonamiento del constructor; solo qué revisar. Así no se "califica a sí mismo".
- Si una decisión de diseño se repite (por ejemplo, un ajuste de tokens), pídele a la sesión principal que la anote en CLAUDE.md.
- Los datos pendientes del club están al final de CLAUDE.md: resuélvelos antes de publicar en el dominio final.
