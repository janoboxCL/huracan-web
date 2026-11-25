/* Isla de /postula: orquesta los 3 pasos, el visor PDF y el resultado.
   La lógica (reglas, validación, código, mensaje) vive en `src/lib/postulacion/`; aquí solo hay DOM.
   PDF.js se importa de forma dinámica y únicamente cuando se muestra el paso 1. */

import {
  ANIO_TEMPORADA,
  evaluarPostulacion,
  conceptosInicioDiferido,
  formatoPeso,
  type EquipoBase,
  type Evaluacion,
  type Ingreso,
  type Postulante,
  type Precios,
  type ProgramaId,
} from '../../lib/postulacion/reglas.ts';
import {
  CAMPOS_VALIDABLES,
  ETIQUETAS_PARENTESCO,
  datosVacios,
  edadTemporada,
  enlaceWhatsappCon,
  esMenorDeEdad,
  formatoCelular,
  mensajeWhatsapp,
  mensajeWhatsappSinCodigo,
  normalizarCelular,
  textoDiaJornada,
  validarCampo,
  validarTodo,
  type DatosPostulacion,
} from '../../lib/postulacion/formulario.ts';
import { COMUNA_OTRA, esComunaDeLista } from '../../lib/postulacion/comunas.ts';
import { CAMPO_API_A_FORMULARIO, cargarJornadas, enviarPostulacion, modoApiActivo, type JornadaCupo, type ResultadoEnvio } from '../../lib/postulacion/api.ts';

/* ── Datos del servidor ─────────────────────────────────────── */

interface DatosPagina {
  pdf: string;
  paginas: number;
  equipos: (EquipoBase & { rango: string; nota?: string })[];
  precios: Precios;
  jornadas: { id: string; dia: string }[];
  telefono: string;
  programas: Record<ProgramaId, string>;
}

const datosPagina = JSON.parse(document.getElementById('postula-datos')?.textContent ?? 'null') as DatosPagina | null;

const QUIEN_JORNADA: Record<string, string> = {
  'youth-junior-senior-prep': 'Youth, Junior y Senior Prep',
  open: 'Open, Open Coed Novice, Prep e International',
  'sin-experiencia-7-19': 'Atletas sin experiencia (evaluación Novice)',
};

/* ── Estado y almacenamiento de la sesión ───────────────────── */

type NumeroPaso = 1 | 2 | 3;

interface Estado {
  paso: NumeroPaso;
  /** La última página del informativo ya entró en pantalla (o el visor falló). */
  ultimaVista: boolean;
  /** El check de lectura está marcado. */
  leido: boolean;
  datos: DatosPostulacion;
  /** Jornada elegida (solo cuando la evaluación es en una jornada). */
  jornadaId: string;
  /** Preinscripción ya registrada (una sola vez). Guarda lo que se registró. */
  confirmada: Confirmacion | null;
}

interface Confirmacion {
  codigo: string;
  /** `null` en modo maqueta (no se envía correo). */
  correoEnviado: boolean | null;
  datos: DatosPostulacion;
  jornadaId: string;
  /** Texto de la jornada registrada (día y hora) para mostrarlo sin volver a pedir las jornadas. */
  jornadaTexto: string;
}

const CLAVE = 'huracan-postula-2027';

function estadoInicial(): Estado {
  return { paso: 1, ultimaVista: false, leido: false, datos: datosVacios(), jornadaId: '', confirmada: null };
}

function cargarEstado(): Estado {
  const base = estadoInicial();
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    if (!crudo) return base;
    const g = JSON.parse(crudo) as Partial<Estado>;
    return {
      paso: g.paso === 2 || g.paso === 3 ? g.paso : 1,
      ultimaVista: g.ultimaVista === true,
      leido: g.leido === true,
      datos: { ...base.datos, ...(g.datos ?? {}) },
      jornadaId: typeof g.jornadaId === 'string' ? g.jornadaId : '',
      confirmada:
        g.confirmada && typeof g.confirmada.codigo === 'string' && g.confirmada.datos
          ? { ...g.confirmada, datos: { ...base.datos, ...g.confirmada.datos } }
          : null,
    };
  } catch {
    return base;
  }
}

function guardarEstado(): void {
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(estado));
  } catch {
    /* Almacenamiento no disponible (modo privado, política del navegador): se sigue sin él. */
  }
}

function limpiarAlmacenamiento(): void {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    /* sin acción */
  }
}

let estado: Estado = estadoInicial();

/* ── Utilidades de DOM ──────────────────────────────────────── */

const $ = <T extends HTMLElement = HTMLElement>(selector: string, raiz: ParentNode = document): T => {
  const el = raiz.querySelector<T>(selector);
  if (!el) throw new Error(`Falta el elemento ${selector}`);
  return el;
};

function esc(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

const reducido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const nombreCorto = (nombre: string) => nombre.replace(/^Huracán\s+/, '');

/* ── Pasos y progreso ───────────────────────────────────────── */

const TITULOS_PASO = ['Informativo', 'Preinscripción', 'Resultado'];

function actualizarProgreso(): void {
  document.querySelectorAll<HTMLElement>('[data-indicador]').forEach((li) => {
    const n = Number(li.dataset.indicador);
    const est = n === estado.paso ? 'actual' : n < estado.paso ? 'hecho' : 'pendiente';
    li.dataset.estado = est;
    if (est === 'actual') li.setAttribute('aria-current', 'step');
    else li.removeAttribute('aria-current');
    li.querySelector<HTMLElement>('.progreso__hecho')!.hidden = est !== 'hecho';
  });
  $('#progreso-texto').textContent = `Paso ${estado.paso} de 3: ${TITULOS_PASO[estado.paso - 1]}`;
}

function irAPaso(n: NumeroPaso, opciones: { foco?: boolean } = {}): void {
  estado.paso = n;
  document.querySelectorAll<HTMLElement>('.paso').forEach((s) => {
    const activo = Number(s.dataset.paso) === n;
    s.hidden = !activo;
    s.classList.toggle('paso-entra', activo && opciones.foco === true);
  });
  actualizarProgreso();
  if (n === 1) void iniciarVisor();
  if (n === 2) actualizarAvisoConfirmada();
  if (n === 3) void pintarResultado();
  guardarEstado();
  if (opciones.foco) {
    const titulo = $(`#paso-${n}-titulo`);
    $('#progreso').scrollIntoView({ block: 'start', behavior: reducido() ? 'auto' : 'smooth' });
    titulo.focus({ preventScroll: true });
  }
}

/* ── Paso 1 · visor PDF ─────────────────────────────────────── */

/* Tipos mínimos de lo que se usa de PDF.js (se carga en tiempo de ejecución). */
interface PaginaPdf {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: { canvas: HTMLCanvasElement; viewport: { width: number; height: number } }): { promise: Promise<void>; cancel(): void };
  cleanup(): void;
}
interface DocumentoPdf {
  numPages: number;
  getPage(n: number): Promise<PaginaPdf>;
  destroy(): Promise<void>;
}

