/* Variables de entorno de las Pages Functions. Todas son secretos o valores del
   despliegue: se cargan en Cloudflare (cifradas) y, en local, en `.dev.vars`
   (ver `.dev.vars.example`). Nunca van en el repositorio. */
export interface Entorno {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY?: string;
  /** Remitente verificado en Resend, p. ej. `Huracán All Stars <hola@dominio>`. */
  CORREO_ORIGEN?: string;
  /** Copia oculta para el head coach (opcional). */
  CORREO_COACH?: string;
  /** Datos de transferencia en texto (varias líneas). Solo viajan en el correo. */
  DATOS_TRANSFERENCIA?: string;
}

export interface ContextoFuncion {
  request: Request;
  env: Entorno;
}
