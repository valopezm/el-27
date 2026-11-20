/* ============================================================
   Funciones puras de los correos (no tocan internet ni Firebase):
   cuándo se envía cada correo y cómo se escribe.
   Reusan los mismos cálculos de la app (js/logica.js).
   ============================================================ */
'use strict';
const L = require('../js/logica.js');

const ESC = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $$ = t => L.formatear(t);

/** Fecha de hoy en la zona horaria de la casa, como 'AAAA-MM-DD'. */
function hoyEn(zona, fecha) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zona || 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha || new Date());
}

function fechaLarga(f) {
  const p = f.split('-').map(Number);
  return p[2] + ' de ' + L.MESES[p[1] - 1] + ' de ' + p[0];
}
const nombreMesSolo = mes => L.MESES[Number(mes.slice(5, 7)) - 1];

/**
 * ¿Qué correos toca enviar hoy?
 *  - Recordatorio: 3 días antes del último día del mes (con una ventana de respaldo
 *    hasta el día anterior al cierre, por si GitHub se salta una ejecución).
 *  - Cruce: el día 1 del mes siguiente (con respaldo los días 2 y 3).
 * `enviados` es un conjunto con ids como 'recordatorio-2026-11' o 'cruce-2026-10'.
 */
function decidir(hoy, enviados, mesesConDatos) {
  const mes = L.mesDe(hoy), dia = Number(hoy.slice(8, 10)), ultimo = L.ultimoDia(mes);
  const tareas = [];
  if (dia >= ultimo - 3 && dia <= ultimo - 1 && !enviados.has('recordatorio-' + mes)) tareas.push({ tipo: 'recordatorio', mes });
  if (dia <= 3) {
    const prev = L.sumarMeses(mes, -1);
    if (!enviados.has('cruce-' + prev) && mesesConDatos.indexOf(prev) >= 0) tareas.push({ tipo: 'cruce', mes: prev });
  }
  return tareas;
}

/* ---------- Diseño de los correos (estilo "recibo", con estilos dentro del correo) ---------- */
const TINTA = '#1B2433', PAPEL = '#F3F4EF', MESA = '#D4DAE2', AZUL = '#2F55C4', ROJO = '#C42F40', GRIS = '#566070', MARCA = '#FFE14D';
const FUENTE = "'IBM Plex Mono',Consolas,'Courier New',monospace";

function envolver({ casa, titulo, bloques, boton, url, pie }) {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + ESC(titulo) + '</title></head><body style="margin:0;padding:0;background:' + MESA + ';">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + MESA + ';"><tr><td align="center" style="padding:20px 12px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:' + PAPEL + ';font-family:' + FUENTE + ';color:' + TINTA + ';font-size:15px;line-height:1.5;">' +
    '<tr><td style="padding:22px 22px 6px;font-size:18px;font-weight:700;">' + ESC(casa.palabra) + ' <span style="background:' + MARCA + ';padding:0 6px;">' + ESC(casa.numero) + '</span></td></tr>' +
    '<tr><td style="padding:6px 22px 4px;font-size:19px;font-weight:700;">' + ESC(titulo) + '</td></tr>' +
    '<tr><td style="padding:6px 22px 8px;">' + bloques.join('') + '</td></tr>' +
    (boton ? '<tr><td style="padding:10px 22px 22px;"><a href="' + ESC(url) + '" style="display:inline-block;background:' + TINTA + ';color:' + PAPEL + ';text-decoration:none;font-weight:700;padding:13px 20px;">' + ESC(boton) + '</a></td></tr>' : '') +
    '<tr><td style="padding:0 22px 22px;font-size:12px;color:' + GRIS + ';border-top:2px dashed #AEB4AA;padding-top:14px;">' + (pie || '') + '</td></tr>' +
    '</table></td></tr></table></body></html>';
}
const parrafo = t => '<p style="margin:0 0 12px;">' + t + '</p>';
const linea = (izq, der, color) => '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:4px 0;border-bottom:2px dotted #BFC4BB;">' + izq + '</td><td align="right" style="padding:4px 0;border-bottom:2px dotted #BFC4BB;white-space:nowrap;font-weight:700;color:' + (color || TINTA) + ';">' + der + '</td></tr></table>';

/** Correo 1: recordatorio antes del cierre. */
function armarRecordatorio({ usuario, mes, hoy, appUrl, casa, prueba }) {
  const ultimo = L.ultimoDia(mes);
  const cierre = fechaLarga(mes + '-' + String(ultimo).padStart(2, '0'));
  const faltan = ultimo - Number(hoy.slice(8, 10));
  const cuando = faltan <= 0 ? 'hoy' : faltan === 1 ? 'mañana' : 'en ' + faltan + ' días';
  const asunto = (prueba ? '[PRUEBA] ' : '') + casa.nombre + ': actualiza tus gastos antes del cierre';
  const texto = [
    'Hola ' + usuario.apodo + ',',
    '',
    'La cuenta de ' + nombreMesSolo(mes) + ' cierra ' + cuando + ' (' + cierre + ', 11:59 p. m.).',
    'Actualiza tus gastos en la app antes del cierre: ' + appUrl,
    '',
    'Después del cierre el mes queda guardado y ya no se puede editar.',
    'Si ya registraste todo, ignora este correo.'
  ].join('\n');
  const html = envolver({
    casa, titulo: 'Actualiza tus gastos', url: appUrl, boton: 'Abrir la app',
    bloques: [
      parrafo('Hola ' + ESC(usuario.apodo) + ','),
      parrafo('La cuenta de <b>' + ESC(nombreMesSolo(mes)) + '</b> cierra <b>' + ESC(cuando) + '</b> (' + ESC(cierre) + ', 11:59 p. m.).'),
      parrafo('Actualiza tus gastos en la app antes del cierre.'),
      parrafo('<span style="color:' + GRIS + ';font-size:13px;">Después del cierre el mes queda guardado y ya no se puede editar. Si ya registraste todo, ignora este correo.</span>')
    ],
    pie: 'Recordatorio automático de ' + ESC(casa.nombre) + '.'
  });
  return { asunto, texto, html };
}

