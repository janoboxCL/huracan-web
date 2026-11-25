-- Huracán All Stars · postulación 2027
-- Esquema inicial: administradores, ajustes del sitio, jornadas de evaluación,
-- postulaciones y pagos. Las escrituras públicas pasan solo por la función
-- `crear_postulacion` (la llama la API con la clave de servicio); el navegador
-- nunca escribe directo en las tablas. Todo con RLS activado.

create extension if not exists pgcrypto;

-- ── Utilidades ───────────────────────────────────────────────

create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

-- ── Administradores del CRM ──────────────────────────────────

create table public.administradores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  rol text not null default 'coach' check (rol in ('head_coach', 'administracion', 'coach')),
  creado_en timestamptz not null default now()
);

alter table public.administradores enable row level security;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.administradores a where a.user_id = auth.uid());
$$;

revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to anon, authenticated;

create policy "administradores: cada uno se ve a sí mismo"
  on public.administradores for select
  to authenticated
  using (user_id = auth.uid());

-- ── Ajustes del sitio (textos y banner editables) ────────────

create table public.ajustes_sitio (
  clave text primary key,
  valor jsonb not null,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references auth.users (id)
);

alter table public.ajustes_sitio enable row level security;

create trigger ajustes_sitio_actualizado
  before update on public.ajustes_sitio
  for each row execute function public.tocar_actualizado_en();

create policy "ajustes: lectura pública"
  on public.ajustes_sitio for select
  to anon, authenticated
  using (true);

create policy "ajustes: edición de administradores"
  on public.ajustes_sitio for all
  to authenticated
  using (public.es_admin())
  with check (public.es_admin());

insert into public.ajustes_sitio (clave, valor) values
  ('inscripciones', '{"estado": "abiertas"}'::jsonb),
  ('banner', '{"visible": false, "texto": "", "enlace": ""}'::jsonb)
on conflict (clave) do nothing;

-- ── Jornadas de evaluación ───────────────────────────────────

create table public.evaluacion_jornadas (
  id text primary key,
  fecha date not null,
  inicio time not null,
  fin time not null,
  grupo text not null check (grupo in ('youth-junior-senior-prep', 'open', 'sin-experiencia-7-19')),
  -- null: sin límite de cupos
  cupos integer check (cupos is null or cupos >= 0),
  abierta boolean not null default true,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  check (fin > inicio),
  unique (fecha, inicio, grupo)
);

alter table public.evaluacion_jornadas enable row level security;

create policy "jornadas: lectura pública de las abiertas"
  on public.evaluacion_jornadas for select
  to anon, authenticated
  using (abierta and fecha >= current_date);

create policy "jornadas: gestión de administradores"
  on public.evaluacion_jornadas for all
  to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- Semilla: flyer «Días de postulación» (viernes 4 y sábado 5 de diciembre de 2026).
insert into public.evaluacion_jornadas (id, fecha, inicio, fin, grupo) values
  ('2026-12-04-1800', '2026-12-04', '18:00', '20:00', 'youth-junior-senior-prep'),
  ('2026-12-04-2000', '2026-12-04', '20:00', '22:00', 'open'),
  ('2026-12-05-1000', '2026-12-05', '10:00', '12:00', 'youth-junior-senior-prep'),
  ('2026-12-05-1200', '2026-12-05', '12:00', '14:00', 'sin-experiencia-7-19'),
  ('2026-12-05-1400', '2026-12-05', '14:00', '16:00', 'open')
on conflict (id) do nothing;

-- ── Postulaciones ────────────────────────────────────────────

