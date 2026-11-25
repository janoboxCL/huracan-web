-- Fija el search_path de las funciones utilitarias (aviso del linter de seguridad de Supabase).
alter function public.tocar_actualizado_en() set search_path = '';
alter function public.generar_codigo() set search_path = public;