/** Correo 2: cruce de cuentas del mes cerrado. */
function armarCruce({ usuario, usuarios, mes, cierre, pendientes, appUrl, casa, prueba, provisional }) {
  const apodo = id => (usuarios.find(u => u.id === id) || { apodo: '?' }).apodo;
  const trs = cierre.transferencias || [];
  const mias = trs.filter(t => t.de === usuario.id), aMi = trs.filter(t => t.a === usuario.id);
  const saldo = (cierre.saldos || {})[usuario.id] || 0;
  const limite = fechaLarga(cierre.limitePago || L.limitePago(mes));
  const nombre = nombreMesSolo(mes);
  const asunto = (prueba ? '[PRUEBA] ' : '') + casa.nombre + ': cuenta de ' + nombre + (provisional ? ' (aún abierta)' : ' cerrada');

  const quedoAMano = !mias.length && !aMi.length;
  const resumenTexto = [];
  const resumenHtml = [];
  if (mias.length) {
    mias.forEach(t => { resumenTexto.push('Debes pagar ' + $$(t.monto) + ' a ' + apodo(t.a) + '.'); });
    resumenHtml.push(parrafo('<b style="color:' + ROJO + ';">Te toca pagar</b>') + mias.map(t => linea('Pagas a ' + ESC(apodo(t.a)), $$(t.monto), ROJO)).join(''));
  }
  if (aMi.length) {
    aMi.forEach(t => { resumenTexto.push(apodo(t.de) + ' te debe pagar ' + $$(t.monto) + '.'); });
    resumenHtml.push(parrafo('<b style="color:' + AZUL + ';">Te deben pagar</b>') + aMi.map(t => linea(ESC(apodo(t.de)) + ' te paga', $$(t.monto), AZUL)).join(''));
  }
  if (quedoAMano) { resumenTexto.push('Quedaste a mano este mes: no debes pagar nada y nadie te debe.'); resumenHtml.push(parrafo('<b>Quedaste a mano este mes.</b> No debes pagar nada y nadie te debe.')); }

  const todos = trs.length ? trs.map(t => apodo(t.de) + ' le paga ' + $$(t.monto) + ' a ' + apodo(t.a)) : ['Nadie le debe a nadie.'];
  const pend = (pendientes || []).map(t => apodo(t.de) + ' → ' + apodo(t.a) + ' ' + $$(t.falta) + ' (de ' + L.nombreMes(t.mes) + ')');

  const texto = [
    'Hola ' + usuario.apodo + ',',
    '',
    provisional ? 'Así va la cuenta de ' + nombre + ' (todavía no está cerrada).' : 'La cuenta de ' + nombre + ' quedó cerrada.',
    'Total gastado: ' + $$(cierre.total || 0) + '.',
    '',
    ...resumenTexto,
    '',
    'Plazo para pagar: hasta el ' + limite + '.',
    '',
    'Todos los pagos de la casa:',
    ...todos.map(x => '- ' + x),
    ...(pend.length ? ['', 'Siguen pendientes de meses anteriores:', ...pend.map(x => '- ' + x)] : []),
    '',
    'Cuando pagues o te paguen, regístralo en la app: ' + appUrl
  ].join('\n');

  const html = envolver({
    casa, titulo: provisional ? 'Cuenta de ' + nombre + ' (provisional)' : 'Cuenta de ' + nombre + ' cerrada', url: appUrl, boton: 'Registrar un pago',
    bloques: [
      parrafo('Hola ' + ESC(usuario.apodo) + ','),
      parrafo((provisional ? 'Así va la cuenta de ' : 'La cuenta de ') + '<b>' + ESC(nombre) + '</b>' + (provisional ? ' (todavía no está cerrada).' : ' quedó cerrada.')),
      linea('Total gastado', $$(cierre.total || 0)),
      linea('Tu saldo del mes', (saldo >= 0 ? '+' : '') + $$(saldo), saldo > 0 ? AZUL : saldo < 0 ? ROJO : TINTA),
      '<div style="height:14px"></div>',
      ...resumenHtml,
      parrafo('<span style="background:' + MARCA + ';padding:0 4px;">Plazo para pagar: hasta el ' + ESC(limite) + '.</span>'),
      '<div style="height:6px"></div>',
      parrafo('<b>Todos los pagos de la casa</b>') + todos.map(x => '<div style="padding:2px 0;">' + ESC(x) + '</div>').join(''),
      ...(pend.length ? ['<div style="height:10px"></div>' + parrafo('<b>Siguen pendientes de meses anteriores</b>') + pend.map(x => '<div style="padding:2px 0;">' + ESC(x) + '</div>').join('')] : [])
    ],
    pie: 'Informe automático de ' + ESC(casa.nombre) + '. Cuando pagues o te paguen, regístralo en la app para que la cuenta quede al día.'
  });
  return { asunto, texto, html };
}

module.exports = { hoyEn, decidir, armarRecordatorio, armarCruce, fechaLarga };