const NIVELES_ZOOM = [1, 1.5, 2, 3];
let visorIniciado = false;

function habilitarLectura(): void {
  estado.ultimaVista = true;
  const check = $<HTMLInputElement>('#check-lectura');
  check.disabled = false;
  $('#check-ayuda').textContent = 'Marca la casilla para continuar.';
  guardarEstado();
}

function actualizarContinuar1(): void {
  const check = $<HTMLInputElement>('#check-lectura');
  const boton = $<HTMLButtonElement>('.js-continuar-1');
  boton.disabled = !(check.checked && !check.disabled);
}

/** El visor no pudo cargarse: la lectura se confirma solo después de abrir el PDF con el enlace. */
let visorCaido = false;
const TEXTO_FALLA_ESPERA = 'No pudimos mostrar el visor. Abre el PDF con el enlace «Abrir el PDF»: la casilla se habilita cuando lo abras.';
const TEXTO_FALLA_LISTO = 'No pudimos mostrar el visor; ya abriste el PDF. Confírmalo aquí cuando termines de leerlo.';

function visorConFalla(error: unknown): void {
  console.warn('Visor PDF no disponible', error);
  visorCaido = true;
  $('#visor').hidden = true;
  $('.avance').hidden = true;
  $('#visor-aviso').hidden = false;
  document.querySelectorAll<HTMLAnchorElement>('.js-enlace-pdf').forEach((a) => {
    a.textContent = `Abrir el PDF (${a.dataset['tamano'] ?? ''})`;
  });
  const check = $<HTMLInputElement>('#check-lectura');
  if (estado.ultimaVista) {
    check.disabled = false;
    $('#check-ayuda').textContent = TEXTO_FALLA_LISTO;
  } else {
    check.disabled = true;
    $('#check-ayuda').textContent = TEXTO_FALLA_ESPERA;
  }
}

/** Con el visor caído, abrir el PDF (clic en el enlace) habilita el check. */
function registrarAperturaPdf(): void {
  document.querySelectorAll('.js-enlace-pdf').forEach((a) =>
    a.addEventListener('click', () => {
      if (!visorCaido || estado.ultimaVista) return;
      estado.ultimaVista = true;
      $<HTMLInputElement>('#check-lectura').disabled = false;
      $('#check-ayuda').textContent = TEXTO_FALLA_LISTO;
      guardarEstado();
    }),
  );
}

