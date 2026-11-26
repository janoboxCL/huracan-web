/* POST /api/postulaciones: crea una preinscripción.

   El navegador envía solo lo que la persona escribió. Equipos sugeridos, jornada
   permitida y monto estimado se RECALCULAN aquí con las mismas reglas que usa la
   interfaz (src/lib/postulacion/reglas.ts). El cupo se revisa dentro de la función SQL
   `crear_postulacion`, de forma atómica. */
import contenido from '../../docs/contenido/huracan-2027.json';
import { franjasPorEquipo, textoHorarioEquipo, type DiaHorario } from '../../src/lib/postulacion/horarios.ts';
import { JORNADAS_INICIALES, edadEnTemporada, evaluarPostulacion, preciosDesdeContenido, type EquipoBase, type ContenidoPrecios } from '../../src/lib/postulacion/reglas.ts';
import type { ContextoFuncion } from '../../src/lib/servidor/entorno.ts';
import { enviarCorreo } from '../../src/lib/servidor/correo.ts';
import { ErrorSupabase, leerCopiasOcultas, rpc } from '../../src/lib/servidor/supabase.ts';
import { validarPostulacion } from '../../src/lib/servidor/validar.ts';

const equipos = (contenido as unknown as { equipos: EquipoBase[] }).equipos;
const precios = preciosDesdeContenido(contenido as unknown as ContenidoPrecios);
const contacto = (contenido as unknown as { contacto: { whatsappHeadCoach: string; whatsappTexto: string } }).contacto;

const horariosClub = (contenido as unknown as { horarios: DiaHorario[] }).horarios;

const LIMITE_CUERPO = 20_000;

interface FilaJornada {
  id: string;
  fecha: string;
  inicio: string;
  fin: string;
  grupo: string;
  disponibles: number | null;
}

const respuestaError = (estado: number, error: string, extra: Record<string, unknown> = {}) => Response.json({ error, ...extra }, { status: estado });

