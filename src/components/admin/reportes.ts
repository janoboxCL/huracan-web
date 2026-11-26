import { arrancar, mostrarContenido, mostrarErrorGeneral } from '../../lib/admin/arranque.ts';
import { esc, fechaHora, hoyChile, peso } from '../../lib/admin/formato.ts';
import { calcularResumen, type DatosReporte, type FilaConteo } from '../../lib/admin/reportes.ts';
import { avisar, consulta, ocupar } from './ui.ts';

const tablaConteo = (filas: FilaConteo[], titulo: string, vacio: string): string =>
  filas.length === 0
    ? `<p class="adm-vacio">${esc(vacio)}</p>`
    : `<div class="adm-tabla-contenedor"><table class="adm-tabla adm-tabla--compacta"><thead><tr><th scope="col">${esc(titulo)}</th><th scope="col">Postulaciones</th></tr></thead><tbody>${filas
        .map((f) => `<tr><th scope="row">${esc(f.etiqueta)}</th><td>${f.n}</td></tr>`)
        .join('')}</tbody></table></div>`;

const cifra = (n: string | number, texto: string): string =>
  `<li><div class="adm-cifra"><span class="adm-cifra__n">${esc(n)}</span><span class="adm-cifra__t">${esc(texto)}</span></div></li>`;

async function iniciar(): Promise<void> {
  try {
    const ctx = await arrancar();
    let datos: DatosReporte | null = null;

    const cargar = async () => {
      const [postulaciones, pagos, jornadas, ocupacion] = await Promise.all([
        ctx.repo.listarPostulaciones(),
        ctx.repo.listarTodosLosPagos(),
        ctx.repo.listarJornadas(),
        ctx.repo.contarOcupacion(),
      ]);
      datos = { postulaciones, pagos, jornadas, ocupacion };
      const r = calcularResumen(datos);

      consulta('[data-cifras]').innerHTML = [
        cifra(r.activas, 'Postulaciones activas'),
        cifra(r.conPagoConfirmado, 'Con pago confirmado'),
        cifra(r.canceladas, 'Canceladas'),
        cifra(peso(r.montoEstimado), 'Monto estimado'),
        cifra(peso(r.montoConfirmado), 'Monto confirmado'),
        cifra(peso(r.montoPorConfirmar), 'Por confirmar'),
        cifra(`${r.jornadasAbiertas} de ${r.jornadasTotal}`, 'Jornadas abiertas'),
      ].join('');

      consulta('[data-estados]').innerHTML = tablaConteo(
        (Object.entries(r.porEstado) as [string, number][]).map(([clave, n]) => ({ etiqueta: clave.replace('_', ' ').replace(/^./, (c) => c.toUpperCase()), n })),
        'Estado',
        'Sin postulaciones.',
      );
      consulta('[data-asignado]').innerHTML = tablaConteo(r.porEquipoAsignado, 'Equipo', 'Sin postulaciones activas.');
      consulta('[data-sugerido]').innerHTML = tablaConteo(r.porEquipoSugerido, 'Equipo', 'Sin equipos sugeridos.');
      consulta('[data-programas]').innerHTML = tablaConteo(r.porPrograma, 'Programa', 'Sin postulaciones activas.');
      consulta('[data-jornadas]').innerHTML =
        r.porJornada.length === 0
          ? '<p class="adm-vacio">No hay jornadas.</p>'
          : `<div class="adm-tabla-contenedor"><table class="adm-tabla adm-tabla--compacta"><thead><tr><th scope="col">Jornada</th><th scope="col">Grupo</th><th scope="col">Abierta</th><th scope="col">Cupos</th><th scope="col">Inscritas</th></tr></thead><tbody>${r.porJornada
              .map((j) => `<tr><th scope="row">${esc(j.texto)}</th><td>${esc(j.grupo)}</td><td>${j.abierta ? 'Sí' : 'No'}</td><td>${j.cupos === null ? 'Sin límite' : j.cupos}</td><td>${j.inscritas}</td></tr>`)
              .join('')}</tbody></table></div>`;
    };

    await cargar();
    mostrarContenido();

    consulta<HTMLButtonElement>('[data-actualizar]').addEventListener('click', () => {
      void cargar().catch((e: unknown) => mostrarErrorGeneral(e, () => location.reload()));
    });

    const error = consulta<HTMLElement>('[data-error-excel]');
    const boton = consulta<HTMLButtonElement>('[data-excel]');
    boton.addEventListener('click', async () => {
      avisar(error, 'error', '');
      if (!datos) return;
      const liberar = ocupar(boton, 'Preparando…');
      try {
        const { generarExcel } = await import('../../lib/admin/excel.ts');
        const blob = await generarExcel(datos, fechaHora(new Date().toISOString()));
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `huracan-reporte-${hoyChile()}.xlsx`;
        document.body.append(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch {
        avisar(error, 'error', 'No se pudo generar el Excel. Inténtalo de nuevo.');
      } finally {
        liberar();
      }
    });
  } catch (e) {
    mostrarErrorGeneral(e, () => location.reload());
  }
}

void iniciar();