create table public.postulaciones (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  estado text not null default 'preinscrita'
    check (estado in ('preinscrita', 'pago_informado', 'pago_confirmado', 'evaluada', 'asignada', 'cancelada')),

  -- Atleta
  atleta_nombre text not null,
  atleta_apellido text not null,
  fecha_nacimiento date not null,
  edad_2027 integer not null check (edad_2027 between 1 and 99),
  sexo text not null check (sexo in ('dama', 'varon')),
  comuna text not null,
  es_antiguo boolean not null default false,

  -- Experiencia
  experiencia text not null check (experiencia in ('ninguna', 'con')),
  club_anterior text,
  anios_experiencia integer check (anios_experiencia is null or anios_experiencia between 0 and 60),
  posicion text,
  habilidades text[] not null default '{}',

  -- Postulación
  modalidad_deseada text check (modalidad_deseada in ('recreativo', 'novice', 'prep', 'international')),
  equipo_interes text,
  tipo_postulacion text not null default 'individual' check (tipo_postulacion in ('individual', 'dupla', 'grupo')),
  promociones_declaradas text[] not null default '{}',

  -- Contacto (apoderado si es menor de edad; la propia persona si es mayor)
  contacto_nombre text not null,
  contacto_parentesco text,
  contacto_telefono text not null,
  contacto_correo text not null,

  -- Resultado calculado por el servidor
  programa_sugerido text,
  equipos_sugeridos text[] not null default '{}',
  jornada_id text references public.evaluacion_jornadas (id),
  jornada_tipo text not null check (jornada_tipo in ('jornadas', 'sin-evaluacion', 'inicio-diferido')),
  monto_estimado integer not null check (monto_estimado >= 0),
  desglose jsonb not null default '{}'::jsonb,

  -- Gestión del coach
  equipo_asignado text,
  promocion_validada text,
  notas_coach text,

  -- Enlace secreto para reagendar o cancelar desde el correo
  token_gestion uuid not null default gen_random_uuid(),

  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  check ((jornada_tipo = 'jornadas') = (jornada_id is not null))
);

create index postulaciones_estado_idx on public.postulaciones (estado);
create index postulaciones_jornada_idx on public.postulaciones (jornada_id) where estado <> 'cancelada';
create index postulaciones_creado_idx on public.postulaciones (creado_en desc);

create trigger postulaciones_actualizado
  before update on public.postulaciones
  for each row execute function public.tocar_actualizado_en();

alter table public.postulaciones enable row level security;

-- Sin políticas para anon: nadie lee ni escribe desde el navegador.
create policy "postulaciones: gestión de administradores"
  on public.postulaciones for all
  to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- ── Pagos ────────────────────────────────────────────────────

create table public.pagos (
  id uuid primary key default gen_random_uuid(),
  postulacion_id uuid not null references public.postulaciones (id) on delete cascade,
  concepto text not null,
  monto integer not null check (monto >= 0),
  comprobante_url text,
  confirmado_por uuid references auth.users (id),
  confirmado_en timestamptz,
  creado_en timestamptz not null default now()
);

create index pagos_postulacion_idx on public.pagos (postulacion_id);

alter table public.pagos enable row level security;

create policy "pagos: gestión de administradores"
  on public.pagos for all
  to authenticated
  using (public.es_admin())
  with check (public.es_admin());

-- ── Funciones públicas ───────────────────────────────────────

