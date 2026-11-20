/* ============================================================
   Cierre automático de mes + correos (recordatorio y cruce)
   Lo ejecuta GitHub Actions (.github/workflows/correos.yml).

   Variables de entorno (las claves vienen de GitHub Secrets, nunca del código):
     FIREBASE_SERVICE_ACCOUNT  clave de servicio de Firebase (JSON completo)   [secreto]
     GMAIL_USER                correo de Gmail que envía                        [secreto]
     GMAIL_APP_PASSWORD        contraseña de aplicación de ese Gmail            [secreto]
     APP_URL, NOMBRE_CASA, LOGO_PALABRA, LOGO_NUMERO, ZONA_HORARIA, DIA_LIMITE_PAGO   (no secretas)
     MODO       auto | cierre | recordatorio | cruce
     MES        'AAAA-MM' (solo para pruebas manuales)
     SOLO_A     apodo o correo de la única persona que recibe la prueba
     EVENTO     schedule | workflow_dispatch
   Para probar sin internet: SIMULAR_ARCHIVO=ejemplo-simulacion.json HOY_SIMULADO=2026-12-01

   OJO: los registros (logs) de Actions son públicos si el repositorio es público,
   por eso aquí NUNCA se imprimen correos ni montos.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('../js/logica.js');
const lib = require('./lib.js');

const env = process.env;
const MODO = String(env.MODO || 'auto').toLowerCase();
const MES = String(env.MES || '').trim();
const SOLO_A = String(env.SOLO_A || '').trim().toLowerCase();
const EVENTO = env.EVENTO || '';
const SIMULAR = env.SIMULAR_ARCHIVO || '';
const PRUEBA = EVENTO === 'workflow_dispatch' && (MODO === 'recordatorio' || MODO === 'cruce');
const CASA = { nombre: env.NOMBRE_CASA || 'El 27', palabra: env.LOGO_PALABRA || 'El', numero: env.LOGO_NUMERO || '27' };
const APP_URL = env.APP_URL || '';
const ZONA = env.ZONA_HORARIA || 'America/Bogota';
if (typeof L.configurar === 'function') L.configurar({ diaLimite: Number(env.DIA_LIMITE_PAGO) || 11 });   // la plantilla permite cambiar el día límite

const limpiar = m => String(m && m.message ? m.message : m).replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[correo]');

/* ---------- Dónde están los datos ---------- */
async function abrirDatos() {
  if (SIMULAR) {
    const d = JSON.parse(fs.readFileSync(SIMULAR, 'utf8'));
    return {
      cargar: async () => ({ usuarios: d.usuarios, categorias: d.categorias || [], gastos: d.gastos || [], pagos: d.pagos || [], cierres: d.cierres || {}, enviados: d.notificaciones || {} }),
      crearCierre: async c => { console.log('[simulación] se guardaría el cierre de ' + c.mes); },
      guardarEnvio: async id => { console.log('[simulación] se anotaría el envío ' + id); }
    };
  }
  if (!env.FIREBASE_SERVICE_ACCOUNT) throw new Error('Falta el secreto FIREBASE_SERVICE_ACCOUNT.');
  const { initializeApp, cert } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  initializeApp({ credential: cert(JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)) });
  const db = getFirestore();
  const leer = async col => (await db.collection(col).get()).docs.map(d => Object.assign({}, d.data(), { id: d.id }));
  return {
    cargar: async () => {
      const [usuarios, categorias, gastos, pagos, cierres, noti] = await Promise.all(['usuarios', 'categorias', 'gastos', 'pagos', 'cierres', 'notificaciones'].map(leer));
      const aMapa = lista => lista.reduce((o, x) => { o[x.id] = x; return o; }, {});
      return { usuarios: usuarios.sort((a, b) => (a.orden || 0) - (b.orden || 0)), categorias, gastos, pagos, cierres: aMapa(cierres), enviados: aMapa(noti) };
    },
    // .create() falla si el cierre ya existe (por ejemplo, si la app lo guardó antes): eso está bien
    crearCierre: async c => {
      try { await db.collection('cierres').doc(c.mes).create(JSON.parse(JSON.stringify(c))); }
      catch (e) { if (e && (e.code === 6 || /already exists/i.test(e.message))) return; throw e; }
    },
    guardarEnvio: async (id, doc) => { await db.collection('notificaciones').doc(id).set(doc, { merge: true }); }
  };
}

/* ---------- Cómo se envía ---------- */
function abrirCorreo() {
  if (SIMULAR) {
    const salida = path.join(__dirname, 'salida-simulacion');
    fs.mkdirSync(salida, { recursive: true });
    let n = 0;
    return { sendMail: async m => {
      n++; const base = path.join(salida, String(n).padStart(2, '0') + '-' + m.nombre);
      fs.writeFileSync(base + '.html', m.html); fs.writeFileSync(base + '.txt', 'Asunto: ' + m.subject + '\n\n' + m.text);
      console.log('[simulación] correo para ' + m.nombre + ': "' + m.subject + '"  →  ' + path.basename(base) + '.html / .txt');
    } };
  }
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) throw new Error('Faltan los secretos GMAIL_USER y GMAIL_APP_PASSWORD.');
  return require('nodemailer').createTransport({ service: 'gmail', auth: { user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD } });
}

