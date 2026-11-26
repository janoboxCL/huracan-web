/* Repositorio real: supabase-js en el navegador con la clave publicable y la sesión de
   Supabase Auth (correo y contraseña). Todo lo protege RLS (`es_admin()`); la clave
   `service_role` no existe en el cliente. supabase-js se carga solo desde las páginas /admin. */

import type { SupabaseClient } from '@supabase/supabase-js';
import { leerBanner, leerInscripciones } from './ajustes.ts';
import { ErrorAdmin, MENSAJE_CONFLICTO, traducirError } from './errores.ts';
import { ocupacionPorJornada } from './jornadas.ts';
import type { Repositorio } from './repositorio.ts';
import type { Administrador, Ajustes, CambiosPostulacion, JornadaAdmin, Pago, Postulacion } from './tipos.ts';

export const URL_SUPABASE_POR_DEFECTO = 'https://edvvueaduetlruiushvz.supabase.co';
export const CLAVE_PUBLICABLE_POR_DEFECTO = 'sb_publishable_S7G3potppIsjlbFQ1sZmBw_y4AH2ToG';

/* Todas las columnas menos `token_gestion` (enlace secreto de la familia). */
const COLUMNAS_POSTULACION = [
  'id', 'codigo', 'estado', 'atleta_nombre', 'atleta_apellido', 'fecha_nacimiento', 'edad_2027', 'sexo', 'comuna',
  'es_antiguo', 'experiencia', 'club_anterior', 'anios_experiencia', 'posicion', 'habilidades', 'modalidad_deseada',
  'equipo_interes', 'tipo_postulacion', 'promociones_declaradas', 'contacto_nombre', 'contacto_parentesco',
  'contacto_telefono', 'contacto_correo', 'programa_sugerido', 'equipos_sugeridos', 'jornada_id', 'jornada_tipo',
  'monto_estimado', 'desglose', 'equipo_asignado', 'promocion_validada', 'notas_coach', 'creado_en', 'actualizado_en',
].join(',');

const hora = (v: string) => v.slice(0, 5);

function aJornada(f: Record<string, unknown>): JornadaAdmin {
  return {
    id: String(f['id']),
    fecha: String(f['fecha']),
    inicio: hora(String(f['inicio'])),
    fin: hora(String(f['fin'])),
    grupo: f['grupo'] as JornadaAdmin['grupo'],
    cupos: f['cupos'] === null || f['cupos'] === undefined ? null : Number(f['cupos']),
    abierta: f['abierta'] === true,
  };
}

function aFila(j: JornadaAdmin) {
  return { fecha: j.fecha, inicio: j.inicio, fin: j.fin, grupo: j.grupo, cupos: j.cupos, abierta: j.abierta };
}

