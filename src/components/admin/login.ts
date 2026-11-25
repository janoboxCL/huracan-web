import { arrancarLogin, MENSAJES_LOGIN } from '../../lib/admin/arranque.ts';
import { avisar, consulta, ocupar } from './ui.ts';

const params = new URLSearchParams(location.search);
const mensaje = consulta<HTMLElement>('[data-mensaje]');
const error = consulta<HTMLElement>('[data-error]');
const formulario = consulta<HTMLFormElement>('[data-formulario]');
const boton = consulta<HTMLButtonElement>('[data-enviar]');

const motivo = params.get('motivo');
if (motivo && MENSAJES_LOGIN[motivo]) avisar(mensaje, motivo === 'no-admin' ? 'error' : 'info', MENSAJES_LOGIN[motivo]);

/** Solo se vuelve a rutas internas del admin (evita redirecciones a otros sitios). */
function destino(): string {
  const volver = params.get('volver') ?? '';
  return /^\/admin(\/[\w\-./]*)?(\?[\w\-=&%.]*)?$/.test(volver) && !volver.startsWith('/admin/login') ? volver : '/admin';
}

async function iniciar(): Promise<void> {
  try {
    const { repo, demo } = await arrancarLogin();
    /* El texto de la demostración vive solo en esta rama: no queda en el build de producción. */
    if ((import.meta.env.DEV || import.meta.env.PUBLIC_ADMIN_DEMO === '1') && demo) {
      const nota = consulta<HTMLElement>('[data-nota-demo]');
      nota.textContent = 'Modo demostración activo: ingresa cualquier correo y contraseña para ver datos de ejemplo.';
      nota.hidden = false;
    }

    /* Si ya hay una sesión válida de administrador, se entra directo. */
    if (motivo !== 'salio' && motivo !== 'no-admin') {
      const usuario = await repo.obtenerUsuario().catch(() => null);
      if (usuario && (await repo.obtenerAdministrador(usuario.id).catch(() => null))) location.replace(destino());
    }

    formulario.addEventListener('submit', async (e) => {
      e.preventDefault();
      avisar(error, 'error', '');
      const datos = new FormData(formulario);
      const correo = String(datos.get('correo') ?? '').trim();
      const clave = String(datos.get('clave') ?? '');
      if (!correo || !clave) {
        avisar(error, 'error', 'Escribe tu correo y tu contraseña.');
        return;
      }
      const liberar = ocupar(boton, 'Entrando…');
      try {
        const r = await repo.iniciarSesion(correo, clave);
        if (!r.ok) {
          avisar(
            error,
            'error',
            r.motivo === 'credenciales'
              ? 'El correo o la contraseña no son correctos.'
              : r.motivo === 'red'
                ? 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'
                : 'No se pudo iniciar sesión. Inténtalo de nuevo.',
          );
          return;
        }
        const usuario = await repo.obtenerUsuario();
        const admin = usuario ? await repo.obtenerAdministrador(usuario.id) : null;
        if (!admin) {
          await repo.cerrarSesion().catch(() => undefined);
          avisar(error, 'error', MENSAJES_LOGIN['no-admin'] ?? '');
          return;
        }
        location.replace(destino());
      } catch {
        avisar(error, 'error', 'No se pudo iniciar sesión. Revisa tu conexión e inténtalo de nuevo.');
      } finally {
        liberar();
      }
    });
  } catch {
    avisar(error, 'error', 'No se pudo preparar el inicio de sesión. Recarga la página.');
  }

}

void iniciar();
