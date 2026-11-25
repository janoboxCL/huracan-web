# Traspaso del proyecto · Huracán All Stars 2027

Documento para retomar el trabajo en otra herramienta (por ejemplo ChatGPT). Última actualización: 25 de noviembre de 2026, 21:00 (respuestas de Franco incorporadas; sitio publicado en main con la API activa y prueba real de preinscripción funcionando). Reglas completas del proyecto en `CLAUDE.md`; flujo de postulación en `docs/flujo-postulacion.md`; pendientes en `docs/pendientes.md`.

## Qué es

Sitio público del club Huracán All Stars (Santiago, Chile), temporada 2027. Astro 5 + TypeScript (salida estática), Cloudflare Pages con Functions en `functions/`, Supabase y Resend. Repositorio: `janoboxCL/huracan-web`. Español de Chile, registro profesional, sin modismos. El contenido sale solo de `docs/contenido/huracan-2027.json`; lo que falte se marca `[así]` en el sitio y se anota en «Datos pendientes».

## Dónde quedamos

- **Sitio de inicio:** las 12 secciones están construidas y revisadas. En esta ronda se aplicaron las observaciones de Franco Pinto (head coach): Titanium Black, Baby Storm de 4 a 6 años, colores por programa, horarios, promociones, reglamento enlazado al informativo PDF.
- **Flujo `/postula`** (maqueta funcional): lectura del informativo PDF en visor, preinscripción corta, sugerencia de equipos y jornada, monto estimado, WhatsApp al head coach. Corre en «modo maqueta» (simulado) hasta activar `PUBLIC_API_POSTULACION=activa` y reconstruir.
- **Motor de reglas:** `src/lib/postulacion/reglas.ts` (compartido entre navegador y servidor). Spirit (abril) y Team Parent (enero) son de inicio diferido y no pasan por evaluación. Tiny no tiene evaluación.
- **API:** `functions/api/postulaciones.ts` y `functions/api/jornadas.ts`, con validación y recálculo en el servidor. Pruebas con `npm test` (42 pasan).
- **Base de datos:** proyecto Supabase «Huracan» (`edvvueaduetlruiushvz`, plan Free, us-east-2). Migraciones aplicadas: `supabase/migrations/20261125000001_postulacion.sql` y `…000002_fijar_search_path.sql`. Tablas: `administradores`, `ajustes_sitio`, `evaluacion_jornadas` (5 jornadas del 4 y 5 de diciembre), `postulaciones`, `pagos`. RLS activado. No se ha probado `crear_postulacion` con datos reales.
- **CRM `/admin`:** primera versión terminada y revisada (96 pruebas pasan). Login con Supabase Auth; lista y detalle de postulaciones (estado, equipo asignado, promoción validada, notas, pagos, WhatsApp); jornadas y cupos; ajustes de banner e inscripciones (el sitio público aún no los lee). Rutas en `src/pages/admin/`, lógica en `src/lib/admin/`, islas en `src/components/admin/`. Modo demostración con `?demo=1` (solo en desarrollo o con `PUBLIC_ADMIN_DEMO=1`; nunca en producción). Cabeceras `noindex` y `no-store` en `public/_headers`. **No está probado contra la base real**: falta crear el primer administrador.

## Conexión a Supabase (no son secretos)

- URL: `https://edvvueaduetlruiushvz.supabase.co`
- Clave publicable: `sb_publishable_S7G3potppIsjlbFQ1sZmBw_y4AH2ToG`
- La clave `service_role` y la de Resend van solo como variables cifradas de Cloudflare Pages, nunca en el repositorio ni en el chat.

Variables de las Functions (ver `.dev.vars.example`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CORREO_ORIGEN`, `CORREO_COACH`, `DATOS_TRANSFERENCIA`.

## Pendientes del club (respondidas casi todas el 25 nov)

Respondidas e incorporadas: edades de Runway Diva y Super Models (12 a 19), mayores de 19 sin experiencia (evaluación Novice del sábado), Five Elite (4 habilidades), Orlando en marzo, botón «Realiza tu inscripción», showcase viernes 10 de septiembre 20:00 a 22:00, dirección (Carlos Walker Martínez 5520, San Miguel), pagos de Spirit, Team Parent y Recreativo, día y hora de los Tiny.

Se agregó «Cómo llegar» (flyer del club, indicaciones desde el Metro Departamental) al pie, a la sección de cierre y al correo de confirmación. El correo `pagoshuracan@gmail.com` del flyer de pagos 2026 NO se usa: el flyer 2027 pide el comprobante por WhatsApp al head coach (confirmar con el club si el correo sigue vigente).

Siguen pendientes: fecha de la primera práctica de los Tiny; valores de inscripción y vestimenta de Spirit y Team Parent; edad de Xtreme Force (8 a 12 en el sitio, 9 a 12 en el informativo); fecha del viernes de evaluación de enero y grupos de las jornadas de enero (miércoles 6, 18:00 a 20:00 y 20:00 a 22:00); cupos de las evaluaciones.

## Pendientes de Jano

- Borrar el proyecto `huracan_crm` creado por error en la organización janobox de Supabase (puede tener costo).
- Cargar en Cloudflare Pages las variables cifradas; entregar remitente verificado para Resend y datos de transferencia.
- Primer administrador del CRM: Alejandro Céspedes (usuario `8e9bdca8-586c-4351-9bc5-5df9d9c90afd`, rol `administracion`) ya registrado en `administradores`. Falta probar el login real y agregar a Franco Pinto como `head_coach` cuando tenga usuario.

## Pendiente de implementar

- Observaciones del club sin aplicar: fotos (#20, #21, las enviará Franco por WhatsApp), franja de clases extras en blanco (menor), tipo de los bloques «Clase extra flyer · gimnasia».
- CRM: probar con un usuario real (crear usuario en Supabase Auth y luego `insert into public.administradores (user_id, nombre, rol) values ('<uuid>', '<nombre>', 'head_coach');`), revisar RLS, agregar titular/reserva (requiere columna nueva, por ejemplo `condicion_equipo`), conectar el sitio público a `ajustes_sitio`.
- Seguridad: impedir que los administradores lean `token_gestion` a nivel de base (hoy el CRM no lo pide, pero RLS no oculta columnas; exige cambiar los permisos de la tabla y probar). El control de cupos al reactivar postulaciones se calcula en el cliente.
- Reagendar o cancelar con el enlace del correo (`token_gestion`), subida de comprobante, antispam por IP (Cloudflare o Turnstile), prueba en iOS Safari y navegador de Instagram, prueba real de la API con `wrangler pages dev`.
- Etapas siguientes: contenido editable con borrador y publicación (etapa 5), pagos en línea y portal de familias (etapa 6).

## Cómo trabajar

- Comandos: `npm run dev`, `npm run build`, `npm run preview`, `npm test`, `npx astro check` antes de cada commit.
- Ciclo por sección: constructor implementa, revisor de diseño revisa sin editar, corregir lo Bloqueante e Importante (máximo 2 rondas), commit por sección.
- Las observaciones del club se leen con `gh api repos/janoboxCL/huracan-web/issues` (la API GraphQL está bloqueada).
- No hay commits ni push de este trabajo todavía: todo está en el directorio de trabajo.