export async function crearRepositorioSupabase(url: string, clave: string): Promise<Repositorio> {
  const { createClient } = await import('@supabase/supabase-js');
  const db: SupabaseClient = createClient(url, clave, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  /** Lanza un error traducido si la respuesta trae uno. */
  const comprobar = <T>(r: { data: T | null; error: unknown }): T | null => {
    if (r.error) throw traducirError(r.error);
    return r.data;
  };

  return {
    modo: 'supabase',

    async obtenerUsuario() {
      try {
        /* getUser consulta al servidor: detecta sesiones revocadas, a diferencia de getSession. */
        const { data, error } = await db.auth.getUser();
        if (error || !data.user) return null;
        return { id: data.user.id, correo: data.user.email ?? '' };
      } catch {
        throw new ErrorAdmin('No se pudo verificar tu sesión. Revisa tu conexión e inténtalo de nuevo.', 'red');
      }
    },

    async iniciarSesion(correo, clave) {
      try {
        const { error } = await db.auth.signInWithPassword({ email: correo, password: clave });
        if (!error) return { ok: true };
        if (error.status === 400 || error.status === 401 || /invalid login/i.test(error.message)) return { ok: false, motivo: 'credenciales' };
        return { ok: false, motivo: error.status === 0 || /fetch|network/i.test(error.message) ? 'red' : 'otro' };
      } catch {
        return { ok: false, motivo: 'red' };
      }
    },

    async cerrarSesion() {
      await db.auth.signOut();
    },

    async pedirRecuperacion(correo, volverA) {
      try {
        const { error } = await db.auth.resetPasswordForEmail(correo, { redirectTo: volverA });
        if (!error) return 'ok';
        return error.status === 0 || /fetch|network/i.test(error.message) ? 'red' : 'otro';
      } catch {
        return 'red';
      }
    },

    async abrirSesionDeRecuperacion() {
      /* El enlace del correo vuelve con los tokens en el fragmento (#access_token=…&type=recovery). */
      const datos = new URLSearchParams(location.hash.replace(/^#/, ''));
      const acceso = datos.get('access_token');
      const renovacion = datos.get('refresh_token');
      history.replaceState(null, '', location.pathname);
      if (datos.get('type') !== 'recovery' || !acceso || !renovacion) return false;
      try {
        const { data, error } = await db.auth.setSession({ access_token: acceso, refresh_token: renovacion });
        return !error && data.session !== null;
      } catch {
        return false;
      }
    },

    async cambiarClave(clave) {
      try {
        const { error } = await db.auth.updateUser({ password: clave });
        if (!error) return 'ok';
        if (/password|contraseña/i.test(error.message) && error.status === 422) return 'debil';
        return error.status === 0 || /fetch|network/i.test(error.message) ? 'red' : 'otro';
      } catch {
        return 'red';
      }
    },

    async obtenerAdministrador(usuarioId) {
      const r = await db.from('administradores').select('user_id,nombre,rol').eq('user_id', usuarioId).maybeSingle();
      return comprobar<Administrador>(r as never);
    },

    async listarPostulaciones() {
      const r = await db.from('postulaciones').select(COLUMNAS_POSTULACION).order('creado_en', { ascending: false }).limit(2000);
      return (comprobar(r as never) ?? []) as Postulacion[];
    },

    async obtenerPostulacion(codigo) {
      const r = await db.from('postulaciones').select(COLUMNAS_POSTULACION).eq('codigo', codigo).maybeSingle();
      return comprobar<Postulacion>(r as never);
    },

    async actualizarPostulacion(id, cambios: CambiosPostulacion, version?: string) {
      let consulta = db.from('postulaciones').update(cambios).eq('id', id);
      /* Control optimista: solo actualiza si nadie más modificó la fila desde que se leyó. */
      if (version) consulta = consulta.eq('actualizado_en', version);
      const r = await consulta.select(COLUMNAS_POSTULACION).maybeSingle();
      const fila = comprobar<Postulacion>(r as never);
      if (!fila) {
        if (version) throw new ErrorAdmin(MENSAJE_CONFLICTO, 'conflicto');
        throw new ErrorAdmin('No se encontró la postulación o no tienes permiso para modificarla.', 'permisos');
      }
      return fila;
    },

    async listarPagos(postulacionId) {
      const r = await db.from('pagos').select('*').eq('postulacion_id', postulacionId).order('creado_en', { ascending: true });
      return (comprobar(r as never) ?? []) as Pago[];
    },

    async crearPago(postulacionId, concepto, monto) {
      const r = await db.from('pagos').insert({ postulacion_id: postulacionId, concepto, monto }).select('*').single();
      return comprobar<Pago>(r as never) as Pago;
    },

    async confirmarPago(pagoId, usuarioId) {
      /* `.is('confirmado_en', null)`: no se vuelve a confirmar (ni se pisa quién lo confirmó) un pago ya confirmado. */
      const r = await db
        .from('pagos')
        .update({ confirmado_por: usuarioId, confirmado_en: new Date().toISOString() })
        .eq('id', pagoId)
        .is('confirmado_en', null)
        .select('*')
        .maybeSingle();
      const fila = comprobar<Pago>(r as never);
      if (!fila) throw new ErrorAdmin('Ese pago ya estaba confirmado o no existe. Recarga la ficha para ver su estado actual.', 'conflicto');
      return fila;
    },

    async listarJornadas() {
      const r = await db.from('evaluacion_jornadas').select('id,fecha,inicio,fin,grupo,cupos,abierta').order('fecha').order('inicio');
      return ((comprobar(r as never) ?? []) as Record<string, unknown>[]).map(aJornada);
    },

    async contarOcupacion() {
      const r = await db.from('postulaciones').select('jornada_id,estado').not('jornada_id', 'is', null).limit(5000);
      return ocupacionPorJornada((comprobar(r as never) ?? []) as { jornada_id: string | null; estado: string }[]);
    },

    async crearJornada(j) {
      const r = await db.from('evaluacion_jornadas').insert({ id: j.id, ...aFila(j) }).select('id,fecha,inicio,fin,grupo,cupos,abierta').single();
      return aJornada(comprobar<Record<string, unknown>>(r as never) as Record<string, unknown>);
    },

    async actualizarJornada(j) {
      const r = await db.from('evaluacion_jornadas').update({ ...aFila(j), actualizada_en: new Date().toISOString() }).eq('id', j.id).select('id,fecha,inicio,fin,grupo,cupos,abierta').maybeSingle();
      const fila = comprobar<Record<string, unknown>>(r as never);
      if (!fila) throw new ErrorAdmin('No se encontró la jornada o no tienes permiso para modificarla.', 'permisos');
      return aJornada(fila);
    },

    async obtenerAjustes(): Promise<Ajustes> {
      const r = await db.from('ajustes_sitio').select('clave,valor').in('clave', ['banner', 'inscripciones']);
      const filas = (comprobar(r as never) ?? []) as { clave: string; valor: unknown }[];
      const valor = (clave: string) => filas.find((f) => f.clave === clave)?.valor;
      return { banner: leerBanner(valor('banner')), inscripciones: leerInscripciones(valor('inscripciones')) };
    },

    async guardarAjuste(clave, valor, usuarioId) {
      const r = await db.from('ajustes_sitio').upsert({ clave, valor, actualizado_por: usuarioId }, { onConflict: 'clave' });
      if (r.error) throw traducirError(r.error);
    },
  };
}
