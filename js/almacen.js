/* ============================================================
   El 27 · ALMACÉN (dónde se guardan los datos)
   FASE 1: se guardan en el propio navegador (localStorage).
   FASE 2: este archivo se cambia por Firebase (Firestore) y el
           resto de la app casi no se entera.
   ============================================================ */
(function () {
  'use strict';
  const K_ESTADO = 'el27_estado_v1';
  const K_FOTOS = 'el27_fotos_v1';
  const K_PREFS = 'el27_prefs_v1';

  function leer(k, def) {
    try { const t = localStorage.getItem(k); return t ? JSON.parse(t) : def; } catch (e) { return def; }
  }
  function escribir(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }

  window.Almacen = {
    cargar() { return leer(K_ESTADO, null); },
    guardar(estado) { return escribir(K_ESTADO, estado); },

    // Fotos de facturas (ya reducidas de tamaño), guardadas aparte para no hinchar los datos
    foto(id) { return (leer(K_FOTOS, {}) || {})[id] || null; },
    guardarFoto(id, dataUrl) {
      const f = leer(K_FOTOS, {}) || {};
      f[id] = dataUrl;
      return escribir(K_FOTOS, f);
    },
    borrarFoto(id) {
      const f = leer(K_FOTOS, {}) || {};
      delete f[id];
      escribir(K_FOTOS, f);
    },

    // Preferencias de este celular (quién soy, fecha simulada para pruebas)
    pref(k) { return (leer(K_PREFS, {}) || {})[k]; },
    ponerPref(k, v) {
      const p = leer(K_PREFS, {}) || {};
      if (v === undefined || v === null) delete p[k]; else p[k] = v;
      escribir(K_PREFS, p);
    },

    borrarTodo() {
      try { localStorage.removeItem(K_ESTADO); localStorage.removeItem(K_FOTOS); } catch (e) { /* nada */ }
    }
  };
})();
