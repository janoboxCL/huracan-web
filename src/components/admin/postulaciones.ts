import { arrancar, mostrarContenido, mostrarErrorGeneral } from '../../lib/admin/arranque.ts';
import { ESTADOS, ETIQUETA_ESTADO } from '../../lib/admin/estados.ts';
import { filtrarPostulaciones, filtrosAParametros, filtrosDesdeParametros, hayFiltros, SIN_JORNADA, type Filtros } from '../../lib/admin/filtros.ts';
import { esc, ETIQUETA_PROGRAMA, fechaDiaMes, nombreAtleta, textoJornada } from '../../lib/admin/formato.ts';
import { compararJornadas } from '../../lib/admin/jornadas.ts';
import type { JornadaAdmin, Postulacion } from '../../lib/admin/tipos.ts';
import { activarPistas, CLAVE_FILTROS, consulta, insignia, opciones } from './ui.ts';

async function iniciar(): Promise<void> {
  try {
    const ctx = await arrancar();
    let postulaciones: Postulacion[] = [];
    let jornadas: JornadaAdmin[] = [];

    const form = consulta<HTMLFormElement>('[data-filtros]');
    const q = consulta<HTMLInputElement>('#f-q');
    const estado = consulta<HTMLSelectElement>('#f-estado');
    const jornada = consulta<HTMLSelectElement>('#f-jornada');
    const programa = consulta<HTMLSelectElement>('#f-programa');
    const orden = consulta<HTMLSelectElement>('#f-orden');

    const leerFiltros = (): Filtros => ({
      busqueda: q.value,
      estado: estado.value as Filtros['estado'],
      jornada: jornada.value,
      programa: programa.value as Filtros['programa'],
      orden: orden.value === 'antiguas' ? 'antiguas' : 'recientes',
    });

    const pintarOpciones = (f: Filtros) => {
      estado.innerHTML = opciones([{ valor: '', texto: 'Todos los estados' }, ...ESTADOS.map((e) => ({ valor: e, texto: ETIQUETA_ESTADO[e] }))], f.estado);
      jornada.innerHTML = opciones(
        [
          { valor: '', texto: 'Todas las jornadas' },
          { valor: SIN_JORNADA, texto: 'Sin jornada de evaluación' },
          ...[...jornadas].sort(compararJornadas).map((j) => ({ valor: j.id, texto: textoJornada(j) })),
        ],
        f.jornada,
      );
      programa.innerHTML = opciones(
        [{ valor: '', texto: 'Todos los programas' }, ...Object.entries(ETIQUETA_PROGRAMA).map(([valor, texto]) => ({ valor, texto }))],
        f.programa,
      );
      orden.value = f.orden;
      q.value = f.busqueda;
    };

    const textoJornadaDe = (p: Postulacion): string => {
      if (p.jornada_id) {
        const j = jornadas.find((x) => x.id === p.jornada_id);
        return j ? `${fechaDiaMes(`${j.fecha}T12:00:00Z`)} · ${j.inicio}` : p.jornada_id;
      }
      if (p.jornada_tipo === 'horario-equipo') return p.equipo_evaluacion ? `Horario de ${p.equipo_evaluacion.replace('Huracán ', '')}` : 'Horario del equipo';
      return p.jornada_tipo === 'sin-evaluacion' ? 'Sin evaluación' : 'Inicio diferido';
    };

    const pintar = () => {
      const f = leerFiltros();
      const url = new URL(location.href);
      url.search = filtrosAParametros(f).toString();
      history.replaceState(null, '', url);
      try {
        sessionStorage.setItem(CLAVE_FILTROS, url.search);
      } catch {
        /* sin almacenamiento: «Volver» llevará a la lista sin filtros */
      }

      const lista = filtrarPostulaciones(postulaciones, f);
      consulta('[data-conteo]').textContent =
        postulaciones.length === 0
          ? ''
          : `${lista.length} de ${postulaciones.length} ${postulaciones.length === 1 ? 'postulación' : 'postulaciones'}`;
      consulta<HTMLButtonElement>('[data-limpiar]').hidden = !hayFiltros(f);

      const cont = consulta('[data-lista]');
      if (postulaciones.length === 0) {
        cont.innerHTML = '<p class="adm-vacio">Todavía no hay postulaciones. Aparecerán aquí cuando una familia complete la preinscripción.</p>';
        return;
      }
      if (lista.length === 0) {
        cont.innerHTML = '<p class="adm-vacio">Ninguna postulación coincide con los filtros. Prueba quitar alguno o limpiar la búsqueda.</p>';
        return;
      }
      cont.innerHTML = `<div class="adm-tabla-contenedor" tabindex="0" role="region" aria-label="Lista de postulaciones"><table class="adm-tabla">
        <thead><tr><th scope="col">Código</th><th scope="col">Atleta</th><th scope="col" class="adm-col-media">Programa</th><th scope="col" class="adm-col-media">Jornada</th><th scope="col">Estado</th><th scope="col" class="adm-col-media">Fecha</th></tr></thead>
        <tbody>${lista
          .map(
            (p) => `<tr>
          <th scope="row"><a class="adm-codigo" href="/admin/postulaciones/ver?codigo=${encodeURIComponent(p.codigo)}">${esc(p.codigo)}</a></th>
          <td><span class="adm-nombre">${esc(nombreAtleta(p))}</span><span class="adm-tenue">${p.edad_2027} años en 2027 · ${esc(p.contacto_nombre)}</span></td>
          <td class="adm-col-media">${p.programa_sugerido ? esc(ETIQUETA_PROGRAMA[p.programa_sugerido]) : '<span class="adm-tenue">Sin programa</span>'}</td>
          <td class="adm-col-media">${esc(textoJornadaDe(p))}</td>
          <td>${insignia(p.estado)}</td>
          <td class="adm-col-media">${esc(fechaDiaMes(p.creado_en))}</td>
        </tr>`,
          )
          .join('')}</tbody></table></div>`;
      activarPistas(cont);
    };

    const cargar = async () => {
      [postulaciones, jornadas] = await Promise.all([ctx.repo.listarPostulaciones(), ctx.repo.listarJornadas()]);
      pintarOpciones(filtrosDesdeParametros(new URLSearchParams(location.search)));
      pintar();
    };

    await cargar();
    mostrarContenido();

    form.addEventListener('input', pintar);
    form.addEventListener('change', pintar);
    form.addEventListener('submit', (e) => e.preventDefault());
    consulta<HTMLButtonElement>('[data-limpiar]').addEventListener('click', () => {
      pintarOpciones({ estado: '', jornada: '', programa: '', busqueda: '', orden: leerFiltros().orden });
      pintar();
      q.focus();
    });
    consulta<HTMLButtonElement>('[data-actualizar]').addEventListener('click', () => {
      const f = leerFiltros();
      void cargar()
        .then(() => {
          pintarOpciones(f);
          pintar();
        })
        .catch((e: unknown) => mostrarErrorGeneral(e, () => location.reload()));
    });
  } catch (e) {
    mostrarErrorGeneral(e, () => location.reload());
  }
}

void iniciar();
