import { arrancar, mostrarContenido, mostrarErrorGeneral, type Contexto } from '../../lib/admin/arranque.ts';
import { ErrorAdmin } from '../../lib/admin/errores.ts';
import { ESTADOS, estadoTrasConfirmarPago, ETIQUETA_ESTADO, planearGestion, transicionesDesde } from '../../lib/admin/estados.ts';
import { filtrosAParametros, filtrosDesdeParametros } from '../../lib/admin/filtros.ts';
import {
  enlaceWhatsappApoderado,
  esc,
  ETIQUETA_PARENTESCO,
  ETIQUETA_POSICION,
  ETIQUETA_PROGRAMA,
  ETIQUETA_PROMOCION_DECLARADA,
  ETIQUETA_TIPO_JORNADA,
  ETIQUETA_TIPO_POSTULACION,
  fechaHora,
  nombreAtleta,
  peso,
  telefonoLegible,
  textoJornada,
} from '../../lib/admin/formato.ts';
import type { CambiosPostulacion, Estado, JornadaAdmin, Pago, Postulacion } from '../../lib/admin/tipos.ts';
import { activarPistas, avisar, CLAVE_FILTROS, consulta, enfocarAviso, insignia, ocupar } from './ui.ts';

interface FilaDesglose {
  equipo: string;
  programa: string;
  inscripcion: number;
  mensualidad: number;
  ropaPrimeraCuota: number;
  cinta: number;
  total: number;
  mensualidadEnEfectivo: boolean;
  promo: { nombre: string; mensualidad: number } | null;
}

function leerDesglose(d: unknown): FilaDesglose[] {
  if (!Array.isArray(d)) return [];
  return d.filter((f): f is FilaDesglose => typeof f === 'object' && f !== null && typeof (f as FilaDesglose).total === 'number');
}

/** Filtros de la lista que la persona tenía al abrir la ficha (normalizados). */
function leerFiltrosGuardados(): string {
  try {
    const guardado = sessionStorage.getItem(CLAVE_FILTROS);
    if (!guardado) return '';
    const texto = filtrosAParametros(filtrosDesdeParametros(new URLSearchParams(guardado))).toString();
    return texto ? `?${texto}` : '';
  } catch {
    return '';
  }
}

