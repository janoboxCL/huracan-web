/* Pruebas de la validación del servidor y del correo de confirmación. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluarPostulacion, preciosDesdeContenido, type ContenidoPrecios, type EquipoBase } from '../postulacion/reglas.ts';
import { readFileSync } from 'node:fs';
import { construirCorreo } from './correo.ts';
import { normalizarTelefono, validarPostulacion } from './validar.ts';

const base = {
  atletaNombre: 'Sofía',
  atletaApellido: 'Pérez',
  fechaNacimiento: '2016-05-20',
  sexo: 'dama',
  comuna: 'San Miguel',
  esAntiguo: false,
  experiencia: 'ninguna',
  habilidades: [],
  contactoNombre: 'Carolina Soto',
  contactoParentesco: 'madre',
  contactoTelefono: '9 1234 5678',
  contactoCorreo: 'Carolina@Correo.cl',
  jornadaId: '2026-12-05-1200',
};

test('normaliza teléfonos chilenos', () => {
  assert.equal(normalizarTelefono('9 1234 5678'), '+56912345678');
  assert.equal(normalizarTelefono('+56 9 1234 5678'), '+56912345678');
  assert.equal(normalizarTelefono('212345678'), null);
  assert.equal(normalizarTelefono(912345678), null);
});

test('acepta una postulación válida y normaliza correo y teléfono', () => {
  const r = validarPostulacion(base);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.datos.contactoTelefono, '+56912345678');
    assert.equal(r.datos.contactoCorreo, 'carolina@correo.cl');
    assert.equal(r.datos.tipoPostulacion, 'individual');
  }
});

test('rechaza campos faltantes, fechas imposibles y habilidades desconocidas', () => {
  const r = validarPostulacion({ ...base, atletaNombre: '', fechaNacimiento: '2016-02-31', habilidades: ['inventada'] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(r.campos.sort(), ['atletaNombre', 'fechaNacimiento', 'habilidades']);
});

test('rechaza cuerpos que no son objetos', () => {
  assert.equal(validarPostulacion(null).ok, false);
  assert.equal(validarPostulacion([]).ok, false);
  assert.equal(validarPostulacion('x').ok, false);
});

test('el correo escapa HTML y no incluye datos bancarios si no se configuran', () => {
  const json = JSON.parse(readFileSync(new URL('../../../docs/contenido/huracan-2027.json', import.meta.url), 'utf8')) as { equipos: EquipoBase[] } & ContenidoPrecios;
  const evaluacion = evaluarPostulacion(json.equipos, preciosDesdeContenido(json), { edad: 10, genero: 'dama', experiencia: 'ninguna' });
  const c = construirCorreo(
    { codigo: 'HUR-ABC234', atleta: '<b>Sofía</b>', para: 'a@b.cl', evaluacion, jornadaTexto: 'Sábado 5 de diciembre, 12:00 a 14:00', whatsappHeadCoach: '+56954959681', whatsappTexto: '+56 9 5495 9681' },
    undefined,
  );
  assert.ok(!c.html.includes('<b>Sofía</b>'));
  assert.ok(c.html.includes('&lt;b&gt;'));
  assert.ok(c.texto.includes('HUR-ABC234'));
  assert.ok(c.texto.includes('Los datos de transferencia te los enviará el head coach.'));
  assert.ok(c.texto.includes('$95.000'));
});

test('comuna: acepta una de la lista o el texto libre de «otra», pero no la etiqueta sola', () => {
  const r1 = validarPostulacion({ ...base, comuna: 'Ñuñoa' });
  assert.ok(r1.ok && r1.datos.comuna === 'Ñuñoa');
  const r2 = validarPostulacion({ ...base, comuna: 'Rancagua, O’Higgins' });
  assert.ok(r2.ok && r2.datos.comuna === 'Rancagua, O’Higgins');
  for (const comuna of ['Otra comuna o región', '', '   ', undefined]) {
    const r = validarPostulacion({ ...base, comuna });
    assert.ok(!r.ok && r.campos.includes('comuna'));
  }
});

/* ── Correo con diseño de marca ─────────────────────────────── */
const contenido = JSON.parse(readFileSync(new URL('../../../docs/contenido/huracan-2027.json', import.meta.url), 'utf8')) as { equipos: EquipoBase[] } & ContenidoPrecios;
const correoDe = (p: Parameters<typeof evaluarPostulacion>[2], transferencia?: string, atleta = 'Sofía Pérez') =>
  construirCorreo(
    { codigo: 'HUR-ABC234', atleta, para: 'a@b.cl', evaluacion: evaluarPostulacion(contenido.equipos, preciosDesdeContenido(contenido), p), jornadaTexto: 'Sábado 5 de diciembre, 12:00 a 14:00', whatsappHeadCoach: '+56954959681', whatsappTexto: '+56 9 5495 9681' },
    transferencia,
  );

test('correo HTML: código y montos aparecen, sin scripts ni recursos externos', () => {
  const c = correoDe({ edad: 10, genero: 'dama', experiencia: 'ninguna' }, 'Banco Prueba\nCuenta 123');
  assert.ok(c.html.includes('HUR-ABC234'));
  for (const monto of c.texto.match(/\$\d{1,3}(\.\d{3})+/g) ?? []) assert.ok(c.html.includes(monto), monto);
  assert.ok(c.html.includes('Total a transferir (estimado)'));
  assert.ok(c.html.includes('Banco Prueba<br>Cuenta 123'));
  assert.ok(c.html.includes('#FFF30B') && c.html.includes('#0A0A0A') && c.html.includes('HURACÁN ALL STARS') && c.html.includes('The power from the wind'));
  assert.ok(!/<script/i.test(c.html));
  assert.ok(!/<link|@import|@font-face|<style/i.test(c.html));
  assert.ok(c.html.includes('max-width:600px'));
});

