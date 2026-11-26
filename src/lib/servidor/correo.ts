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
  /** Dirección del gimnasio e indicaciones desde el metro (salen del contenido del club). */
  direccion?: string;
  comoLlegar?: string[];
  /** Correo alternativo para enviar el comprobante de pago. */
  correoPagos?: string;
}

const escapar = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function lineaJornada(d: DatosCorreo): string {
  const j = d.evaluacion.jornada;
  if (j.tipo === 'sin-evaluacion' && j.motivo === 'sin-equipo') return 'El head coach te contactará por WhatsApp para orientarte y coordinar tu evaluación.';
  if (j.tipo === 'sin-evaluacion') return 'Los equipos Tiny no tienen evaluación: pasan directo a su primera práctica. El head coach te indicará día y hora.';
  if (j.tipo === 'inicio-diferido') {
    const inicios = j.inicios.map((i) => `${i.equipo.replace('Huracán ', '')} comienza en ${i.inicio}`).join('; ');
    return `${inicios}. No pasa por la evaluación de diciembre: el head coach te avisará por WhatsApp.`;
  }
  return d.jornadaTexto ? `Tu evaluación: ${d.jornadaTexto}. Llega 10 minutos antes.` : 'Tu evaluación está por confirmar.';
}

/* ── HTML de marca ──────────────────────────────────────────
   Compatible con clientes de correo: tablas, estilos en línea, Arial/Helvetica, sin JS ni CSS
   externo ni fuentes web. Fondo exterior negro, tarjeta blanca con texto negro (nunca amarillo
   sobre blanco): el amarillo solo va sobre negro. Todo valor dinámico se escapa. */
const NEGRO = '#0A0A0A';
const AMARILLO = '#FFF30B';
const FUENTE = "Arial,Helvetica,sans-serif";
const MONO = "'Courier New',Courier,monospace";

const parrafo = (t: string, extra = '') => `<p style="margin:0 0 12px;font-family:${FUENTE};font-size:15px;line-height:22px;color:${NEGRO};${extra}">${escapar(t).replace(/\n/g, '<br>')}</p>`;

/** Bloque con título (rótulo en mayúsculas con filete negro) y contenido, separado del siguiente. */
const bloque = (titulo: string, contenido: string) =>
  `<tr><td style="padding:0 28px 24px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 0 8px 0;border-bottom:3px solid ${NEGRO};font-family:${FUENTE};font-size:12px;line-height:16px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${NEGRO}">${escapar(titulo)}</td></tr><tr><td style="padding:14px 0 0 0">${contenido}</td></tr></table></td></tr>`;

interface FilaMonto {
  etiqueta: string;
  valor: string;
  total?: boolean;
}

