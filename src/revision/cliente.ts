/* Modo revisión: control de cambios del sitio entre el club y el equipo.
   Se carga solo cuando la página se abre con ?revision=<clave> (ver
   components/revision/ActivadorRevision.astro). La clave determina el rol:

   - Club (rol cliente): crea observaciones por sección, marca el veredicto de
     cada sección, responde en el hilo de cada observación y entrega la ronda.
   - Equipo (rol equipo): no crea observaciones; responde en el hilo y decide
     (aceptar con el cambio acordado, pedir aclaración, posponer, rechazar,
     marcar implementada). Tiene una bandeja y el consolidado de cambios
     aceptados para pasárselo a Claude Code.

   Todo se guarda en GitHub Issues a través de /api/revision/*. */

import estilos from './revision.css?inline';
import { crearApi, ErrorApi, type Api } from './api';
import { formatearFecha, h, icono, ICONOS } from './dom';
import { describirElemento, senalar } from './senalar';
import { aceptadas, generarConsolidado } from './consolidado';
import {
  DECISIONES,
  ESTADOS_COMENTARIO,
  ESTADOS_SECCION,
  LIMITES,
  PRIORIDADES,
  RONDA_ACTUAL,
  ROLES,
  SECCIONES,
  TIPOS,
  buscarSeccion,
  nombreSeccion,
  type Comentario,
  type EstadoRonda,
  type IdDecision,
  type IdEstadoSeccion,
  type IdPrioridad,
  type IdTipo,
  type Respuesta,
  type Rol,
  type SeccionRevision,
} from '../data/revision';

const CLAVE_ACCESO = 'huracan-revision';
const CLAVE_NOMBRE: Record<Rol, string> = { cliente: 'huracan-revision-revisor', equipo: 'huracan-revision-equipo' };

type Vista = 'seccion' | 'resumen' | 'bandeja' | 'consolidado';
type Filtro = 'por-responder' | 'esperando-otro' | 'aceptada' | 'pospuesta' | 'cerradas' | 'todas';

interface Borrador {
  tipo: IdTipo | null;
  prioridad: IdPrioridad | null;
  texto: string;
  elemento: string | null;
}

interface BorradorRespuesta {
  texto: string;
  decision: IdDecision | null;
  cambio: string;
}

interface Estado {
  datos: EstadoRonda | null;
  rol: Rol | null;
  nombre: string;
  seccionActual: string;
  seccionPanel: string;
  panelAbierto: boolean;
  vista: Vista;
  filtro: Filtro;
  borrador: Borrador;
  enviando: boolean;
  confirmandoEntrega: boolean;
  /** Hilos cargados, por número de observación. */
  hilos: Map<number, Respuesta[]>;
  /** Hilos desplegados. */
  hilosAbiertos: Set<number>;
  /** Formularios de respuesta abiertos, con su borrador. */
  respuestas: Map<number, BorradorRespuesta>;
}

const version = `${__VERSION_SITIO__.commit} (${__VERSION_SITIO__.rama})`;
const borradorVacio = (): Borrador => ({ tipo: null, prioridad: null, texto: '', elemento: null });

function leerLocal(clave: string): string {
  try {
    return localStorage.getItem(clave) ?? '';
  } catch {
    return '';
  }
}

function guardarLocal(clave: string, valor: string | null): void {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch {
    /* navegación privada: se mantiene solo en memoria */
  }
}

function dispositivo(): string {
  const w = window.innerWidth;
  const alto = window.innerHeight;
  const tipo = w < 640 ? 'Móvil' : w < 1024 ? 'Tablet' : 'Escritorio';
  return `${tipo} · ${w} × ${alto}`;
}

function elementoDe(s: SeccionRevision): HTMLElement | null {
  return s.selector ? document.querySelector<HTMLElement>(s.selector) : null;
}

const esFijo = (el: HTMLElement) => getComputedStyle(el).position === 'fixed';
const plural = (n: number, singular: string, pluralTexto = `${singular}s`) => `${n} ${n === 1 ? singular : pluralTexto}`;

