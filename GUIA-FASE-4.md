# El 27 · Guía de la Fase 4 (correos automáticos y cierre de mes)

Esta fase deja funcionando, sin que nadie tenga que hacer nada:

| Cuándo (hora de Colombia) | Qué pasa |
|---|---|
| 3 días antes del último día del mes (el 27 en noviembre, el 28 en meses de 31 días) · 6:00 a. m. | Cada uno recibe el recordatorio: "actualiza tus gastos en la app" con el enlace. |
| Día 1 del mes siguiente · 12:10 a. m. | Se cierra el mes automáticamente (si la app no lo cerró antes). |
| Día 1 del mes siguiente · 6:00 a. m. | Cada uno recibe el cruce: a quién le debe pagar o quién le debe, y cuánto, con el plazo hasta el día 11. |

Cada correo se envía una sola vez por persona: si algo falla y se repite, no se duplica.

Tú tienes que crear **3 claves** y guardarlas en GitHub. Son unos 20 minutos.

> 🔒 **Regla de oro:** ninguna de estas claves se pega en el chat, ni en un archivo del proyecto, ni en el código. Solo van en **GitHub Secrets**.

---

## Parte A · Contraseña de aplicación de Gmail
Es una contraseña especial de 16 letras que permite a la app enviar correos **desde una cuenta de Gmail**, sin usar tu contraseña real. Los correos saldrán de esa cuenta. Puede ser la tuya o una de cualquiera de los 3.

1. Entra a https://myaccount.google.com con esa cuenta de Gmail.
2. Menú de la izquierda: **Seguridad**.
3. Verifica que la **Verificación en dos pasos** esté **activada**. Si no, actívala (es obligatoria para este paso).
4. Entra a https://myaccount.google.com/apppasswords
   - Si no aparece, busca "Contraseñas de aplicaciones" en el buscador de la página de tu cuenta.
5. En **Nombre de la app** escribe **El 27** y toca **Crear**.
6. Google muestra una contraseña de 16 letras en un recuadro amarillo. **Cópiala** (sin espacios) y déjala a mano: se ve una sola vez.

Si tu cuenta es de trabajo o colegio (Google Workspace), puede que el administrador tenga bloqueada esta opción. Usa una cuenta personal de Gmail.

## Parte B · Clave de servicio de Firebase
Permite al programa leer los gastos y guardar el cierre de mes.

1. Entra a https://console.firebase.google.com y abre **el-27**.
2. Toca el engranaje ⚙️ → **Configuración del proyecto**.
3. Pestaña **Cuentas de servicio** (Service accounts).
4. Toca **Generar nueva clave privada** y confirma. Se descarga un archivo `.json`.
5. Ábrelo con el **Bloc de notas** (clic derecho → Abrir con → Bloc de notas), presiona `Ctrl + A` y luego `Ctrl + C`. Es un texto largo que empieza con `{` y termina con `}`.
6. **Déjalo copiado** para la Parte C.
7. Cuando termines la Parte C, **borra el archivo `.json`** de tu computador (carpeta Descargas) y vacía la papelera. Ya no lo necesitas, y quien lo tenga puede leer tu base de datos.

## Parte C · Guardar las 3 claves en GitHub
1. Entra a https://github.com/valopezm/el-27
2. **Settings** → en el menú de la izquierda **Secrets and variables** → **Actions**.
3. Toca **New repository secret** y crea estos 3, uno por uno (los nombres deben ser exactamente así):

| Name | Secret (lo que pegas) |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Todo el texto del archivo `.json` (Parte B, paso 5) |
| `GMAIL_USER` | El correo de Gmail que envía (por ejemplo `micorreo@gmail.com`) |
| `GMAIL_APP_PASSWORD` | La contraseña de 16 letras de la Parte A (sin espacios) |

4. Después de cada uno toca **Add secret**.

## Parte D · Probar con el botón manual
**Antes de esperar al día del cierre, prueba que todo funcione:**

1. En el repositorio toca la pestaña **Actions**.
2. En la lista de la izquierda elige **Correos automáticos y cierre de mes**.
3. Toca **Run workflow** (botón gris a la derecha).
4. Llena así la **primera prueba**:
   - **modo:** `recordatorio`
   - **solo_a:** tu apodo (por ejemplo `Val`) para que solo te llegue a ti
   - Deja `mes` vacío.
5. Toca el botón verde **Run workflow**. Espera 1 o 2 minutos y recarga la página: debe aparecer una ejecución con ✅ verde.
6. Revisa tu correo (y la carpeta de **spam**, la primera vez). Debe llegar **"[PRUEBA] El 27: actualiza tus gastos antes del cierre"**.
7. **Segunda prueba:** repite con **modo** `cruce` y **solo_a** con tu apodo. Llega el informe del mes más reciente con movimientos. Si el mes aún no ha terminado, el asunto dice "(aún abierta)".
8. **Tercera prueba (opcional):** deja **solo_a** vacío para que le llegue a los 3 y confirmen que les llegó. Siguen siendo correos de **PRUEBA** y no cuentan como enviados.

Las pruebas **no cierran ningún mes** ni se anotan como enviadas. Los modos **cierre** y **auto** sí actúan de verdad (solo úsalos si sabes lo que haces).

## Si algo falla
Abre la ejecución en **Actions** y toca el paso **Cierre de mes y correos** para leer el mensaje.

| Mensaje | Qué significa |
|---|---|
| `Falta el secreto FIREBASE_SERVICE_ACCOUNT` (o GMAIL_…) | No creaste ese secreto, o escribiste mal el nombre. |
| `Invalid login` o `535` | La contraseña de aplicación está mal copiada, o la verificación en dos pasos no está activa. Crea otra. |
| `Todavía no hay roommates configurados` | Nadie ha hecho la configuración inicial en la app. |
| `FALLÓ el envío a …` | El correo de esa persona no es válido o Gmail lo rechazó. |
| Los correos llegan a spam | Márcalos como "No es spam". La primera vez es normal. |

Por seguridad, los registros de GitHub **no muestran correos ni montos** (el repositorio es público).

## Cosas que debes saber
- **GitHub puede tardar** entre unos minutos y media hora en lanzar una tarea programada. Los correos de las 6:00 a. m. pueden llegar hacia las 6:30.
- **Sin actividad en 60 días**, GitHub apaga las tareas programadas de los repositorios públicos. El programa incluye un paso que lo evita, pero si dejas de usar la app mucho tiempo, entra a **Actions** de vez en cuando para confirmar que sigue activa. Si algún día falla, GitHub te avisa por correo.
- **El cierre también ocurre solo en la app:** el primero que abra la app después de la medianoche del último día lo guarda. Este programa solo lo asegura si nadie la abrió.
- **Límites:** Gmail permite unos 500 correos al día; aquí se envían 6 al mes.
- **Cambiar la hora o los textos:** pídemelo; se edita en `.github/workflows/correos.yml` y `automatizacion/lib.js`.
