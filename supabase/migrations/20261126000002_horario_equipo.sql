-- Evaluación en el horario habitual del equipo (después de las audiciones de diciembre).
-- La familia elige uno de los equipos sugeridos; se guarda en `equipo_evaluacion`.
alter table public.postulaciones add column if not exists equipo_evaluacion text;

alter table public.postulaciones drop constraint if exists postulaciones_jornada_tipo_check;
alter table public.postulaciones add constraint postulaciones_jornada_tipo_check
  check (jornada_tipo in ('jornadas', 'sin-evaluacion', 'inicio-diferido', 'horario-equipo'));

-- Misma función, con la columna nueva en el insert.
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
    programa_sugerido, equipos_sugeridos, jornada_id, jornada_tipo, monto_estimado, desglose, equipo_evaluacion
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
    coalesce(p -> 'desglose', '{}'::jsonb),
    nullif(p ->> 'equipo_evaluacion', '')
  )
  returning postulaciones.id, postulaciones.token_gestion into v_id, v_token;

  return query select v_id, v_codigo, v_token;
end;
$$;

revoke all on function public.crear_postulacion(jsonb) from public, anon, authenticated;
grant execute on function public.crear_postulacion(jsonb) to service_role;