function tablaMontos(filas: FilaMonto[]): string {
  const celdas = filas
    .map((f, n) => {
      const borde = n < filas.length - 1 ? 'border-bottom:1px solid #D4D4D4;' : '';
      const peso = f.total ? 'font-weight:bold;' : '';
      const fondo = f.total ? 'background-color:#F2F2F2;' : '';
      return `<tr><td style="padding:10px 12px;${borde}${fondo}font-family:${FUENTE};font-size:14px;line-height:20px;color:${NEGRO};${peso}">${escapar(f.etiqueta)}</td><td align="right" style="padding:10px 12px;${borde}${fondo}white-space:nowrap;font-family:${FUENTE};font-size:14px;line-height:20px;color:${NEGRO};font-weight:bold">${escapar(f.valor)}</td></tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #D4D4D4;margin:0 0 12px 0">${celdas}</table>`;
}

function htmlCorreo(d: DatosCorreo, p: { equipos: string; filas: FilaMonto[]; notasMontos: string[]; diferido: boolean; sinEquipo: boolean; transferencia: string | undefined; cierre: string }): string {
  const intro = `<tr><td style="padding:28px 28px 20px 28px">${parrafo(`Recibimos la preinscripción de ${d.atleta} para la temporada 2027.`, 'font-size:17px;line-height:24px;font-weight:bold;margin:0')}</td></tr>`;
  const codigo = `<tr><td style="padding:0 28px 24px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="background-color:${AMARILLO};padding:16px 12px;font-family:${FUENTE};color:${NEGRO}"><div style="font-size:12px;line-height:16px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:${NEGRO}">Código de postulación</div><div style="padding-top:4px;font-size:28px;line-height:34px;font-weight:bold;letter-spacing:2px;color:${NEGRO}">${escapar(d.codigo)}</div></td></tr></table></td></tr>`;
  const equipos = p.sinEquipo
    ? bloque('Equipos sugeridos', parrafo('Por ahora no tenemos un equipo sugerido para estos datos. El head coach te orientará por WhatsApp.', 'margin:0'))
    : bloque('Equipos sugeridos', parrafo(p.equipos, 'font-weight:bold;margin:0 0 6px') + parrafo('El head coach confirma el equipo final en la evaluación.', 'margin:0'));
  const jornada = bloque('Evaluación', parrafo(lineaJornada(d), 'margin:0'));
  const llegar =
    d.comoLlegar && d.comoLlegar.length > 0
      ? bloque(
          'Cómo llegar',
          (d.direccion ? parrafo(d.direccion, 'font-weight:bold;margin:0 0 8px') : '') +
            d.comoLlegar.map((paso, k) => parrafo(`${k + 1}. ${paso}`, 'margin:0 0 4px')).join(''),
        )
      : '';
  const montos = p.filas.length > 0 || p.notasMontos.length > 0 ? bloque('Montos', (p.filas.length > 0 ? tablaMontos(p.filas) : '') + p.notasMontos.map((n, k) => parrafo(n, k === p.notasMontos.length - 1 ? 'margin:0' : '')).join('')) : '';
  let pago = '';
  if (!p.diferido) {
    const caja = p.transferencia
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px 0"><tr><td style="background-color:#EDEDED;border:1px solid #D4D4D4;padding:14px 16px;font-family:${MONO};font-size:14px;line-height:21px;color:${NEGRO};white-space:pre-wrap">${escapar(p.transferencia).replace(/\n/g, '<br>')}</td></tr></table>`
      : parrafo('Los datos de transferencia te los enviará el head coach.', 'margin:0 0 12px');
    pago = bloque('Datos de transferencia', caja + parrafo(p.cierre, 'margin:0'));
  } else {
    pago = bloque('Dudas', parrafo(p.cierre, 'margin:0'));
  }
  const numero = d.whatsappHeadCoach.replace(/\D/g, '');
  const contacto = numero
    ? `<a href="https://wa.me/${escapar(numero)}" style="color:${AMARILLO};text-decoration:underline">${escapar(d.whatsappTexto)}</a>`
    : escapar(d.whatsappTexto);
  const pie = `<tr><td align="center" style="background-color:${NEGRO};padding:22px 28px;font-family:${FUENTE};font-size:13px;line-height:20px;color:#D4D4D4"><div style="font-weight:bold;color:#FFFFFF">Head coach · WhatsApp ${contacto}</div><div style="padding-top:8px;color:#A3A3A3">Huracán All Stars · The power from the wind</div></td></tr>`;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${escapar(`Postulación ${d.codigo} · Huracán All Stars 2027`)}</title></head><body style="margin:0;padding:0;background-color:${NEGRO}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${NEGRO}"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%"><tr><td align="left" style="background-color:${NEGRO};padding:8px 28px 22px 28px;border-bottom:6px solid ${AMARILLO}"><div style="font-family:${FUENTE};font-size:28px;line-height:32px;font-weight:bold;font-style:italic;letter-spacing:1px;text-transform:uppercase;color:${AMARILLO}">HURACÁN ALL STARS</div><div style="padding-top:4px;font-family:${FUENTE};font-size:14px;line-height:20px;color:#FFFFFF">The power from the wind</div></td></tr><tr><td style="background-color:#FFFFFF"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${intro}${codigo}${equipos}${jornada}${montos}${pago}${llegar}</table></td></tr>${pie}</table></td></tr></table></body></html>`;
}

export function construirCorreo(d: DatosCorreo, transferencia: string | undefined): { asunto: string; texto: string; html: string } {
  const i = d.evaluacion.ingresoEstimado;
  const equipos = d.evaluacion.equipos.map((e) => e.nombre).join(', ') || 'por definir con el head coach';
  const diferido = d.evaluacion.jornada.tipo === 'inicio-diferido';
  const sinEquipo = d.evaluacion.equipos.length === 0;
  /* Sin pago por ahora: inicio diferido o sin equipo sugerido (el head coach orienta). */
  const sinPago = diferido || sinEquipo;
  const filas: FilaMonto[] = [];
  const notasMontos: string[] = [];
  if (i && diferido) {
    filas.push({ etiqueta: 'Mensualidad Recreativo (en efectivo al head coach en la primera clase)', valor: formatoPeso(i.mensualidad) });
    notasMontos.push(`Por transferencia pagarás ${conceptosInicioDiferido(d.evaluacion.equipos)}. Esos valores se informarán más adelante; el head coach te los confirmará antes del inicio.`);
  } else if (i) {
    filas.push({ etiqueta: 'Inscripción', valor: formatoPeso(i.inscripcion) });
    filas.push({ etiqueta: i.mensualidadEnEfectivo ? 'Mensualidad (en efectivo al head coach en la primera clase)' : 'Mensualidad', valor: formatoPeso(i.mensualidad) });
    filas.push({ etiqueta: 'Primera cuota de vestimenta de entrenamiento', valor: formatoPeso(i.ropaPrimeraCuota) });
    if (i.cinta > 0) filas.push({ etiqueta: 'Cinta de entrenamiento', valor: formatoPeso(i.cinta) });
    filas.push({ etiqueta: 'Total a transferir (estimado)', valor: formatoPeso(i.total), total: true });
  }
  /* El orden de notas y filas es el del texto plano: en inicio diferido la nota va tras la fila. */
  const montos = [...filas.map((f) => `${f.etiqueta}: ${f.valor}`), ...notasMontos];
  const cierre = sinPago
    ? `Si tienes dudas, escribe al head coach por WhatsApp (${d.whatsappTexto}) indicando tu código ${d.codigo}.`
    : `Después de pagar, envía el comprobante al head coach por WhatsApp (${d.whatsappTexto}) indicando tu código ${d.codigo}.${
        d.correoPagos
          ? ` También puedes enviarlo al correo ${d.correoPagos}, indicando en el asunto el nombre del deportista, quién paga y qué pagas.`
          : ''
      }`;
  if (!sinPago) notasMontos.push('El monto es una estimación sin promociones. El head coach confirma equipo, promoción y monto final.');
  const lineas = [
    `Recibimos la preinscripción de ${d.atleta} para la temporada 2027.`,
    `Código de postulación: ${d.codigo}`,
    '',
    sinEquipo
      ? 'Por ahora no tenemos un equipo sugerido para estos datos. El head coach te orientará por WhatsApp.'
      : `Equipos sugeridos: ${equipos}. El head coach confirma el equipo final en la evaluación.`,
    lineaJornada(d),
    '',
    ...montos,
    ...(sinPago
      ? ['', cierre]
      : [
          'El monto es una estimación sin promociones. El head coach confirma equipo, promoción y monto final.',
          '',
          transferencia ? `Datos de transferencia:\n${transferencia}` : 'Los datos de transferencia te los enviará el head coach.',
          '',
          cierre,
        ]),
    ...(d.comoLlegar && d.comoLlegar.length > 0
      ? ['', `Cómo llegar${d.direccion ? ` · ${d.direccion}` : ''}:`, ...d.comoLlegar.map((paso, k) => `${k + 1}. ${paso}`)]
      : []),
    '',
    'Huracán All Stars · The power from the wind',
  ];
  const texto = lineas.join('\n');
  const html = htmlCorreo(d, { equipos, filas, notasMontos, diferido: sinPago, sinEquipo, transferencia, cierre });
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
