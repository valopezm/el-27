/* Pruebas de lib.js (calendario y redacción de los correos).  Ejecutar:  node pruebas.js */
'use strict';
const L = require('../js/logica.js');
const lib = require('./lib.js');

const resultados = []; let fallos = 0;
function prueba(nombre, fn) { try { fn(); resultados.push([true, nombre]); } catch (e) { fallos++; resultados.push([false, nombre + '\n      -> ' + e.message]); } }
const igual = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' esperaba ' + JSON.stringify(b) + ' y obtuve ' + JSON.stringify(a)); };
const cierto = (c, m) => { if (!c) throw new Error(m || 'no se cumplió'); };
const vacio = new Set();

prueba('Zona horaria: 05:10 UTC es 00:10 del mismo día en Colombia; 04:30 UTC es el día anterior', () => {
  igual(lib.hoyEn('America/Bogota', new Date('2026-12-01T05:10:00Z')), '2026-12-01');
  igual(lib.hoyEn('America/Bogota', new Date('2026-12-01T11:00:00Z')), '2026-12-01');
  igual(lib.hoyEn('America/Bogota', new Date('2026-12-01T04:30:00Z')), '2026-11-30');
});
prueba('Recordatorio: 3 días antes del último día (noviembre tiene 30 -> el 27)', () => {
  igual(lib.decidir('2026-11-26', vacio, []), []);
  igual(lib.decidir('2026-11-27', vacio, []), [{ tipo: 'recordatorio', mes: '2026-11' }]);
});
prueba('Recordatorio: meses de 31 días (el 28) y febrero (el 25)', () => {
  igual(lib.decidir('2026-12-27', vacio, []), []);
  igual(lib.decidir('2026-12-28', vacio, []), [{ tipo: 'recordatorio', mes: '2026-12' }]);
  igual(lib.decidir('2026-02-25', vacio, []), [{ tipo: 'recordatorio', mes: '2026-02' }]);
  igual(lib.decidir('2026-02-24', vacio, []), []);
});
prueba('Recordatorio: respaldo hasta la víspera del cierre, y nunca dos veces ni el día del cierre', () => {
  igual(lib.decidir('2026-11-29', vacio, []), [{ tipo: 'recordatorio', mes: '2026-11' }]);
  igual(lib.decidir('2026-11-29', new Set(['recordatorio-2026-11']), []), []);
  igual(lib.decidir('2026-11-30', vacio, []), []);
});
prueba('Cruce: el día 1 del mes siguiente (y respaldo los días 2 y 3), solo si hubo movimiento', () => {
  igual(lib.decidir('2026-12-01', vacio, ['2026-11']), [{ tipo: 'cruce', mes: '2026-11' }]);
  igual(lib.decidir('2026-12-03', vacio, ['2026-11']), [{ tipo: 'cruce', mes: '2026-11' }]);
  igual(lib.decidir('2026-12-04', vacio, ['2026-11']), []);
  igual(lib.decidir('2026-12-01', vacio, []), [], 'sin movimiento');
  igual(lib.decidir('2026-12-01', new Set(['cruce-2026-11']), ['2026-11']), [], 'ya enviado');
});
prueba('Cruce: cambio de año (1 de enero informa diciembre)', () => {
  igual(lib.decidir('2027-01-01', vacio, ['2026-12']), [{ tipo: 'cruce', mes: '2026-12' }]);
});

/* ---- Redacción ---- */
const usuarios = [{ id: 'a', apodo: 'Ana', email: 'a@example.com' }, { id: 'b', apodo: 'Beto' }, { id: 'c', apodo: 'Caro' }];
const casa = { nombre: 'Casa Prueba', palabra: 'Casa', numero: '1' };
const todos = [{ uid: 'a', valor: null, cuotas: 1 }, { uid: 'b', valor: null, cuotas: 1 }, { uid: 'c', valor: null, cuotas: 1 }];
const estado = L.estadoVacio(usuarios);
estado.gastos = [
  { id: '1', descripcion: 'Arriendo', monto: L.aDecimas(1500000), pagadoPor: 'a', fecha: '2026-11-01', categoriaId: 'arriendo', metodo: 'iguales', reparto: todos },
  { id: '2', descripcion: 'Mercado', monto: L.aDecimas(300000), pagadoPor: 'b', fecha: '2026-11-02', categoriaId: 'mercado', metodo: 'iguales', reparto: todos }
];
L.cerrarMesesVencidos(estado, '2026-12-01');
const cierre = estado.cierres['2026-11'];

