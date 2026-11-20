/* ============================================================
   El 27 · NUBE (Firebase: login con Google + base de datos)
   Solo se activa si en js/firebase-config.js están los datos
   de tu proyecto de Firebase. Si no, la app sigue en modo demo.

   Colecciones en Firestore:
     usuarios/{id}   -> los 3 roommates (nombre, apodo, color, correo)
     categorias/{id} -> categorías
     gastos/{id}     -> gastos
     pagos/{id}      -> pagos entre roommates
     cierres/{mes}   -> meses cerrados (una vez creado NO se puede cambiar)
     fotos/{id}      -> fotos de facturas (ya reducidas), se leen solo al abrirlas
   ============================================================ */
(function () {
  'use strict';
  const COLS = ['usuarios', 'categorias', 'gastos', 'pagos', 'cierres'];
  let auth = null, db = null, cb = {}, unsubs = [];
  let cache = nuevaCache();
  const fotos = {};

  function nuevaCache() { return { usuarios: {}, categorias: {}, gastos: {}, pagos: {}, cierres: {} }; }
  function cfg() { return window.FIREBASE_CONFIG; }
  function disponible() {
    const c = cfg();
    return !!(c && typeof c === 'object' && c.apiKey && c.projectId && window.firebase && window.firebase.auth && window.firebase.firestore);
  }
  function limpiar(o) { return JSON.parse(JSON.stringify(o)); }   // quita valores "undefined" (Firestore no los acepta)

  function detener() {
    unsubs.forEach(u => { try { u(); } catch (e) { /* nada */ } });
    unsubs = []; cache = nuevaCache();
  }

  function iniciar(callbacks) {
    cb = callbacks;
    window.firebase.initializeApp(cfg());
    auth = window.firebase.auth();
    db = window.firebase.firestore();
    auth.onAuthStateChanged(alCambiarSesion);
  }

  async function alCambiarSesion(user) {
    detener();
    if (!user) { cb.sesion(null); return; }
    const email = String(user.email || '').toLowerCase();
    cb.cargando(email);
    // 1) ¿Las reglas me dejan entrar? Si no, "sin acceso".
    try { await db.collection('usuarios').get(); }
    catch (e) {
      if (e && e.code === 'permission-denied') cb.sinAcceso(email); else cb.error(e);
      return;
    }
    // 2) Escuchar los cambios en vivo
    let pendientes = COLS.length;
    COLS.forEach(col => {
      let primera = true;
      unsubs.push(db.collection(col).onSnapshot(snap => {
        snap.docChanges().forEach(ch => {
          if (ch.type === 'removed') delete cache[col][ch.doc.id]; else cache[col][ch.doc.id] = ch.doc.data();
        });
        if (primera) { primera = false; pendientes--; }
        if (pendientes === 0) emitir(email);
      }, err => {
        if (err && err.code === 'permission-denied') cb.sinAcceso(email); else cb.error(err);
      }));
    });
  }

  function emitir(email) {
    const lista = col => Object.keys(cache[col]).map(id => Object.assign({}, cache[col][id], { id }));
    const porOrden = (a, b) => (a.orden || 0) - (b.orden || 0);
    cb.estado({
      version: 1,
      usuarios: lista('usuarios').sort(porOrden),
      categorias: lista('categorias').sort(porOrden),
      gastos: lista('gastos'),
      pagos: lista('pagos'),
      cierres: Object.assign({}, cache.cierres)
    }, email);
  }

  /* ---------- Guardar ---------- */
  const guardarGasto = g => db.collection('gastos').doc(g.id).set(limpiar(g));
  const borrarGasto = id => db.collection('gastos').doc(id).delete();
  const guardarPago = p => db.collection('pagos').doc(p.id).set(limpiar(p));
  const borrarPago = id => db.collection('pagos').doc(id).delete();
  const guardarCategoria = c => db.collection('categorias').doc(c.id).set(limpiar(c));
  // Un cierre solo se puede crear una vez (las reglas no dejan cambiarlo después)
  const guardarCierre = c => db.collection('cierres').doc(c.mes).set(limpiar(c));

  // Configuración inicial de la casa: roommates y categorías (se hace una sola vez)
  function configurarCasa(usuarios, categorias) {
    const batch = db.batch();
    usuarios.forEach((u, i) => batch.set(db.collection('usuarios').doc(u.id), limpiar(Object.assign({}, u, { orden: i }))));
    categorias.forEach((c, i) => batch.set(db.collection('categorias').doc(c.id), limpiar(Object.assign({}, c, { orden: i }))));
    return batch.commit();
  }

  /* ---------- Fotos de facturas ---------- */
  function fotoCache(id) { return fotos[id] || null; }
  function cargarFoto(id) {
    if (!id) return Promise.resolve(null);
    if (fotos[id]) return Promise.resolve(fotos[id]);
    return db.collection('fotos').doc(id).get().then(d => { if (d.exists) fotos[id] = d.data().data; return fotos[id] || null; }).catch(() => null);
  }
  function guardarFoto(id, dataUrl) {
    if (dataUrl.length > 900000) return Promise.resolve(false);   // Firestore admite ~1 MB por documento
    fotos[id] = dataUrl;
    return db.collection('fotos').doc(id).set({ data: dataUrl, creado: Date.now() }).then(() => true).catch(() => false);
  }
  function borrarFoto(id) { delete fotos[id]; return db.collection('fotos').doc(id).delete().catch(() => { /* nada */ }); }

  /* ---------- Sesión ---------- */
  function entrarConGoogle() {
    const p = new window.firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    return auth.signInWithPopup(p);
  }
  function salir() { detener(); return auth.signOut(); }

  window.Nube = {
    disponible, iniciar, entrarConGoogle, salir,
    guardarGasto, borrarGasto, guardarPago, borrarPago, guardarCategoria, guardarCierre, configurarCasa,
    fotoCache, cargarFoto, guardarFoto, borrarFoto
  };
})();
