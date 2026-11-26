-- Amplía los valores permitidos: sexo «otro» y experiencia «basica» (muy poca y de nivel básico).
alter table public.postulaciones drop constraint if exists postulaciones_sexo_check;
alter table public.postulaciones add constraint postulaciones_sexo_check
  check (sexo in ('dama', 'varon', 'otro'));

alter table public.postulaciones drop constraint if exists postulaciones_experiencia_check;
alter table public.postulaciones add constraint postulaciones_experiencia_check
  check (experiencia in ('ninguna', 'basica', 'con'));
