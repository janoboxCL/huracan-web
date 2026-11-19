/* Modo revisión del cliente.
   Se carga solo cuando la página se abre con ?revision=<clave> (ver
   components/revision/ActivadorRevision.astro). Agrega sobre el sitio real:
   - una barra inferior con la sección que se está mirando,
   - un marcador «Comentar» al inicio de cada sección,
   - un panel con preguntas guía, veredicto de la sección, comentarios de la
     ronda con su estado de atención, y el formulario para comentar,
   - una vista de resumen para entregar la revisión de la ronda.
   Todo lo que se guarda va a GitHub Issues a través de /api/revision/*. */

import estilos from './revision.css?inline';
import { crearApi, ErrorApi, type Api } from './api';
import { formatearFecha, h, icono, ICONOS } from './dom';
import { describirElemento, senalar } from './senalar';
import {
  ESTADOS_COMENTARIO,
  ESTADOS_SECCION,
  LIMITES,
  PRIORIDADES,
  RONDA_ACTUAL,
  SECCIONES,
  TIPOS,
  buscarSeccion,
  nombreSeccion,
  type Comentario,
  type EstadoRonda,
  type IdEstadoSeccion,
  type IdPrioridad,
  type IdTipo,
  type SeccionRevision,
} from '../data/revision';

const CLAVE_REVISOR = 'huracan-revision-revisor';
const CLAVE_ACCESO = 'huracan-revision';

interface Borrador {
  tipo: IdTipo | null;
  prioridad: IdPrioridad | null;
  texto: string;
  elemento: string | null;
}