async function iniciarVisor(): Promise<void> {
  if (visorIniciado || !datosPagina) return;
  visorIniciado = true;
  const scroll = $('#visor-scroll');
  const lista = $('#visor-lista');
  const estadoVisor = $('#visor-estado');
  const vacio = $('#visor-vacio');

  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const worker = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = worker;

    /* `wasmUrl`: el informativo trae imágenes JBIG2; los decodificadores los copia scripts/copiar-pdfjs.mjs. */
    const tarea = pdfjs.getDocument({ url: datosPagina.pdf, wasmUrl: '/pdfjs/wasm/' });
    tarea.onProgress = (p: { loaded: number; total?: number }) => {
      if (p.total) estadoVisor.textContent = `Cargando el informativo… ${Math.min(100, Math.round((p.loaded / p.total) * 100))} %`;
    };
    const pdf = (await tarea.promise) as unknown as DocumentoPdf;
    const total = pdf.numPages;

    vacio.hidden = true;
    estadoVisor.textContent = 'Desplázate para leer. Usa + y − para cambiar el tamaño.';
    $('#vistas-total').textContent = String(total);

    const primera = await pdf.getPage(1);
    const vp1 = primera.getViewport({ scale: 1 });

    const estados = new Map<number, 'vacio' | 'cargando' | 'listo'>();
    const tareas = new Map<number, { cancel(): void }>();
    const visibles = new Set<number>();
    const vistas = new Set<number>();

    /* Dibuja la página n al ancho actual (devicePixelRatio acotado a 2). */
    const dibujar = async (n: number, caja: HTMLElement) => {
      if (estados.get(n) !== 'vacio') return;
      estados.set(n, 'cargando');
      try {
        const pagina = await pdf.getPage(n);
        const ancho = caja.clientWidth || 300;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const base = pagina.getViewport({ scale: 1 });
        const vp = pagina.getViewport({ scale: (ancho * dpr) / base.width });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `Página ${n} de ${total} del informativo`);
        const render = pagina.render({ canvas, viewport: vp });
        tareas.set(n, render);
        await render.promise;
        tareas.delete(n);
        if (estados.get(n) !== 'cargando') return; // se liberó mientras dibujaba
        caja.replaceChildren(canvas);
        caja.dataset.estado = 'listo';
        estados.set(n, 'listo');
      } catch (e) {
        if ((e as { name?: string }).name !== 'RenderingCancelledException') console.warn(`Página ${n}`, e);
        if (estados.get(n) === 'cargando') estados.set(n, 'vacio');
      }
    };

    const liberar = (n: number, caja: HTMLElement) => {
      tareas.get(n)?.cancel();
      tareas.delete(n);
      estados.set(n, 'vacio');
      caja.replaceChildren();
      delete caja.dataset.estado;
    };

    const cajas: HTMLElement[] = [];
    for (let n = 1; n <= total; n++) {
      const li = document.createElement('li');
      li.className = 'visor__pagina';
      li.dataset.n = String(n);
      li.dataset.etiqueta = `Página ${n}`;
      li.style.aspectRatio = `${vp1.width} / ${vp1.height}`;
      estados.set(n, 'vacio');
      lista.append(li);
      cajas.push(li);
    }

    /* Carga perezosa: solo las páginas cerca de la vista; se liberan las lejanas. */
    const obsCarga = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          const caja = e.target as HTMLElement;
          const n = Number(caja.dataset.n);
          if (e.isIntersecting) {
            visibles.add(n);
            void dibujar(n, caja);
          } else {
            visibles.delete(n);
            liberar(n, caja);
          }
        }
      },
      { root: scroll, rootMargin: '100% 50%' },
    );

    /* Avance: una página cuenta como vista cuando una parte relevante entra en el visor. */
    let ultimoAnuncio = 0;
    const anuncio = $('#visor-anuncio');
    const obsVistas = new IntersectionObserver(
      (entradas) => {
        let cambio = false;
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          const n = Number((e.target as HTMLElement).dataset.n);
          if (!vistas.has(n)) {
            vistas.add(n);
            cambio = true;
          }
        }
        if (!cambio) return;
        $('#vistas-n').textContent = String(vistas.size);
        $('#avance-relleno').style.transform = `scaleX(${vistas.size / total})`;
        if (vistas.has(total) && !estado.ultimaVista) {
          habilitarLectura();
          anuncio.textContent = 'Llegaste a la última página. Ya puedes confirmar la lectura.';
        } else if (vistas.size - ultimoAnuncio >= 10) {
          ultimoAnuncio = vistas.size;
          anuncio.textContent = `Has visto ${vistas.size} de ${total} páginas.`;
        }
      },
      { root: scroll, threshold: 0.15 },
    );

    for (const caja of cajas) {
      obsCarga.observe(caja);
      obsVistas.observe(caja);
    }

    /* Zoom: re-dibuja las páginas visibles al nuevo ancho conservando la posición. */
    let nivel = 0;
    const redibujarVisibles = () => {
      for (const n of visibles) {
        const caja = cajas[n - 1];
        if (!caja) continue;
        liberar(n, caja);
        void dibujar(n, caja);
      }
    };
    const aplicarZoom = (nuevo: number) => {
      const rY = scroll.scrollTop / Math.max(1, scroll.scrollHeight);
      const rX = scroll.scrollLeft / Math.max(1, scroll.scrollWidth);
      nivel = nuevo;
      const factor = NIVELES_ZOOM[nivel] ?? 1;
      scroll.style.setProperty('--zoom', String(factor));
      $('#zoom-nivel').textContent = `${Math.round(factor * 100)} %`;
      $<HTMLButtonElement>('#zoom-menos').disabled = nivel === 0;
      $<HTMLButtonElement>('#zoom-mas').disabled = nivel === NIVELES_ZOOM.length - 1;
      scroll.scrollTop = rY * scroll.scrollHeight;
      scroll.scrollLeft = rX * scroll.scrollWidth;
      redibujarVisibles();
    };
    $('#zoom-menos').addEventListener('click', () => nivel > 0 && aplicarZoom(nivel - 1));
    $('#zoom-mas').addEventListener('click', () => nivel < NIVELES_ZOOM.length - 1 && aplicarZoom(nivel + 1));
    /* En pantallas angostas el informativo (apaisado) arranca ampliado, con paneo dentro del visor. */
    aplicarZoom(window.matchMedia('(max-width: 40rem)').matches ? 2 : 0);

    /* Pantalla completa: el visor ocupa la ventana, con foco atrapado y Escape para salir. */
    const visor = $('#visor');
    const abrir = $<HTMLButtonElement>('#visor-completo');
    const cerrar = $<HTMLButtonElement>('#visor-cerrar');
    abrir.disabled = false;
    const enfocables = () =>
      [...visor.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]')].filter((el) => !el.closest('[hidden]') && el.offsetParent !== null);
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrarCompleto();
        return;
      }
      if (e.key !== 'Tab') return;
      const lista = enfocables();
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (!primero || !ultimo) return;
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      } else if (!visor.contains(document.activeElement)) {
        e.preventDefault();
        primero.focus();
      }
    };
    const alCambiarModo = () => requestAnimationFrame(() => redibujarVisibles());
    function abrirCompleto() {
      visor.classList.add('visor--completo');
      visor.setAttribute('role', 'dialog');
      visor.setAttribute('aria-modal', 'true');
      visor.setAttribute('aria-label', 'Informativo 2027 a pantalla completa');
      document.documentElement.classList.add('visor-abierto');
      abrir.hidden = true;
      cerrar.hidden = false;
      document.addEventListener('keydown', alTeclear);
      cerrar.focus();
      alCambiarModo();
    }
    function cerrarCompleto() {
      visor.classList.remove('visor--completo');
      visor.removeAttribute('role');
      visor.removeAttribute('aria-modal');
      visor.removeAttribute('aria-label');
      document.documentElement.classList.remove('visor-abierto');
      document.removeEventListener('keydown', alTeclear);
      cerrar.hidden = true;
      abrir.hidden = false;
      abrir.focus();
      alCambiarModo();
    }
    abrir.addEventListener('click', abrirCompleto);
    cerrar.addEventListener('click', cerrarCompleto);

    /* Cambio de ancho de la ventana (giro del teléfono): se redibuja con pausa. */
    let anchoPrevio = scroll.clientWidth;
    let pausa = 0;
    new ResizeObserver(() => {
      if (scroll.clientWidth === anchoPrevio) return;
      anchoPrevio = scroll.clientWidth;
      window.clearTimeout(pausa);
      pausa = window.setTimeout(redibujarVisibles, 200);
    }).observe(scroll);
  } catch (error) {
    visorConFalla(error);
    actualizarContinuar1();
  }
}

function configurarPaso1(): void {
  registrarAperturaPdf();
  const check = $<HTMLInputElement>('#check-lectura');
  if (estado.ultimaVista) {
    check.disabled = false;
    $('#check-ayuda').textContent = 'Marca la casilla para continuar.';
  }
  check.checked = estado.leido && !check.disabled;
  check.addEventListener('change', () => {
    estado.leido = check.checked;
    actualizarContinuar1();
    guardarEstado();
  });
  actualizarContinuar1();
  $('.js-continuar-1').addEventListener('click', () => {
    if (!estado.leido) return;
    irAPaso(2, { foco: true });
  });
}

/* ── Paso 2 · formulario ────────────────────────────────────── */

/** Campos que ya mostraron error o se tocaron: se corrigen en vivo. */
const tocados = new Set<string>();

const form = () => $<HTMLFormElement>('#form-preinscripcion');

function valorDe(nombre: string): string {
  const el = form().elements.namedItem(nombre) as RadioNodeList | HTMLInputElement | HTMLSelectElement | null;
  return el ? (el.value ?? '') : '';
}

function marcados(nombre: string): string[] {
  return [...form().querySelectorAll<HTMLInputElement>(`input[name="${nombre}"]:checked`)].map((i) => i.value);
}

function leerFormulario(): DatosPostulacion {
  const v = valorDe;
  return {
    nombre: v('nombre'),
    apellido: v('apellido'),
    fechaNacimiento: v('fechaNacimiento'),
    sexo: v('sexo') as DatosPostulacion['sexo'],
    comuna: v('comuna'),
    comunaOtra: v('comunaOtra'),
    esAntiguo: v('esAntiguo') as DatosPostulacion['esAntiguo'],
    experiencia: v('experiencia') as DatosPostulacion['experiencia'],
    clubAnterior: v('clubAnterior'),
    aniosExperiencia: v('aniosExperiencia'),
    posicion: v('posicion') as DatosPostulacion['posicion'],
    habilidades: marcados('habilidades'),
    modalidad: (v('modalidad') || 'auto') as DatosPostulacion['modalidad'],
    equipoInteres: v('equipoInteres'),
    forma: (v('forma') || 'individual') as DatosPostulacion['forma'],
    promociones: marcados('promociones') as DatosPostulacion['promociones'],
    contactoNombre: v('contactoNombre'),
    parentesco: v('parentesco') as DatosPostulacion['parentesco'],
    telefono: v('telefono'),
    correo: v('correo'),
    sitioWeb: v('sitioWeb'),
  };
}

