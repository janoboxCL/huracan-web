import { arrancar, mostrarContenido, mostrarErrorGeneral } from '../../lib/admin/arranque.ts';
import { ESTADOS, ETIQUETA_ESTADO } from '../../lib/admin/estados.ts';
import { contarPorEstado } from '../../lib/admin/filtros.ts';
import { esc, fechaDiaMes, hoyChile, nombreAtleta, textoJornada } from '../../lib/admin/formato.ts';
import { estadoOcupacion, jornadasProximas } from '../../lib/admin/jornadas.ts';
import { ETIQUETA_GRUPO } from '../../lib/admin/formato.ts';
import { barraOcupacion, consulta, insignia } from './ui.ts';

async function iniciar(): Promise<void> {
  try {
    const ctx = await arrancar();
    const cargar = async () => {
      const [postulaciones, jornadas, ocupacion] = await Promise.all([
        ctx.repo.listarPostulaciones(),
        ctx.repo.listarJornadas(),
        ctx.repo.contarOcupacion(),
      ]);

      const cuentas = contarPorEstado(postulaciones);
      consulta('[data-estados]').innerHTML = ESTADOS.map(
        (e) =>
          `<li><a class="adm-cifra adm-cifra--${e}" href="/admin/postulaciones?estado=${e}"><span class="adm-cifra__n">${cuentas[e]}</span><span class="adm-cifra__t">${esc(ETIQUETA_ESTADO[e])}</span></a></li>`,
      ).join('');

      const alerta = consulta<HTMLElement>('[data-pendientes]');
      if (cuentas.pago_informado > 0) {
        alerta.hidden = false;
        alerta.innerHTML = `<strong>${cuentas.pago_informado}</strong> ${cuentas.pago_informado === 1 ? 'postulación espera' : 'postulaciones esperan'} la confirmación de su pago. <a href="/admin/postulaciones?estado=pago_informado">Revisar</a>`;
      } else {
        alerta.hidden = true;
      }

      const proximas = jornadasProximas(jornadas, hoyChile()).slice(0, 6);
      consulta('[data-jornadas]').innerHTML =
        proximas.length === 0
          ? '<p class="adm-vacio">No hay jornadas próximas. Crea una en «Jornadas».</p>'
          : `<ul class="adm-lista-jornadas" role="list">${proximas
              .map(
                (j) =>
                  `<li><div><strong>${esc(textoJornada(j))}</strong><span class="adm-tenue">${esc(ETIQUETA_GRUPO[j.grupo])}${j.abierta ? '' : ' · cerrada'}</span></div>${barraOcupacion(estadoOcupacion(j.cupos, ocupacion[j.id] ?? 0))}</li>`,
              )
              .join('')}</ul>`;

      const recientes = [...postulaciones].sort((a, b) => Date.parse(b.creado_en) - Date.parse(a.creado_en)).slice(0, 5);
      consulta('[data-recientes]').innerHTML =
        recientes.length === 0
          ? '<p class="adm-vacio">Todavía no hay postulaciones.</p>'
          : `<ul class="adm-lista-simple" role="list">${recientes
              .map(
                (p) =>
                  `<li><a href="/admin/postulaciones/ver?codigo=${encodeURIComponent(p.codigo)}"><span class="adm-codigo">${esc(p.codigo)}</span> ${esc(nombreAtleta(p))}</a><span class="adm-tenue">${esc(fechaDiaMes(p.creado_en))}</span>${insignia(p.estado)}</li>`,
              )
              .join('')}</ul>`;
    };

    await cargar();
    mostrarContenido();
    consulta<HTMLButtonElement>('[data-actualizar]').addEventListener('click', () => {
      void cargar().catch((e: unknown) => mostrarErrorGeneral(e, () => location.reload()));
    });
  } catch (e) {
    mostrarErrorGeneral(e, () => location.reload());
  }
}

void iniciar();