test('correo HTML: escapa todos los valores dinámicos', () => {
  const c = correoDe({ edad: 10, genero: 'dama', experiencia: 'ninguna' }, '<script>alert(1)</script>\n"x" & \'y\'', '<img src=x onerror=1> & Co');
  assert.ok(!/<script/i.test(c.html));
  assert.ok(!c.html.includes('<img'));
  assert.ok(c.html.includes('&lt;img src=x onerror=1&gt; &amp; Co'));
  assert.ok(c.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(c.html.includes('&quot;x&quot; &amp; &#39;y&#39;'));
});

test('correo HTML: el inicio diferido no pide transferir montos de otras ramas', () => {
  const c = correoDe({ edad: 10, genero: 'dama', experiencia: 'ninguna', modalidad: 'recreativo' }, 'Banco Prueba');
  assert.ok(c.html.includes('Mensualidad Recreativo'));
  assert.ok(c.html.includes('Esos valores se informarán más adelante'));
  for (const ausente of ['Total a transferir', 'Inscripción', 'Primera cuota', 'Banco Prueba', 'Datos de transferencia', 'enviá', 'comprobante', 'Evaluación: ']) assert.ok(!c.html.includes(ausente), ausente);
  assert.ok(c.html.includes('Si tienes dudas'));
});

test('correo HTML: sin evaluación (Tiny) conserva la frase de primera práctica', () => {
  const c = correoDe({ edad: 4, genero: 'dama', experiencia: 'ninguna' });
  assert.ok(c.html.includes('Los equipos Tiny no tienen evaluación'));
});

test('correo: incluye «Cómo llegar» con dirección e indicaciones cuando se entregan', () => {
  const base = {
    codigo: 'HUR-TEST01',
    atleta: 'Atleta Prueba',
    para: 'familia@example.com',
    evaluacion: evaluarPostulacion(contenido.equipos, preciosDesdeContenido(contenido), { edad: 10, genero: 'dama', experiencia: 'ninguna' }),
    jornadaTexto: 'Sábado 5 de diciembre, 12:00 a 14:00',
    whatsappHeadCoach: '+56900000000',
    whatsappTexto: '+56 9 0000 0000',
  };
  const sin = construirCorreo(base, undefined);
  assert.ok(!sin.texto.includes('Cómo llegar'));
  const con = construirCorreo({ ...base, direccion: 'Calle 1, Comuna', comoLlegar: ['Primer paso <b>', 'Segundo paso'] }, undefined);
  assert.ok(con.texto.includes('Cómo llegar · Calle 1, Comuna:'));
  assert.ok(con.texto.includes('2. Segundo paso'));
  assert.ok(con.html.includes('Cómo llegar'));
  assert.ok(con.html.includes('Primer paso &lt;b&gt;'));
  assert.ok(!con.html.includes('<b>'));
});

test('correo: ofrece el correo de pagos como alternativa solo cuando se entrega y hay que pagar', () => {
  const base = {
    codigo: 'HUR-TEST02',
    atleta: 'Atleta Prueba',
    para: 'familia@example.com',
    evaluacion: evaluarPostulacion(contenido.equipos, preciosDesdeContenido(contenido), { edad: 10, genero: 'dama', experiencia: 'ninguna' }),
    jornadaTexto: 'Sábado 5 de diciembre, 12:00 a 14:00',
    whatsappHeadCoach: '+56900000000',
    whatsappTexto: '+56 9 0000 0000',
  };
  assert.ok(!construirCorreo(base, undefined).texto.includes('pagos@'));
  const con = construirCorreo({ ...base, correoPagos: 'pagos@example.com' }, undefined);
  assert.ok(con.texto.includes('También puedes enviarlo al correo pagos@example.com'));
  assert.ok(con.html.includes('pagos@example.com'));
});

test('la API rechaza menores de 4 años durante 2027 antes de guardar y acepta el límite', () => {
  for (const fechaNacimiento of ['2026-01-01', '2025-01-01', '2024-01-01', '2024-12-31']) {
    const r = validarPostulacion({ ...base, fechaNacimiento });
    assert.ok(!r.ok && r.campos.includes('fechaNacimiento'));
  }
  for (const fechaNacimiento of ['2023-12-31', '2023-01-01', '1985-01-01']) {
    assert.ok(validarPostulacion({ ...base, fechaNacimiento }).ok);
  }
});


test('correo administrativo actualizado conserva código, reemplaza el anterior y no vuelve a cobrar', () => {
  const evaluacion = evaluarPostulacion(contenido.equipos, preciosDesdeContenido(contenido), { edad: 10, genero: 'dama', experiencia: 'ninguna' });
  const c = construirCorreo({ codigo: 'HUR-ABC234', atleta: 'Atleta Prueba', para: 'familia@example.com', evaluacion, jornadaTexto: null, whatsappHeadCoach: '+56900000000', whatsappTexto: '+56 9 0000 0000', actualizada: true, sinInstruccionesPago: true, evaluacionPendiente: true }, 'Banco Prueba');
  assert.match(c.asunto, /Preinscripción actualizada HUR-ABC234/);
  for (const cuerpo of [c.texto, c.html]) {
    assert.match(cuerpo, /reemplaza al anterior/);
    assert.match(cuerpo, /HUR-ABC234/);
    assert.match(cuerpo, /evaluación está por confirmar/);
    assert.match(cuerpo, /No realices un nuevo pago/);
    assert.doesNotMatch(cuerpo, /Banco Prueba|Total a transferir|Después de pagar/);
  }
});
