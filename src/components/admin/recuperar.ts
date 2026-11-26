import { arrancarLogin } from '../../lib/admin/arranque.ts';
import { avisar, consulta, ocupar } from './ui.ts';

const mensaje = consulta<HTMLElement>('[data-mensaje]');
const error = consulta<HTMLElement>('[data-error]');
const formulario = consulta<HTMLFormElement>('[data-formulario]');
const boton = consulta<HTMLButtonElement>('[data-enviar]');

async function iniciar(): Promise<void> {
  try {
    const { repo } = await arrancarLogin();
    formulario.addEventListener('submit', async (e) => {
      e.preventDefault();
      avisar(error, 'error', '');
      const correo = String(new FormData(formulario).get('correo') ?? '').trim();
      if (!/^\S+@\S+\.\S+$/.test(correo)) {
        avisar(error, 'error', 'Escribe un correo válido.');
        return;
      }
      const liberar = ocupar(boton, 'Enviando…');
      try {
        const r = await repo.pedirRecuperacion(correo, `${location.origin}/admin/nueva-clave`);
        if (r === 'ok') {
          /* Mismo mensaje exista o no la cuenta: no se revela quién tiene acceso. */
          avisar(mensaje, 'ok', 'Si el correo corresponde a una cuenta del equipo, te enviamos un enlace. Revisa también la carpeta de spam.');
        } else {
          avisar(error, 'error', r === 'red' ? 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.' : 'No se pudo enviar el correo. Inténtalo de nuevo en unos minutos.');
        }
      } finally {
        liberar();
      }
    });
  } catch {
    avisar(error, 'error', 'No se pudo preparar la página. Recarga e inténtalo de nuevo.');
  }
}

void iniciar();
