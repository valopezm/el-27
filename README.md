# El 27

Las cuentas del apartamento de 3 roommates: gastos, saldos, pagos y cruce de cuentas mensual. Sin frameworks: HTML, CSS y JavaScript puro, con Firebase (login con Google y Firestore) y publicada en GitHub Pages. Se puede instalar en el celular como app (PWA).

- Gastos entre 1, 2 o 3 personas; por partes iguales, porcentaje o montos exactos.
- Gastos diferidos en cuotas (cada persona paga en los meses que quiera).
- Fotos de facturas y catálogo de productos con sus precios.
- Cierre automático de mes el último minuto del último día, con plazo de pago hasta el 11 del mes siguiente.
- Moneda: pesos colombianos (máximo un decimal).

## Seguridad
Solo pueden leer y escribir 3 correos autorizados mediante las reglas de Firestore (`firestore.rules` es el modelo; los correos reales solo viven en la consola de Firebase). La configuración web de Firebase no es secreta.

## Estructura
- `index.html`, `css/`, `js/` — la app
- `js/logica.js` — cálculos (probados con `pruebas.html` o `node js/pruebas.js`)
- `js/nube.js` — conexión con Firebase
- `sw.js`, `manifest.webmanifest`, `icons/` — instalación como app
- `fonts/` — IBM Plex Mono (licencia OFL)

Diseño inspirado en la idea de dividir gastos en grupo de proyectos de código abierto como Spliit (MIT); el código es propio y no usa su nombre ni su logo.
