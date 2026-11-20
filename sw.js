/* ============================================================
   El 27 · SERVICE WORKER (hace que la app abra rápido y se pueda instalar)
   - Archivos de la app (html, css, js): primero internet, y si no hay, la copia guardada.
     Así cada vez que publiquemos cambios, se actualizan solos.
   - Tipografías, íconos y librerías de Firebase: primero la copia guardada (cambian casi nunca).
   - Los datos (Firestore) y el login de Google NO pasan por aquí: siempre van directo a internet.
   ============================================================ */
const VERSION = 'el27-v1';
const BASE = ['./', 'index.html', 'manifest.webmanifest', 'css/estilos.css',
  'js/firebase-config.js', 'js/logica.js', 'js/datos-prueba.js', 'js/almacen.js', 'js/nube.js', 'js/app.js',
  'fonts/IBMPlexMono-400.woff2', 'fonts/IBMPlexMono-500.woff2', 'fonts/IBMPlexMono-700.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png', 'icons/icon-32.png'];
const FIREBASE_SDK = /^https:\/\/www\.gstatic\.com\/firebasejs\//;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const mismoSitio = url.origin === self.location.origin;
  if (!mismoSitio && !FIREBASE_SDK.test(req.url)) return;   // todo lo demás (Firestore, Google login) va directo

  const guardable = /\.(woff2|png|svg)$/.test(url.pathname) || FIREBASE_SDK.test(req.url);
  if (guardable) {
    // primero la copia guardada
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copia = res.clone(); caches.open(VERSION).then(c => c.put(req, copia)); }
      return res;
    })));
    return;
  }
  // primero internet, si falla la copia guardada
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const copia = res.clone(); caches.open(VERSION).then(c => c.put(req, copia)); }
    return res;
  }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
