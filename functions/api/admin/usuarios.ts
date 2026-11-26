/* POST /api/admin/usuarios: crea una cuenta del CRM con contraseña temporal.

   Solo la jefatura (head coach o administración) puede llamarla. El navegador envía su
   sesión (`Authorization: Bearer …`); aquí se verifica contra Supabase Auth y contra la
   tabla `administradores`. La cuenta nace con `user_metadata.debe_cambiar_clave = true`:
   en el primer ingreso el CRM exige definir una contraseña propia. La clave de servicio
   solo existe en esta función. */
import type { ContextoFuncion, Entorno } from '../../../src/lib/servidor/entorno.ts';

const ROLES = ['head_coach', 'administracion', 'coach'] as const;
type Rol = (typeof ROLES)[number];
const LARGO_MINIMO_CLAVE = 10;
const LIMITE_CUERPO = 5_000;

const error = (estado: number, codigo: string) => Response.json({ error: codigo }, { status: estado });

const cabecerasServicio = (env: Entorno) => ({
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
});

/** Identifica a quien llama a partir de su token de sesión; `null` si no es válido. */
async function quienLlama(env: Entorno, request: Request): Promise<string | null> {
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!token) return null;
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const usuario = (await r.json()) as { id?: string };
  return typeof usuario.id === 'string' ? usuario.id : null;
}

async function esJefatura(env: Entorno, usuarioId: string): Promise<boolean> {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/administradores?user_id=eq.${encodeURIComponent(usuarioId)}&select=rol`, { headers: cabecerasServicio(env) });
  if (!r.ok) return false;
  const filas = (await r.json()) as { rol: string }[];
  return filas[0]?.rol === 'head_coach' || filas[0]?.rol === 'administracion';
}

export const onRequestPost = async ({ request, env }: ContextoFuncion): Promise<Response> => {
  if (Number(request.headers.get('content-length') ?? '0') > LIMITE_CUERPO) return error(413, 'cuerpo_muy_grande');

  let llamador: string | null;
  try {
    llamador = await quienLlama(env, request);
    if (!llamador) return error(401, 'sin_sesion');
    if (!(await esJefatura(env, llamador))) return error(403, 'sin_permiso');
  } catch {
    return error(503, 'no_disponible');
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = (await request.json()) as Record<string, unknown>;
  } catch {
    return error(400, 'json_invalido');
  }
  const nombre = typeof cuerpo['nombre'] === 'string' ? cuerpo['nombre'].trim() : '';
  const correo = typeof cuerpo['correo'] === 'string' ? cuerpo['correo'].trim().toLowerCase() : '';
  const rol = cuerpo['rol'];
  const clave = typeof cuerpo['clave'] === 'string' ? cuerpo['clave'] : '';
  if (nombre.length < 2 || nombre.length > 80) return error(400, 'nombre_invalido');
  if (correo.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return error(400, 'correo_invalido');
  if (typeof rol !== 'string' || !(ROLES as readonly string[]).includes(rol)) return error(400, 'rol_invalido');
  if (clave.length < LARGO_MINIMO_CLAVE || clave.length > 72) return error(400, 'clave_invalida');

  try {
    const creada = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: cabecerasServicio(env),
      body: JSON.stringify({ email: correo, password: clave, email_confirm: true, user_metadata: { debe_cambiar_clave: true, nombre } }),
    });
    if (!creada.ok) {
      const detalle = (await creada.text()).toLowerCase();
      if (creada.status === 422 && (detalle.includes('already') || detalle.includes('registered') || detalle.includes('exists'))) return error(409, 'correo_existente');
      if (creada.status === 422 && detalle.includes('password')) return error(400, 'clave_debil');
      console.error('No se pudo crear la cuenta', creada.status);
      return error(502, 'no_se_pudo_crear');
    }
    const usuario = (await creada.json()) as { id: string };

    const fila = await fetch(`${env.SUPABASE_URL}/rest/v1/administradores`, {
      method: 'POST',
      headers: { ...cabecerasServicio(env), Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: usuario.id, nombre, rol: rol as Rol, correo }),
    });
    if (!fila.ok) {
      /* Sin la fila en `administradores` la cuenta no sirve: se deshace para no dejar usuarios huérfanos. */
      await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${usuario.id}`, { method: 'DELETE', headers: cabecerasServicio(env) }).catch(() => undefined);
      console.error('No se pudo registrar el administrador', fila.status);
      return error(502, 'no_se_pudo_crear');
    }
    return Response.json({ ok: true, administrador: { user_id: usuario.id, nombre, rol, correo } }, { status: 201 });
  } catch {
    return error(503, 'no_disponible');
  }
};
