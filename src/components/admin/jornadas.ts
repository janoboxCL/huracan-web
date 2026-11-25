import { arrancar, mostrarContenido, mostrarErrorGeneral } from '../../lib/admin/arranque.ts';
import { ErrorAdmin } from '../../lib/admin/errores.ts';
import { esc, ETIQUETA_GRUPO, fechaCorta, horaChile, horaCorta, hoyChile } from '../../lib/admin/formato.ts';
import { compararJornadas, estadoOcupacion, generarIdJornada, validarJornada } from '../../lib/admin/jornadas.ts';
import type { JornadaAdmin } from '../../lib/admin/tipos.ts';
import { activarPistas, avisar, barraOcupacion, consulta, enfocarAviso, ocupar } from './ui.ts';

const CAMPOS = ['fecha', 'inicio', 'fin', 'grupo', 'cupos'] as const;
const INTERVALO_MS = 30_000;

async function iniciar(): Promise<void> {
  try {
    const ctx = await arrancar();
    let jornadas: JornadaAdmin[] = [];
    let ocupacion: Record<string, number> = {};
    let editando: JornadaAdmin | null = null;

    const panel = consulta<HTMLElement>('[data-panel]');
    const form = consulta<HTMLFormElement>('[data-form]');
    const avisoForm = consulta<HTMLElement>('[data-aviso-form]');
    const avisoLista = consulta<HTMLElement>('[data-aviso-lista]');
    const campo = (n: string) => form.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement;

    const fila = (j: JornadaAdmin): string => {
      const o = estadoOcupacion(j.cupos, ocupacion[j.id] ?? 0);
      return `<tr>
        <th scope="row">${esc(fechaCorta(j.fecha))}<span class="adm-tenue">${esc(horaCorta(j.inicio))} a ${esc(horaCorta(j.fin))}</span></th>
        <td data-etiqueta="Quién evalúa">${esc(ETIQUETA_GRUPO[j.grupo])}</td>
        <td data-etiqueta="Ocupación">${barraOcupacion(o)}</td>
        <td data-etiqueta="Estado"><span class="adm-insignia ${j.abierta ? 'adm-insignia--pago_confirmado' : 'adm-insignia--cancelada'}">${j.abierta ? 'Abierta' : 'Cerrada'}</span></td>
        <td class="adm-celda-acciones">
          <button type="button" class="adm-btn adm-btn--chico" data-editar="${esc(j.id)}">Editar<span class="solo-lectores"> jornada del ${esc(fechaCorta(j.fecha))} a las ${esc(horaCorta(j.inicio))}</span></button>
          <button type="button" class="adm-btn adm-btn--chico adm-btn--tenue" data-alternar="${esc(j.id)}">${j.abierta ? 'Cerrar' : 'Abrir'}<span class="solo-lectores"> jornada del ${esc(fechaCorta(j.fecha))} a las ${esc(horaCorta(j.inicio))}</span></button>
        </td></tr>`;
    };

    const tabla = (lista: JornadaAdmin[]) =>
      `<div class="adm-tabla-contenedor" tabindex="0" role="region" aria-label="Jornadas de evaluación"><table class="adm-tabla adm-tabla--apilada">
        <thead><tr><th scope="col">Fecha y hora</th><th scope="col">Quién evalúa</th><th scope="col">Ocupación</th><th scope="col">Estado</th><th scope="col"><span class="solo-lectores">Acciones</span></th></tr></thead>
        <tbody>${lista.map(fila).join('')}</tbody></table></div>`;

    const pintar = () => {
      const hoy = hoyChile();
      const ordenadas = [...jornadas].sort(compararJornadas);
      const proximas = ordenadas.filter((j) => j.fecha >= hoy);
      const pasadas = ordenadas.filter((j) => j.fecha < hoy).reverse();
      consulta('[data-proximas]').innerHTML =
        proximas.length === 0 ? '<p class="adm-vacio">No hay jornadas próximas. Crea una con «Nueva jornada».</p>' : tabla(proximas);
      consulta<HTMLElement>('[data-bloque-pasadas]').hidden = pasadas.length === 0;
      consulta('[data-pasadas]').innerHTML = pasadas.length === 0 ? '' : tabla(pasadas);
      consulta('[data-actualizado]').textContent = `Actualizado a las ${horaChile()}`;
      activarPistas(consulta('[data-contenido]'));
    };

    const refrescarOcupacion = async () => {
      ocupacion = await ctx.repo.contarOcupacion();
      pintar();
    };

    const cargar = async () => {
      [jornadas, ocupacion] = await Promise.all([ctx.repo.listarJornadas(), ctx.repo.contarOcupacion()]);
      pintar();
    };

    /* ── Formulario ─────────────────────────────────────────── */

    const limpiarErrores = () => {
      for (const c of CAMPOS) {
        consulta(`[data-error-${c}]`).textContent = '';
        campo(c).removeAttribute('aria-invalid');
      }
      avisar(avisoForm, 'info', '');
    };

    const abrirFormulario = (j: JornadaAdmin | null) => {
      editando = j;
      limpiarErrores();
      form.reset();
      consulta('[data-form-titulo]').textContent = j ? 'Editar jornada' : 'Nueva jornada';
      campo('fecha').value = j?.fecha ?? '';
      campo('inicio').value = j?.inicio ?? '';
      campo('fin').value = j?.fin ?? '';
      campo('grupo').value = j?.grupo ?? 'youth-junior-senior-prep';
      campo('cupos').value = j?.cupos === null || j === null ? '' : String(j.cupos);
      (campo('abierta') as HTMLInputElement).checked = j?.abierta ?? true;
      panel.hidden = false;
      panel.scrollIntoView({ block: 'nearest' });
      campo('fecha').focus();
    };

    const cerrarFormulario = (devolverFoco?: HTMLElement | null) => {
      panel.hidden = true;
      editando = null;
      devolverFoco?.focus();
    };

    const nuevaBtn = consulta<HTMLButtonElement>('[data-nueva]');
    nuevaBtn.addEventListener('click', () => abrirFormulario(null));
    consulta<HTMLButtonElement>('[data-cancelar]').addEventListener('click', () => cerrarFormulario(nuevaBtn));
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cerrarFormulario(nuevaBtn);
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      limpiarErrores();
      const id = editando?.id ?? generarIdJornada(campo('fecha').value, campo('inicio').value || '0000', campo('grupo').value as JornadaAdmin['grupo'], jornadas.map((j) => j.id));
      const r = validarJornada(
        {
          fecha: campo('fecha').value,
          inicio: campo('inicio').value,
          fin: campo('fin').value,
          grupo: campo('grupo').value,
          cupos: campo('cupos').value,
          abierta: (campo('abierta') as HTMLInputElement).checked,
        },
        id,
        ocupacion[id] ?? 0,
      );
      if (!r.valor) {
        let primero: HTMLElement | null = null;
        for (const c of CAMPOS) {
          const msg = r.errores[c];
          if (!msg) continue;
          consulta(`[data-error-${c}]`).textContent = msg;
          campo(c).setAttribute('aria-invalid', 'true');
          primero ??= campo(c);
        }
        avisar(avisoForm, 'error', 'Revisa los campos marcados.');
        primero?.focus();
        return;
      }
      const liberar = ocupar(consulta<HTMLButtonElement>('[data-guardar]'), 'Guardando…');
      try {
        if (editando) await ctx.repo.actualizarJornada(r.valor);
        else await ctx.repo.crearJornada(r.valor);
        const mensaje = editando ? 'Jornada actualizada.' : 'Jornada creada.';
        await cargar();
        cerrarFormulario(nuevaBtn);
        avisar(avisoLista, 'ok', r.avisos.length ? `${mensaje} ${r.avisos.join(' ')}` : mensaje);
      } catch (err) {
        avisar(avisoForm, 'error', err instanceof ErrorAdmin ? err.message : 'No se pudo guardar la jornada.');
      } finally {
        liberar();
      }
    });

    /* ── Acciones de la lista ───────────────────────────────── */

    consulta('[data-contenido]').addEventListener('click', async (e) => {
      const boton = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-editar], button[data-alternar]');
      if (!boton) return;
      if (boton.dataset['editar']) {
        const j = jornadas.find((x) => x.id === boton.dataset['editar']);
        if (j) abrirFormulario(j);
        return;
      }
      const j = jornadas.find((x) => x.id === boton.dataset['alternar']);
      if (!j) return;
      const ocupados = ocupacion[j.id] ?? 0;
      if (j.abierta && ocupados > 0) {
        const texto = `${ocupados} ${ocupados === 1 ? 'postulación ocupa' : 'postulaciones ocupan'} cupo en la jornada del ${fechaCorta(j.fecha)} a las ${horaCorta(j.inicio)}. Al cerrarla no recibirá nuevas postulaciones; las que ya existen se mantienen. ¿Cerrar la jornada?`;
        if (!window.confirm(texto)) return;
      }
      const liberar = ocupar(boton, 'Guardando…');
      try {
        await ctx.repo.actualizarJornada({ ...j, abierta: !j.abierta });
        await cargar();
        avisar(avisoLista, 'ok', j.abierta ? 'Jornada cerrada: ya no recibe nuevas postulaciones.' : 'Jornada abierta a nuevas postulaciones.');
        /* La tabla se repintó: el foco vuelve al mismo control (ahora «Abrir» o «Cerrar») o, si no está, al aviso. */
        const equivalente = document.querySelector<HTMLButtonElement>(`button[data-alternar="${CSS.escape(j.id)}"]`);
        if (equivalente) equivalente.focus();
        else enfocarAviso(avisoLista);
      } catch (err) {
        liberar();
        avisar(avisoLista, 'error', err instanceof ErrorAdmin ? err.message : 'No se pudo cambiar el estado de la jornada.');
      }
    });

    consulta<HTMLButtonElement>('[data-actualizar]').addEventListener('click', () => {
      void cargar().catch((err: unknown) => avisar(avisoLista, 'error', err instanceof ErrorAdmin ? err.message : 'No se pudo actualizar.'));
    });

    await cargar();
    mostrarContenido();

    /* Ocupación en vivo: se vuelve a contar cada 30 s mientras la pestaña está visible. */
    setInterval(() => {
      if (document.visibilityState === 'visible' && panel.hidden) void refrescarOcupacion().catch(() => undefined);
    }, INTERVALO_MS);
  } catch (e) {
    mostrarErrorGeneral(e, () => location.reload());
  }
}

void iniciar();
