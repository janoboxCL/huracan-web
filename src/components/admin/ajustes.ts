import { validarBanner } from '../../lib/admin/ajustes.ts';
import { arrancar, mostrarContenido, mostrarErrorGeneral } from '../../lib/admin/arranque.ts';
import { ErrorAdmin } from '../../lib/admin/errores.ts';
import { avisar, consulta, ocupar } from './ui.ts';

async function iniciar(): Promise<void> {
  try {
    const ctx = await arrancar();
    const ajustes = await ctx.repo.obtenerAjustes();
    mostrarContenido();

    const fb = consulta<HTMLFormElement>('[data-banner]');
    const campoB = (n: string) => fb.elements.namedItem(n) as HTMLInputElement;
    campoB('visible').checked = ajustes.banner.visible;
    campoB('texto').value = ajustes.banner.texto;
    campoB('enlace').value = ajustes.banner.enlace;

    const fi = consulta<HTMLFormElement>('[data-inscripciones]');
    for (const r of fi.querySelectorAll<HTMLInputElement>('input[name="estado"]')) r.checked = r.value === ajustes.inscripciones.estado;

    fb.addEventListener('submit', async (e) => {
      e.preventDefault();
      const aviso = consulta<HTMLElement>('[data-aviso-banner]');
      const banner = { visible: campoB('visible').checked, texto: campoB('texto').value.trim(), enlace: campoB('enlace').value.trim() };
      const errores = validarBanner(banner);
      for (const c of ['texto', 'enlace'] as const) {
        consulta(`[data-error-${c}]`).textContent = errores[c] ?? '';
        if (errores[c]) campoB(c).setAttribute('aria-invalid', 'true');
        else campoB(c).removeAttribute('aria-invalid');
      }
      if (errores.texto || errores.enlace) {
        avisar(aviso, 'error', 'Revisa los campos marcados.');
        (errores.texto ? campoB('texto') : campoB('enlace')).focus();
        return;
      }
      const liberar = ocupar(consulta<HTMLButtonElement>('[data-guardar-banner]'), 'Guardando…');
      try {
        await ctx.repo.guardarAjuste('banner', banner, ctx.usuario.id);
        avisar(aviso, 'ok', 'Banner guardado.');
      } catch (err) {
        avisar(aviso, 'error', err instanceof ErrorAdmin ? err.message : 'No se pudo guardar el banner.');
      } finally {
        liberar();
      }
    });

    fi.addEventListener('submit', async (e) => {
      e.preventDefault();
      const aviso = consulta<HTMLElement>('[data-aviso-insc]');
      const estado = fi.querySelector<HTMLInputElement>('input[name="estado"]:checked')?.value;
      if (estado !== 'abiertas' && estado !== 'cerradas') return avisar(aviso, 'error', 'Elige si las inscripciones están abiertas o cerradas.');
      const liberar = ocupar(consulta<HTMLButtonElement>('[data-guardar-insc]'), 'Guardando…');
      try {
        await ctx.repo.guardarAjuste('inscripciones', { estado }, ctx.usuario.id);
        avisar(aviso, 'ok', estado === 'abiertas' ? 'Inscripciones abiertas.' : 'Inscripciones cerradas.');
      } catch (err) {
        avisar(aviso, 'error', err instanceof ErrorAdmin ? err.message : 'No se pudo guardar el estado.');
      } finally {
        liberar();
      }
    });
  } catch (e) {
    mostrarErrorGeneral(e, () => location.reload());
  }
}

void iniciar();
