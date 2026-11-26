/* Arranque común de las páginas /admin: elige el repositorio (Supabase o demostración),
   protege la página y entrega el contexto. Se ejecuta solo en el navegador.

   Modo demostración: `?demo=1` y (`import.meta.env.DEV` o PUBLIC_ADMIN_DEMO=1). Una vez activado
   se recuerda en sessionStorage durante la pestaña; `?demo=0` lo apaga. Nunca se activa por
   defecto ni sin esa condición: en producción el código de demostración ni siquiera se empaqueta. */

import { esc } from './formato.ts';
import type { DatosBase } from './demo.ts';
import { ErrorAdmin } from './errores.ts';
import type { Repositorio } from './repositorio.ts';
import { CLAVE_PUBLICABLE_POR_DEFECTO, URL_SUPABASE_POR_DEFECTO } from './supabase.ts';
import type { Administrador, Usuario } from './tipos.ts';

export interface DatosPagina extends DatosBase {
  programas: Record<string, string>;
  promociones: string[];
  habilidades: Record<string, string>;
  telefonoClub: string;
}

export interface Contexto {
  repo: Repositorio;
  usuario: Usuario;
  admin: Administrador;
  datos: DatosPagina;
  demo: boolean;
}

const CLAVE_DEMO = 'huracan-admin-demo';

function leerDatos(): DatosPagina {
  const nodo = document.getElementById('admin-datos');
  if (!nodo?.textContent) throw new Error('Faltan los datos del CRM en la página.');
  return JSON.parse(nodo.textContent) as DatosPagina;
}

/** ¿Se puede usar la demostración en esta compilación? */
export function demoPermitida(): boolean {
  return import.meta.env.DEV === true || import.meta.env.PUBLIC_ADMIN_DEMO === '1';
}

function demoSolicitada(): boolean {
  if (!demoPermitida()) return false;
  const param = new URLSearchParams(location.search).get('demo');
  try {
    if (param === '1') sessionStorage.setItem(CLAVE_DEMO, '1');
    if (param === '0') sessionStorage.removeItem(CLAVE_DEMO);
    return sessionStorage.getItem(CLAVE_DEMO) === '1';
  } catch {
    return param === '1';
  }
}

async function crearRepositorio(datos: DatosPagina): Promise<{ repo: Repositorio; demo: boolean }> {
  /* La condición va escrita aquí (no en una función) para que el empaquetador elimine la demostración en producción. */
  if ((import.meta.env.DEV || import.meta.env.PUBLIC_ADMIN_DEMO === '1') && demoSolicitada()) {
    const { crearRepositorioDemo } = await import('./demo.ts');
    let almacen: Storage | null = null;
    try {
      almacen = sessionStorage;
    } catch {
      /* sin almacenamiento */
    }
    return { repo: crearRepositorioDemo(datos, almacen), demo: true };
  }
  const { crearRepositorioSupabase } = await import('./supabase.ts');
  const url = import.meta.env.PUBLIC_SUPABASE_URL || URL_SUPABASE_POR_DEFECTO;
  const clave = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || CLAVE_PUBLICABLE_POR_DEFECTO;
  return { repo: await crearRepositorioSupabase(url, clave), demo: false };
}

export function irALogin(motivo: 'sin-sesion' | 'no-admin' | 'vencida'): never {
  const volver = location.pathname + location.search;
  const params = new URLSearchParams({ motivo });
  if (volver !== '/admin/login') params.set('volver', volver);
  location.replace(`/admin/login?${params.toString()}`);
  throw new ErrorAdmin('Redirigiendo al inicio de sesión.');
}

export const MENSAJES_LOGIN: Record<string, string> = {
  'sin-sesion': 'Inicia sesión para entrar a la administración.',
  vencida: 'Tu sesión venció. Inicia sesión de nuevo.',
  'no-admin': 'Tu cuenta no tiene acceso a la administración. Pídele al head coach que te habilite.',
  salio: 'Cerraste sesión.',
  'clave-nueva': 'Tu contraseña se actualizó. Ingresa con la nueva.',
};

