/* Horario habitual de cada equipo, leído de los bloques de tipo «equipo» del contenido oficial.
   Desde la semana siguiente a las audiciones, la evaluación es en este horario (confirmado por
   el club, 26 nov 2026). Lo usan la interfaz, el servidor y el correo. */

export interface Franja {
  dia: string;
  inicio: string;
  fin: string;
}

interface BloqueHorario {
  inicio: string;
  fin: string;
  texto: string;
  tipo: string;
}

export interface DiaHorario {
  dia: string;
  bloques: BloqueHorario[];
}

/** `Huracán Xplotion` → `Xplotion`. */
export const nombreCortoEquipo = (nombre: string): string => nombre.replace(/^Huracán\s+/, '');

/** Franjas por nombre completo de equipo. Los equipos sin horario (Spirit, Team Parent) quedan con lista vacía. */
export function franjasPorEquipo(horarios: readonly DiaHorario[], nombres: readonly string[]): Record<string, Franja[]> {
  const resultado: Record<string, Franja[]> = {};
  for (const nombre of nombres) {
    const corto = nombreCortoEquipo(nombre);
    const franjas: Franja[] = [];
    for (const dia of horarios) {
      for (const b of dia.bloques) {
        if (b.tipo !== 'equipo') continue;
        const equipos = b.texto.split('·').map((t) => t.trim());
        if (equipos.includes(corto)) franjas.push({ dia: dia.dia, inicio: b.inicio, fin: b.fin });
      }
    }
    resultado[nombre] = franjas;
  }
  return resultado;
}

/** `Lunes 18:00 a 20:00; sábado 08:00 a 10:00`. */
export function textoFranjas(franjas: readonly Franja[]): string {
  return franjas.map((f) => `${f.dia} ${f.inicio} a ${f.fin}`).join('; ');
}

/** Frase para el resultado, el correo y el mensaje de WhatsApp. */
export function textoHorarioEquipo(nombre: string, franjas: readonly Franja[]): string {
  const corto = nombreCortoEquipo(nombre);
  return franjas.length > 0 ? `el horario habitual de ${corto}: ${textoFranjas(franjas)}` : `el horario habitual de ${corto} (el head coach te lo confirmará)`;
}