function escribirFormulario(original: DatosPostulacion): void {
  const f = form();
  /* Sesiones guardadas con la comuna como texto libre: lo que no está en la lista pasa a «Otra». */
  const d = { ...original, comunaOtra: original.comunaOtra ?? '' };
  if (d.comuna !== '' && d.comuna !== COMUNA_OTRA && !esComunaDeLista(d.comuna)) {
    d.comunaOtra = d.comuna;
    d.comuna = COMUNA_OTRA;
  }
  const texto = ['nombre', 'apellido', 'fechaNacimiento', 'comuna', 'comunaOtra', 'clubAnterior', 'aniosExperiencia', 'posicion', 'modalidad', 'equipoInteres', 'contactoNombre', 'parentesco', 'telefono', 'correo'] as const;
  for (const k of texto) {
    const el = f.elements.namedItem(k) as HTMLInputElement | HTMLSelectElement | null;
    if (el) el.value = d[k];
  }
  for (const k of ['sexo', 'esAntiguo', 'experiencia', 'forma'] as const) {
    f.querySelectorAll<HTMLInputElement>(`input[name="${k}"]`).forEach((r) => (r.checked = r.value === d[k]));
  }
  f.querySelectorAll<HTMLInputElement>('input[name="habilidades"]').forEach((c) => (c.checked = d.habilidades.includes(c.value)));
  f.querySelectorAll<HTMLInputElement>('input[name="promociones"]').forEach((c) => (c.checked = d.promociones.includes(c.value as never)));
}

/** Controles de un campo: el control principal y los que reciben `aria-invalid`. */
function controlesDe(campo: string): { ctrl: HTMLElement | null; inputs: HTMLElement[] } {
  const ctrl = document.getElementById(`f-${campo}`) ?? document.getElementById(`grupo-${campo}`);
  if (!ctrl) return { ctrl: null, inputs: [] };
  return { ctrl, inputs: ctrl.matches('fieldset') ? [...ctrl.querySelectorAll<HTMLElement>('input')] : [ctrl] };
}

function mostrarError(campo: string, mensaje: string | null): void {
  const { ctrl, inputs } = controlesDe(campo);
  const caja = document.getElementById(`error-${campo}`);
  if (!ctrl || !caja) return;
  caja.textContent = mensaje ?? '';
  caja.hidden = !mensaje;
  inputs.forEach((i) => (mensaje ? i.setAttribute('aria-invalid', 'true') : i.removeAttribute('aria-invalid')));
  const base = ctrl.dataset.describe ?? '';
  const ids = [base, mensaje ? `error-${campo}` : ''].filter(Boolean).join(' ');
  if (ids) ctrl.setAttribute('aria-describedby', ids);
  else ctrl.removeAttribute('aria-describedby');
}

function enfocarCampo(campo: string): void {
  const { ctrl, inputs } = controlesDe(campo);
  (ctrl?.matches('fieldset') ? inputs[0] : ctrl)?.focus();
}

/** Muestra u oculta bloques según las respuestas (edad, experiencia, apoderado). */
function actualizarDependencias(d: DatosPostulacion): void {
  const edad = edadTemporada(d.fechaNacimiento);
  const caja = $('#edad-2027');
  caja.hidden = edad === null || edad < 0;
  if (edad !== null && edad >= 0) $('#edad-2027-n').textContent = String(edad);

  $('#bloque-experiencia').hidden = d.experiencia !== 'con';
  $('#bloque-comuna-otra').hidden = d.comuna !== COMUNA_OTRA;

  const fechaValida = edad !== null && edad >= 0;
  const menor = fechaValida && esMenorDeEdad(d.fechaNacimiento);
  $('#bloque-apoderado').hidden = !menor;
  $('#legenda-contacto').textContent = !fechaValida ? 'Datos de contacto' : menor ? 'Datos del apoderado' : 'Tus datos de contacto';
  $('#ayuda-contacto').hidden = fechaValida;
  const etiquetaTel = document.querySelector<HTMLElement>('label[for="f-telefono"]');
  const etiquetaCorreo = document.querySelector<HTMLElement>('label[for="f-correo"]');
  if (etiquetaTel) etiquetaTel.textContent = menor ? 'Celular del apoderado' : 'Celular';
  if (etiquetaCorreo) etiquetaCorreo.textContent = menor ? 'Correo del apoderado' : 'Correo';

  /* Los bloques opcionales se abren solos si ya tienen respuestas (p. ej. al restaurar la sesión). */
  if (d.modalidad !== 'auto' || d.equipoInteres !== '' || d.forma !== 'individual') $<HTMLDetailsElement>('#det-equipo').open = true;
  if (d.promociones.length > 0) $<HTMLDetailsElement>('#det-promos').open = true;

  const n = d.habilidades.length;
  $('#habilidades-conteo').textContent = n === 0 ? '' : n === 1 ? '1 marcada' : `${n} marcadas`;
}

function configurarPaso2(): void {
  const f = form();
  $<HTMLInputElement>('#f-fechaNacimiento').max = hoyISO();

  const alCambiar = (e: Event) => {
    const el = e.target as HTMLInputElement;
    estado.datos = leerFormulario();
    actualizarDependencias(estado.datos);
    guardarEstado();
    /* Corrige en vivo solo los campos que ya mostraron error. */
    for (const campo of CAMPOS_VALIDABLES) {
      if (!tocados.has(campo)) continue;
      const aplica = el.name === campo || campo === 'fechaNacimiento' || (campo === 'clubAnterior' || campo === 'aniosExperiencia' ? el.name === 'experiencia' : campo === 'comunaOtra' ? el.name === 'comuna' : false);
      if (!aplica) continue;
      mostrarError(campo, validarCampo(campo, estado.datos, hoyISO()));
    }
  };
  f.addEventListener('input', alCambiar);
  f.addEventListener('change', alCambiar);

  f.addEventListener('focusout', (e) => {
    const el = e.target as HTMLInputElement;
    if (!el.name) return;
    if (el.name === 'telefono') {
      const nueve = normalizarCelular(el.value);
      if (nueve) el.value = formatoCelular(nueve);
      estado.datos = leerFormulario();
      guardarEstado();
    }
    const campo = el.name as keyof DatosPostulacion;
    if (!CAMPOS_VALIDABLES.includes(campo)) return;
    /* Radios: se validan al enviar; salir de un campo vacío sin tocarlo no molesta. */
    if (el.type === 'radio') return;
    tocados.add(campo);
    mostrarError(campo, validarCampo(campo, leerFormulario(), hoyISO()));
  });

  f.addEventListener('submit', (e) => {
    e.preventDefault();
    estado.datos = leerFormulario();
    const errores = validarTodo(estado.datos, hoyISO());
    for (const campo of CAMPOS_VALIDABLES) {
      tocados.add(campo);
      mostrarError(campo, errores[campo] ?? null);
    }
    const primero = CAMPOS_VALIDABLES.find((c) => errores[c]);
    const resumen = $('#resumen-errores');
    resumen.hidden = !primero;
    if (primero) {
      enfocarCampo(primero);
      return;
    }
    /* No se guarda nada aquí: el registro se crea al confirmar en el paso 3. */
    irAPaso(3, { foco: true });
  });

  $('.js-atras-2').addEventListener('click', () => irAPaso(1, { foco: true }));
}

