/* Repositorio de demostración: datos de ejemplo en memoria (respaldados en sessionStorage para
   que sobrevivan al navegar entre las páginas del CRM). Todo es ficticio: nombres, teléfonos y
   correos no corresponden a personas reales. Los equipos, jornadas y montos salen del mismo
   motor que usa el sitio (reglas.ts), así que son coherentes con las reglas vigentes.

   Solo se carga si `arranque.ts` permite el modo demostración (`import.meta.env.DEV` o
   PUBLIC_ADMIN_DEMO=1); en producción no se incluye en el paquete. */

import { leerBanner, leerInscripciones } from './ajustes.ts';
import { ErrorAdmin, MENSAJE_CONFLICTO } from './errores.ts';
import { ocupacionPorJornada } from './jornadas.ts';
import type { Repositorio } from './repositorio.ts';
import type { Ajustes, CambiosPostulacion, Estado, JornadaAdmin, Pago, Postulacion } from './tipos.ts';
import {
  JORNADAS_INICIALES,
  evaluarPostulacion,
  type EquipoBase,
  type Postulante,
  type Precios,
} from '../postulacion/reglas.ts';

const CLAVE_ALMACEN = 'huracan-admin-demo-estado';
const USUARIO_DEMO = { id: 'demo-usuario', correo: 'demostracion@ejemplo.cl' };

interface Perfil {
  nombre: string;
  apellido: string;
  nacimiento: string;
  sexo: 'dama' | 'varon';
  experiencia: 'ninguna' | 'con';
  habilidades?: string[];
  antiguo?: boolean;
  tipo?: Postulacion['tipo_postulacion'];
  promociones?: string[];
  estado: Estado;
  comuna: string;
  notas?: string;
  promocionValidada?: string;
  club?: string;
  anios?: number;
  posicion?: string;
}

const PERFILES: Perfil[] = [
  { nombre: 'Sofía', apellido: 'Mendoza Prueba', nacimiento: '2018-03-14', sexo: 'dama', experiencia: 'ninguna', estado: 'preinscrita', comuna: 'La Cisterna' },
  { nombre: 'Matías', apellido: 'Fuentes Prueba', nacimiento: '2012-08-02', sexo: 'varon', experiencia: 'con', habilidades: ['n2-handvault'], estado: 'pago_informado', comuna: 'San Miguel', club: 'Club de ejemplo', anios: 3, posicion: 'base-principal' },
  { nombre: 'Valentina', apellido: 'Rojas Prueba', nacimiento: '2016-11-21', sexo: 'dama', experiencia: 'ninguna', estado: 'pago_confirmado', comuna: 'San Joaquín', notas: 'Llegará 10 minutos antes de la jornada.' },
  { nombre: 'Isidora', apellido: 'Pizarro Prueba', nacimiento: '2010-05-30', sexo: 'dama', experiencia: 'con', habilidades: ['n3-flic-salto-flic'], estado: 'evaluada', comuna: 'Maipú', club: 'Club de ejemplo', anios: 5, posicion: 'flyer', notas: 'Buena técnica de gimnasia. Falta trabajar la flexibilidad.' },
  { nombre: 'Antonia', apellido: 'Soto Prueba', nacimiento: '2022-01-09', sexo: 'dama', experiencia: 'ninguna', estado: 'asignada', comuna: 'La Cisterna' },
  { nombre: 'Benjamín', apellido: 'Araya Prueba', nacimiento: '2008-09-17', sexo: 'varon', experiencia: 'con', habilidades: ['n2-flic-una-pierna'], antiguo: true, estado: 'asignada', comuna: 'Lo Espejo', club: 'Huracán', anios: 4, posicion: 'base-secundaria' },
  { nombre: 'Camila', apellido: 'Vergara Prueba', nacimiento: '2007-02-25', sexo: 'dama', experiencia: 'ninguna', estado: 'preinscrita', comuna: 'San Bernardo' },
  { nombre: 'Josefa', apellido: 'Núñez Prueba', nacimiento: '2015-07-04', sexo: 'dama', experiencia: 'con', estado: 'pago_informado', comuna: 'El Bosque', promociones: ['hermanos'], club: 'Club de ejemplo', anios: 2, posicion: 'flyer' },
  { nombre: 'Tomás', apellido: 'Gutiérrez Prueba', nacimiento: '2019-12-12', sexo: 'varon', experiencia: 'ninguna', estado: 'cancelada', comuna: 'San Miguel', notas: 'La familia desistió: cambio de horario laboral.' },
  { nombre: 'Emilia', apellido: 'Castillo Prueba', nacimiento: '2000-06-18', sexo: 'dama', experiencia: 'con', habilidades: ['g3-desmonte-giro', 'g3-switch-up-hell-stretch', 'g3-tic-toc-cintura'], tipo: 'grupo', estado: 'pago_confirmado', comuna: 'Santiago', club: 'Club de ejemplo', anios: 6, posicion: 'flyer', promocionValidada: 'Open Prep' },
  { nombre: 'Martina', apellido: 'Lagos Prueba', nacimiento: '2011-10-08', sexo: 'dama', experiencia: 'ninguna', estado: 'evaluada', comuna: 'Pedro Aguirre Cerda' },
  { nombre: 'Diego', apellido: 'Salazar Prueba', nacimiento: '1989-04-03', sexo: 'varon', experiencia: 'ninguna', estado: 'preinscrita', comuna: 'La Cisterna', promociones: ['familiar'] },
];

