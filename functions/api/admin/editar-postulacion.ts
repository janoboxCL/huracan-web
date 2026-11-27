/* Edición administrativa: la sesión y el rol se comprueban en servidor.
   Nunca crea otra postulación ni modifica pagos. */
import contenido from '../../../docs/contenido/huracan-2027.json';
import type { Postulacion, JornadaAdmin } from '../../../src/lib/admin/tipos.ts';
import type { ContextoFuncion, Entorno } from '../../../src/lib/servidor/entorno.ts';
import { validarPostulacion } from '../../../src/lib/servidor/validar.ts';
import { esMenorDeEdad, textoDiaJornada } from '../../../src/lib/postulacion/formulario.ts';
import { edadEnTemporada, evaluarPostulacion, preciosDesdeContenido, type EquipoBase, type ContenidoPrecios } from '../../../src/lib/postulacion/reglas.ts';
import { franjasPorEquipo, textoHorarioEquipo, type DiaHorario } from '../../../src/lib/postulacion/horarios.ts';
import { enviarCorreo } from '../../../src/lib/servidor/correo.ts';
import { leerCopiasOcultas } from '../../../src/lib/servidor/supabase.ts';

const equipos = contenido.equipos as unknown as EquipoBase[];
const precios = preciosDesdeContenido(contenido as unknown as ContenidoPrecios);
const horarios = contenido.horarios as unknown as DiaHorario[];
const error = (status: number, error: string, extra = {}) => Response.json({ error, ...extra }, { status });
const servicio = (env: Entorno) => ({ apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' });
async function filas<T>(env: Entorno, tabla: string, q: URLSearchParams): Promise<T[]> {
  const r = await fetch(env.SUPABASE_URL + '/rest/v1/' + tabla + '?' + q, { headers: servicio(env) });
  if (!r.ok) throw new Error('Lectura administrativa: ' + r.status);
  return await r.json() as T[];
}
const columnas = 'id,codigo,estado,atleta_nombre,atleta_apellido,fecha_nacimiento,edad_2027,sexo,comuna,es_antiguo,experiencia,club_anterior,anios_experiencia,posicion,habilidades,modalidad_deseada,equipo_interes,tipo_postulacion,promociones_declaradas,contacto_nombre,contacto_parentesco,contacto_telefono,contacto_correo,programa_sugerido,equipos_sugeridos,jornada_id,jornada_tipo,equipo_evaluacion,monto_estimado,desglose,equipo_asignado,promocion_validada,actualizado_en';

export const onRequestPost = async ({ request, env }: ContextoFuncion): Promise<Response> => {
  try {
    const token = /^Bearer\\s+(\\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
    if (!token) return error(401, 'sin_sesion');
    const auth = await fetch(env.SUPABASE_URL + '/auth/v1/user', { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + token } });
    if (!auth.ok) return error(401, 'sin_sesion');
    const u = await auth.json() as { id?: string };
    if (!u.id) return error(401, 'sin_sesion');
    const [admin] = await filas<{ rol: string }>(env, 'administradores', new URLSearchParams({ user_id: 'eq.' + u.id, select: 'rol' }));
    if (!admin || !['head_coach', 'administracion'].includes(admin.rol)) return error(403, 'sin_permiso');
    let b: Record<string, unknown>;
    try {
      const raw = await request.text();
      if (raw.length > 12000) return error(413, 'cuerpo_muy_grande');
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return error(400, 'datos_invalidos');
      b = parsed as Record<string, unknown>;
    } catch { return error(400, 'datos_invalidos'); }
    const id = b['id'], version = b['version'], accion = b['accion'];
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) || typeof version !== 'string' || !Number.isFinite(Date.parse(version)) || !['editar', 'reenviar'].includes(String(accion))) return error(400, 'datos_invalidos');
    const [p] = await filas<Postulacion>(env, 'postulaciones', new URLSearchParams({ id: 'eq.' + id, select: columnas }));
    if (!p) return error(404, 'no_encontrada');
    if (p.actualizado_en !== version) return error(409, 'conflicto');
    const editar = accion === 'editar';
    const cambios = b['datos'];
    if (editar && (!cambios || typeof cambios !== 'object' || Array.isArray(cambios))) return error(400, 'datos_invalidos');
    const c = editar ? cambios as Record<string, unknown> : {};
    const valor = (k: string, v: unknown) => editar && Object.hasOwn(c, k) ? c[k] : v;
    const validacion = validarPostulacion({
      atletaNombre: valor('atletaNombre', p.atleta_nombre), atletaApellido: valor('atletaApellido', p.atleta_apellido),
      fechaNacimiento: valor('fechaNacimiento', p.fecha_nacimiento), sexo: valor('sexo', p.sexo), comuna: valor('comuna', p.comuna),
      esAntiguo: p.es_antiguo, experiencia: p.experiencia, clubAnterior: p.club_anterior, aniosExperiencia: p.anios_experiencia,
      posicion: p.posicion, habilidades: p.habilidades, modalidad: p.modalidad_deseada, equipoInteres: p.equipo_interes,
      tipoPostulacion: p.tipo_postulacion, promociones: p.promociones_declaradas,
      contactoNombre: valor('contactoNombre', p.contacto_nombre), contactoParentesco: valor('contactoParentesco', p.contacto_parentesco),
      contactoTelefono: valor('contactoTelefono', p.contacto_telefono), contactoCorreo: valor('contactoCorreo', p.contacto_correo),
    });
    if (!validacion.ok) return error(400, 'datos_invalidos', { campos: validacion.campos });
    const d = validacion.datos;
    const edad = edadEnTemporada(d.fechaNacimiento);
    if (edad > 99) return error(400, 'datos_invalidos', { campos: ['fechaNacimiento'] });
    if (!d.contactoParentesco || (esMenorDeEdad(d.fechaNacimiento) && d.contactoParentesco === 'propio')) return error(400, 'datos_invalidos', { campos: ['contactoParentesco'] });
    const ev = evaluarPostulacion(equipos, precios, { edad, genero: d.sexo, experiencia: d.experiencia, ...(d.modalidad ? { modalidad: d.modalidad } : {}), habilidades: d.habilidades, esAntiguo: d.esAntiguo });
    const reclasificar = editar && (edad !== p.edad_2027 || d.sexo !== p.sexo);
    if (reclasificar && p.equipo_asignado && !ev.equipos.some(e => e.nombre === p.equipo_asignado)) return error(409, 'equipo_incompatible');
    let jornada: JornadaAdmin | undefined;
    if (p.jornada_id) [jornada] = await filas<JornadaAdmin>(env, 'evaluacion_jornadas', new URLSearchParams({ id: 'eq.' + p.jornada_id, select: 'id,fecha,inicio,fin,grupo,abierta,cupos' }));
    let jornadaId = p.jornada_id;
    let tipo = p.jornada_tipo;
    let equipoEvaluacion = p.equipo_evaluacion;
    if (reclasificar) {
      if (ev.jornada.tipo !== 'jornadas') { tipo = ev.jornada.tipo; jornadaId = null; equipoEvaluacion = null; }
      else if (jornada && ev.jornada.grupos.includes(jornada.grupo)) { tipo = 'jornadas'; equipoEvaluacion = null; }
      else {
        // El esquema exige jornada_id para tipo jornadas. Sin reserva nueva, se coordina horario con el coach.
        tipo = 'horario-equipo'; jornadaId = null;
        equipoEvaluacion = p.jornada_tipo === 'horario-equipo' && ev.equipos.some(e => e.nombre === p.equipo_evaluacion) ? p.equipo_evaluacion : null;
      }
    }
    const enviar = accion === 'reenviar' || b['enviarCorreo'] === true;
    if (enviar && p.estado === 'cancelada') return error(409, 'cancelada');
    let tienePagos = p.estado !== 'preinscrita';
    if (enviar && !tienePagos) tienePagos = (await filas<{ id: string }>(env, 'pagos', new URLSearchParams({ postulacion_id: 'eq.' + id, select: 'id', limit: '1' }))).length > 0;
    let guardado = false;
    if (editar) {
      const patch = {
        atleta_nombre: d.atletaNombre, atleta_apellido: d.atletaApellido, fecha_nacimiento: d.fechaNacimiento, edad_2027: edad,
        sexo: d.sexo, comuna: d.comuna, contacto_nombre: d.contactoNombre, contacto_parentesco: d.contactoParentesco,
        contacto_telefono: d.contactoTelefono, contacto_correo: d.contactoCorreo,
        ...(reclasificar ? { programa_sugerido: ev.ingresoEstimado?.programa ?? null, equipos_sugeridos: ev.equipos.map(e => e.nombre), monto_estimado: ev.ingresoEstimado?.total ?? 0, desglose: ev.ingresos, jornada_id: jornadaId, jornada_tipo: tipo, equipo_evaluacion: equipoEvaluacion } : {}),
      };
      const q = new URLSearchParams({ id: 'eq.' + id, actualizado_en: 'eq.' + version, select: 'id' });
      const r = await fetch(env.SUPABASE_URL + '/rest/v1/postulaciones?' + q, { method: 'PATCH', headers: { ...servicio(env), Prefer: 'return=representation' }, body: JSON.stringify(patch) });
      if (!r.ok) return error(502, 'no_se_pudo_guardar');
      const modificadas = await r.json() as { id: string }[];
      if (!modificadas.length) return error(409, 'conflicto');
      guardado = true;
      console.info(JSON.stringify({ evento: 'crm_postulacion_editada', actor: u.id, postulacion: id, fecha: new Date().toISOString(), reclasificar }));
    }
    let correoEnviado: boolean | null = null;
    if (enviar) {
      correoEnviado = false;
      try {
        // No recalcular precios de una ficha intacta ni enviar cobros duplicados.
        const evalCorreo = reclasificar ? ev : { ...ev, equipos: equipos.filter(e => p.equipos_sugeridos.includes(e.nombre)), ingresos: Array.isArray(p.desglose) ? p.desglose as typeof ev.ingresos : [], ingresoEstimado: Array.isArray(p.desglose) ? (p.desglose as typeof ev.ingresos).reduce<typeof ev.ingresoEstimado>((a, x) => !a || x.total > a.total ? x : a, null) : null };
        const jornadaTexto = jornadaId && jornada ? textoDiaJornada(jornada.fecha) + ', ' + jornada.inicio.slice(0, 5) + ' a ' + jornada.fin.slice(0, 5) : null;
        const horarioEquipo = tipo === 'horario-equipo' && equipoEvaluacion ? textoHorarioEquipo(equipoEvaluacion, franjasPorEquipo(horarios, [equipoEvaluacion])[equipoEvaluacion] ?? []) : undefined;
        correoEnviado = await enviarCorreo(env, { codigo: p.codigo, atleta: d.atletaNombre + ' ' + d.atletaApellido, para: d.contactoCorreo, evaluacion: evalCorreo, jornadaTexto,
          ...(horarioEquipo ? { horarioEquipo } : {}), ...contenido.contacto,
          actualizada: true, sinInstruccionesPago: tienePagos,
          evaluacionPendiente: tipo === 'horario-equipo' && !equipoEvaluacion,
          copiasOcultas: await leerCopiasOcultas(env) });
      } catch { console.warn('No se pudo enviar correo administrativo'); }
      console.info(JSON.stringify({ evento: 'crm_postulacion_correo', actor: u.id, postulacion: id, fecha: new Date().toISOString(), aceptado: correoEnviado }));
    }
    return Response.json({ ok: true, guardado, correoEnviado, jornadaPendiente: tipo === 'horario-equipo' && !equipoEvaluacion });
  } catch { return error(503, 'no_disponible'); }
};