/* ── Paso 3 · resultado y confirmación ──────────────────────── */

interface JornadaVista {
  id: string;
  dia: string;
  inicio: string;
  fin: string;
}

let evaluacionActual: Evaluacion | null = null;
let jornadasMostradas: JornadaVista[] = [];
/** Evita que una respuesta tardía de jornadas pise una pantalla más nueva. */
let secuencia = 0;

const datosVigentes = (): DatosPostulacion => estado.confirmada?.datos ?? estado.datos;

function postulanteDesdeDatos(d: DatosPostulacion): Postulante {
  const p: Postulante = {
    edad: edadTemporada(d.fechaNacimiento) ?? 0,
    genero: d.sexo === 'varon' ? 'varon' : 'dama',
    experiencia: d.experiencia === 'con' ? 'con' : 'ninguna',
    habilidades: d.experiencia === 'con' ? d.habilidades : [],
    esAntiguo: d.esAntiguo === 'si',
  };
  if (d.modalidad !== 'auto') p.modalidad = d.modalidad as ProgramaId;
  return p;
}

function nombreAtleta(d: DatosPostulacion): string {
  return `${d.nombre.trim()} ${d.apellido.trim()}`.trim();
}

function quienEscribe(d: DatosPostulacion): string {
  return esMenorDeEdad(d.fechaNacimiento) && d.parentesco ? `${d.contactoNombre.trim()} (${ETIQUETAS_PARENTESCO[d.parentesco]})` : nombreAtleta(d);
}

function filaMonto(texto: string, monto: number, nota?: string): string {
  return `<tr><th scope="row">${esc(texto)}${nota ? `<small>${esc(nota)}</small>` : ''}</th><td>${formatoPeso(monto)}</td></tr>`;
}

function textoPromo(i: Ingreso): string {
  const equipo = esc(nombreCorto(i.equipo));
  const monto = i.promo && i.promo.mensualidad === 0 ? 'mensualidad gratis todo el año' : `mensualidad de ${formatoPeso(i.promo?.mensualidad ?? 0)} todo el año`;
  return `Posible promoción: ${monto} (${equipo}). La valida el coach.`;
}

/** Rótulo de la mensualidad: «Open» para los equipos Open de Novice y Prep; si no, el programa. */
function rotuloMensualidad(ing: Ingreso): string {
  const categoria = datosPagina?.equipos.find((e) => e.nombre === ing.equipo)?.categoria ?? '';
  if ((ing.programa === 'novice' || ing.programa === 'prep') && /\bopen\b/i.test(categoria)) return 'Mensualidad Open';
  return `Mensualidad ${datosPagina?.programas[ing.programa] ?? ''}`.trim();
}

function htmlMonto(ev: Evaluacion, d: DatosPostulacion): string {
  const ing = ev.ingresoEstimado;
  if (!ing || !datosPagina) {
    return '<p>Cuando el coach confirme el equipo, te informará el monto de ingreso.</p>';
  }
  const partes: string[] = [];
  if (ev.jornada.tipo === 'inicio-diferido') {
    /* Spirit y Team Parent: solo se informa la mensualidad; inscripción y ropa los confirma el head coach. */
    partes.push(`<p>${esc(rotuloMensualidad(ing))}: ${formatoPeso(ing.mensualidad)}, en efectivo al head coach en la primera clase.</p>`);
    partes.push(`<p>Por transferencia pagarás ${esc(conceptosInicioDiferido(ev.equipos))}. Esos valores se informarán más adelante.</p>`);
    partes.push('<p class="bloque__nota">El head coach te confirmará los valores antes del inicio.</p>');
    return partes.join('');
  }
  const totalesDistintos = new Set(ev.ingresos.map((i) => i.total)).size > 1;

  if (totalesDistintos) {
    /* Montos distintos según el equipo: no se muestra un solo monto, sino uno por equipo. */
    partes.push('<p>Los equipos sugeridos tienen montos distintos según su programa:</p>');
    partes.push(
      `<ul class="montos-equipo" role="list">${ev.ingresos
        .map((i) => {
          const detalle = [
            `Inscripción ${formatoPeso(i.inscripcion)}`,
            i.mensualidadEnEfectivo ? '' : `${rotuloMensualidad(i)} ${formatoPeso(i.mensualidad)}`,
            `ropa de entrenamiento, primera cuota ${formatoPeso(i.ropaPrimeraCuota)}`,
            i.cinta > 0 ? `cinta ${formatoPeso(i.cinta)}` : '',
          ]
            .filter(Boolean)
            .join(' + ');
          const efectivo = i.mensualidadEnEfectivo ? `<span class="monto-equipo__nota">Mensualidad ${esc(datosPagina?.programas[i.programa] ?? '')}: ${formatoPeso(i.mensualidad)}, se paga en efectivo al head coach en la primera clase.</span>` : '';
          return `<li class="monto-equipo"><span class="monto-equipo__nombre">${esc(i.equipo)}</span><span class="monto-equipo__total">${formatoPeso(i.total)}</span><span class="monto-equipo__programa">Programa ${esc(datosPagina?.programas[i.programa] ?? '')}</span><span class="monto-equipo__nota">${esc(detalle)}</span>${efectivo}</li>`;
        })
        .join('')}</ul>`,
    );
    partes.push('<p class="bloque__nota">Monto estimado sin promociones. El coach confirma el equipo, la promoción y el monto final.</p>');
  } else {
    const filas = [
      filaMonto('Inscripción', ing.inscripcion, 'Incluye una polera de entrenamiento'),
      ing.mensualidadEnEfectivo ? '' : filaMonto(rotuloMensualidad(ing), ing.mensualidad),
      filaMonto('Ropa de entrenamiento, primera cuota', ing.ropaPrimeraCuota, 'Primera de dos cuotas'),
      ing.cinta > 0 ? filaMonto('Cinta de entrenamiento', ing.cinta) : '',
    ].join('');
    partes.push(
      `<div class="monto__contenedor"><table class="monto"><caption class="solo-lectores">Monto estimado de ingreso</caption><tbody>${filas}</tbody><tfoot><tr><th scope="row">Total a transferir</th><td>${formatoPeso(ing.total)}</td></tr></tfoot></table></div>`,
    );
    if (ing.mensualidadEnEfectivo) {
      partes.push(`<p>Mensualidad ${esc(datosPagina.programas[ing.programa])}: ${formatoPeso(ing.mensualidad)}. Se paga en efectivo al head coach en la primera clase.</p>`);
    }
    partes.push('<p class="bloque__nota">Monto estimado sin promociones. El coach confirma equipo, promoción y monto final.</p>');
  }

  const vistas = new Set<string>();
  for (const i of ev.ingresos) {
    if (!i.promo || vistas.has(i.equipo)) continue;
    vistas.add(i.equipo);
    partes.push(`<p class="promo-linea">${textoPromo(i)}</p>`);
  }
  if (d.promociones.length > 0) {
    const nombres = d.promociones.map((id) => document.querySelector(`input[name="promociones"][value="${id}"] ~ span`)?.firstChild?.textContent?.trim() ?? id);
    partes.push(`<p class="bloque__nota">Promociones que declaraste: ${esc(nombres.join(', '))}. Las valida el coach.</p>`);
  }
  return partes.join('');
}