/** Cupos de ejemplo para ver la ocupación (la semilla real no tiene límite). */
const CUPOS_DEMO: Record<string, number | null> = {
  '2026-12-04-1800': 3,
  '2026-12-04-2000': 2,
  '2026-12-05-1000': 12,
  '2026-12-05-1200': 4,
  '2026-12-05-1400': null,
};

interface Estado_ {
  postulaciones: Postulacion[];
  pagos: Pago[];
  jornadas: JornadaAdmin[];
  ajustes: Ajustes;
}

export interface DatosBase {
  equipos: readonly EquipoBase[];
  precios: Precios;
}

export function crearEstadoDemo({ equipos, precios }: DatosBase): Estado_ {
  const jornadas: JornadaAdmin[] = JORNADAS_INICIALES.map((j) => ({
    id: j.id,
    fecha: j.fecha,
    inicio: j.inicio,
    fin: j.fin,
    grupo: j.grupo,
    cupos: CUPOS_DEMO[j.id] ?? null,
    abierta: true,
  }));
  jornadas.push({ id: '2026-12-12-1000', fecha: '2026-12-12', inicio: '10:00', fin: '12:00', grupo: 'youth-junior-senior-prep', cupos: 10, abierta: false });

  const postulaciones: Postulacion[] = [];
  const pagos: Pago[] = [];
  const base = Date.parse('2026-11-25T15:00:00Z');

  PERFILES.forEach((perfil, i) => {
    const edad = 2027 - Number(perfil.nacimiento.slice(0, 4));
    const postulante: Postulante = {
      edad,
      genero: perfil.sexo,
      experiencia: perfil.experiencia,
      habilidades: perfil.habilidades ?? [],
      esAntiguo: perfil.antiguo ?? false,
    };
    const ev = evaluarPostulacion(equipos, precios, postulante);
    const principal = ev.ingresoEstimado;
    const creado = new Date(base - i * 5.5 * 3_600_000).toISOString();

    let jornadaId: string | null = null;
    if (ev.jornada.tipo === 'jornadas') {
      const candidatas = jornadas.filter((j) => j.abierta && (ev.jornada as { grupos: string[] }).grupos.includes(j.grupo));
      jornadaId = candidatas.length > 0 ? (candidatas[i % candidatas.length]?.id ?? null) : null;
    }
    const tipoJornada: Postulacion['jornada_tipo'] = jornadaId ? 'jornadas' : ev.jornada.tipo === 'jornadas' ? 'inicio-diferido' : ev.jornada.tipo;
    const menor = edad < 19;
    const id = `demo-postulacion-${String(i + 1).padStart(2, '0')}`;
    const equipoAsignado = perfil.estado === 'asignada' ? (ev.equipos[0]?.nombre ?? null) : null;

    postulaciones.push({
      id,
      codigo: `HUR-DEMO${String(i + 1).padStart(2, '0')}`,
      estado: perfil.estado,
      atleta_nombre: perfil.nombre,
      atleta_apellido: perfil.apellido,
      fecha_nacimiento: perfil.nacimiento,
      edad_2027: edad,
      sexo: perfil.sexo,
      comuna: perfil.comuna,
      es_antiguo: perfil.antiguo ?? false,
      experiencia: perfil.experiencia,
      club_anterior: perfil.club ?? null,
      anios_experiencia: perfil.anios ?? null,
      posicion: perfil.posicion ?? null,
      habilidades: perfil.habilidades ?? [],
      modalidad_deseada: null,
      equipo_interes: null,
      tipo_postulacion: perfil.tipo ?? 'individual',
      promociones_declaradas: perfil.promociones ?? [],
      contacto_nombre: menor ? `Apoderado ${i + 1} de ejemplo` : `${perfil.nombre} ${perfil.apellido}`,
      contacto_parentesco: menor ? (i % 2 === 0 ? 'madre' : 'padre') : 'propio',
      contacto_telefono: `+569000000${String(i + 1).padStart(2, '0')}`,
      contacto_correo: `demo${i + 1}@ejemplo.cl`,
      programa_sugerido: principal?.programa ?? null,
      equipos_sugeridos: ev.equipos.map((e) => e.nombre),
      jornada_id: jornadaId,
      jornada_tipo: tipoJornada,
      monto_estimado: principal?.total ?? 0,
      desglose: ev.ingresos,
      equipo_asignado: equipoAsignado,
      promocion_validada: perfil.promocionValidada ?? null,
      notas_coach: perfil.notas ?? null,
      creado_en: creado,
      actualizado_en: creado,
    });

    const monto = principal?.total ?? 0;
    if (perfil.estado === 'pago_informado' && monto > 0) {
      pagos.push({ id: `demo-pago-${i + 1}`, postulacion_id: id, concepto: 'Inscripción, ropa y primera mensualidad', monto, comprobante_url: null, confirmado_por: null, confirmado_en: null, creado_en: creado });
    }
    if (['pago_confirmado', 'evaluada', 'asignada'].includes(perfil.estado) && monto > 0) {
      pagos.push({ id: `demo-pago-${i + 1}`, postulacion_id: id, concepto: 'Inscripción, ropa y primera mensualidad', monto, comprobante_url: null, confirmado_por: USUARIO_DEMO.id, confirmado_en: creado, creado_en: creado });
    }
  });

  return {
    postulaciones,
    pagos,
    jornadas,
    ajustes: {
      banner: leerBanner({ visible: true, texto: 'Evaluaciones el 4 y 5 de diciembre. Texto de ejemplo.', enlace: '/postula' }),
      inscripciones: leerInscripciones({ estado: 'abiertas' }),
    },
  };
}