/** Arranque de una página protegida. Redirige al login si falta la sesión o el permiso. */
export async function arrancar(): Promise<Contexto> {
  const datos = leerDatos();
  const { repo, demo } = await crearRepositorio(datos);
  const usuario = await repo.obtenerUsuario().catch((e: unknown) => {
    if (e instanceof ErrorAdmin && e.tipo === 'red') throw e;
    return null;
  });
  if (!usuario) irALogin('sin-sesion');
  /* Cuenta con contraseña temporal: antes de usar el CRM debe definir la suya. */
  if (usuario.debeCambiarClave) {
    location.replace('/admin/nueva-clave?primera=1');
    throw new ErrorAdmin('Redirigiendo al cambio de contraseña.');
  }
  const admin = await repo.obtenerAdministrador(usuario.id).catch((e: unknown) => {
    if (e instanceof ErrorAdmin && e.tipo === 'red') throw e;
    return null;
  });
  if (!admin) {
    await repo.cerrarSesion().catch(() => undefined);
    irALogin('no-admin');
  }
  prepararCabecera({ repo, usuario, admin, datos, demo });
  return { repo, usuario, admin, datos, demo };
}

/** Para el login: crea el repositorio sin exigir sesión. */
export async function arrancarLogin(): Promise<{ repo: Repositorio; datos: DatosPagina; demo: boolean }> {
  const datos = leerDatos();
  const { repo, demo } = await crearRepositorio(datos);
  return { repo, datos, demo };
}

/** Muestra el usuario, el aviso de demostración y el botón de cerrar sesión de la cabecera. */
function prepararCabecera(c: Contexto): void {
  const zona = document.querySelector<HTMLElement>('[data-sesion]');
  if (zona) {
    zona.hidden = false;
    const nombre = zona.querySelector<HTMLElement>('[data-usuario]');
    if (nombre) nombre.textContent = c.admin.nombre;
    zona.querySelector<HTMLButtonElement>('[data-salir]')?.addEventListener('click', async () => {
      await c.repo.cerrarSesion().catch(() => undefined);
      try {
        if ((import.meta.env.DEV || import.meta.env.PUBLIC_ADMIN_DEMO === '1') && c.demo) sessionStorage.removeItem(CLAVE_DEMO);
      } catch {
        /* sin almacenamiento */
      }
      location.replace('/admin/login?motivo=salio');
    });
  }
  /* «Usuarios» solo se ofrece a la jefatura (la página y la función de servidor lo vuelven a exigir). */
  if (c.admin.rol !== 'coach') document.querySelectorAll<HTMLElement>('[data-solo-jefatura]').forEach((el) => (el.hidden = false));
  /* Texto y llave de la demostración solo dentro de esta condición: el build normal los elimina. */
  if ((import.meta.env.DEV || import.meta.env.PUBLIC_ADMIN_DEMO === '1') && c.demo) {
    const aviso = document.querySelector<HTMLElement>('[data-aviso-demo]');
    if (aviso) {
      aviso.hidden = false;
      aviso.innerHTML = `<strong>Modo demostración.</strong> Los datos son de ejemplo y no se guardan en el servidor. <a href="?demo=0">Salir de la demostración</a>`;
    }
  }
}

/** Reemplaza el estado de carga por el contenido (o por un error con opción de reintentar). */
export function mostrarContenido(): void {
  document.querySelector<HTMLElement>('[data-carga]')?.setAttribute('hidden', '');
  document.querySelector<HTMLElement>('[data-contenido]')?.removeAttribute('hidden');
}

export function mostrarErrorGeneral(error: unknown, reintentar?: () => void): void {
  const mensaje = error instanceof ErrorAdmin ? error.message : 'Ocurrió un error inesperado al cargar la página.';
  const caja = document.querySelector<HTMLElement>('[data-carga]');
  if (!caja) return;
  caja.removeAttribute('hidden');
  caja.className = 'adm-aviso adm-aviso--error';
  caja.setAttribute('role', 'alert');
  caja.innerHTML = `<p>${esc(mensaje)}</p>${reintentar ? '<button type="button" class="adm-btn" data-reintentar>Reintentar</button>' : ''}`;
  caja.querySelector('[data-reintentar]')?.addEventListener('click', () => reintentar?.());
}