export function iniciar(clave: string): void {
  const api: Api = crearApi(clave);
  const estado: Estado = {
    datos: null,
    rol: null,
    nombre: '',
    seccionActual: 'general',
    seccionPanel: 'general',
    panelAbierto: false,
    vista: 'seccion',
    filtro: 'por-responder',
    borrador: borradorVacio(),
    enviando: false,
    confirmandoEntrega: false,
    hilos: new Map(),
    hilosAbiertos: new Set(),
    respuestas: new Map(),
  };

  const estilo = h('style', { 'data-revision': '' });
  estilo.textContent = estilos;
  document.head.append(estilo);
  document.documentElement.classList.add('rv-activo');

  /* ── Elementos fijos ──────────────────────────────────────────────── */

  const capa = h('div', { class: 'rv-raiz rv-capa' });
  const marco = h('div', { class: 'rv-marco', 'aria-hidden': 'true' });
  capa.append(marco);

  const aviso = h('div', { class: 'rv-raiz rv-aviso', role: 'status', 'aria-live': 'polite' });

  const dockRol = h('span', {}, ` · Ronda ${RONDA_ACTUAL}`);
  const dockAccion = h('span', { class: 'rv-dock__accion' }, 'Comentar');
  const dockSeccion = h('span', { class: 'rv-dock__seccion' }, 'Cargando…');
  const dockVistaNombre = h('span', { class: 'rv-ocultar-movil' }, 'Resumen ');
  const dockProgreso = h('span', { class: 'rv-dock__progreso' });
  const dockPendientes = h('span', { class: 'rv-dock__pendientes', hidden: true });
  const botonVista = h(
    'button',
    {
      type: 'button',
      class: 'rv-dock__boton',
      onclick: () => abrirPanel(estado.seccionPanel, estado.rol === 'equipo' ? 'bandeja' : 'resumen'),
    },
    icono(ICONOS.lista),
    dockVistaNombre,
    dockProgreso,
    dockPendientes,
  );
  const botonComentar = h(
    'button',
    { type: 'button', class: 'rv-dock__comentar', onclick: () => abrirPanel(estado.seccionActual, 'seccion') },
    icono(ICONOS.globo),
    dockAccion,
    dockSeccion,
  );
  const dock = h(
    'div',
    { class: 'rv-raiz rv-dock', role: 'region', 'aria-label': 'Modo revisión' },
    h('span', { class: 'rv-dock__marca' }, h('strong', {}, 'Revisión'), dockRol),
    botonComentar,
    botonVista,
    h(
      'button',
      {
        type: 'button',
        class: 'rv-dock__boton',
        'aria-pressed': 'false',
        'aria-label': 'Ocultar marcadores para ver el diseño limpio',
        title: 'Ocultar marcadores para ver el diseño limpio',
        onclick: (e: Event) => {
          const boton = e.currentTarget as HTMLButtonElement;
          const ocultos = capa.classList.toggle('rv-capa--oculta');
          boton.setAttribute('aria-pressed', String(ocultos));
        },
      },
      icono(ICONOS.ojo),
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'rv-dock__boton',
        'aria-label': 'Salir del modo revisión',
        title: 'Salir del modo revisión',
        onclick: salir,
      },
      icono(ICONOS.salir),
    ),
  );

  const panelAntetitulo = h('p', { class: 'rv-panel__antetitulo' }, `Revisión del sitio · Ronda ${RONDA_ACTUAL}`);
  const panelTitulo = h('h2', { id: 'rv-panel-titulo', class: 'rv-panel__titulo', tabindex: '-1' });
  const panelPestanas = h('div', { class: 'rv-pestanas', role: 'group', 'aria-label': 'Vista' });
  const panelCuerpo = h('div', { class: 'rv-panel__cuerpo' });
  const selectorSeccion = h(
    'select',
    {
      class: 'rv-select',
      'aria-label': 'Cambiar de sección',
      onchange: (e: Event) => abrirPanel((e.target as HTMLSelectElement).value, 'seccion', true),
    },
    SECCIONES.map((s) => h('option', { value: s.id }, nombreSeccion(s))),
  );
  const panel = h(
    'aside',
    { class: 'rv-raiz rv-panel', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'rv-panel-titulo', hidden: true },
    h(
      'div',
      { class: 'rv-panel__cab' },
      h(
        'div',
        { class: 'rv-panel__fila' },
        panelAntetitulo,
        h('button', { type: 'button', class: 'rv-icono-boton', 'aria-label': 'Cerrar panel', onclick: cerrarPanel }, icono(ICONOS.cerrar)),
      ),
      panelTitulo,
      panelPestanas,
    ),
    panelCuerpo,
  );

  document.body.append(capa, panel, dock, aviso);

  const esUi = (el: Element) => Boolean(el.closest('.rv-raiz'));

  /* ── Avisos y errores ─────────────────────────────────────────────── */

  let temporizadorAviso = 0;
  function avisar(texto: string, tipo: 'ok' | 'error' = 'ok'): void {
    aviso.textContent = texto;
    aviso.dataset['tipo'] = tipo;
    aviso.classList.add('rv-aviso--visible');
    window.clearTimeout(temporizadorAviso);
    temporizadorAviso = window.setTimeout(() => aviso.classList.remove('rv-aviso--visible'), tipo === 'error' ? 7000 : 3500);
  }

  function manejarError(e: unknown): void {
    if (e instanceof ErrorApi && e.estado === 401) {
      guardarLocal(CLAVE_ACCESO, null);
      dockSeccion.textContent = 'Enlace de revisión no válido';
      avisar('El enlace de revisión no es válido o expiró. Pide uno nuevo a quien desarrolla el sitio.', 'error');
      return;
    }
    avisar(e instanceof Error ? e.message : 'No se pudo completar la acción.', 'error');
  }

  /* ── Datos ────────────────────────────────────────────────────────── */

  const comentarios = () => estado.datos?.comentarios ?? [];
  const comentariosDe = (seccion: string) => comentarios().filter((c) => c.seccion === seccion);
  const esperanMiRespuesta = () => comentarios().filter((c) => estado.rol && c.turno === estado.rol);

  function reemplazarComentario(nuevo: Comentario): void {
    if (!estado.datos) return;
    const i = estado.datos.comentarios.findIndex((c) => c.numero === nuevo.numero);
    if (i === -1) estado.datos.comentarios.push(nuevo);
    else estado.datos.comentarios[i] = nuevo;
  }

  async function cargar(): Promise<void> {
    try {
      estado.datos = await api.estado();
      if (!estado.rol) {
        estado.rol = estado.datos.rol;
        estado.nombre = leerLocal(CLAVE_NOMBRE[estado.rol]);
        document.documentElement.dataset['rvRol'] = estado.rol;
        crearMarcadores();
      } else {
        // Recarga: los hilos abiertos también pueden tener respuestas nuevas.
        for (const numero of estado.hilosAbiertos) {
          api
            .respuestas(numero)
            .then((r) => {
              estado.hilos.set(numero, r);
              if (estado.panelAbierto) pintarPanel();
            })
            .catch(() => undefined);
        }
      }
      pintarTodo();
    } catch (e) {
      manejarError(e);
    }
  }

  /* ── Marcadores sobre la página ───────────────────────────────────── */

  const marcadores = new Map<string, HTMLButtonElement>();
  function crearMarcadores(): void {
    for (const s of SECCIONES) {
      if (!s.marcador || !elementoDe(s)) continue;
      const boton = h('button', { type: 'button', class: 'rv-marca', onclick: () => abrirPanel(s.id, 'seccion') });
      marcadores.set(s.id, boton);
      capa.append(boton);
    }
  }

  function pintarMarcadores(): void {
    for (const [id, boton] of marcadores) {
      const s = buscarSeccion(id)!;
      const lista = comentariosDe(id);
      const pendientes = lista.filter((c) => c.turno === estado.rol).length;
      const veredicto = estado.datos?.secciones[id]?.estado ?? 'sin-revisar';
      boton.classList.toggle('rv-marca--alerta', pendientes > 0);
      boton.replaceChildren(
        h('span', { class: `rv-punto rv-punto--${veredicto}`, 'aria-hidden': 'true' }),
        icono(ICONOS.globo),
        h('span', {}, s.numero === '—' ? s.nombre : `${s.numero} ${s.nombre}`),
        ...(lista.length > 0 ? [h('span', { class: 'rv-marca__n' }, lista.length)] : []),
      );
      boton.setAttribute(
        'aria-label',
        `${estado.rol === 'equipo' ? 'Ver' : 'Comentar'} la sección ${nombreSeccion(s)}. ` +
          `${plural(lista.length, 'observación', 'observaciones')}` +
          (pendientes ? `, ${pendientes} esperan tu respuesta` : '') +
          `. Veredicto: ${ESTADOS_SECCION[veredicto].nombre}.`,
      );
    }
  }

  let marcoPendiente = 0;
  function ubicar(): void {
    cancelAnimationFrame(marcoPendiente);
    marcoPendiente = requestAnimationFrame(() => {
      const desplazamiento = window.scrollY;
      const header = document.querySelector('.header')?.getBoundingClientRect();
      const baseHeader = header ? header.bottom + desplazamiento : 0;
      for (const [id, boton] of marcadores) {
        const el = elementoDe(buscarSeccion(id)!);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        let arriba = r.top + desplazamiento + 12;
        // El header va sobre la portada: el marcador se corre bajo él.
        if (header && arriba < baseHeader && r.bottom + desplazamiento > baseHeader) arriba = baseHeader + 8;
        boton.style.transform = `translate(${Math.max(8, r.left + 12)}px, ${arriba}px)`;
      }
      const activa = estado.panelAbierto && estado.vista === 'seccion' ? buscarSeccion(estado.seccionPanel) : undefined;
      const el = activa ? elementoDe(activa) : null;
      if (el) {
        const r = el.getBoundingClientRect();
        const fijo = esFijo(el);
        Object.assign(marco.style, {
          display: 'block',
          position: fijo ? 'fixed' : 'absolute',
          transform: `translate(${r.left}px, ${r.top + (fijo ? 0 : desplazamiento)}px)`,
          width: `${r.width}px`,
          height: `${r.height}px`,
        });
      } else {
        marco.style.display = 'none';
      }
    });
  }

  new ResizeObserver(ubicar).observe(document.body);
  window.addEventListener('resize', ubicar);
  window.addEventListener('load', ubicar);
  void document.fonts?.ready.then(ubicar);
  window.setInterval(ubicar, 2500);

  /* Sección que se está mirando: la que cruza la mitad de la pantalla. */
  const observador = new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        const s = SECCIONES.find((x) => x.selector && entrada.target.matches(x.selector));
        if (s) {
          estado.seccionActual = s.id;
          pintarDock();
        }
      }
    },
    { rootMargin: '-50% 0px -50% 0px' },
  );
  for (const s of SECCIONES) {
    const el = elementoDe(s);
    if (el && !esFijo(el)) observador.observe(el);
  }

  /* ── Barra inferior ───────────────────────────────────────────────── */

  function pintarDock(): void {
    const s = buscarSeccion(estado.seccionActual)!;
    dockSeccion.textContent = nombreSeccion(s);
    if (!estado.rol) return;
    const equipo = estado.rol === 'equipo';
    dockRol.textContent = ` · Ronda ${RONDA_ACTUAL} · ${ROLES[estado.rol]}`;
    dockAccion.textContent = equipo ? 'Ver' : 'Comentar';
    dockVistaNombre.textContent = equipo ? 'Bandeja ' : 'Resumen ';
    const conVeredicto = SECCIONES.filter((x) => estado.datos?.secciones[x.id]).length;
    dockProgreso.textContent = equipo ? '' : `${conVeredicto}/${SECCIONES.length}`;
    const pendientes = esperanMiRespuesta().length;
    dockPendientes.hidden = pendientes === 0;
    dockPendientes.textContent = String(pendientes);
    const descripcion =
      (equipo ? 'Bandeja' : `Resumen de la ronda: ${conVeredicto} de ${SECCIONES.length} secciones con veredicto`) +
      (pendientes ? `. ${pendientes} esperan tu respuesta` : '');
    botonVista.setAttribute('aria-label', descripcion);
    botonVista.setAttribute('title', descripcion);
  }

  function pintarTodo(): void {
    pintarDock();
    pintarMarcadores();
    if (estado.panelAbierto) pintarPanel();
    ubicar();
  }

  /* ── Panel ────────────────────────────────────────────────────────── */

  function abrirPanel(id: string, vista: Vista, mantenerFoco = false): void {
    if (estado.seccionPanel !== id) estado.borrador.elemento = null;
    if ((vista === 'resumen' || vista === 'bandeja') && vista !== estado.vista) {
      estado.filtro = esperanMiRespuesta().length ? 'por-responder' : 'todas';
    }
    estado.seccionPanel = id;
    estado.vista = vista;
    estado.panelAbierto = true;
    estado.confirmandoEntrega = false;
    panel.hidden = false;
    document.documentElement.classList.add('rv-panel-abierto');
    pintarPanel();
    ubicar();
    if (!mantenerFoco) panelTitulo.focus();
  }

  function cerrarPanel(): void {
    estado.panelAbierto = false;
    panel.hidden = true;
    document.documentElement.classList.remove('rv-panel-abierto');
    ubicar();
    botonComentar.focus();
  }

  function cambiarVista(vista: Vista): void {
    if ((vista === 'resumen' || vista === 'bandeja') && vista !== estado.vista) {
      estado.filtro = esperanMiRespuesta().length ? 'por-responder' : 'todas';
    }
    estado.vista = vista;
    estado.confirmandoEntrega = false;
    pintarPanel();
    ubicar();
  }

  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarPanel();
  });

  const NOMBRES_VISTA: Record<Vista, string> = {
    seccion: 'Sección',
    resumen: 'Resumen de la ronda',
    bandeja: 'Bandeja',
    consolidado: 'Consolidado',
  };

  let vistaPintada = '';
  function pintarPanel(): void {
    const s = buscarSeccion(estado.seccionPanel)!;
    const rol = estado.rol ?? 'cliente';
    const vistas: Vista[] = rol === 'equipo' ? ['seccion', 'bandeja', 'consolidado'] : ['seccion', 'resumen'];
    if (!vistas.includes(estado.vista)) estado.vista = 'seccion';

    // Al cambiar de sección o de vista el panel vuelve arriba; al guardar, se queda donde estaba.
    const claveVista = `${estado.vista}:${s.id}:${estado.filtro}`;
    const desplazamiento = claveVista === vistaPintada ? panelCuerpo.scrollTop : 0;
    vistaPintada = claveVista;

    panelAntetitulo.textContent = `Revisión del sitio · Ronda ${RONDA_ACTUAL}${estado.rol ? ` · ${ROLES[estado.rol]}` : ''}`;
    panelTitulo.textContent = estado.vista === 'seccion' ? nombreSeccion(s) : NOMBRES_VISTA[estado.vista];
    selectorSeccion.value = s.id;
    const pendientes = esperanMiRespuesta().length;
    panelPestanas.replaceChildren(
      ...vistas.map((v) =>
        h(
          'button',
          { type: 'button', class: 'rv-pestana', 'aria-pressed': String(estado.vista === v), onclick: () => cambiarVista(v) },
          v === 'resumen' ? 'Resumen' : NOMBRES_VISTA[v],
          (v === 'bandeja' || v === 'resumen') && pendientes > 0
            ? h('span', { class: 'rv-pestana__n', 'aria-label': `${pendientes} esperan tu respuesta` }, pendientes)
            : null,
          v === 'consolidado' && aceptadas(comentarios()).length > 0
            ? h('span', { class: 'rv-pestana__n rv-pestana__n--neutro' }, aceptadas(comentarios()).length)
            : null,
        ),
      ),
    );

    const contenido =
      estado.vista === 'seccion'
        ? vistaSeccion(s)
        : estado.vista === 'resumen'
          ? vistaResumen()
          : estado.vista === 'bandeja'
            ? vistaBandeja()
            : vistaConsolidado();
    panelCuerpo.replaceChildren(...contenido);
    panelCuerpo.scrollTop = desplazamiento;
  }

  function campoNombre(): HTMLElement {
    const equipo = estado.rol === 'equipo';
    if (estado.nombre) {
      return h(
        'p',
        { class: 'rv-revisor' },
        equipo ? 'Respondes como ' : 'Revisas como ',
        h('strong', {}, estado.nombre),
        ' · ',
        h(
          'button',
          {
            type: 'button',
            class: 'rv-enlace',
            onclick: () => {
              estado.nombre = '';
              if (estado.rol) guardarLocal(CLAVE_NOMBRE[estado.rol], null);
              pintarPanel();
            },
          },
          'cambiar',
        ),
      );
    }
    const entrada = h('input', {
      id: 'rv-nombre',
      class: 'rv-input',
      type: 'text',
      maxlength: LIMITES.revisor,
      autocomplete: 'name',
      placeholder: equipo ? 'Tu nombre, p. ej. Jano' : 'Nombre y cargo, p. ej. Ana Pérez, directora',
    });
    return h(
      'div',
      { class: 'rv-bloque rv-bloque--destacado' },
      h('label', { class: 'rv-etiqueta', for: 'rv-nombre' }, equipo ? '¿Quién responde?' : '¿Quién revisa?'),
      h(
        'div',
        { class: 'rv-fila' },
        entrada,
        h(
          'button',
          {
            type: 'button',
            class: 'rv-boton',
            onclick: () => {
              const valor = entrada.value.trim();
              if (!valor) {
                entrada.focus();
                return;
              }
              estado.nombre = valor;
              if (estado.rol) guardarLocal(CLAVE_NOMBRE[estado.rol], valor);
              pintarPanel();
            },
          },
          'Guardar',
        ),
      ),
      h('p', { class: 'rv-ayuda' }, 'Queda registrado en cada observación y respuesta.'),
    );
  }

  function exigirNombre(): boolean {
    if (estado.nombre) return true;
    avisar(estado.rol === 'equipo' ? 'Antes de responder, indica tu nombre.' : 'Antes de guardar, indica quién revisa.', 'error');
    panelCuerpo.scrollTop = 0;
    document.getElementById('rv-nombre')?.focus();
    return false;
  }

  function pie(): HTMLElement {
    return h('p', { class: 'rv-pie' }, `Versión revisada: ${version}`);
  }

  function chip(texto: string, clase: string): HTMLElement {
    return h('span', { class: `rv-chip ${clase}` }, texto);
  }

  /* ── Vista: sección ───────────────────────────────────────────────── */

  function vistaSeccion(s: SeccionRevision): HTMLElement[] {
    const el = elementoDe(s);
    const lista = comentariosDe(s.id);
    const registro = estado.datos?.secciones[s.id];
    const cliente = estado.rol === 'cliente';

    const navegacion = h(
      'div',
      { class: 'rv-fila rv-fila--separada' },
      selectorSeccion,
      el && !esFijo(el)
        ? h(
            'button',
            {
              type: 'button',
              class: 'rv-boton rv-boton--claro',
              onclick: () => {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // En el teléfono el panel tapa la página: se cierra para poder mirar.
                if (window.innerWidth < 768) cerrarPanel();
              },
            },
            'Ir a la sección',
          )
        : null,
    );

    const preguntas = h(
      'div',
      { class: 'rv-bloque' },
      h('h3', { class: 'rv-subtitulo' }, 'Preguntas guía'),
      h('ul', { class: 'rv-preguntas' }, s.preguntas.map((p) => h('li', {}, p))),
    );

    const listado = h(
      'div',
      { class: 'rv-bloque' },
      h('h3', { class: 'rv-subtitulo' }, `Observaciones de esta ronda (${lista.length})`),
      lista.length
        ? h('ol', { class: 'rv-comentarios' }, lista.slice().reverse().map((c) => tarjeta(c)))
        : h('p', { class: 'rv-ayuda' }, cliente ? 'Todavía no hay observaciones en esta sección.' : 'El club no ha dejado observaciones en esta sección.'),
    );

    const veredicto = cliente
      ? bloqueVeredicto(s)
      : h(
          'div',
          { class: 'rv-bloque' },
          h('h3', { class: 'rv-subtitulo' }, 'Veredicto del club'),
          h(
            'p',
            {},
            h('span', { class: `rv-punto rv-punto--${registro?.estado ?? 'sin-revisar'}`, 'aria-hidden': 'true' }),
            ' ',
            ESTADOS_SECCION[registro?.estado ?? 'sin-revisar'].nombre,
            registro ? ` · ${registro.revisor} · ${formatearFecha(registro.fecha)}` : '',
          ),
          registro?.nota ? h('p', { class: 'rv-ayuda' }, `Nota: «${registro.nota}»`) : null,
        );

    return cliente
      ? [navegacion, campoNombre(), preguntas, formulario(s), listado, veredicto, pie()]
      : [navegacion, campoNombre(), veredicto, listado, preguntas, pie()];
  }

  function bloqueVeredicto(s: SeccionRevision): HTMLElement {
    const registro = estado.datos?.secciones[s.id];
    const nota = h('textarea', {
      class: 'rv-input rv-input--corto',
      rows: 2,
      maxlength: LIMITES.nota,
      placeholder: 'Nota para el veredicto (opcional)',
      'aria-label': 'Nota para el veredicto',
    });
    return h(
      'div',
      { class: 'rv-bloque' },
      h('h3', { class: 'rv-subtitulo' }, 'Veredicto de la sección'),
      h(
        'div',
        { class: 'rv-veredictos', role: 'group', 'aria-label': 'Veredicto' },
        (['aprobada', 'aprobada-con-cambios', 'rehacer'] as const).map((id) =>
          h(
            'button',
            {
              type: 'button',
              class: `rv-veredicto rv-veredicto--${id}`,
              'aria-pressed': String(registro?.estado === id),
              disabled: estado.enviando,
              onclick: () => void guardarVeredicto(s, id, nota.value),
            },
            ESTADOS_SECCION[id].nombre,
          ),
        ),
      ),
      registro
        ? h(
            'p',
            { class: 'rv-ayuda' },
            `Registrado por ${registro.revisor} · ${formatearFecha(registro.fecha)}`,
            registro.nota ? ` · Nota: «${registro.nota}»` : '',
          )
        : h('p', { class: 'rv-ayuda' }, 'Cuando termines de revisar la sección, marca tu veredicto.'),
      nota,
    );
  }

  /* ── Tarjeta de observación con su hilo ───────────────────────────── */

  function tarjeta(c: Comentario, mostrarSeccion = false): HTMLElement {
    const rol = estado.rol ?? 'cliente';
    const seccion = buscarSeccion(c.seccion);
    const abierto = estado.hilosAbiertos.has(c.numero);
    const hilo = estado.hilos.get(c.numero);
    const borrador = estado.respuestas.get(c.numero);

    const turno = c.turno
      ? c.turno === rol
        ? chip('Esperando tu respuesta', 'rv-chip--alerta')
        : chip(`Esperando ${c.turno === 'equipo' ? 'al equipo' : 'al club'}`, 'rv-chip--turno')
      : null;

    const botonHilo =
      c.respuestas > 0
        ? h(
            'button',
            {
              type: 'button',
              class: 'rv-enlace',
              'aria-expanded': String(abierto),
              onclick: () => void alternarHilo(c.numero),
            },
            abierto ? 'Ocultar conversación' : `Ver conversación (${c.respuestas})`,
          )
        : null;

    const botonResponder = borrador
      ? null
      : h(
          'button',
          {
            type: 'button',
            class: c.turno === rol ? 'rv-boton rv-boton--claro rv-boton--chico' : 'rv-enlace',
            onclick: () => {
              estado.respuestas.set(c.numero, { texto: '', decision: null, cambio: c.cambio });
              if (c.respuestas > 0) void alternarHilo(c.numero, true);
              else pintarPanel();
            },
          },
          rol === 'equipo' ? 'Responder o decidir' : 'Responder',
        );

    return h(
      'li',
      { class: `rv-comentario rv-comentario--${c.estado}${c.turno === rol ? ' rv-comentario--turno' : ''}` },
      mostrarSeccion && seccion ? h('p', { class: 'rv-comentario__seccion' }, nombreSeccion(seccion)) : null,
      h(
        'div',
        { class: 'rv-chips' },
        c.tipo ? chip(TIPOS[c.tipo].nombre, `rv-chip--${c.tipo}`) : null,
        c.prioridad ? chip(PRIORIDADES[c.prioridad].nombre, 'rv-chip--prioridad') : null,
        chip(ESTADOS_COMENTARIO[c.estado].nombre, `rv-chip--estado rv-chip--${c.estado}`),
        turno,
      ),
      h('p', { class: 'rv-comentario__texto' }, c.comentario),
      c.elemento ? h('p', { class: 'rv-comentario__elemento' }, 'Señalado: ', c.elemento) : null,
      h('p', { class: 'rv-comentario__meta' }, `#${c.numero} · ${c.revisor} · ${formatearFecha(c.fecha)}`),
      c.cambio && (c.estado === 'aceptada' || c.estado === 'implementada')
        ? h('div', { class: 'rv-cambio' }, h('strong', {}, 'Cambio acordado: '), c.cambio)
        : null,
      abierto
        ? hilo
          ? h(
              'ol',
              { class: 'rv-hilo', 'aria-label': `Conversación de la observación ${c.numero}` },
              hilo.map((r) => mensaje(r)),
            )
          : h('p', { class: 'rv-ayuda' }, 'Cargando conversación…')
        : null,
      borrador ? formularioRespuesta(c, borrador) : null,
      botonHilo || botonResponder ? h('div', { class: 'rv-fila rv-fila--separada' }, botonHilo, botonResponder) : null,
    );
  }

  function mensaje(r: Respuesta): HTMLElement {
    const propio = r.rol === estado.rol;
    return h(
      'li',
      { class: `rv-mensaje rv-mensaje--${r.rol}${propio ? ' rv-mensaje--propio' : ''}` },
      h(
        'p',
        { class: 'rv-mensaje__autor' },
        h('strong', {}, `${ROLES[r.rol]} · ${r.autor || 'sin nombre'}`),
        ` · ${formatearFecha(r.fecha)}`,
      ),
      r.decision
        ? h('p', { class: 'rv-mensaje__decision' }, 'Decisión: ', chip(DECISIONES[r.decision].nombre, `rv-chip--estado rv-chip--${r.decision}`))
        : null,
      r.texto ? h('p', { class: 'rv-comentario__texto' }, r.texto) : null,
      r.cambio ? h('p', { class: 'rv-mensaje__cambio' }, h('strong', {}, 'Cambio acordado: '), r.cambio) : null,
    );
  }

  async function alternarHilo(numero: number, forzarAbierto = false): Promise<void> {
    if (estado.hilosAbiertos.has(numero) && !forzarAbierto) {
      estado.hilosAbiertos.delete(numero);
      pintarPanel();
      return;
    }
    estado.hilosAbiertos.add(numero);
    pintarPanel();
    try {
      estado.hilos.set(numero, await api.respuestas(numero));
    } catch (e) {
      estado.hilosAbiertos.delete(numero);
      manejarError(e);
    }
    pintarPanel();
  }

  function formularioRespuesta(c: Comentario, b: BorradorRespuesta): HTMLElement {
    const equipo = estado.rol === 'equipo';
    const idTexto = `rv-resp-${c.numero}`;
    const idCambio = `rv-cambio-${c.numero}`;

    const campoCambio =
      equipo && b.decision === 'aceptada'
        ? h(
            'div',
            {},
            h('label', { class: 'rv-etiqueta', for: idCambio }, 'Cambio acordado'),
            h('p', { class: 'rv-ayuda' }, 'Instrucción concreta: es lo que va al consolidado para Claude Code.'),
            h('textarea', {
              id: idCambio,
              class: 'rv-input rv-input--corto',
              rows: 3,
              maxlength: LIMITES.cambio,
              value: b.cambio,
              placeholder: 'Ej.: Cambiar el valor de Novice a $45.000 en el JSON de contenido.',
              oninput: (e: Event) => (b.cambio = (e.target as HTMLTextAreaElement).value),
            }),
          )
        : null;

    const decisiones = equipo
      ? h(
          'fieldset',
          { class: 'rv-opciones' },
          h('legend', { class: 'rv-etiqueta' }, 'Decisión'),
          h(
            'div',
            { class: 'rv-opciones__lista' },
            [['', 'Solo responder'] as const, ...Object.entries(DECISIONES).map(([id, d]) => [id, d.nombre] as const)].map(
              ([id, nombre]) =>
                h(
                  'label',
                  { class: `rv-opcion rv-opcion--${id || 'ninguna'}` },
                  h('input', {
                    type: 'radio',
                    name: `rv-decision-${c.numero}`,
                    value: id,
                    checked: (b.decision ?? '') === id,
                    onchange: () => {
                      b.decision = (id || null) as IdDecision | null;
                      pintarPanel();
                      document.getElementById(b.decision === 'aceptada' ? idCambio : idTexto)?.focus();
                    },
                  }),
                  h('span', {}, nombre),
                ),
            ),
          ),
          b.decision ? h('p', { class: 'rv-ayuda' }, DECISIONES[b.decision].ayuda) : null,
        )
      : null;

    const etiquetaTexto = !equipo
      ? 'Tu respuesta'
      : b.decision === 'aclaracion'
        ? 'Pregunta para el club'
        : b.decision === 'rechazada' || b.decision === 'pospuesta'
          ? 'Motivo para el club'
          : 'Respuesta para el club';

    return h(
      'form',
      {
        class: 'rv-respuesta-form',
        novalidate: true,
        onsubmit: (e: Event) => {
          e.preventDefault();
          void enviarRespuesta(c, b);
        },
      },
      decisiones,
      campoCambio,
      h(
        'div',
        {},
        h('label', { class: 'rv-etiqueta', for: idTexto }, etiquetaTexto),
        h('textarea', {
          id: idTexto,
          class: 'rv-input rv-input--corto',
          rows: 3,
          maxlength: LIMITES.respuesta,
          value: b.texto,
          oninput: (e: Event) => (b.texto = (e.target as HTMLTextAreaElement).value),
        }),
      ),
      h(
        'div',
        { class: 'rv-fila' },
        h(
          'button',
          {
            type: 'button',
            class: 'rv-boton rv-boton--claro',
            onclick: () => {
              estado.respuestas.delete(c.numero);
              pintarPanel();
            },
          },
          'Cancelar',
        ),
        h(
          'button',
          { type: 'submit', class: 'rv-boton rv-boton--principal', disabled: estado.enviando },
          estado.enviando ? 'Enviando…' : 'Enviar respuesta',
        ),
      ),
    );
  }

  async function enviarRespuesta(c: Comentario, b: BorradorRespuesta): Promise<void> {
    if (!exigirNombre()) return;
    if (b.decision === 'aceptada' && b.cambio.trim().length < 3) {
      avisar('Describe el cambio acordado antes de aceptar.', 'error');
      document.getElementById(`rv-cambio-${c.numero}`)?.focus();
      return;
    }
    if (!b.texto.trim() && (!b.decision || b.decision === 'aclaracion' || b.decision === 'rechazada' || b.decision === 'pospuesta')) {
      avisar(b.decision === 'aclaracion' ? 'Escribe la pregunta para el club.' : b.decision ? 'Explica el motivo al club.' : 'Escribe una respuesta.', 'error');
      document.getElementById(`rv-resp-${c.numero}`)?.focus();
      return;
    }
    estado.enviando = true;
    pintarPanel();
    try {
      const actualizado = await api.responder(c.numero, {
        ronda: RONDA_ACTUAL,
        autor: estado.nombre,
        texto: b.texto,
        ...(b.decision ? { decision: b.decision } : {}),
        ...(b.decision === 'aceptada' ? { cambio: b.cambio } : {}),
      });
      reemplazarComentario(actualizado);
      estado.respuestas.delete(c.numero);
      estado.hilosAbiertos.add(c.numero);
      estado.hilos.set(c.numero, await api.respuestas(c.numero));
      avisar(b.decision ? `#${c.numero}: ${DECISIONES[b.decision].nombre}.` : `Respuesta enviada en #${c.numero}.`);
    } catch (e) {
      manejarError(e);
    } finally {
      estado.enviando = false;
      pintarTodo();
    }
  }

  /* ── Formulario de nueva observación (club) ───────────────────────── */

  function grupoOpciones<T extends string>(
    nombre: string,
    leyenda: string,
    opciones: Record<T, { nombre: string; ayuda: string }>,
    actual: T | null,
    alCambiar: (valor: T) => void,
  ): HTMLElement {
    const ayuda = h('p', { class: 'rv-ayuda', id: `rv-ayuda-${nombre}` }, actual ? opciones[actual].ayuda : '');
    return h(
      'fieldset',
      { class: 'rv-opciones' },
      h('legend', { class: 'rv-etiqueta' }, leyenda),
      h(
        'div',
        { class: 'rv-opciones__lista' },
        (Object.keys(opciones) as T[]).map((id) =>
          h(
            'label',
            { class: `rv-opcion rv-opcion--${id}` },
            h('input', {
              type: 'radio',
              name: `rv-${nombre}`,
              value: id,
              checked: actual === id,
              'aria-describedby': `rv-ayuda-${nombre}`,
              onchange: () => {
                alCambiar(id);
                ayuda.textContent = opciones[id].ayuda;
              },
            }),
            h('span', {}, opciones[id].nombre),
          ),
        ),
      ),
      ayuda,
    );
  }

  function formulario(s: SeccionRevision): HTMLElement {
    const b = estado.borrador;
    const contador = h('span', { class: 'rv-contador' }, `${b.texto.length}/${LIMITES.comentario}`);
    const texto = h('textarea', {
      id: 'rv-texto',
      class: 'rv-input',
      rows: 4,
      maxlength: LIMITES.comentario,
      placeholder: 'Qué ves, qué cambiarías y por qué. Un tema por observación.',
      value: b.texto,
      oninput: (e: Event) => {
        b.texto = (e.target as HTMLTextAreaElement).value;
        contador.textContent = `${b.texto.length}/${LIMITES.comentario}`;
      },
    });

    const elemento = b.elemento
      ? h(
          'div',
          { class: 'rv-elemento' },
          h('span', {}, b.elemento),
          h(
            'button',
            {
              type: 'button',
              class: 'rv-enlace',
              onclick: () => {
                b.elemento = null;
                pintarPanel();
              },
            },
            'Quitar',
          ),
        )
      : null;

    return h(
      'form',
      {
        class: 'rv-bloque rv-formulario',
        novalidate: true,
        onsubmit: (e: Event) => {
          e.preventDefault();
          void enviarObservacion(s);
        },
      },
      h('h3', { class: 'rv-subtitulo' }, 'Nueva observación'),
      grupoOpciones('tipo', 'Tipo', TIPOS, b.tipo, (v) => (b.tipo = v)),
      grupoOpciones('prioridad', 'Prioridad', PRIORIDADES, b.prioridad, (v) => (b.prioridad = v)),
      h(
        'div',
        {},
        h('div', { class: 'rv-fila rv-fila--separada' }, h('label', { class: 'rv-etiqueta', for: 'rv-texto' }, 'Observación'), contador),
        texto,
      ),
      h(
        'div',
        { class: 'rv-fila rv-fila--separada' },
        h(
          'button',
          { type: 'button', class: 'rv-boton rv-boton--claro', onclick: () => void senalarElemento() },
          icono(ICONOS.mira),
          b.elemento ? 'Señalar otro elemento' : 'Señalar en la página',
        ),
        h('span', { class: 'rv-ayuda' }, dispositivo()),
      ),
      elemento,
      h(
        'button',
        { type: 'submit', class: 'rv-boton rv-boton--principal', disabled: estado.enviando },
        estado.enviando ? 'Enviando…' : 'Enviar observación',
      ),
    );
  }

  async function senalarElemento(): Promise<void> {
    panel.hidden = true;
    dock.hidden = true;
    const el = await senalar(esUi);
    panel.hidden = false;
    dock.hidden = false;
    if (el) {
      estado.borrador.elemento = describirElemento(el);
      // La sección pasa a ser la que contiene el elemento señalado.
      const contenedora = SECCIONES.find((s) => s.selector && el.closest(s.selector));
      if (contenedora) estado.seccionPanel = contenedora.id;
    }
    pintarPanel();
    ubicar();
    document.getElementById('rv-texto')?.focus();
  }

  async function enviarObservacion(s: SeccionRevision): Promise<void> {
    const b = estado.borrador;
    if (!exigirNombre()) return;
    if (!b.tipo || !b.prioridad) {
      avisar('Elige el tipo y la prioridad de la observación.', 'error');
      return;
    }
    if (b.texto.trim().length < 3) {
      avisar('Escribe la observación antes de enviarla.', 'error');
      document.getElementById('rv-texto')?.focus();
      return;
    }
    estado.enviando = true;
    pintarPanel();
    try {
      const url = new URL(location.pathname, location.origin);
      const el = elementoDe(s);
      if (el?.id) url.hash = el.id;
      const nueva = await api.comentar({
        ronda: RONDA_ACTUAL,
        seccion: s.id,
        tipo: b.tipo,
        prioridad: b.prioridad,
        comentario: b.texto,
        revisor: estado.nombre,
        dispositivo: dispositivo(),
        ...(b.elemento ? { elemento: b.elemento } : {}),
        url: url.href,
        version,
      });
      reemplazarComentario(nueva);
      estado.borrador = borradorVacio();
      avisar(`Observación #${nueva.numero} guardada en ${nombreSeccion(s)}.`);
    } catch (e) {
      manejarError(e);
    } finally {
      estado.enviando = false;
      pintarTodo();
    }
  }

  async function guardarVeredicto(s: SeccionRevision, id: IdEstadoSeccion, nota: string): Promise<void> {
    if (!exigirNombre()) return;
    estado.enviando = true;
    pintarPanel();
    try {
      const registro = await api.veredicto({ ronda: RONDA_ACTUAL, seccion: s.id, estado: id, revisor: estado.nombre, nota });
      if (estado.datos) estado.datos.secciones[s.id] = registro;
      avisar(`${nombreSeccion(s)}: ${ESTADOS_SECCION[id].nombre}.`);
    } catch (e) {
      manejarError(e);
    } finally {
      estado.enviando = false;
      pintarTodo();
    }
  }

  /* ── Piezas compartidas de resumen ────────────────────────────────── */

  function cifras(): HTMLElement {
    const lista = comentarios();
    const conVeredicto = SECCIONES.filter((s) => estado.datos?.secciones[s.id]).length;
    const porEstado = (Object.keys(ESTADOS_COMENTARIO) as Array<keyof typeof ESTADOS_COMENTARIO>)
      .map((k) => [k, lista.filter((c) => c.estado === k).length] as const)
      .filter(([, n]) => n > 0);
    return h(
      'div',
      { class: 'rv-bloque' },
      h(
        'div',
        { class: 'rv-cifras' },
        h('div', { class: 'rv-cifra' }, h('strong', {}, `${conVeredicto}/${SECCIONES.length}`), h('span', {}, 'secciones con veredicto')),
        h('div', { class: 'rv-cifra' }, h('strong', {}, lista.length), h('span', {}, 'observaciones')),
      ),
      porEstado.length
        ? h('div', { class: 'rv-chips' }, porEstado.map(([k, n]) => chip(`${ESTADOS_COMENTARIO[k].nombre}: ${n}`, `rv-chip--estado rv-chip--${k}`)))
        : null,
    );
  }

  function listaSecciones(): HTMLElement {
    return h(
      'ul',
      { class: 'rv-resumen' },
      SECCIONES.map((s) => {
        const veredicto = estado.datos?.secciones[s.id]?.estado ?? 'sin-revisar';
        const n = comentariosDe(s.id).length;
        return h(
          'li',
          {},
          h(
            'button',
            {
              type: 'button',
              class: 'rv-resumen__fila',
              onclick: () => {
                const el = elementoDe(s);
                if (el && !esFijo(el)) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                abrirPanel(s.id, 'seccion');
              },
            },
            h('span', { class: `rv-punto rv-punto--${veredicto}`, 'aria-hidden': 'true' }),
            h('span', { class: 'rv-resumen__nombre' }, nombreSeccion(s)),
            h('span', { class: 'rv-resumen__estado' }, ESTADOS_SECCION[veredicto].nombre),
            h('span', { class: 'rv-resumen__n', 'aria-label': plural(n, 'observación', 'observaciones') }, n),
          ),
        );
      }),
    );
  }

  /* ── Vista: resumen (club) ────────────────────────────────────────── */

  function vistaResumen(): HTMLElement[] {
    const datos = estado.datos;
    const conVeredicto = SECCIONES.filter((s) => datos?.secciones[s.id]).length;

    const entrega = datos?.entregada
      ? h(
          'div',
          { class: 'rv-bloque rv-bloque--ok' },
          h('h3', { class: 'rv-subtitulo' }, 'Revisión entregada'),
          h('p', {}, `${datos.entregada.revisor} entregó la revisión de la ronda ${RONDA_ACTUAL} · ${formatearFecha(datos.entregada.fecha)}`),
          h('p', { class: 'rv-ayuda' }, 'Puedes seguir respondiendo y agregando observaciones; quedan registradas en esta misma ronda.'),
        )
      : bloqueEntrega(conVeredicto);

    return [
      campoNombre(),
      cifras(),
      ...bloqueObservaciones(),
      h('h3', { class: 'rv-subtitulo' }, 'Secciones'),
      listaSecciones(),
      entrega,
      pie(),
    ];
  }

  function bloqueEntrega(conVeredicto: number): HTMLElement {
    const mensajeFinal = h('textarea', {
      class: 'rv-input rv-input--corto',
      rows: 3,
      maxlength: LIMITES.nota,
      placeholder: 'Mensaje final para el equipo de desarrollo (opcional)',
      'aria-label': 'Mensaje final',
    });
    const faltan = SECCIONES.length - conVeredicto;
    const boton = h(
      'button',
      {
        type: 'button',
        class: 'rv-boton rv-boton--principal',
        disabled: estado.enviando,
        onclick: () => {
          if (!exigirNombre()) return;
          if (!estado.confirmandoEntrega) {
            estado.confirmandoEntrega = true;
            boton.textContent = 'Confirmar entrega';
            return;
          }
          void entregar(mensajeFinal.value);
        },
      },
      estado.confirmandoEntrega ? 'Confirmar entrega' : `Entregar revisión de la ronda ${RONDA_ACTUAL}`,
    );
    return h(
      'div',
      { class: 'rv-bloque rv-bloque--destacado' },
      h('h3', { class: 'rv-subtitulo' }, 'Entregar la revisión'),
      h(
        'p',
        { class: 'rv-ayuda' },
        faltan > 0
          ? `Quedan ${faltan} secciones sin veredicto. Entrega cuando hayas recorrido todo el sitio: así se cierra la ronda y comienzan los ajustes.`
          : 'Todas las secciones tienen veredicto. Al entregar, se cierra la ronda y comienzan los ajustes.',
      ),
      mensajeFinal,
      boton,
    );
  }

  async function entregar(mensajeFinal: string): Promise<void> {
    estado.enviando = true;
    pintarPanel();
    try {
      const entrega = await api.entregar({ ronda: RONDA_ACTUAL, revisor: estado.nombre, mensaje: mensajeFinal });
      if (estado.datos) estado.datos.entregada = entrega;
      avisar('Revisión entregada. ¡Gracias!');
    } catch (e) {
      manejarError(e);
    } finally {
      estado.enviando = false;
      estado.confirmandoEntrega = false;
      pintarTodo();
    }
  }

  /* ── Vista: bandeja (equipo) ──────────────────────────────────────── */

  function filtros(): Record<Filtro, { nombre: string; incluye: (c: Comentario) => boolean }> {
    const rol = estado.rol ?? 'cliente';
    const otro = rol === 'cliente' ? 'equipo' : 'cliente';
    return {
      'por-responder': { nombre: rol === 'equipo' ? 'Por responder' : 'Esperan tu respuesta', incluye: (c) => c.turno === rol },
      'esperando-otro': { nombre: otro === 'equipo' ? 'Esperando al equipo' : 'Esperando al club', incluye: (c) => c.turno === otro },
      aceptada: { nombre: 'Aceptadas', incluye: (c) => c.estado === 'aceptada' },
      pospuesta: { nombre: 'Pospuestas', incluye: (c) => c.estado === 'pospuesta' },
      cerradas: { nombre: 'Cerradas', incluye: (c) => c.estado === 'implementada' || c.estado === 'rechazada' },
      todas: { nombre: 'Todas', incluye: () => true },
    };
  }

  /** Filtros + listado de observaciones de toda la ronda. */
  function bloqueObservaciones(): HTMLElement[] {
    const lista = comentarios();
    const opciones = filtros();
    const orden = (c: Comentario) => SECCIONES.findIndex((s) => s.id === c.seccion);
    const filtradas = lista.filter(opciones[estado.filtro].incluye).sort((a, b) => orden(a) - orden(b) || a.numero - b.numero);
    return [
      h('h3', { class: 'rv-subtitulo' }, 'Observaciones de la ronda'),
      h(
        'div',
        { class: 'rv-filtros', role: 'group', 'aria-label': 'Filtrar observaciones' },
        (Object.keys(opciones) as Filtro[]).map((id) =>
          h(
            'button',
            {
              type: 'button',
              class: 'rv-filtro',
              'aria-pressed': String(estado.filtro === id),
              onclick: () => {
                estado.filtro = id;
                pintarPanel();
              },
            },
            `${opciones[id].nombre} (${lista.filter(opciones[id].incluye).length})`,
          ),
        ),
      ),
      filtradas.length
        ? h('ol', { class: 'rv-comentarios' }, filtradas.map((c) => tarjeta(c, true)))
        : h('p', { class: 'rv-ayuda' }, 'No hay observaciones en este filtro.'),
    ];
  }

  function vistaBandeja(): HTMLElement[] {
    const entregada = estado.datos?.entregada;
    return [
      campoNombre(),
      entregada
        ? h(
            'div',
            { class: 'rv-bloque rv-bloque--ok' },
            h('p', {}, h('strong', {}, 'Revisión entregada'), ` por ${entregada.revisor} · ${formatearFecha(entregada.fecha)}`),
            entregada.mensaje ? h('p', { class: 'rv-ayuda' }, `«${entregada.mensaje}»`) : null,
          )
        : h('p', { class: 'rv-ayuda' }, 'El club aún no entrega su revisión de esta ronda.'),
      cifras(),
      ...bloqueObservaciones(),
      h('h3', { class: 'rv-subtitulo' }, 'Veredictos del club por sección'),
      listaSecciones(),
      pie(),
    ];
  }

  /* ── Vista: consolidado (equipo) ──────────────────────────────────── */

  function vistaConsolidado(): HTMLElement[] {
    const lista = aceptadas(comentarios());
    const texto = generarConsolidado(comentarios(), RONDA_ACTUAL, version);
    const implementadas = comentarios().filter((c) => c.estado === 'implementada').length;

    const copiar = async () => {
      try {
        await navigator.clipboard.writeText(texto);
      } catch {
        const area = h('textarea', { class: 'rv-oculto', value: texto });
        document.body.append(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      avisar('Consolidado copiado. Pégalo en Claude Code.');
    };
    const descargar = () => {
      const enlace = h('a', {
        href: URL.createObjectURL(new Blob([texto], { type: 'text/markdown;charset=utf-8' })),
        download: `cambios-ronda-${RONDA_ACTUAL}.md`,
      });
      document.body.append(enlace);
      enlace.click();
      enlace.remove();
    };

    return [
      h(
        'div',
        { class: 'rv-bloque' },
        h(
          'p',
          { class: 'rv-ayuda' },
          `${plural(lista.length, 'cambio aceptado', 'cambios aceptados')} por implementar · ${plural(implementadas, 'implementado', 'implementados')}. ` +
            'Solo entran las observaciones aceptadas, con su cambio acordado. Cuando Claude Code cierra cada issue, la observación pasa a «Implementada» y sale de esta lista.',
        ),
        h(
          'div',
          { class: 'rv-fila' },
          h('button', { type: 'button', class: 'rv-boton rv-boton--principal', disabled: !lista.length, onclick: () => void copiar() }, 'Copiar para Claude Code'),
          h('button', { type: 'button', class: 'rv-boton rv-boton--claro', disabled: !lista.length, onclick: descargar }, 'Descargar .md'),
        ),
      ),
      h('pre', { class: 'rv-md', tabindex: '0', 'aria-label': 'Vista previa del consolidado' }, texto),
      pie(),
    ];
  }

  /* ── Salir ────────────────────────────────────────────────────────── */

  function salir(): void {
    guardarLocal(CLAVE_ACCESO, null);
    location.href = `${location.pathname}?revision=salir${location.hash}`;
  }

  // Al volver a la pestaña se actualiza: el otro rol pudo haber respondido.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && estado.rol && !estado.enviando) void cargar();
  });

  pintarDock();
  ubicar();
  void cargar();
}
