/* Correo de confirmación de la preinscripción (Resend). Si falta la clave o el remitente,
   no se envía y la API lo informa: la postulación igual queda guardada. */
import type { Entorno } from './entorno.ts';
import { conceptosInicioDiferido, formatoPeso, type Evaluacion } from '../postulacion/reglas.ts';

export interface DatosCorreo {
  codigo: string;
  atleta: string;
  para: string;
  evaluacion: Evaluacion;
  /** Texto de la jornada elegida, p. ej. «Viernes 4 de diciembre, 18:00 a 20:00». */
  jornadaTexto: string | null;
  whatsappHeadCoach: string;
  whatsappTexto: string;
}

const escapar = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function lineaJornada(d: DatosCorreo): string {
  const j = d.evaluacion.jornada;
  if (j.tipo === 'sin-evaluacion') return 'Los equipos Tiny no tienen evaluación: pasan directo a su primera práctica. El head coach te indicará día y hora.';
  if (j.tipo === 'inicio-diferido') {
    const inicios = j.inicios.map((i) => `${i.equipo.replace('Huracán ', '')} comienza en ${i.inicio}`).join('; ');
    return `${inicios}. No pasa por la evaluación de diciembre: el head coach te avisará por WhatsApp.`;
  }
  return d.jornadaTexto ? `Tu evaluación: ${d.jornadaTexto}. Llega 10 minutos antes.` : 'Tu evaluación está por confirmar.';
}

export function construirCorreo(d: DatosCorreo, transferencia: string | undefined): { asunto: string; texto: string; html: string } {
  const i = d.evaluacion.ingresoEstimado;
  const equipos = d.evaluacion.equipos.map((e) => e.nombre).join(', ') || 'por definir con el head coach';
  const diferido = d.evaluacion.jornada.tipo === 'inicio-diferido';
  const montos: string[] = [];
  if (i && diferido) {
    montos.push(`Mensualidad Recreativo (en efectivo al head coach en la primera clase): ${formatoPeso(i.mensualidad)}`);
    montos.push(`Por transferencia pagarás ${conceptosInicioDiferido(d.evaluacion.equipos)}. Esos valores se informarán más adelante; el head coach te los confirmará antes del inicio.`);
  } else if (i) {
    montos.push(`Inscripción: ${formatoPeso(i.inscripcion)}`);
    montos.push(i.mensualidadEnEfectivo ? `Mensualidad (en efectivo al head coach en la primera clase): ${formatoPeso(i.mensualidad)}` : `Mensualidad: ${formatoPeso(i.mensualidad)}`);
    montos.push(`Primera cuota de vestimenta de entrenamiento: ${formatoPeso(i.ropaPrimeraCuota)}`);
    if (i.cinta > 0) montos.push(`Cinta de entrenamiento: ${formatoPeso(i.cinta)}`);
    montos.push(`Total a transferir (estimado): ${formatoPeso(i.total)}`);
  }
  const lineas = [
    `Recibimos la preinscripción de ${d.atleta} para la temporada 2027.`,
    `Código de postulación: ${d.codigo}`,
    '',
    `Equipos sugeridos: ${equipos}. El head coach confirma el equipo final en la evaluación.`,
    lineaJornada(d),
    '',
    ...montos,
    ...(diferido
      ? ['', `Si tienes dudas, escribe al head coach por WhatsApp (${d.whatsappTexto}) indicando tu código ${d.codigo}.`]
      : [
          'El monto es una estimación sin promociones. El head coach confirma equipo, promoción y monto final.',
          '',
          transferencia ? `Datos de transferencia:\n${transferencia}` : 'Los datos de transferencia te los enviará el head coach.',
          '',
          `Después de pagar, envía el comprobante al head coach por WhatsApp (${d.whatsappTexto}) indicando tu código ${d.codigo}.`,
        ]),
    '',
    'Huracán All Stars · The power from the wind',
  ];
  const texto = lineas.join('\n');
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">${lineas
    .map((l) => (l === '' ? '<br>' : `<p style="margin:0 0 6px">${escapar(l).replace(/\n/g, '<br>')}</p>`))
    .join('')}</div>`;
  return { asunto: `Postulación ${d.codigo} · Huracán All Stars 2027`, texto, html };
}

export async function enviarCorreo(env: Entorno, d: DatosCorreo): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.CORREO_ORIGEN) {
    console.warn('Correo no enviado: faltan RESEND_API_KEY o CORREO_ORIGEN.');
    return false;
  }
  const { asunto, texto, html } = construirCorreo(d, env.DATOS_TRANSFERENCIA);
  const respuesta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.CORREO_ORIGEN,
      to: [d.para],
      ...(env.CORREO_COACH ? { bcc: [env.CORREO_COACH] } : {}),
      subject: asunto,
      text: texto,
      html,
    }),
  });
  if (!respuesta.ok) {
    console.error('Resend rechazó el correo', respuesta.status);
    return false;
  }
  return true;
}
