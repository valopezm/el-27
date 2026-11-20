# El 27 · Guía de la Fase 2 (Firebase: login con Google y base de datos)

Esta parte la haces tú en el navegador, con la cuenta de Google que quieras usar como dueña del proyecto (puede ser la de Val). Son unos 15 minutos. No hay que pagar nada ni poner tarjeta.

## Parte A · Crear el proyecto en Firebase
1. Entra a **https://console.firebase.google.com** e inicia sesión con tu cuenta de Google.
2. Toca **Crear un proyecto** (o "Add project").
3. Nombre: escribe **el-27** (Firebase puede agregarle números al final, está bien). Toca **Continuar**.
4. Cuando pregunte por **Google Analytics**, apágalo (deja el interruptor en "desactivado") y toca **Crear proyecto**. Espera y toca **Continuar**.

## Parte B · Registrar la app web y copiar sus datos
5. En la pantalla principal del proyecto toca el ícono **`</>`** (Web).
6. Apodo de la app: **El 27**. **No** marques "Firebase Hosting". Toca **Registrar app**.
7. Te mostrará un bloque de código con `const firebaseConfig = { apiKey: "...", authDomain: "...", ... }`. **Copia solo lo que está entre las llaves `{ ... }`** y pégamelo en el chat. Estos datos no son secretos: aunque el repositorio sea público, lo que protege tu información son las reglas de la Parte D.
8. Toca **Continuar a la consola**.

## Parte C · Activar el login con Google
9. Menú de la izquierda: **Compilación → Authentication** (en algunas versiones: "Build → Authentication"). Toca **Comenzar**.
10. En **Método de acceso** (Sign-in method) elige **Google**.
11. Activa el interruptor **Habilitar**.
12. En **Correo electrónico de asistencia del proyecto** elige tu correo.
13. Toca **Guardar**.

## Parte D · Crear la base de datos y poner la seguridad
14. Menú de la izquierda: **Compilación → Firestore Database**. Toca **Crear base de datos**.
15. Ubicación: elige **southamerica-east1 (São Paulo)** (la más cercana a Colombia). Toca **Siguiente**.
16. Elige **Iniciar en modo de producción** y toca **Crear**. Espera a que termine.
17. Arriba toca la pestaña **Reglas**.
18. Borra todo lo que haya en el cuadro.
19. En tu computador, abre el archivo **`firestore.rules.PRIVADO.txt`** de la carpeta del proyecto, **copia todo** y pégalo en el cuadro de reglas. (Ahí ya están los 3 correos. Ese archivo nunca se sube a GitHub.)
20. Toca **Publicar**. Debe aparecer un mensaje de que se publicó.

## Parte E · Avísame
21. Pégame en el chat el bloque del paso 7. Yo lo coloco en la app.

## Parte F · Probar (cuando yo te avise que está conectado)
22. En la carpeta del proyecto haz doble clic en **`iniciar-servidor.bat`**. Se abre una ventana negra (déjala abierta) y el navegador en `http://localhost:8127`.
    - Si dice que no encuentra Python, avísame y buscamos otra forma.
23. Toca **Entrar con Google** y elige tu cuenta. La **primera persona** que entra verá la **configuración inicial**: escribe el correo de Google de Val, Santi y Pegui y toca **Guardar y empezar**.
24. Registra un gasto (por ejemplo el arriendo de 1.500.000). Abre la app con la cuenta de otro roommate y comprueba que lo ve.
25. **Prueba de seguridad:** entra con una cuenta de Google que **no** sea de los 3 (puede ser otra tuya). Debe salir **"Sin acceso"**.
26. Desde la consola de Firebase (**Firestore Database → Datos**) comprueba que aparecen las colecciones `gastos`, `usuarios`, `categorias`, etc.

## Cosas que debes saber
- El modo demo desaparece cuando la app está conectada: ya no hay "Modo de prueba" ni fecha simulada (para que nadie borre datos reales por accidente).
- **Los meses cerrados quedan protegidos por las reglas**: una vez guardado el cierre, ni la app ni nadie puede modificarlo.
- Las fotos de las facturas se guardan comprimidas dentro de la base de datos (cada una pesa unos 150–300 KB).
- Las reglas autorizan por correo. Lo que **no** controlan las reglas: que un gasto de un mes ya cerrado no se edite. Eso lo hace la app. Para el uso normal de los 3 está bien.
- Más adelante, al publicar en GitHub Pages (Fase 3), agregaremos el dominio de la página en **Authentication → Configuración → Dominios autorizados**.