function provisional(estado, mes) {
  const saldos = L.saldosDelMes(estado, mes);
  return { mes, saldos, transferencias: L.cruzar(saldos), total: L.totalDelMes(estado, mes), limitePago: L.limitePago(mes) };
}

async function main() {
  // Antes de configurar las claves, las ejecuciones programadas no hacen nada (así GitHub no te llena de avisos de error)
  if (!SIMULAR && EVENTO === 'schedule' && !env.FIREBASE_SERVICE_ACCOUNT) {
    console.log('Las claves todavía no están configuradas (GitHub Secrets). No se hace nada. Ver GUIA-FASE-4.md.');
    return;
  }
  const hoy = env.HOY_SIMULADO || lib.hoyEn(ZONA);
  console.log('Hoy (' + ZONA + '): ' + hoy + ' | modo: ' + MODO + (PRUEBA ? ' | PRUEBA' : ''));
  const datos = await abrirDatos();
  const d = await datos.cargar();
  const estado = { version: 1, usuarios: d.usuarios, categorias: d.categorias, gastos: d.gastos, pagos: d.pagos, cierres: d.cierres };
  if (!estado.usuarios.length) throw new Error('Todavía no hay roommates configurados en la app (falta la configuración inicial).');

  // 1) Cerrar los meses que ya terminaron (si la app no lo hizo antes)
  if (!PRUEBA) {
    const nuevos = L.cerrarMesesVencidos(estado, hoy);
    for (const m of nuevos) { await datos.crearCierre(estado.cierres[m]); console.log('Mes cerrado: ' + m); }
    if (!nuevos.length) console.log('No hay meses pendientes de cerrar.');
  }
  if (MODO === 'cierre') return;

  // 2) ¿Qué correos toca enviar?
  let tareas;
  if (MODO === 'recordatorio') tareas = [{ tipo: 'recordatorio', mes: MES || L.mesDe(hoy) }];
  else if (MODO === 'cruce') {
    // En una prueba manual sin mes: el mes más reciente que tenga movimientos (puede ser el actual, "así va")
    const conDatos = L.mesesConActividad(estado).filter(m => m <= L.mesDe(hoy));
    tareas = [{ tipo: 'cruce', mes: MES || conDatos[conDatos.length - 1] || L.sumarMeses(L.mesDe(hoy), -1) }];
  }
  else {
    const completos = new Set(Object.keys(d.enviados).filter(id => Object.keys(d.enviados[id].enviados || {}).length >= estado.usuarios.length));
    tareas = lib.decidir(hoy, completos, L.mesesConActividad(estado));
  }
  if (!tareas.length) { console.log('Hoy no toca enviar ningún correo.'); return; }

  const correo = abrirCorreo();
  let fallos = 0;
  for (const t of tareas) {
    const idDoc = t.tipo + '-' + t.mes;
    const previo = Object.assign({}, (d.enviados[idDoc] || {}).enviados || {});
    let dest = estado.usuarios.filter(u => u.email);
    if (SOLO_A) dest = dest.filter(u => String(u.apodo || '').toLowerCase() === SOLO_A || String(u.email).toLowerCase() === SOLO_A);
    if (!PRUEBA) dest = dest.filter(u => !previo[u.id]);
    console.log(t.tipo + ' de ' + t.mes + ': ' + dest.length + ' destinatario(s).');
    if (!dest.length) continue;

    let cierre = null, provis = false;
    if (t.tipo === 'cruce') {
      cierre = estado.cierres[t.mes];
      if (!cierre) { if (!PRUEBA) { console.log('Ese mes no tiene cierre; no se envía.'); continue; } cierre = provisional(estado, t.mes); provis = true; }
    }
    const pendientes = t.tipo === 'cruce' ? L.pendientesCerrados(estado, hoy).filter(x => x.mes !== t.mes) : [];

    for (const u of dest) {
      const msg = t.tipo === 'recordatorio'
        ? lib.armarRecordatorio({ usuario: u, mes: t.mes, hoy, appUrl: APP_URL, casa: CASA, prueba: PRUEBA })
        : lib.armarCruce({ usuario: u, usuarios: estado.usuarios, mes: t.mes, cierre, pendientes, appUrl: APP_URL, casa: CASA, prueba: PRUEBA, provisional: provis });
      try {
        await correo.sendMail({ from: '"' + CASA.nombre + '" <' + (env.GMAIL_USER || 'simulacion@example.com') + '>', to: u.email, subject: msg.asunto, text: msg.texto, html: msg.html, nombre: u.apodo });
        previo[u.id] = new Date().toISOString();
        console.log('  enviado a ' + u.apodo);
      } catch (e) { fallos++; console.error('  FALLÓ el envío a ' + u.apodo + ': ' + limpiar(e)); }
    }
    if (!PRUEBA) await datos.guardarEnvio(idDoc, { tipo: t.tipo, mes: t.mes, enviados: previo, actualizado: new Date().toISOString() });
  }
  if (fallos) process.exitCode = 1;
}

main().catch(e => { console.error('ERROR: ' + limpiar(e)); process.exit(1); });