prueba('Cruce: a quien debe se le dice a quién y cuánto; a quien le deben, quién le paga', () => {
  const c = lib.armarCruce({ usuario: usuarios[2], usuarios, mes: '2026-11', cierre, pendientes: [], appUrl: 'https://x.test/app/', casa });
  cierto(c.texto.includes('Debes pagar $600.000 a Ana.'), c.texto);
  const b = lib.armarCruce({ usuario: usuarios[1], usuarios, mes: '2026-11', cierre, pendientes: [], appUrl: 'https://x.test/app/', casa });
  cierto(b.texto.includes('Debes pagar $300.000 a Ana.'), b.texto);
  const a = lib.armarCruce({ usuario: usuarios[0], usuarios, mes: '2026-11', cierre, pendientes: [], appUrl: 'https://x.test/app/', casa });
  cierto(a.texto.includes('Caro te debe pagar $600.000.') && a.texto.includes('Beto te debe pagar $300.000.'), a.texto);
  cierto(a.texto.includes('hasta el 11 de diciembre de 2026'), 'plazo');
  cierto(a.asunto === 'Casa Prueba: cuenta de noviembre cerrada', a.asunto);
  cierto(a.html.includes('https://x.test/app/') && a.html.includes('$900.000'), 'html');
});
prueba('Cruce: quien queda a mano lo lee claro', () => {
  const e2 = L.estadoVacio(usuarios); e2.gastos = [{ id: '1', descripcion: 'x', monto: L.aDecimas(30000), pagadoPor: 'a', fecha: '2026-11-01', categoriaId: 'otros', metodo: 'iguales', reparto: [{ uid: 'a', cuotas: 1 }, { uid: 'b', cuotas: 1 }] }];
  L.cerrarMesesVencidos(e2, '2026-12-01');
  const c = lib.armarCruce({ usuario: usuarios[2], usuarios, mes: '2026-11', cierre: e2.cierres['2026-11'], pendientes: [], appUrl: 'u', casa });
  cierto(c.texto.includes('Quedaste a mano'), c.texto);
});
prueba('Cruce: avisa de pagos pendientes de meses anteriores y marca la prueba', () => {
  const c = lib.armarCruce({ usuario: usuarios[2], usuarios, mes: '2026-11', cierre, pendientes: [{ de: 'b', a: 'a', falta: L.aDecimas(1000), mes: '2026-10' }], appUrl: 'u', casa, prueba: true });
  cierto(c.texto.includes('Siguen pendientes') && c.texto.includes('octubre 2026'), c.texto);
  cierto(c.asunto.startsWith('[PRUEBA] '), c.asunto);
});
prueba('Recordatorio: dice "actualiza tus gastos", la fecha de cierre y trae el enlace', () => {
  const r = lib.armarRecordatorio({ usuario: usuarios[0], mes: '2026-11', hoy: '2026-11-27', appUrl: 'https://x.test/app/', casa });
  cierto(r.texto.includes('Actualiza tus gastos en la app') && r.texto.includes('https://x.test/app/'), r.texto);
  cierto(r.texto.includes('en 3 días') && r.texto.includes('30 de noviembre de 2026'), r.texto);
  cierto(r.asunto === 'Casa Prueba: actualiza tus gastos antes del cierre', r.asunto);
  const m = lib.armarRecordatorio({ usuario: usuarios[0], mes: '2026-11', hoy: '2026-11-29', appUrl: 'u', casa });
  cierto(m.texto.includes('cierra mañana'), m.texto);
});
prueba('Seguridad: los apodos no pueden inyectar HTML en el correo', () => {
  const raro = [{ id: 'a', apodo: '<b>Hack</b>' }, usuarios[1], usuarios[2]];
  const r = lib.armarRecordatorio({ usuario: raro[0], mes: '2026-11', hoy: '2026-11-27', appUrl: 'u', casa });
  cierto(!r.html.includes('<b>Hack</b>') && r.html.includes('&lt;b&gt;Hack&lt;/b&gt;'), 'sin escapar');
});

resultados.forEach(r => console.log((r[0] ? '  ✔ ' : '  ✘ ') + r[1]));
console.log('\n' + (resultados.length - fallos) + ' de ' + resultados.length + ' pruebas correctas' + (fallos ? ' · ' + fallos + ' FALLARON' : ''));
process.exit(fallos ? 1 : 0);