const dato = (titulo: string, valor: string) => `<div><dt>${esc(titulo)}</dt><dd>${valor}</dd></div>`;
/* Solo se enlaza una dirección https://; cualquier otra cosa (javascript:, data:, http:) se muestra como texto. */
function comprobante(url: string | null): string {
  if (!url) return '';
  if (/^https:\/\//i.test(url)) return `<a class="adm-tenue" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Ver comprobante<span class="solo-lectores"> (se abre en otra pestaña)</span></a>`;
  return '<span class="adm-tenue">Comprobante con una dirección no segura: no se enlaza.</span>';
}

const si = (v: boolean) => (v ? 'Sí' : 'No');

async function iniciar(): Promise<void> {
  const codigo = new URLSearchParams(location.search).get('codigo')?.trim() ?? '';
  try {
    const ctx = await arrancar();
    mostrarContenido();
    if (!codigo) return noEncontrada('Falta el código de la postulación en la dirección.');
    const p = await ctx.repo.obtenerPostulacion(codigo);
    if (!p) return noEncontrada(`No existe una postulación con el código «${codigo}». Revisa el código o vuelve a la lista.`);
    const [pagos, jornadas] = await Promise.all([ctx.repo.listarPagos(p.id), ctx.repo.listarJornadas()]);
    new Detalle(ctx, p, pagos, jornadas).pintar();
    document.title = `${nombreAtleta(p)} · Postulación · Administración`;
  } catch (e) {
    mostrarErrorGeneral(e, () => location.reload());
  }
}

function noEncontrada(mensaje: string): void {
  const caja = consulta<HTMLElement>('[data-no-encontrada]');
  caja.hidden = false;
  caja.textContent = mensaje;
}

class Detalle {
  private raiz = consulta<HTMLElement>('[data-detalle]');
  /** Se activa tras confirmar que se descartan los cambios, para no preguntar dos veces. */
  private saliendo = false;

  constructor(
    private ctx: Contexto,
    private p: Postulacion,
    private pagos: Pago[],
    private jornadas: JornadaAdmin[],
  ) {}

  private get jornada(): JornadaAdmin | undefined {
    return this.jornadas.find((j) => j.id === this.p.jornada_id);
  }

  private textoJornada(): string {
    const j = this.jornada;
    if (j) return textoJornada(j);
    if (this.p.jornada_id) return this.p.jornada_id;
    if (this.p.jornada_tipo === 'horario-equipo' && this.p.equipo_evaluacion) return `Horario habitual de ${this.p.equipo_evaluacion.replace('Huracán ', '')}`;
    return ETIQUETA_TIPO_JORNADA[this.p.jornada_tipo];
  }

  pintar(): void {
    const { p } = this;
    const nombres = this.ctx.datos.habilidades;
    const desglose = leerDesglose(p.desglose);
    const jornadaTxt = this.jornada || p.jornada_id ? this.textoJornada() : null;
    const wa = enlaceWhatsappApoderado(p, jornadaTxt);
    const menor = p.contacto_parentesco !== 'propio';

    const habilidades =
      p.habilidades.length === 0
        ? '<span class="adm-tenue">Ninguna declarada</span>'
        : `<ul class="adm-lista-puntos">${p.habilidades.map((h) => `<li>${esc(nombres[h] ?? h)}</li>`).join('')}</ul>`;

    this.raiz.innerHTML = `
      <header class="adm-ficha-cabecera">
        <div>
          <p class="adm-codigo adm-codigo--grande">${esc(p.codigo)}</p>
          <h1 class="adm-titulo">${esc(nombreAtleta(p))}</h1>
          <p class="adm-tenue">Preinscrita el ${esc(fechaHora(p.creado_en))} · actualizada el <span data-actualizada>${esc(fechaHora(p.actualizado_en))}</span></p>
        </div>
        <div data-insignia>${insignia(p.estado)}</div>
        <nav class="adm-saltos" aria-label="Ir a una sección de la ficha">
          <a class="adm-btn adm-btn--chico" href="#d-gestion">Ir a gestión</a>
          <a class="adm-btn adm-btn--chico" href="#d-pagos">Ir a pagos</a>
        </nav>
      </header>

      <div class="adm-ficha">
        <div class="adm-ficha__columna">
          <section class="adm-tarjeta" aria-labelledby="d-atleta">
            <h2 id="d-atleta" class="adm-h2">Atleta</h2>
            <dl class="adm-datos">
              ${dato('Edad en 2027', `${p.edad_2027} años`)}
              ${dato('Fecha de nacimiento', esc(p.fecha_nacimiento.split('-').reverse().join('-')))}
              ${dato('Sexo', p.sexo === 'dama' ? 'Dama' : p.sexo === 'varon' ? 'Varón' : 'Otro')}
              ${dato('Comuna', esc(p.comuna))}
              ${dato('Atleta antiguo de Huracán', si(p.es_antiguo))}
              ${dato('Experiencia', p.experiencia === 'con' ? 'Con experiencia (Prep)' : p.experiencia === 'basica' ? 'Experiencia muy básica (Novice)' : 'Sin experiencia (Novice)')}
              ${p.experiencia === 'con' ? dato('Club anterior', esc(p.club_anterior || 'No indicó')) : ''}
              ${p.experiencia === 'con' && p.anios_experiencia !== null ? dato('Años de experiencia', String(p.anios_experiencia)) : ''}
              ${p.posicion ? dato('Posición', esc(ETIQUETA_POSICION[p.posicion] ?? p.posicion)) : ''}
              ${dato('Tipo de postulación', esc(ETIQUETA_TIPO_POSTULACION[p.tipo_postulacion]))}
              ${p.modalidad_deseada ? dato('Modalidad elegida', esc(ETIQUETA_PROGRAMA[p.modalidad_deseada])) : ''}
              ${p.equipo_interes ? dato('Equipo de interés', esc(p.equipo_interes)) : ''}
              ${dato('Habilidades declaradas', habilidades)}
            </dl>
          </section>

          <section class="adm-tarjeta" aria-labelledby="d-contacto">
            <h2 id="d-contacto" class="adm-h2">${menor ? 'Apoderado' : 'Contacto'}</h2>
            <dl class="adm-datos">
              ${dato('Nombre', esc(p.contacto_nombre))}
              ${dato('Parentesco', esc(ETIQUETA_PARENTESCO[p.contacto_parentesco ?? ''] ?? p.contacto_parentesco ?? 'No indicado'))}
              ${dato('Teléfono', `<a href="tel:${esc(p.contacto_telefono)}">${esc(telefonoLegible(p.contacto_telefono))}</a>`)}
              ${dato('Correo', `<a href="mailto:${esc(p.contacto_correo)}">${esc(p.contacto_correo)}</a>`)}
            </dl>
            ${
              wa
                ? `<a class="adm-btn adm-btn--whatsapp" href="${esc(wa)}" target="_blank" rel="noopener noreferrer">Escribir por WhatsApp<span class="solo-lectores"> (se abre en otra pestaña)</span></a>`
                : '<p class="adm-tenue">El teléfono no tiene formato de celular chileno: no se puede abrir WhatsApp.</p>'
            }
          </section>

          <section class="adm-tarjeta" aria-labelledby="d-sugerencia">
            <h2 id="d-sugerencia" class="adm-h2">Sugerencia del sistema</h2>
            <dl class="adm-datos">
              ${dato('Programa sugerido', p.programa_sugerido ? esc(ETIQUETA_PROGRAMA[p.programa_sugerido]) : '<span class="adm-tenue">Sin programa</span>')}
              ${dato('Equipos sugeridos', p.equipos_sugeridos.length === 0 ? '<span class="adm-tenue">Ninguno: el coach define</span>' : `<ul class="adm-etiquetas" role="list">${p.equipos_sugeridos.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`)}
              ${dato('Evaluación', esc(this.textoJornada()))}
              ${dato('Promociones declaradas', p.promociones_declaradas.length === 0 ? '<span class="adm-tenue">Ninguna</span>' : esc(p.promociones_declaradas.map((x) => ETIQUETA_PROMOCION_DECLARADA[x] ?? x).join(', ')))}
            </dl>
            <h3 class="adm-h3">Monto estimado de ingreso: ${esc(peso(p.monto_estimado))}</h3>
            ${
              desglose.length === 0
                ? '<p class="adm-tenue">Esta postulación no tiene desglose guardado.</p>'
                : `<div class="adm-tabla-contenedor" tabindex="0" role="region" aria-label="Desglose del monto por equipo"><table class="adm-tabla adm-tabla--compacta">
                <thead><tr><th scope="col">Equipo</th><th scope="col">Inscripción</th><th scope="col">Mensualidad</th><th scope="col">Ropa (1.ª cuota)</th><th scope="col">Cinta</th><th scope="col">Total</th></tr></thead>
                <tbody>${desglose
                  .map(
                    (f) => `<tr><th scope="row">${esc(f.equipo)}${f.promo ? `<span class="adm-tenue">Posible promoción «${esc(f.promo.nombre)}»: mensualidad ${esc(peso(f.promo.mensualidad))} (la valida el coach)</span>` : ''}</th>
                    <td>${esc(peso(f.inscripcion))}</td><td>${esc(peso(f.mensualidad))}${f.mensualidadEnEfectivo ? '<span class="adm-tenue">en efectivo, no suma al total</span>' : ''}</td><td>${esc(peso(f.ropaPrimeraCuota))}</td><td>${esc(peso(f.cinta))}</td><td><strong>${esc(peso(f.total))}</strong></td></tr>`,
                  )
                  .join('')}</tbody></table></div>
                <p class="adm-nota">El monto estimado se muestra sin descuentos. Las promociones las valida el coach.</p>`
            }
          </section>
        </div>

        <div class="adm-ficha__columna">
          <section class="adm-tarjeta" aria-labelledby="d-gestion">
            <h2 id="d-gestion" class="adm-h2">Gestión del coach</h2>
            <form data-gestion novalidate>
              <div class="adm-campo">
                <label for="g-estado">Estado</label>
                <select id="g-estado" name="estado" aria-describedby="g-estado-ayuda"></select>
                <p class="adm-ayuda" id="g-estado-ayuda"></p>
              </div>
              <div class="adm-campo">
                <label for="g-equipo">Equipo asignado</label>
                <select id="g-equipo" name="equipo"></select>
                <p class="adm-ayuda">La condición de titular o reserva se registrará más adelante.</p>
              </div>
              <div class="adm-campo">
                <label for="g-promo">Promoción validada</label>
                <select id="g-promo" name="promocion"></select>
              </div>
              <div class="adm-campo">
                <label for="g-notas">Notas del coach</label>
                <textarea id="g-notas" name="notas" rows="5" maxlength="2000"></textarea>
              </div>
              <p class="adm-sucio" data-sucio hidden>Hay cambios sin guardar.</p>
              <div class="adm-aviso" data-aviso-gestion role="status" aria-live="polite" hidden></div>
              <button type="submit" class="adm-btn adm-btn--primario" data-guardar>Guardar cambios</button>
            </form>
          </section>

          <section class="adm-tarjeta" aria-labelledby="d-pagos">
            <h2 id="d-pagos" class="adm-h2">Pagos</h2>
            <div data-pagos></div>
            <form data-pago-nuevo class="adm-pago-nuevo" novalidate>
              <h3 class="adm-h3">Registrar un pago</h3>
              <div class="adm-campo">
                <label for="n-concepto">Concepto</label>
                <input id="n-concepto" name="concepto" list="n-conceptos" maxlength="120" required />
                <datalist id="n-conceptos">
                  <option value="Inscripción, ropa y primera mensualidad"></option>
                  <option value="Inscripción"></option>
                  <option value="Mensualidad"></option>
                  <option value="Ropa de entrenamiento (segunda cuota)"></option>
                </datalist>
              </div>
              <div class="adm-campo">
                <label for="n-monto">Monto en pesos</label>
                <input id="n-monto" name="monto" type="number" min="1" step="1" inputmode="numeric" required />
              </div>
              <div class="adm-aviso" data-aviso-pago role="status" aria-live="polite" hidden></div>
              <button type="submit" class="adm-btn" data-registrar>Registrar pago</button>
            </form>
          </section>
          ${this.ctx.admin.rol === 'coach' ? '' : this.htmlEliminar()}
        </div>
      </div>`;

    this.pintarGestion();
    this.pintarPagos();
    this.conectar();
    activarPistas(this.raiz);
  }

  /* ── Eliminar (solo jefatura; RLS lo vuelve a exigir) ────────── */

  private htmlEliminar(): string {
    return `<section class="adm-tarjeta adm-peligro" aria-labelledby="d-eliminar">
            <h2 id="d-eliminar" class="adm-h2">Eliminar inscripción</h2>
            <p class="adm-tenue">Borra la inscripción y sus pagos de forma definitiva. Úsalo solo para pruebas o duplicados: no se puede deshacer.</p>
            <button type="button" class="adm-btn adm-btn--peligro" data-eliminar-abrir>Eliminar esta inscripción…</button>
            <form data-eliminar-form hidden novalidate>
              <div class="adm-campo">
                <label for="e-codigo">Para confirmar, escribe el código <strong>${esc(this.p.codigo)}</strong></label>
                <input id="e-codigo" name="codigo" autocomplete="off" autocapitalize="characters" spellcheck="false" />
              </div>
              <div class="adm-aviso" data-aviso-eliminar role="alert" hidden></div>
              <button type="submit" class="adm-btn adm-btn--peligro" data-eliminar-confirmar disabled>Eliminar definitivamente</button>
              <button type="button" class="adm-btn adm-btn--tenue" data-eliminar-cancelar>Cancelar</button>
            </form>
          </section>`;
  }

  private conectarEliminar(): void {
    const abrir = document.querySelector<HTMLButtonElement>('[data-eliminar-abrir]');
    if (!abrir) return;
    const form = consulta<HTMLFormElement>('[data-eliminar-form]');
    const campo = consulta<HTMLInputElement>('#e-codigo');
    const confirmar = consulta<HTMLButtonElement>('[data-eliminar-confirmar]');
    const aviso = consulta<HTMLElement>('[data-aviso-eliminar]');
    const coincide = () => campo.value.trim().toUpperCase() === this.p.codigo.toUpperCase();

    abrir.addEventListener('click', () => {
      form.hidden = false;
      abrir.hidden = true;
      campo.focus();
    });
    consulta('[data-eliminar-cancelar]').addEventListener('click', () => {
      form.hidden = true;
      abrir.hidden = false;
      campo.value = '';
      confirmar.disabled = true;
      avisar(aviso, 'error', '');
      abrir.focus();
    });
    campo.addEventListener('input', () => {
      confirmar.disabled = !coincide();
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!coincide()) return;
      const liberar = ocupar(confirmar, 'Eliminando…');
      try {
        await this.ctx.repo.eliminarPostulacion(this.p.id);
        this.saliendo = true;
        location.replace(`/admin/postulaciones${leerFiltrosGuardados()}`);
      } catch (err) {
        liberar();
        avisar(aviso, 'error', err instanceof ErrorAdmin ? err.message : 'No se pudo eliminar la inscripción.');
      }
    });
  }

  /* ── Gestión ──────────────────────────────────────────────── */

  /** Repinta solo el estado (select, ayuda, insignia y fecha), conservando lo que la persona haya elegido y no guardado. */
  private pintarEstado(previo?: { estadoAnterior: Estado; elegido: string }): void {
    const { p } = this;
    const estados: Estado[] = [p.estado, ...transicionesDesde(p.estado)];
    const orden = (e: Estado) => ESTADOS.indexOf(e);
    estados.sort((a, b) => orden(a) - orden(b));
    const select = consulta<HTMLSelectElement>('#g-estado');
    select.innerHTML = estados
      .map((e) => `<option value="${e}"${e === p.estado ? ' selected' : ''}>${esc(ETIQUETA_ESTADO[e])}${e === p.estado ? ' (actual)' : ''}</option>`)
      .join('');
    /* Si la persona había elegido otro estado distinto del que tenía la ficha, se respeta cuando sigue siendo válido. */
    if (previo && previo.elegido !== previo.estadoAnterior && estados.includes(previo.elegido as Estado)) select.value = previo.elegido;
    consulta('#g-estado-ayuda').textContent =
      p.estado === 'cancelada'
        ? 'Una postulación cancelada solo se puede reactivar como preinscrita. Revisa que la jornada tenga cupo.'
        : p.jornada_id
          ? 'Cancelar libera el cupo de la jornada de evaluación.'
          : 'Solo se muestran los estados a los que se puede pasar desde el actual.';
    consulta('[data-insignia]').innerHTML = insignia(p.estado);
    consulta('[data-actualizada]').textContent = fechaHora(p.actualizado_en);
  }

  private pintarGestion(): void {
    const { p } = this;
    this.pintarEstado();

    const equipos = this.ctx.datos.equipos;
    const sugeridos = equipos.filter((e) => p.equipos_sugeridos.includes(e.nombre));
    const otros = equipos.filter((e) => !p.equipos_sugeridos.includes(e.nombre));
    const opcion = (n: string) => `<option value="${esc(n)}"${p.equipo_asignado === n ? ' selected' : ''}>${esc(n)}</option>`;
    const huerfano = p.equipo_asignado && !equipos.some((e) => e.nombre === p.equipo_asignado) ? opcion(p.equipo_asignado) : '';
    consulta('#g-equipo').innerHTML = `<option value="">Sin asignar</option>${huerfano}
      ${sugeridos.length ? `<optgroup label="Sugeridos por el sistema">${sugeridos.map((e) => opcion(e.nombre)).join('')}</optgroup>` : ''}
      <optgroup label="${sugeridos.length ? 'Otros equipos' : 'Equipos'}">${otros.map((e) => opcion(e.nombre)).join('')}</optgroup>`;

    const promos = this.ctx.datos.promociones;
    const actual = p.promocion_validada ?? '';
    const lista = actual && !promos.includes(actual) ? [actual, ...promos] : promos;
    consulta('#g-promo').innerHTML = `<option value="">Ninguna</option>${lista.map((n) => `<option value="${esc(n)}"${n === actual ? ' selected' : ''}>${esc(n)}</option>`).join('')}`;

    consulta<HTMLTextAreaElement>('#g-notas').value = p.notas_coach ?? '';
    this.actualizarSucio();
  }

  /* ── Cambios sin guardar ──────────────────────────────────── */

  private valoresForm() {
    return {
      estado: consulta<HTMLSelectElement>('#g-estado').value as Estado,
      equipo: consulta<HTMLSelectElement>('#g-equipo').value || null,
      promo: consulta<HTMLSelectElement>('#g-promo').value || null,
      notas: consulta<HTMLTextAreaElement>('#g-notas').value.trim() || null,
    };
  }

  private esSucio(): boolean {
    const v = this.valoresForm();
    const { p } = this;
    return v.estado !== p.estado || v.equipo !== p.equipo_asignado || v.promo !== p.promocion_validada || v.notas !== (p.notas_coach || null);
  }

  private actualizarSucio(): void {
    const sucio = this.esSucio();
    consulta<HTMLElement>('[data-sucio]').hidden = !sucio;
    consulta('[data-gestion]').classList.toggle('adm-form--sucio', sucio);
  }

  private avisarConflicto(aviso: HTMLElement, mensaje: string): void {
    avisar(aviso, 'error', mensaje);
    const recargar = document.createElement('button');
    recargar.type = 'button';
    recargar.className = 'adm-btn adm-btn--chico';
    recargar.textContent = 'Recargar la ficha';
    recargar.addEventListener('click', () => location.reload());
    aviso.append(' ', recargar);
  }

  private async guardar(): Promise<void> {
    const aviso = consulta<HTMLElement>('[data-aviso-gestion]');
    const { estado, equipo, promo, notas } = this.valoresForm();

    /* Para avisar si la jornada de una cancelada que se reactiva ya está llena. */
    let jornada: { cupos: number | null; ocupados: number } | null = null;
    const j = this.jornada;
    if (this.p.estado === 'cancelada' && estado !== 'cancelada' && j) {
      try {
        jornada = { cupos: j.cupos, ocupados: (await this.ctx.repo.contarOcupacion())[j.id] ?? 0 };
      } catch {
        /* sin el dato no se avisa; no bloquea el guardado */
      }
    }

    const plan = planearGestion({ estadoActual: this.p.estado, estadoNuevo: estado, equipoAsignado: equipo, jornada });
    if (plan.error) return avisar(aviso, 'error', plan.error);
    if (plan.confirmacion && !window.confirm(plan.confirmacion)) return;

    const cambios: CambiosPostulacion = {};
    if (estado !== this.p.estado) cambios.estado = estado;
    if (plan.equipoFinal !== this.p.equipo_asignado) cambios.equipo_asignado = plan.equipoFinal;
    if (promo !== this.p.promocion_validada) cambios.promocion_validada = promo;
    if (notas !== (this.p.notas_coach || null)) cambios.notas_coach = notas;
    if (Object.keys(cambios).length === 0) return avisar(aviso, 'info', 'No hay cambios que guardar.');

    const liberar = ocupar(consulta<HTMLButtonElement>('[data-guardar]'), 'Guardando…');
    try {
      this.p = await this.ctx.repo.actualizarPostulacion(this.p.id, cambios, this.p.actualizado_en);
      this.pintarGestion();
      this.pintarPagos();
      avisar(aviso, 'ok', plan.aviso ? `Cambios guardados. Atención: ${plan.aviso}` : 'Cambios guardados.');
    } catch (e) {
      if (e instanceof ErrorAdmin && e.tipo === 'conflicto') this.avisarConflicto(aviso, e.message);
      else avisar(aviso, 'error', e instanceof ErrorAdmin ? e.message : 'No se pudieron guardar los cambios.');
    } finally {
      liberar();
    }
  }

  /* ── Pagos ────────────────────────────────────────────────── */

  private pintarPagos(): void {
    const confirmados = this.pagos.filter((x) => x.confirmado_en);
    const sumaConfirmada = confirmados.reduce((s, x) => s + x.monto, 0);
    const sumaTotal = this.pagos.reduce((s, x) => s + x.monto, 0);
    const cont = consulta('[data-pagos]');

    const propuesta = confirmados.length > 0 ? estadoTrasConfirmarPago(this.p.estado) : null;
    cont.innerHTML =
      this.pagos.length === 0
        ? '<p class="adm-vacio adm-vacio--corto">Aún no hay pagos registrados.</p>'
        : `<div class="adm-tabla-contenedor" tabindex="0" role="region" aria-label="Pagos registrados"><table class="adm-tabla adm-tabla--compacta">
            <thead><tr><th scope="col">Concepto</th><th scope="col">Monto</th><th scope="col">Estado</th></tr></thead>
            <tbody>${this.pagos
              .map(
                (x) => `<tr><th scope="row">${esc(x.concepto)}${comprobante(x.comprobante_url)}</th>
                <td>${esc(peso(x.monto))}</td>
                <td>${x.confirmado_en ? `<span class="adm-insignia adm-insignia--pago_confirmado">Confirmado</span><span class="adm-tenue">${esc(fechaHora(x.confirmado_en))}</span>` : `<button type="button" class="adm-btn adm-btn--chico" data-confirmar="${esc(x.id)}">Confirmar pago</button>`}</td></tr>`,
              )
              .join('')}</tbody></table></div>
            <p class="adm-nota">Confirmado: ${esc(peso(sumaConfirmada))} de ${esc(peso(this.p.monto_estimado))} estimados.</p>`;

    if (propuesta) {
      cont.insertAdjacentHTML(
        'beforeend',
        `<p class="adm-alerta">Ya hay un pago confirmado. <button type="button" class="adm-btn adm-btn--chico" data-pasar-confirmado>Pasar la postulación a «${esc(ETIQUETA_ESTADO[propuesta])}»</button></p>`,
      );
    }

    activarPistas(cont);
    const monto = consulta<HTMLInputElement>('#n-monto');
    const concepto = consulta<HTMLInputElement>('#n-concepto');
    if (!monto.value && !concepto.value) {
      const restante = this.p.monto_estimado - sumaTotal;
      if (restante > 0) {
        monto.value = String(restante);
        concepto.value = this.pagos.length === 0 ? 'Inscripción, ropa y primera mensualidad' : '';
      }
    }
  }

  private async registrarPago(): Promise<void> {
    const aviso = consulta<HTMLElement>('[data-aviso-pago]');
    const concepto = consulta<HTMLInputElement>('#n-concepto');
    const monto = consulta<HTMLInputElement>('#n-monto');
    const texto = concepto.value.trim();
    const valor = Number(monto.value);
    if (!texto) return avisar(aviso, 'error', 'Escribe el concepto del pago.');
    if (monto.value.trim() === '' || !Number.isInteger(valor) || valor < 1) return avisar(aviso, 'error', 'El monto debe ser un número entero de pesos mayor que cero, sin puntos ni signos.');

    const liberar = ocupar(consulta<HTMLButtonElement>('[data-registrar]'), 'Registrando…');
    try {
      this.pagos.push(await this.ctx.repo.crearPago(this.p.id, texto, valor));
      concepto.value = '';
      monto.value = '';
      this.pintarPagos();
      avisar(aviso, 'ok', 'Pago registrado. Falta confirmarlo cuando verifiques el comprobante.');
    } catch (e) {
      avisar(aviso, 'error', e instanceof ErrorAdmin ? e.message : 'No se pudo registrar el pago.');
    } finally {
      liberar();
    }
  }

  private async confirmarPago(id: string, boton: HTMLButtonElement): Promise<void> {
    const pago = this.pagos.find((x) => x.id === id);
    if (!pago) return;
    const aviso = consulta<HTMLElement>('[data-aviso-pago]');
    if (!window.confirm(`¿Confirmar el pago «${pago.concepto}» por ${peso(pago.monto)}? Esta acción queda registrada a tu nombre.`)) return;
    const liberar = ocupar(boton, 'Confirmando…');
    try {
      const i = this.pagos.findIndex((x) => x.id === id);
      this.pagos[i] = await this.ctx.repo.confirmarPago(id, this.ctx.usuario.id);
      this.pintarPagos();
      avisar(aviso, 'ok', 'Pago confirmado.');
      /* El botón pulsado ya no existe: el foco pasa al siguiente pago por confirmar o, si no hay, al aviso. */
      const siguiente = this.raiz.querySelector<HTMLButtonElement>('[data-pagos] [data-confirmar]');
      if (siguiente) siguiente.focus();
      else enfocarAviso(aviso);
    } catch (e) {
      liberar();
      avisar(aviso, 'error', e instanceof ErrorAdmin ? e.message : 'No se pudo confirmar el pago.');
      if (e instanceof ErrorAdmin && e.tipo === 'conflicto') {
        /* Otra persona ya lo confirmó: se muestra el estado real. */
        this.pagos = await this.ctx.repo.listarPagos(this.p.id).catch(() => this.pagos);
        this.pintarPagos();
        enfocarAviso(aviso);
      }
    }
  }

  private async pasarAConfirmado(boton: HTMLButtonElement): Promise<void> {
    const aviso = consulta<HTMLElement>('[data-aviso-pago]');
    const liberar = ocupar(boton, 'Guardando…');
    const previo = { estadoAnterior: this.p.estado, elegido: consulta<HTMLSelectElement>('#g-estado').value };
    try {
      this.p = await this.ctx.repo.actualizarPostulacion(this.p.id, { estado: 'pago_confirmado' }, this.p.actualizado_en);
      /* Solo se actualiza el estado: el formulario de gestión conserva notas, equipo y promoción sin guardar. */
      this.pintarEstado(previo);
      this.actualizarSucio();
      this.pintarPagos();
      avisar(aviso, 'ok', 'La postulación pasó a «Pago confirmado».');
      enfocarAviso(aviso);
    } catch (e) {
      liberar();
      if (e instanceof ErrorAdmin && e.tipo === 'conflicto') this.avisarConflicto(aviso, e.message);
      else avisar(aviso, 'error', e instanceof ErrorAdmin ? e.message : 'No se pudo cambiar el estado.');
    }
  }

  private conectar(): void {
    const form = consulta<HTMLFormElement>('[data-gestion]');
    form.addEventListener('input', () => this.actualizarSucio());
    form.addEventListener('change', () => this.actualizarSucio());

    /* Aviso del navegador al cerrar o recargar con cambios sin guardar. */
    window.addEventListener('beforeunload', (e) => {
      if (this.saliendo || !this.esSucio()) return;
      e.preventDefault();
      e.returnValue = '';
    });

    const volver = document.querySelector<HTMLAnchorElement>('[data-volver]');
    if (volver) {
      volver.href = `/admin/postulaciones${leerFiltrosGuardados()}`;
      volver.addEventListener('click', (e) => {
        if (!this.esSucio()) return;
        if (window.confirm('Hay cambios sin guardar en la gestión. Si vuelves ahora se perderán. ¿Volver de todos modos?')) this.saliendo = true;
        else e.preventDefault();
      });
    }

    this.conectarEliminar();

    consulta<HTMLFormElement>('[data-gestion]').addEventListener('submit', (e) => {
      e.preventDefault();
      void this.guardar();
    });
    consulta<HTMLFormElement>('[data-pago-nuevo]').addEventListener('submit', (e) => {
      e.preventDefault();
      void this.registrarPago();
    });
    consulta('[data-pagos]').addEventListener('click', (e) => {
      const destino = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!destino) return;
      if (destino.dataset['confirmar']) void this.confirmarPago(destino.dataset['confirmar'], destino);
      else if (destino.hasAttribute('data-pasar-confirmado')) void this.pasarAConfirmado(destino);
    });
  }
}

void iniciar();