/** Día de una jornada: el de la lista inicial si existe; si no, la fecha en español de Chile. */
function diaDe(j: { id: string; fecha: string }): string {
  return datosPagina?.jornadas.find((x) => x.id === j.id)?.dia ?? textoDiaJornada(j.fecha);
}

function textoCupo(j: JornadaCupo): { agotada: boolean; texto: string } {
  if (j.disponibles === null) return { agotada: false, texto: '' };
  if (j.disponibles <= 0) return { agotada: true, texto: 'Sin cupos' };
  if (j.disponibles <= 5) return { agotada: false, texto: j.disponibles === 1 ? 'Queda 1 cupo' : `Quedan ${j.disponibles} cupos` };
  return { agotada: false, texto: '' };
}

function htmlJornadasLista(lista: JornadaCupo[]): string {
  const opciones = lista
    .map((jo) => {
      const cupo = textoCupo(jo);
      return `<label class="jornada${cupo.agotada ? ' jornada--agotada' : ''}"><input type="radio" name="jornada" value="${esc(jo.id)}" ${cupo.agotada ? 'disabled' : ''} ${jo.id === estado.jornadaId ? 'checked' : ''} />
        <span><span class="jornada__dia">${esc(diaDe(jo))}</span><span class="jornada__hora">${esc(jo.inicio)} a ${esc(jo.fin)}</span><span class="jornada__quien">${esc(QUIEN_JORNADA[jo.grupo] ?? '')}</span>${cupo.texto ? `<span class="jornada__cupo">${cupo.texto}</span>` : ''}</span></label>`;
    })
    .join('');
  return `<fieldset class="jornadas" id="grupo-jornada" aria-describedby="error-jornada">
      <legend>Elige tu jornada de evaluación (obligatorio)</legend>${opciones}
      <p class="campo__error" id="error-jornada" hidden></p></fieldset>`;
}

/** `Spirit en abril de 2027; Team Parent en enero de 2027`. */
function textoInicios(ev: Evaluacion): string {
  if (ev.jornada.tipo !== 'inicio-diferido') return '';
  return ev.jornada.inicios.map((i) => `${nombreCorto(i.equipo)} en ${i.inicio}`).join('; ');
}

/** La nota sin su primera frase (que ya dice cuándo comienza y va en la etiqueta de inicio). */
function detalleNota(nota: string): string {
  const corte = nota.indexOf('. ');
  return corte === -1 ? '' : nota.slice(corte + 2);
}

const esDiferido = (ev: Evaluacion | null): boolean => ev?.jornada.tipo === 'inicio-diferido';

function textoJornadaElegida(ev: Evaluacion, jornadaId: string, conf: Confirmacion | null = null): string {
  if (ev.jornada.tipo === 'sin-evaluacion') return 'sin evaluación (Tiny); el coach me indicará día y hora de la primera práctica';
  if (ev.jornada.tipo === 'inicio-diferido') return textoInicios(ev);
  if (conf) return conf.jornadaTexto;
  const j = jornadasMostradas.find((x) => x.id === jornadaId);
  return j ? `${j.dia}, ${j.inicio} a ${j.fin}` : 'por coordinar con el coach';
}

/* Mensajes del bloque de confirmación */

function mostrarErrorConfirmar(mensaje: string | null, conAlternativa = false): void {
  const caja = $('#res-error');
  caja.textContent = mensaje ?? '';
  caja.hidden = !mensaje;
  $('#res-alt').hidden = !conAlternativa;
  if (conAlternativa) actualizarEnlaceAlternativo();
}

function actualizarEnlaceAlternativo(): void {
  if (!datosPagina) return;
  const d = estado.datos;
  const mensaje = mensajeWhatsappSinCodigo({ atleta: nombreAtleta(d), contacto: quienEscribe(d) });
  $<HTMLAnchorElement>('.js-whatsapp-alt').href = enlaceWhatsappCon(datosPagina.telefono, mensaje);
}

function actualizarBotonConfirmar(): void {
  const ev = evaluacionActual;
  const boton = $<HTMLButtonElement>('.js-confirmar');
  const ayuda = $('#confirmar-ayuda');
  if (!ev) return;
  const necesitaJornada = ev.jornada.tipo === 'jornadas';
  const falta = necesitaJornada && !estado.jornadaId;
  boton.disabled = ev.equipos.length === 0 || falta;
  ayuda.textContent = ev.equipos.length === 0 ? '' : falta ? 'Elige una jornada de evaluación para poder confirmar.' : '';
}

function actualizarEnlaceWhatsapp(): void {
  const conf = estado.confirmada;
  if (!datosPagina || !evaluacionActual || !conf) return;
  const d = conf.datos;
  const mensaje = mensajeWhatsapp({
    atleta: nombreAtleta(d),
    codigo: conf.codigo,
    jornada: textoJornadaElegida(evaluacionActual, conf.jornadaId, conf),
    equipos: evaluacionActual.equipos.map((e) => e.nombre),
    contacto: quienEscribe(d),
    inicioDiferido: esDiferido(evaluacionActual),
  });
  $<HTMLAnchorElement>('.js-whatsapp').href = enlaceWhatsappCon(datosPagina.telefono, mensaje);
}

function textoCorreo(conf: Confirmacion, diferido: boolean): string {
  if (conf.correoEnviado === null) return 'Modo de prueba: no se envía correo.';
  if (conf.correoEnviado) return `Te enviamos un correo a ${conf.datos.correo.trim()} ${diferido ? 'con el resumen de tu preinscripción' : 'con los datos de transferencia'}.`;
  return 'No pudimos enviar el correo; el head coach te escribirá por WhatsApp.';
}