const esperar = (ms = 120) => new Promise<void>((r) => setTimeout(r, ms));

export function crearRepositorioDemo(datos: DatosBase, almacen: Storage | null): Repositorio {
  let estado: Estado_ = crearEstadoDemo(datos);
  try {
    const guardado = almacen?.getItem(CLAVE_ALMACEN);
    if (guardado) estado = JSON.parse(guardado) as Estado_;
  } catch {
    /* estado dañado: se parte de los datos de ejemplo */
  }
  const guardar = () => {
    try {
      almacen?.setItem(CLAVE_ALMACEN, JSON.stringify(estado));
    } catch {
      /* sin almacenamiento: queda solo en memoria */
    }
  };

  return {
    modo: 'demo',
    async obtenerUsuario() {
      await esperar(60);
      return USUARIO_DEMO;
    },
    async iniciarSesion() {
      await esperar();
      return { ok: true };
    },
    async cerrarSesion() {
      almacen?.removeItem(CLAVE_ALMACEN);
    },
    async pedirRecuperacion() {
      await esperar();
      return 'ok';
    },
    async abrirSesionDeRecuperacion() {
      return true;
    },
    async cambiarClave() {
      await esperar();
      return 'ok';
    },
    async obtenerAdministrador(usuarioId) {
      return { user_id: usuarioId, nombre: 'Persona de demostración', rol: 'head_coach' };
    },

    async listarPostulaciones() {
      await esperar();
      return structuredClone(estado.postulaciones);
    },
    async obtenerPostulacion(codigo) {
      await esperar();
      const p = estado.postulaciones.find((x) => x.codigo === codigo);
      return p ? structuredClone(p) : null;
    },
    async actualizarPostulacion(id, cambios: CambiosPostulacion, version?: string) {
      await esperar();
      const p = estado.postulaciones.find((x) => x.id === id);
      if (!p) throw new ErrorAdmin('No se encontró la postulación.', 'no-encontrado');
      if (version && p.actualizado_en !== version) throw new ErrorAdmin(MENSAJE_CONFLICTO, 'conflicto');
      Object.assign(p, cambios, { actualizado_en: new Date().toISOString() });
      guardar();
      return structuredClone(p);
    },

    async listarPagos(postulacionId) {
      await esperar(60);
      return structuredClone(estado.pagos.filter((x) => x.postulacion_id === postulacionId));
    },
    async crearPago(postulacionId, concepto, monto) {
      await esperar();
      const pago: Pago = { id: `demo-pago-${Date.now()}`, postulacion_id: postulacionId, concepto, monto, comprobante_url: null, confirmado_por: null, confirmado_en: null, creado_en: new Date().toISOString() };
      estado.pagos.push(pago);
      guardar();
      return structuredClone(pago);
    },
    async confirmarPago(pagoId, usuarioId) {
      await esperar();
      const pago = estado.pagos.find((x) => x.id === pagoId);
      if (!pago) throw new ErrorAdmin('No se encontró el pago.', 'no-encontrado');
      if (pago.confirmado_en) throw new ErrorAdmin('Ese pago ya estaba confirmado o no existe. Recarga la ficha para ver su estado actual.', 'conflicto');
      pago.confirmado_por = usuarioId;
      pago.confirmado_en = new Date().toISOString();
      guardar();
      return structuredClone(pago);
    },

    async listarJornadas() {
      await esperar(60);
      return structuredClone(estado.jornadas);
    },
    async contarOcupacion() {
      await esperar(60);
      return ocupacionPorJornada(estado.postulaciones);
    },
    async crearJornada(j) {
      await esperar();
      if (estado.jornadas.some((x) => x.fecha === j.fecha && x.inicio === j.inicio && x.grupo === j.grupo)) {
        throw new ErrorAdmin('Ya existe una jornada con esa fecha, hora y grupo.', 'duplicado');
      }
      estado.jornadas.push({ ...j });
      guardar();
      return { ...j };
    },
    async actualizarJornada(j) {
      await esperar();
      const i = estado.jornadas.findIndex((x) => x.id === j.id);
      if (i < 0) throw new ErrorAdmin('No se encontró la jornada.', 'no-encontrado');
      estado.jornadas[i] = { ...j };
      guardar();
      return { ...j };
    },

    async obtenerAjustes() {
      await esperar(60);
      return structuredClone(estado.ajustes);
    },
    async guardarAjuste(clave, valor) {
      await esperar();
      if (clave === 'banner') estado.ajustes.banner = leerBanner(valor);
      else estado.ajustes.inscripciones = leerInscripciones(valor);
      guardar();
    },
  };
}
