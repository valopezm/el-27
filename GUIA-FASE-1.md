# El 27 · Guía para probar la Fase 1

## Cómo abrir la app
1. Abre la carpeta **App Gastos del 27**.
2. Haz doble clic en **index.html**. Se abre en tu navegador (Chrome, Edge, Safari…). No necesita internet.
3. Para ver las pruebas automáticas, doble clic en **pruebas.html**: deben salir 24 de 24 con ✔.

> Los datos se guardan solo en ese navegador. Son de prueba: en la Fase 2 pasan a Firebase.

## Prueba 1 · Los números de aceptación
1. Entra como **Val**.
2. Ve a **Perfil → Modo de prueba → "Cargar ejemplo: arriendo + mercado"**.
3. En **Inicio** debe decir:
   - Val: le deben **$900.000**
   - Santi: debe **$300.000**
   - Pegui: debe **$600.000**
   - Cruce: **Pegui le paga $600.000 a Val** y **Santi le paga $300.000 a Val** (2 pagos, el mínimo).

## Prueba 2 · Registrar un gasto con las preguntas de división
1. Toca el botón redondo **＋**.
2. Paso 2: elige **Los 3**, **Dos personas** o **Una persona**.
3. Paso 3: **partes iguales**, **por porcentaje** o **montos exactos**. Si no cuadra, la app te dice cuánto falta.
4. Paso 4: **Pagar en cuotas**. Cada persona puede pagar en un número distinto de meses.
5. Abajo, el **Resumen** te muestra cómo queda antes de guardar.

## Prueba 3 · Factura y productos
1. **Perfil → Subir foto de una factura**.
2. Toma o elige una foto, escribe la tienda y agrega productos con cantidad y precio.
3. Toca **Usar como monto**, escribe la descripción y guarda.
4. Mira **Perfil → Productos y precios**: ahí queda cada producto con su último precio, promedio y historial.
5. Si no eliges categoría, la app la deduce sola (o usa *Otros*).
6. La lectura automática de la factura (que la app lea la foto) está pendiente. Ver "Lo que falta".

## Prueba 4 · Cierre de mes
1. **Perfil → Modo de prueba → "Cargar ejemplo completo"**. Trae un mes anterior ya cerrado, cuotas y facturas.
2. Ve a **Cruce**: verás el historial con cada pago *Pendiente / Vencido / Pagado*. Prueba **Marcar pagado**.
3. Para ver cómo se cierra solo el mes: en **Perfil → Fecha simulada** pon el último día del mes, aplica; luego pon el día 1 del mes siguiente.
4. Entra a **Gastos** y toca ‹ para ir al mes cerrado: los gastos se ven pero **no se pueden editar ni borrar**.

## Prueba 5 · Cuenta sin permiso
En la pantalla de entrada toca **"Probar con una cuenta NO autorizada"**. Verás el mensaje de "Sin acceso". (En la Fase 2 será Google de verdad.)

## Reglas que quedaron aplicadas
- El mes se cierra **el último minuto del último día**; el pago se puede hacer **hasta el 11** del mes siguiente.
- Los 3 pueden editar y borrar cualquier gasto del mes abierto.
- Dinero en pesos con **máximo un decimal**; el sobrante de una división se reparte para que la suma siempre cuadre.
- Categorías: Arriendo, Servicios, Mercado, Aseo, Internet, **Very Nice** (tarifa del servicio de aseo) y Otros. Puedes crear más.

## Lo que falta (próximas fases)
- Fase 2: entrar con Google y guardar en Firebase.
- Fase 3: instalar como app en el celular y publicar en GitHub Pages.
- Fase 4: correos automáticos (recordatorio y cruce del día 1).
- Lectura automática de facturas: necesita un servicio de inteligencia artificial o un lector de texto (OCR). Se decide con ustedes después de la Fase 2.
