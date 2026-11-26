import { arrancarLogin } from '../../lib/admin/arranque.ts';
import { avisar, consulta, ocupar } from './ui.ts';

const mensaje = consulta<HTMLElement>('[data-mensaje]');
const error = consulta<HTMLElement>('[data-error]');
const formulario = consulta<HTMLFormElement>('[data-formulario]');
const boton = consulta<HTMLButtonElement>('[data-enviar]');

const LARGO_MINIMO = 10;

async function iniciar(): Promise<void> {
  try {
    const { repo } = await arrancarLogin();
    const valido = await repo.abrirSesionDeRecuperacion();
    if (!valido) {
      avisar(mensaje, 'error', 'El enlace no es válido o venció. Pide uno nuevo.');
      return;
    }
    formulario.hidden = false;
    consulta<HTMLInputElement>('#clave').focus();

    formulario.addEventListener('submit', async (e) => {
      e.preventDefault();
      avisar(error, 'error', '');
      const datos = new FormData(formulario);
      const clave = String(datos.get('clave') ?? '');
      if (clave.length < LARGO_MINIMO) {
        avisar(error, 'error', `La contraseña debe tener al menos ${LARGO_MINIMO} caracteres.`);
        return;
      }
      if (clave !== String(datos.get('clave2') ?? '')) {
        avisar(error, 'error', 'Las contraseñas no coinciden.');
        return;
      }
      const liberar = ocupar(boton, 'Guardando…');
      try {
        const r = await repo.cambiarClave(clave);
        if (r === 'ok') {
          await repo.cerrarSesion().catch(() => undefined);
          location.replace('/admin/login?motivo=clave-nueva');
          return;
        }
        avisar(
          error,
          'error',
          r === 'debil'
            ? 'Esa contraseña es demasiado débil o ya se usó. Elige otra más larga.'
            : r === 'red'
              ? 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'
              : 'No se pudo guardar la contraseña. Pide un enlace nuevo e inténtalo de nuevo.',
        );
      } finally {
        liberar();
      }
    });
  } catch {
    avisar(error, 'error', 'No se pudo preparar la página. Recarga e inténtalo de nuevo.');
  }
}

void iniciar();
