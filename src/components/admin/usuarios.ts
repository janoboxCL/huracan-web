import { arrancar, mostrarContenido, mostrarErrorGeneral } from '../../lib/admin/arranque.ts';
import { ErrorAdmin } from '../../lib/admin/errores.ts';
import { esc } from '../../lib/admin/formato.ts';
import type { Administrador, RolAdmin } from '../../lib/admin/tipos.ts';
import { avisar, consulta, ocupar } from './ui.ts';

const ETIQUETA_ROL: Record<RolAdmin, string> = { head_coach: 'Head coach', administracion: 'Administración', coach: 'Coach' };

/* Sin caracteres ambiguos (0/O, 1/l/I) para que se pueda dictar o copiar sin errores. */
const ALFABETO = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generarClave(largo = 14): string {
  const azar = new Uint32Array(largo);
  crypto.getRandomValues(azar);
  return Array.from(azar, (n) => ALFABETO[n % ALFABETO.length]).join('');
}

function pintarLista(cuentas: Administrador[]): void {
  consulta<HTMLElement>('[data-lista]').innerHTML = cuentas
    .map((c) => `<tr><th scope="row">${esc(c.nombre)}</th><td>${esc(c.correo ?? '—')}</td><td>${esc(ETIQUETA_ROL[c.rol])}</td></tr>`)
    .join('');
}

async function iniciar(): Promise<void> {
  try {
    const ctx = await arrancar();
    mostrarContenido();
    if (ctx.admin.rol === 'coach') {
      consulta<HTMLElement>('[data-sin-permiso]').hidden = false;
      return;
    }
    consulta<HTMLElement>('[data-panel]').hidden = false;

    const form = consulta<HTMLFormElement>('[data-formulario]');
    const aviso = consulta<HTMLElement>('[data-aviso]');
    const boton = consulta<HTMLButtonElement>('[data-crear]');
    const campoClave = consulta<HTMLInputElement>('#u-clave');
    let cuentas = await ctx.repo.listarAdministradores();
    pintarLista(cuentas);

    consulta('[data-generar]').addEventListener('click', () => {
      campoClave.value = generarClave();
      campoClave.focus();
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      avisar(aviso, 'error', '');
      const datos = new FormData(form);
      const nombre = String(datos.get('nombre') ?? '').trim();
      const correo = String(datos.get('correo') ?? '').trim().toLowerCase();
      const rol = String(datos.get('rol') ?? 'coach') as RolAdmin;
      const claveTemporal = String(datos.get('clave') ?? '');
      if (nombre.length < 2) return avisar(aviso, 'error', 'Escribe el nombre de la persona.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return avisar(aviso, 'error', 'Escribe un correo válido.');
      if (claveTemporal.length < 10) return avisar(aviso, 'error', 'La contraseña temporal debe tener al menos 10 caracteres. Puedes generar una.');
      const liberar = ocupar(boton, 'Creando…');
      try {
        const creada = await ctx.repo.crearUsuario({ nombre, correo, rol, claveTemporal });
        cuentas = [...cuentas, creada];
        pintarLista(cuentas);
        form.reset();
        avisar(aviso, 'ok', `Cuenta creada para ${nombre}. Entrégale el correo ${correo} y la contraseña temporal ${claveTemporal}: al ingresar por primera vez tendrá que definir una propia. Esta contraseña no se vuelve a mostrar.`);
      } catch (err) {
        avisar(aviso, 'error', err instanceof ErrorAdmin ? err.message : 'No se pudo crear la cuenta.');
      } finally {
        liberar();
      }
    });
  } catch (e) {
    mostrarErrorGeneral(e, () => location.reload());
  }
}

void iniciar();