interface Estado {
  datos: EstadoRonda | null;
  revisor: string;
  seccionActual: string;
  seccionPanel: string;
  panelAbierto: boolean;
  vista: 'seccion' | 'resumen';
  borrador: Borrador;
  enviando: boolean;
  confirmandoEntrega: boolean;
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

export function iniciar(clave: string): void {
  const api: Api = crearApi(clave);
  const estado: Estado = {
    datos: null,
    revisor: leerLocal(CLAVE_REVISOR),
    seccionActual: 'general',
    seccionPanel: 'general',
    panelAbierto: false,
    vista: 'seccion',
    borrador: borradorVacio(),
    enviando: false,
    confirmandoEntrega: false,
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

  const dockSeccion = h('span', { class: 'rv-dock__seccion' }, 'Cargando…');
  const dockProgreso = h('span', { class: 'rv-dock__progreso' });
  const dock = h(
    'div',
    { class: 'rv-raiz rv-dock', role: 'region', 'aria-label': 'Modo revisión' },
    h('span', { class: 'rv-dock__marca' }, h('strong', {}, 'Revisión'), ` · Ronda ${RONDA_ACTUAL}`),
    h(
      'button',
      { type: 'button', class: 'rv-dock__comentar', onclick: () => abrirPanel(estado.seccionActual, 'seccion') },
      icono(ICONOS.globo),
      h('span', { class: 'rv-dock__accion' }, 'Comentar'),
      dockSeccion,
    ),
    h(
      'button',
      { type: 'button', class: 'rv-dock__boton', onclick: () => abrirPanel(estado.seccionPanel, 'resumen') },
      icono(ICONOS.lista),
      h('span', { class: 'rv-ocultar-movil' }, 'Resumen '),
      dockProgreso,
    ),
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
      { type: 'button', class: 'rv-dock__boton', 'aria-label': 'Salir del modo revisión', title: 'Salir del modo revisión', onclick: salir },
      icono(ICONOS.salir),
    ),
  );

  const panelTitulo = h('h2', { id: 'rv-panel-titulo', class: 'rv-panel__titulo' });
  const panelCuerpo = h('div', { class: 'rv-panel__cuerpo' });
  const selectorSeccion = h(
    'select',
    {
      class: 'rv-select',
      'aria-label': 'Cambiar de sección',
      onchange: (e: Event) => {
        const id = (e.target as HTMLSelectElement).value;
        abrirPanel(id, 'seccion', true);
      },
    },
    SECCIONES.map((s) => h('option', { value: s.id }, nombreSeccion(s))),
  );
  const pestanaSeccion = h('button', { type: 'button', class: 'rv-pestana', onclick: () => cambiarVista('seccion') }, 'Sección');
  const pestanaResumen = h('button', { type: 'button', class: 'rv-pestana', onclick: () => cambiarVista('resumen') }, 'Resumen de la ronda');
  const panel = h(
    'aside',
    { class: 'rv-raiz rv-panel', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'rv-panel-titulo', hidden: true },
    h(
      'div',
      { class: 'rv-panel__cab' },
      h(
        'div',
        { class: 'rv-panel__fila' },
        h('p', { class: 'rv-panel__antetitulo' }, `Revisión del sitio · Ronda ${RONDA_ACTUAL}`),
        h(
          'button',
          { type: 'button', class: 'rv-icono-boton', 'aria-label': 'Cerrar panel', onclick: cerrarPanel },
          icono(ICONOS.cerrar),
        ),
      ),
      panelTitulo,
      h('div', { class: 'rv-pestanas', role: 'group', 'aria-label': 'Vista' }, pestanaSeccion, pestanaResumen),
    ),
    panelCuerpo,
  );

  document.body.append(capa, panel, dock, aviso);

  const esUi = (el: Element) => Boolean(el.closest('.rv-raiz'));

  /* ── Avisos ───────────────────────────────────────────────────────── */

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

  /* ── Marcadores sobre la página ───────────────────────────────────── */

  const marcadores = new Map<string, HTMLButtonElement>();
  for (const s of SECCIONES) {
    if (!s.marcador || !elementoDe(s)) continue;
    const boton = h('button', {
      type: 'button',
      class: 'rv-marca',
      onclick: () => abrirPanel(s.id, 'seccion'),
    });
    marcadores.set(s.id, boton);
    capa.append(boton);
  }

  function pintarMarcadores(): void {
    for (const [id, boton] of marcadores) {
      const s = buscarSeccion(id)!;
      const n = comentariosDe(id).length;
      const veredicto = estado.datos?.secciones[id]?.estado ?? 'sin-revisar';
      boton.replaceChildren(
        h('span', { class: `rv-punto rv-punto--${veredicto}`, 'aria-hidden': 'true' }),
        icono(ICONOS.globo),
        h('span', {}, s.numero === '—' ? s.nombre : `${s.numero} ${s.nombre}`),
        ...(n > 0 ? [h('span', { class: 'rv-marca__n' }, n)] : []),
      );
      boton.setAttribute(
        'aria-label',
        `Comentar la sección ${nombreSeccion(s)}. ${n} comentario${n === 1 ? '' : 's'}. ${ESTADOS_SECCION[veredicto].nombre}.`,
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
        const fijo = getComputedStyle(el).position === 'fixed';
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
    if (el && getComputedStyle(el).position !== 'fixed') observador.observe(el);
  }

  /* ── Datos ────────────────────────────────────────────────────────── */

  function comentariosDe(seccion: string): Comentario[] {
    return estado.datos?.comentarios.filter((c) => c.seccion === seccion) ?? [];
  }

  async function cargar(): Promise<void> {
    try {
      estado.datos = await api.estado();
      pintarTodo();
    } catch (e) {
      manejarError(e);
    }
  }

  function pintarDock(): void {
    const s = buscarSeccion(estado.seccionActual)!;
    dockSeccion.textContent = nombreSeccion(s);
    const total = SECCIONES.length;
    const conVeredicto = SECCIONES.filter((x) => estado.datos?.secciones[x.id]).length;
    dockProgreso.textContent = `${conVeredicto}/${total}`;
    dockProgreso.setAttribute('title', `${conVeredicto} de ${total} secciones con veredicto`);
  }

  function pintarTodo(): void {
    pintarDock();
    pintarMarcadores();
    if (estado.panelAbierto) pintarPanel();
    ubicar();
  }

  /* ── Panel ────────────────────────────────────────────────────────── */

  function abrirPanel(id: string, vista: Estado['vista'], mantenerFoco = false): void {
    if (estado.seccionPanel !== id) estado.borrador.elemento = null;
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
    dock.querySelector<HTMLButtonElement>('.rv-dock__comentar')?.focus();
  }

  function cambiarVista(vista: Estado['vista']): void {
    estado.vista = vista;
    estado.confirmandoEntrega = false;
    pintarPanel();
    ubicar();
  }

  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarPanel();
  });
  panelTitulo.tabIndex = -1;

  let vistaPintada = '';
  function pintarPanel(): void {
    const s = buscarSeccion(estado.seccionPanel)!;
    const enSeccion = estado.vista === 'seccion';
    // Al cambiar de sección o de vista el panel vuelve arriba; al guardar, se queda donde estaba.
    const clave = `${estado.vista}:${s.id}`;
    const desplazamiento = clave === vistaPintada ? panelCuerpo.scrollTop : 0;
    vistaPintada = clave;
    panelTitulo.textContent = enSeccion ? nombreSeccion(s) : 'Resumen de la ronda';
    selectorSeccion.value = s.id;
    pestanaSeccion.setAttribute('aria-pressed', String(enSeccion));
    pestanaResumen.setAttribute('aria-pressed', String(!enSeccion));
    panelCuerpo.replaceChildren(...(enSeccion ? vistaSeccion(s) : vistaResumen()));
    panelCuerpo.scrollTop = desplazamiento;
  }

  function campoRevisor(): HTMLElement {
    if (estado.revisor) {
      return h(
        'p',
        { class: 'rv-revisor' },
        'Revisas como ',
        h('strong', {}, estado.revisor),
        ' · ',
        h(
          'button',
          {
            type: 'button',
            class: 'rv-enlace',
            onclick: () => {
              estado.revisor = '';
              guardarLocal(CLAVE_REVISOR, null);
              pintarPanel();
            },
          },
          'cambiar',
        ),
      );
    }
    const entrada = h('input', {
      id: 'rv-revisor',
      class: 'rv-input',
      type: 'text',
      maxlength: LIMITES.revisor,
      autocomplete: 'name',
      placeholder: 'Nombre y cargo, p. ej. Ana Pérez, directora',
    });
    return h(
      'div',
      { class: 'rv-bloque rv-bloque--destacado' },
      h('label', { class: 'rv-etiqueta', for: 'rv-revisor' }, '¿Quién revisa?'),
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
              estado.revisor = valor;
              guardarLocal(CLAVE_REVISOR, valor);
              pintarPanel();
            },
          },
          'Guardar',
        ),
      ),
      h('p', { class: 'rv-ayuda' }, 'Queda registrado en cada comentario.'),
    );
  }

  function exigirRevisor(): boolean {
    if (estado.revisor) return true;
    avisar('Antes de guardar, indica quién revisa.', 'error');
    document.getElementById('rv-revisor')?.focus();
    return false;
  }

  function vistaSeccion(s: SeccionRevision): HTMLElement[] {
    const el = elementoDe(s);
    const comentarios = comentariosDe(s.id);
    const registro = estado.datos?.secciones[s.id];

    const navegacion = h(
      'div',
      { class: 'rv-fila rv-fila--separada' },
      selectorSeccion,
      el && getComputedStyle(el).position !== 'fixed'
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

    // Veredicto de la sección
    const nota = h('textarea', {
      class: 'rv-input rv-input--corto',
      rows: 2,
      maxlength: LIMITES.nota,
      placeholder: 'Nota para el veredicto (opcional)',
      'aria-label': 'Nota para el veredicto',
    });
    const botonesVeredicto = (['aprobada', 'aprobada-con-cambios', 'rehacer'] as const).map((id) =>
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
    );
    const veredicto = h(
      'div',
      { class: 'rv-bloque' },
      h('h3', { class: 'rv-subtitulo' }, 'Veredicto de la sección'),
      h('div', { class: 'rv-veredictos', role: 'group', 'aria-label': 'Veredicto' }, botonesVeredicto),
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

    const lista = h(
      'div',
      { class: 'rv-bloque' },
      h('h3', { class: 'rv-subtitulo' }, `Comentarios de esta ronda (${comentarios.length})`),
      comentarios.length
        ? h('ol', { class: 'rv-comentarios' }, comentarios.slice().reverse().map(tarjetaComentario))
        : h('p', { class: 'rv-ayuda' }, 'Todavía no hay comentarios en esta sección.'),
    );

    return [navegacion, campoRevisor(), preguntas, formulario(s), lista, veredicto, pie()];
  }

  function pie(): HTMLElement {
    return h('p', { class: 'rv-pie' }, `Versión revisada: ${version}`);
  }

  function chip(texto: string, clase: string): HTMLElement {
    return h('span', { class: `rv-chip ${clase}` }, texto);
  }

  function tarjetaComentario(c: Comentario): HTMLElement {
    const contenedorRespuestas = h('div', { class: 'rv-respuestas' });
    return h(
      'li',
      { class: `rv-comentario rv-comentario--${c.estado}` },
      h(
        'div',
        { class: 'rv-chips' },
        c.tipo ? chip(TIPOS[c.tipo].nombre, `rv-chip--${c.tipo}`) : null,
        c.prioridad ? chip(PRIORIDADES[c.prioridad].nombre, 'rv-chip--prioridad') : null,
        chip(ESTADOS_COMENTARIO[c.estado].nombre, `rv-chip--estado rv-chip--${c.estado}`),
      ),
      h('p', { class: 'rv-comentario__texto' }, c.comentario),
      c.elemento ? h('p', { class: 'rv-comentario__elemento' }, 'Señalado: ', c.elemento) : null,
      h('p', { class: 'rv-comentario__meta' }, `#${c.numero} · ${c.revisor} · ${formatearFecha(c.fecha)}`),
      c.respuestas > 0
        ? h(
            'button',
            {
              type: 'button',
              class: 'rv-enlace',
              'aria-expanded': 'false',
              onclick: async (e: Event) => {
                const boton = e.currentTarget as HTMLButtonElement;
                if (boton.getAttribute('aria-expanded') === 'true') {
                  boton.setAttribute('aria-expanded', 'false');
                  contenedorRespuestas.replaceChildren();
                  return;
                }
                boton.disabled = true;
                try {
                  const respuestas = await api.respuestas(c.numero);
                  contenedorRespuestas.replaceChildren(
                    ...respuestas.map((r) =>
                      h(
                        'div',
                        { class: 'rv-respuesta' },
                        h('p', { class: 'rv-comentario__meta' }, `Respuesta · ${formatearFecha(r.fecha)}`),
                        h('p', { class: 'rv-comentario__texto' }, r.texto),
                      ),
                    ),
                  );
                  boton.setAttribute('aria-expanded', 'true');
                } catch (err) {
                  manejarError(err);
                } finally {
                  boton.disabled = false;
                }
              },
            },
            `Ver respuestas (${c.respuestas})`,
          )
        : null,
      contenedorRespuestas,
    );
  }

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
      placeholder: 'Qué ves, qué cambiarías y por qué. Un tema por comentario.',
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

    const enviar = h(
      'button',
      { type: 'submit', class: 'rv-boton rv-boton--principal', disabled: estado.enviando },
      estado.enviando ? 'Enviando…' : 'Enviar comentario',
    );

    return h(
      'form',
      {
        class: 'rv-bloque rv-formulario',
        novalidate: true,
        onsubmit: (e: Event) => {
          e.preventDefault();
          void enviarComentario(s);
        },
      },
      h('h3', { class: 'rv-subtitulo' }, 'Nuevo comentario'),
      grupoOpciones('tipo', 'Tipo', TIPOS, b.tipo, (v) => (b.tipo = v)),
      grupoOpciones('prioridad', 'Prioridad', PRIORIDADES, b.prioridad, (v) => (b.prioridad = v)),
      h(
        'div',
        {},
        h('div', { class: 'rv-fila rv-fila--separada' }, h('label', { class: 'rv-etiqueta', for: 'rv-texto' }, 'Comentario'), contador),
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
      enviar,
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

  async function enviarComentario(s: SeccionRevision): Promise<void> {
    const b = estado.borrador;
    if (!exigirRevisor()) return;
    if (!b.tipo || !b.prioridad) {
      avisar('Elige el tipo y la prioridad del comentario.', 'error');
      return;
    }
    if (b.texto.trim().length < 3) {
      avisar('Escribe el comentario antes de enviarlo.', 'error');
      document.getElementById('rv-texto')?.focus();
      return;
    }
    estado.enviando = true;
    pintarPanel();
    try {
      const url = new URL(location.pathname, location.origin);
      const el = elementoDe(s);
      if (el?.id) url.hash = el.id;
      const nuevo = await api.comentar({
        ronda: RONDA_ACTUAL,
        seccion: s.id,
        tipo: b.tipo,
        prioridad: b.prioridad,
        comentario: b.texto,
        revisor: estado.revisor,
        dispositivo: dispositivo(),
        ...(b.elemento ? { elemento: b.elemento } : {}),
        url: url.href,
        version,
      });
      estado.datos?.comentarios.push(nuevo);
      estado.borrador = borradorVacio();
      avisar(`Comentario #${nuevo.numero} guardado en ${nombreSeccion(s)}.`);
    } catch (e) {
      manejarError(e);
    } finally {
      estado.enviando = false;
      pintarTodo();
    }
  }

  async function guardarVeredicto(s: SeccionRevision, id: IdEstadoSeccion, nota: string): Promise<void> {
    if (!exigirRevisor()) return;
    estado.enviando = true;
    pintarPanel();
    try {
      const registro = await api.veredicto({ ronda: RONDA_ACTUAL, seccion: s.id, estado: id, revisor: estado.revisor, nota });
      if (estado.datos) estado.datos.secciones[s.id] = registro;
      avisar(`${nombreSeccion(s)}: ${ESTADOS_SECCION[id].nombre}.`);
    } catch (e) {
      manejarError(e);
    } finally {
      estado.enviando = false;
      pintarTodo();
    }
  }

  /* ── Resumen ──────────────────────────────────────────────────────── */

  function vistaResumen(): HTMLElement[] {
    const datos = estado.datos;
    const comentarios = datos?.comentarios ?? [];
    const conVeredicto = SECCIONES.filter((s) => datos?.secciones[s.id]);
    const cuenta = <K extends string>(claves: readonly K[], f: (c: Comentario) => K | null) =>
      claves.map((k) => [k, comentarios.filter((c) => f(c) === k).length] as const).filter(([, n]) => n > 0);

    const porEstado = cuenta(Object.keys(ESTADOS_COMENTARIO) as Array<keyof typeof ESTADOS_COMENTARIO>, (c) => c.estado);
    const porTipo = cuenta(Object.keys(TIPOS) as IdTipo[], (c) => c.tipo);

    const cifras = h(
      'div',
      { class: 'rv-bloque' },
      h(
        'div',
        { class: 'rv-cifras' },
        h('div', { class: 'rv-cifra' }, h('strong', {}, `${conVeredicto.length}/${SECCIONES.length}`), h('span', {}, 'secciones con veredicto')),
        h('div', { class: 'rv-cifra' }, h('strong', {}, comentarios.length), h('span', {}, 'comentarios')),
      ),
      porEstado.length
        ? h('div', { class: 'rv-chips' }, porEstado.map(([k, n]) => chip(`${ESTADOS_COMENTARIO[k].nombre}: ${n}`, `rv-chip--estado rv-chip--${k}`)))
        : null,
      porTipo.length ? h('div', { class: 'rv-chips' }, porTipo.map(([k, n]) => chip(`${TIPOS[k].nombre}: ${n}`, `rv-chip--${k}`))) : null,
    );

    const tabla = h(
      'ul',
      { class: 'rv-resumen' },
      SECCIONES.map((s) => {
        const registro = datos?.secciones[s.id];
        const veredicto = registro?.estado ?? 'sin-revisar';
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
                if (el && getComputedStyle(el).position !== 'fixed') el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                abrirPanel(s.id, 'seccion');
              },
            },
            h('span', { class: `rv-punto rv-punto--${veredicto}`, 'aria-hidden': 'true' }),
            h('span', { class: 'rv-resumen__nombre' }, nombreSeccion(s)),
            h('span', { class: 'rv-resumen__estado' }, ESTADOS_SECCION[veredicto].nombre),
            h('span', { class: 'rv-resumen__n', 'aria-label': `${n} comentarios` }, n),
          ),
        );
      }),
    );

    const entrega = datos?.entregada
      ? h(
          'div',
          { class: 'rv-bloque rv-bloque--ok' },
          h('h3', { class: 'rv-subtitulo' }, 'Revisión entregada'),
          h('p', {}, `${datos.entregada.revisor} entregó la revisión de la ronda ${RONDA_ACTUAL} · ${formatearFecha(datos.entregada.fecha)}`),
          h('p', { class: 'rv-ayuda' }, 'Puedes seguir agregando comentarios; quedarán registrados en esta misma ronda.'),
        )
      : bloqueEntrega(conVeredicto.length);

    return [campoRevisor(), cifras, h('h3', { class: 'rv-subtitulo' }, 'Secciones'), tabla, entrega, pie()];
  }

  function bloqueEntrega(conVeredicto: number): HTMLElement {
    const mensaje = h('textarea', {
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
          if (!exigirRevisor()) return;
          if (!estado.confirmandoEntrega) {
            estado.confirmandoEntrega = true;
            boton.textContent = 'Confirmar entrega';
            return;
          }
          void entregar(mensaje.value);
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
      mensaje,
      boton,
    );
  }

  async function entregar(mensaje: string): Promise<void> {
    estado.enviando = true;
    pintarPanel();
    try {
      const entrega = await api.entregar({ ronda: RONDA_ACTUAL, revisor: estado.revisor, mensaje });
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

  /* ── Salir ────────────────────────────────────────────────────────── */

  function salir(): void {
    guardarLocal(CLAVE_ACCESO, null);
    location.href = `${location.pathname}?revision=salir${location.hash}`;
  }

  pintarDock();
  pintarMarcadores();
  ubicar();
  void cargar();
}