export const onRequestPost = async ({ request, env }: ContextoFuncion): Promise<Response> => {
  const largo = Number(request.headers.get('content-length') ?? '0');
  if (largo > LIMITE_CUERPO) return respuestaError(413, 'cuerpo_muy_grande');

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return respuestaError(400, 'json_invalido');
  }

  /* Trampa para bots: un campo oculto que una persona nunca llena. Se responde como si
     hubiera funcionado para no darles pistas. */
  if (typeof cuerpo === 'object' && cuerpo !== null && (cuerpo as Record<string, unknown>)['sitioWeb']) {
    return Response.json({ codigo: 'HUR-000000' }, { status: 201 });
  }

  const validacion = validarPostulacion(cuerpo);
  if (!validacion.ok) return respuestaError(400, 'datos_invalidos', { campos: validacion.campos });
  const d = validacion.datos;

  const edad = edadEnTemporada(d.fechaNacimiento);
  const evaluacion = evaluarPostulacion(equipos, precios, {
    edad,
    genero: d.sexo,
    experiencia: d.experiencia,
    ...(d.modalidad ? { modalidad: d.modalidad } : {}),
    habilidades: d.habilidades,
    esAntiguo: d.esAntiguo,
  });
  /* Sin equipo sugerido también se guarda: el head coach orienta a la familia por WhatsApp. */

  let jornadaId: string | null = null;
  let jornadaTexto: string | null = null;
  let tipoJornada: string = evaluacion.jornada.tipo;
  let equipoEvaluacion: string | null = null;
  let horarioEquipo: string | undefined;
  if (evaluacion.jornada.tipo === 'jornadas') {
    const grupos = evaluacion.jornada.grupos;
    let abiertas: FilaJornada[];
    try {
      abiertas = await rpc<FilaJornada[]>(env, 'jornadas_disponibles');
    } catch (error) {
      console.error('No se pudieron leer las jornadas', error instanceof Error ? error.message : 'error');
      return respuestaError(503, 'no_disponible');
    }
    if (d.jornadaId) {
      const elegida = abiertas.find((j) => j.id === d.jornadaId);
      if (!elegida || !grupos.includes(elegida.grupo as never)) return respuestaError(409, 'jornada_no_disponible');
      if (elegida.disponibles !== null && elegida.disponibles <= 0) return respuestaError(409, 'jornada_sin_cupo');
      jornadaId = elegida.id;
      const semilla = JORNADAS_INICIALES.find((j) => j.id === elegida.id);
      jornadaTexto = `${semilla?.dia ?? elegida.fecha}, ${elegida.inicio.slice(0, 5)} a ${elegida.fin.slice(0, 5)}`;
    } else if (!abiertas.some((j) => grupos.includes(j.grupo as never))) {
      /* Sin jornadas de audición: la evaluación es en el horario habitual del equipo sugerido. La persona no elige equipo: con varios sugeridos, el head coach confirma cuál. */
      const sugeridos = evaluacion.equipos;
      if (sugeridos.length === 0) return respuestaError(400, 'datos_invalidos', { campos: ['jornadaId'] });
      tipoJornada = 'horario-equipo';
      const franjas = franjasPorEquipo(horariosClub, sugeridos.map((e) => e.nombre));
      equipoEvaluacion = sugeridos.length === 1 ? (sugeridos[0]?.nombre ?? null) : null;
      horarioEquipo = sugeridos.map((e) => textoHorarioEquipo(e.nombre, franjas[e.nombre] ?? [])).join('; o ');
    } else {
      return respuestaError(400, 'datos_invalidos', { campos: ['jornadaId'] });
    }
  } else if (d.jornadaId) {
    return respuestaError(400, 'datos_invalidos', { campos: ['jornadaId'] });
  }

  const principal = evaluacion.ingresoEstimado; // nulo si no hay equipo sugerido
  try {
    const [creada] = await rpc<{ id: string; codigo: string; token_gestion: string }[]>(env, 'crear_postulacion', {
      p: {
        atleta_nombre: d.atletaNombre,
        atleta_apellido: d.atletaApellido,
        fecha_nacimiento: d.fechaNacimiento,
        edad_2027: edad,
        sexo: d.sexo,
        comuna: d.comuna,
        es_antiguo: d.esAntiguo,
        experiencia: d.experiencia,
        club_anterior: d.clubAnterior,
        anios_experiencia: d.aniosExperiencia,
        posicion: d.posicion,
        habilidades: d.habilidades,
        modalidad_deseada: d.modalidad,
        equipo_interes: d.equipoInteres,
        tipo_postulacion: d.tipoPostulacion,
        promociones_declaradas: d.promociones,
        contacto_nombre: d.contactoNombre,
        contacto_parentesco: d.contactoParentesco,
        contacto_telefono: d.contactoTelefono,
        contacto_correo: d.contactoCorreo,
        programa_sugerido: principal?.programa ?? null,
        equipos_sugeridos: evaluacion.equipos.map((e) => e.nombre),
        jornada_id: jornadaId,
        jornada_tipo: tipoJornada,
        equipo_evaluacion: equipoEvaluacion,
        monto_estimado: principal?.total ?? 0,
        desglose: evaluacion.ingresos,
      },
    });
    if (!creada) return respuestaError(500, 'no_se_pudo_guardar');

    let correoEnviado = false;
    try {
      correoEnviado = await enviarCorreo(env, {
        codigo: creada.codigo,
        atleta: `${d.atletaNombre} ${d.atletaApellido}`,
        para: d.contactoCorreo,
        evaluacion,
        jornadaTexto,
        ...(horarioEquipo ? { horarioEquipo } : {}),
        whatsappHeadCoach: contacto.whatsappHeadCoach,
        whatsappTexto: contacto.whatsappTexto,
        direccion: contacto.direccion,
        comoLlegar: contacto.comoLlegar,
        correoPagos: contacto.correoPagos,
        copiasOcultas: await leerCopiasOcultas(env),
      });
    } catch (error) {
      console.error('Falló el envío de correo', error instanceof Error ? error.message : 'error');
    }

    return Response.json({ codigo: creada.codigo, correoEnviado, ingresoEstimado: principal.total }, { status: 201 });
  } catch (error) {
    if (error instanceof ErrorSupabase) {
      if (error.mensaje.includes('jornada_sin_cupo')) return respuestaError(409, 'jornada_sin_cupo');
      if (error.mensaje.includes('jornada_no_disponible')) return respuestaError(409, 'jornada_no_disponible');
    }
    console.error('No se pudo crear la postulación', error instanceof Error ? error.message : 'error');
    return respuestaError(500, 'no_se_pudo_guardar');
  }
};
