-- Gestión de usuarios del CRM y borrado de inscripciones.
-- · `administradores.correo`: para listar las cuentas sin consultar auth.users.
-- · `es_jefatura()`: head coach o administración.
-- · Solo la jefatura puede ver todas las cuentas y borrar postulaciones.
--   La creación de cuentas pasa por una Pages Function con la clave de servicio.

alter table public.administradores add column if not exists correo text;

update public.administradores a
   set correo = u.email
  from auth.users u
 where u.id = a.user_id
   and a.correo is null;

create or replace function public.es_jefatura()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.administradores a
     where a.user_id = auth.uid() and a.rol in ('head_coach', 'administracion')
  );
$$;

revoke all on function public.es_jefatura() from public;
grant execute on function public.es_jefatura() to authenticated;

create policy "administradores: la jefatura ve todas las cuentas"
  on public.administradores for select
  to authenticated
  using (public.es_jefatura());

-- Postulaciones: la política única "for all" se separa para que borrar exija jefatura.
drop policy if exists "postulaciones: gestión de administradores" on public.postulaciones;

create policy "postulaciones: lectura de administradores"
  on public.postulaciones for select
  to authenticated
  using (public.es_admin());

create policy "postulaciones: alta de administradores"
  on public.postulaciones for insert
  to authenticated
  with check (public.es_admin());

create policy "postulaciones: edición de administradores"
  on public.postulaciones for update
  to authenticated
  using (public.es_admin())
  with check (public.es_admin());

create policy "postulaciones: borrado de la jefatura"
  on public.postulaciones for delete
  to authenticated
  using (public.es_jefatura());

-- Las funciones nuevas quedan visibles para anon por privilegios por defecto de Supabase: se retira.
revoke execute on function public.es_jefatura() from anon;