-- Jornadas con su cupo restante, sin exponer datos de nadie.
create or replace function public.jornadas_disponibles()
returns table (
  id text,
  fecha date,
  inicio time,
  fin time,
  grupo text,
  cupos integer,
  ocupados integer,
  disponibles integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    j.id,
    j.fecha,
    j.inicio,
    j.fin,
    j.grupo,
    j.cupos,
    coalesce(o.n, 0)::integer as ocupados,
    case when j.cupos is null then null else greatest(j.cupos - coalesce(o.n, 0), 0)::integer end as disponibles
  from public.evaluacion_jornadas j
  left join lateral (
    select count(*) as n
    from public.postulaciones p
    where p.jornada_id = j.id and p.estado <> 'cancelada'
  ) o on true
  where j.abierta and j.fecha >= current_date
  order by j.fecha, j.inicio;
$$;

revoke all on function public.jornadas_disponibles() from public;
grant execute on function public.jornadas_disponibles() to anon, authenticated;

-- Código corto legible (sin 0, O, 1, I).
create or replace function public.generar_codigo()
returns text
language plpgsql
volatile
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  resultado text := 'HUR-';
  i integer;
begin
  for i in 1..6 loop
    resultado := resultado || substr(alfabeto, 1 + floor(random() * length(alfabeto))::integer, 1);
  end loop;
  return resultado;
end;
$$;

-- Crea una postulación de forma atómica: bloquea la jornada, revisa el cupo e inserta.
-- La llama solo la API (clave de servicio). Lanza `jornada_sin_cupo` o `jornada_no_disponible`.
create or replace function public.crear_postulacion(p jsonb)
returns table (id uuid, codigo text, token_gestion uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jornada public.evaluacion_jornadas;
  v_ocupados integer;
  v_codigo text;
  v_intentos integer := 0;
  v_id uuid;
  v_token uuid;
begin
  if p ->> 'jornada_id' is not null then
    select * into v_jornada
    from public.evaluacion_jornadas j
    where j.id = p ->> 'jornada_id'
    for update;

    if not found or not v_jornada.abierta or v_jornada.fecha < current_date then
      raise exception 'jornada_no_disponible' using errcode = 'P0001';
    end if;

    if v_jornada.cupos is not null then
      select count(*) into v_ocupados
      from public.postulaciones x
      where x.jornada_id = v_jornada.id and x.estado <> 'cancelada';
      if v_ocupados >= v_jornada.cupos then
        raise exception 'jornada_sin_cupo' using errcode = 'P0001';
      end if;
    end if;
  end if;

  loop
    v_codigo := public.generar_codigo();
    exit when not exists (select 1 from public.postulaciones x where x.codigo = v_codigo);
    v_intentos := v_intentos + 1;
    if v_intentos > 20 then
      raise exception 'codigo_no_disponible' using errcode = 'P0001';
    end if;
  end loop;

  insert into public.postulaciones (
    codigo, atleta_nombre, atleta_apellido, fecha_nacimiento, edad_2027, sexo, comuna, es_antiguo,
    experiencia, club_anterior, anios_experiencia, posicion, habilidades,
    modalidad_deseada, equipo_interes, tipo_postulacion, promociones_declaradas,
    contacto_nombre, contacto_parentesco, contacto_telefono, contacto_correo,
    programa_sugerido, equipos_sugeridos, jornada_id, jornada_tipo, monto_estimado, desglose
  ) values (
    v_codigo,
    p ->> 'atleta_nombre',
    p ->> 'atleta_apellido',
    (p ->> 'fecha_nacimiento')::date,
    (p ->> 'edad_2027')::integer,
    p ->> 'sexo',
    p ->> 'comuna',
    coalesce((p ->> 'es_antiguo')::boolean, false),
    p ->> 'experiencia',
    nullif(p ->> 'club_anterior', ''),
    nullif(p ->> 'anios_experiencia', '')::integer,
    nullif(p ->> 'posicion', ''),
    coalesce(array(select jsonb_array_elements_text(p -> 'habilidades')), '{}'),
    nullif(p ->> 'modalidad_deseada', ''),
    nullif(p ->> 'equipo_interes', ''),
    coalesce(nullif(p ->> 'tipo_postulacion', ''), 'individual'),
    coalesce(array(select jsonb_array_elements_text(p -> 'promociones_declaradas')), '{}'),
    p ->> 'contacto_nombre',
    nullif(p ->> 'contacto_parentesco', ''),
    p ->> 'contacto_telefono',
    p ->> 'contacto_correo',
    nullif(p ->> 'programa_sugerido', ''),
    coalesce(array(select jsonb_array_elements_text(p -> 'equipos_sugeridos')), '{}'),
    nullif(p ->> 'jornada_id', ''),
    p ->> 'jornada_tipo',
    (p ->> 'monto_estimado')::integer,
    coalesce(p -> 'desglose', '{}'::jsonb)
  )
  returning postulaciones.id, postulaciones.token_gestion into v_id, v_token;

  return query select v_id, v_codigo, v_token;
end;
$$;

revoke all on function public.crear_postulacion(jsonb) from public, anon, authenticated;
grant execute on function public.crear_postulacion(jsonb) to service_role;
