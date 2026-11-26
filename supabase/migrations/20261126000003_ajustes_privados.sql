-- Ajustes que solo lee el servidor (Pages Functions con service_role). Sin políticas: anon y
-- authenticated no pueden leer ni escribir. Los valores (p. ej. `correo_copia_oculta`, lista de
-- correos que reciben copia oculta de cada inscripción) se cargan con SQL, no desde el repositorio.
create table if not exists public.ajustes_privados (
  clave text primary key,
  valor jsonb not null,
  actualizado_en timestamptz not null default now()
);
alter table public.ajustes_privados enable row level security;
revoke all on public.ajustes_privados from anon, authenticated;
grant select on public.ajustes_privados to service_role;
comment on table public.ajustes_privados is 'Ajustes que solo lee el servidor (service_role); sin políticas para anon ni authenticated.';