function actualizarAvisoConfirmada(): void {
  const aviso = $('#aviso-confirmada');
  const conf = estado.confirmada;
  aviso.hidden = !conf;
  if (conf) aviso.textContent = `Ya enviaste esta preinscripción (código ${conf.codigo}). Si cambias datos aquí no se registrará otra: coordina cualquier cambio con el head coach por WhatsApp.`;
}

/** Jornadas del bloque «Evaluación»: radios con cupos al confirmar, o el texto de lo registrado. */
async function pintarJornada(ev: Evaluacion, conf: Confirmacion | null): Promise<void> {
  const caja = $('#res-jornada');
  const j = ev.jornada;
  if (j.tipo === 'sin-evaluacion') {
    caja.innerHTML = '<p>Los equipos Tiny no tienen evaluación: pasan directo a su primera práctica. El coach te indicará día y hora.</p>';
    return;
  }
  if (j.tipo === 'inicio-diferido') {
    const notas = new Map(datosPagina?.equipos.map((e) => [e.nombre, e.nota ?? '']) ?? []);
    const items = j.inicios
      .map(
        (i) =>
          `<li class="aviso-inicio"><span class="aviso-inicio__nombre">${esc(i.equipo)}</span><span class="etiqueta-inicio">Inicio: ${esc(i.inicio)}</span>${detalleNota(notas.get(i.equipo) ?? '') ? `<span class="aviso-inicio__nota">${esc(detalleNota(notas.get(i.equipo) ?? ''))}</span>` : ''}</li>`,
      )
      .join('');
    caja.innerHTML = `<ul class="avisos-inicio" role="list">${items}</ul><p>No pasan por la evaluación de diciembre, así que no tienes que elegir jornada.</p>`;
    return;
  }
  if (conf) {
    caja.innerHTML = `<p>Tu jornada de evaluación: <strong>${esc(textoJornadaElegida(ev, conf.jornadaId, conf))}</strong>.</p>`;
    return;
  }
  const mia = ++secuencia;
  caja.innerHTML = '<p>Cargando las jornadas disponibles…</p>';
  let todas: JornadaCupo[];
  try {
    todas = await cargarJornadas();
  } catch (error) {
    if (mia !== secuencia) return;
    console.warn('No se pudieron cargar las jornadas', error);
    jornadasMostradas = [];
    caja.innerHTML = '<p>No pudimos cargar las jornadas de evaluación.</p>';
    mostrarErrorConfirmar('No pudimos cargar las jornadas. Revisa tu conexión e inténtalo de nuevo, o escribe al head coach por WhatsApp.', true);
    actualizarBotonConfirmar();
    return;
  }
  if (mia !== secuencia) return;
  const lista = todas.filter((x) => j.grupos.includes(x.grupo));
  jornadasMostradas = lista.map((x) => ({ id: x.id, dia: diaDe(x), inicio: x.inicio, fin: x.fin }));
  const libres = lista.filter((x) => !textoCupo(x).agotada);
  if (!libres.some((x) => x.id === estado.jornadaId)) estado.jornadaId = '';
  if (lista.length === 0 || libres.length === 0) {
    caja.innerHTML =
      lista.length === 0
        ? '<p>Por ahora no hay jornadas publicadas para tu caso.</p>'
        : htmlJornadasLista(lista) + '<p>Las jornadas de este grupo ya no tienen cupos.</p>';
    mostrarErrorConfirmar('No hay jornadas con cupo disponible para tu caso. Escribe al head coach por WhatsApp para coordinar tu evaluación.', true);
  } else {
    caja.innerHTML = htmlJornadasLista(lista);
  }
  actualizarBotonConfirmar();
}

async function pintarResultado(): Promise<void> {
  if (!datosPagina) return;
  const conf = estado.confirmada;
  const d = datosVigentes();
  if (!conf && Object.keys(validarTodo(d, hoyISO())).length > 0) {
    irAPaso(2, { foco: false });
    return;
  }
  const ev = evaluarPostulacion(datosPagina.equipos, datosPagina.precios, postulanteDesdeDatos(d));
  evaluacionActual = ev;

  $('#aviso-prueba').hidden = modoApiActivo();
  $('#res-resumen').textContent = `Resultado para ${nombreAtleta(d)}, que cumple ${ev.edad} años en ${ANIO_TEMPORADA}.`;
  $('#aviso-cambios').hidden = !conf || JSON.stringify(estado.datos) === JSON.stringify(conf.datos);

  const cont = $('#res-equipos');
  if (ev.equipos.length === 0) {
    cont.innerHTML = '<p>No encontramos un equipo que calce con estos datos. El head coach te orientará por WhatsApp.</p>';
  } else {
    const rangos = new Map(datosPagina.equipos.map((e) => [e.nombre, e.rango]));
    cont.innerHTML = `<ul class="tarjetas" role="list">${ev.equipos
      .map((e) => `<li class="tarjeta"><span class="tarjeta__nombre">${esc(e.nombre)}</span><span class="tarjeta__detalle">${esc(e.categoria)}</span><span class="tarjeta__detalle">${esc(rangos.get(e.nombre) ?? '')}</span></li>`)
      .join('')}</ul>`;
  }
  $('#res-monto').innerHTML = htmlMonto(ev, d);
  const dif = esDiferido(ev);
  $('#res-jornada-titulo').textContent = dif ? 'Inicio' : 'Evaluación';
  $('#res-monto-titulo').textContent = dif ? 'Mensualidad' : 'Monto estimado de ingreso';
  $('#res-pago-titulo').textContent = dif ? 'Próximos pasos' : 'Cómo pagar';
  $('#res-pago-texto').textContent = dif ? 'El head coach te avisará por WhatsApp cuando el grupo esté por comenzar.' : 'Paga y envía el comprobante al head coach.';
  $('#res-codigo-ayuda').textContent = dif ? 'Guárdalo: lo necesitas cuando escribas al head coach.' : 'Guárdalo: lo necesitas al enviar el comprobante.';
  $('#res-equipos-nota').textContent = dif ? 'El head coach confirma tu grupo antes del inicio.' : 'El coach confirma tu equipo final en la evaluación.';
  $('#res-confirmar-texto').textContent = dif ? 'Al confirmar guardamos tu preinscripción. El head coach te avisará cuando el grupo esté por comenzar.' : 'Al confirmar guardamos tu preinscripción y reservamos tu jornada. Después te mostramos cómo pagar.';
  $('#whatsapp-texto').textContent = dif ? 'Escribir al head coach por WhatsApp' : 'Enviar comprobante por WhatsApp';

  /* Antes de confirmar: vista previa. Después: código, cómo pagar y WhatsApp. */
  $('#res-confirmada').hidden = !conf;
  $('#res-previa').hidden = !!conf;
  if (conf) {
    $('#res-codigo').textContent = conf.codigo;
    $('#res-correo').textContent = textoCorreo(conf, esDiferido(ev));
    $('#whatsapp-estado').textContent = '';
    await pintarJornada(ev, conf);
    actualizarEnlaceWhatsapp();
  } else {
    mostrarErrorConfirmar(null);
    if (ev.equipos.length === 0) mostrarErrorConfirmar('Para tu caso el head coach te orientará. Escríbele por WhatsApp.', true);
    await pintarJornada(ev, null);
    actualizarBotonConfirmar();
  }
  guardarEstado();
}

/** Texto de cada error del servidor para la persona (español de Chile, sin tecnicismos). */
const MENSAJES_ERROR: Record<string, string> = {
  jornada_sin_cupo: 'Esa jornada se llenó mientras completabas el formulario. Elige otra de las que quedan.',
  jornada_no_disponible: 'Esa jornada ya no está disponible. Elige otra de las que se muestran.',
  sin_equipo_sugerido: 'Con estos datos no encontramos un equipo sugerido. Escribe al head coach por WhatsApp y te orienta.',
  servidor: 'No pudimos guardar tu preinscripción por un problema de nuestro lado. Tus datos siguen aquí: inténtalo de nuevo en un momento o escribe al head coach por WhatsApp.',
  red: 'No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo; tus datos siguen aquí. Si el problema sigue, escribe al head coach por WhatsApp.',
};

async function confirmarPreinscripcion(): Promise<void> {
  const ev = evaluacionActual;
  if (!ev || estado.confirmada) return;
  const boton = $<HTMLButtonElement>('.js-confirmar');
  const necesitaJornada = ev.jornada.tipo === 'jornadas';
  if (necesitaJornada && !estado.jornadaId) {
    actualizarBotonConfirmar();
    return;
  }
  boton.disabled = true;
  mostrarErrorConfirmar(null);
  $('#confirmar-ayuda').textContent = 'Guardando tu preinscripción…';
  const datos = estado.datos;
  const jornadaId = necesitaJornada ? estado.jornadaId : null;
  const r: ResultadoEnvio = await enviarPostulacion(datos, jornadaId);
  $('#confirmar-ayuda').textContent = '';

  if (r.ok) {
    estado.confirmada = {
      codigo: r.codigo,
      correoEnviado: r.correoEnviado,
      datos: { ...datos },
      jornadaId: jornadaId ?? '',
      jornadaTexto: textoJornadaElegida(ev, jornadaId ?? ''),
    };
    guardarEstado();
    await pintarResultado();
    const titulo = $('#res-confirmada-titulo');
    titulo.scrollIntoView({ block: 'start', behavior: reducido() ? 'auto' : 'smooth' });
    titulo.focus({ preventScroll: true });
    return;
  }

  if (r.error === 'datos_invalidos') {
    /* El servidor encontró datos que no cuadran: se marcan junto al campo y se vuelve al paso 2. */
    const sinCampo: string[] = [];
    let primero: keyof DatosPostulacion | null = null;
    for (const campo of r.campos) {
      const destino = CAMPO_API_A_FORMULARIO[campo];
      if (destino && document.getElementById(`error-${destino}`)) {
        tocados.add(destino);
        mostrarError(destino, 'Revisa este dato: el servidor no lo aceptó.');
        primero ??= destino;
      } else sinCampo.push(campo);
    }
    irAPaso(2, { foco: false });
    const resumen = $('#resumen-errores');
    resumen.textContent = sinCampo.length > 0 && primero === null ? 'Algunos datos no se aceptaron. Revisa el formulario o escribe al head coach por WhatsApp.' : 'Revisa los campos marcados: el servidor no aceptó algunos datos.';
    resumen.hidden = false;
    if (primero) enfocarCampo(primero);
    else resumen.focus();
    boton.disabled = false;
    return;
  }

  if (r.error === 'jornada_sin_cupo' || r.error === 'jornada_no_disponible') {
    estado.jornadaId = '';
    guardarEstado();
    await pintarJornada(ev, null);
    mostrarErrorConfirmar(MENSAJES_ERROR[r.error] ?? '');
    $('#res-error').focus();
    return;
  }

  /* Servidor, red o sin equipo: mensaje amable, lo escrito se conserva y WhatsApp queda como alternativa. */
  mostrarErrorConfirmar(MENSAJES_ERROR[r.error] ?? MENSAJES_ERROR['servidor'] ?? '', true);
  actualizarBotonConfirmar();
  $('#res-error').focus();
}

function configurarPaso3(): void {
  /* Delegación: los radios de jornada se crean al pintar el resultado. */
  $('#res-jornada').addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.name !== 'jornada') return;
    estado.jornadaId = el.value;
    guardarEstado();
    mostrarErrorConfirmar(null);
    actualizarBotonConfirmar();
  });

  $('.js-confirmar').addEventListener('click', () => void confirmarPreinscripcion());

  $('.js-whatsapp').addEventListener('click', () => {
    actualizarEnlaceWhatsapp();
    $('#whatsapp-estado').textContent = `Abrimos WhatsApp con tu mensaje. Si no se abre, escribe al head coach e indica tu código ${estado.confirmada?.codigo ?? ''}.`;
    /* Flujo terminado: no se deja nada de la familia en el navegador. */
    limpiarAlmacenamiento();
  });

  $('.js-atras-3').addEventListener('click', () => irAPaso(2, { foco: true }));

  $('.js-otra').addEventListener('click', () => {
    /* Inicia una postulación nueva; el informativo ya leído en esta sesión no se vuelve a exigir. */
    const { leido, ultimaVista } = estado;
    estado = { ...estadoInicial(), leido, ultimaVista };
    escribirFormulario(estado.datos);
    actualizarDependencias(estado.datos);
    tocados.clear();
    document.querySelectorAll<HTMLDetailsElement>('#det-equipo, #det-promos, #habilidades').forEach((x) => (x.open = false));
    form().querySelectorAll('.campo__error').forEach((c) => ((c as HTMLElement).hidden = true));
    form().querySelectorAll('[aria-invalid]').forEach((c) => c.removeAttribute('aria-invalid'));
    $('#resumen-errores').hidden = true;
    evaluacionActual = null;
    mostrarErrorConfirmar(null);
    irAPaso(leido ? 2 : 1, { foco: true });
  });
}

/* ── Arranque ───────────────────────────────────────────────── */

function iniciar(): void {
  if (!datosPagina) return;
  estado = cargarEstado();
  escribirFormulario(estado.datos);
  actualizarDependencias(estado.datos);
  configurarPaso1();
  configurarPaso2();
  configurarPaso3();
  irAPaso(estado.paso, { foco: false });
}

iniciar();
