# Bloque 2: autenticación y sesiones

El PR #18 se verificó fusionado en `main`. Base de este bloque: `04f23e5`.
Se actualizó la copia limpia de main por avance rápido, se comprobó la presencia
de `httpClient.js` y `cartApi.js` y se creó un worktree independiente con la rama
`refactor/02-autenticacion-sesiones`. Los cambios previos del checkout original
no se incorporaron ni sobrescribieron.

## Responsabilidades e interfaz

- `authApi.js` encapsula `POST /api/v1/auth/authenticate`,
  `POST /api/v1/auth/register` y `GET /users/me`.
  `authenticate` y `register` devuelven `{ token, user }` después de verificar
  la identidad mediante `/users/me`; `getCurrentUser` también se usa al recuperar
  una sesión guardada. Los cuerpos conservan `email`, `password`, `firstname`,
  `lastname` y la lectura de `access_token`. No persiste datos, no importa React
  y no administra navegación.
- `httpClient.js` expone `request` para acceder a la respuesta HTTP sin procesar,
  necesario para conservar los mensajes específicos de login y registro.
  `requestJson` sigue usando el mismo constructor de solicitudes y `readResponse`.
  Este último se comparó con main y permanece idéntico al bloque 1.
- `useSession.js` es la única fuente de usuario, token, carga inicial y error de
  sesión. Controla recuperación, login, registro, persistencia, logout, navegación,
  versión y cancelación. Combina la señal del formulario con la de sesión.
  Antes de publicar una cuenta nueva comprueba montaje, señal, versión y que
  el token almacenado no cambió mientras se verificaba la identidad.
- `Login.jsx` y `Register.jsx` conservan formulario, estados visuales, bloqueo de
  envíos simultáneos y cancelación al desmontarse. Invocan las operaciones del
  hook recibidas por props; el hook usa `authApi`. No hacen fetch ni escriben
  localStorage. `AccountAccess` y los estilos no se modificaron.

Hay **una sola llamada a useSession**, en App. Su interfaz expone:

- Estado: `user`, `token`, `loading`, `sessionError`.
- Acciones: `login`, `register`, `logout`.
- Integración temporal: `setSessionError` para los 401 de otros dominios y
  `setUser` para aplicar la respuesta confirmada de edición del perfil.
- `sessionVersion` y `sessionAbort`: referencias estables que App solo **lee**
  para conservar sus comprobaciones existentes. Solo el hook modifica su versión,
  reemplaza el controlador o cancela la sesión.

App mantiene `resetPrivateData`, un callback estable que el hook ejecuta después
de invalidar la sesión anterior, tanto al ingresar como al salir. Limpia los
estados y bloqueos de perfil, carrito, órdenes y detalles, publicaciones y
promociones. Esta coordinación permanece en App porque esos dominios todavía
no se extrajeron. El hook no los importa ni conoce su estructura.

Las comprobaciones de respuestas antiguas, cantidades optimistas, rollback,
checkout, idempotencia y cachés permanecen en sus funciones originales. Las
dependencias de los efectos incluyen las referencias estables devueltas por el
hook. No se modificaron rutas, componentes protegidos, permisos ni contratos.
El GET de identidad salió de App; el PUT de perfil y la desactivación permanecen.

App pasa de **1402 a 1334 líneas**. No se agregaron dependencias ni Providers.
El análisis de importaciones locales de los 54 módulos de src no detectó ciclos.

## Validación de identidad y cancelación

Una única validación de usuario se aplica a login, registro y recuperación:
ID entero positivo, email presente, nombres de tipo string, rol USUARIO o ADMIN
y cuenta no marcada como inactiva. Antes, registro y recuperación no aplicaban
la comprobación de Login; ahora tampoco pueden establecer una sesión inválida.
Se conservan los mensajes de credenciales incorrectas, correo duplicado y fallos
HTTP. Registro también muestra mensajes claros ante red o JSON inválido y deja
de registrar errores en consola. No se registran tokens ni contraseñas.

StrictMode reutiliza la recuperación inicial gracias a `sessionRequested`.
El desmontaje real del hook marca inmediatamente la instancia como inactiva y
aborta en una microtarea; el remontaje de efectos de StrictMode dentro del mismo
turno no cancela la solicitud compartida. El cierre/cambio de sesión incrementa
la versión y aborta inmediatamente, sin esperar esa microtarea.

## Pruebas ejecutadas

Se reutilizaron las dependencias instaladas y Playwright externo del entorno;
no se modificaron package.json ni package-lock.json.

| Comando | Resultado real |
| --- | --- |
| `npm run lint` | PASS, sin advertencias |
| `npm run build` | PASS |
| `node --test tests/auth-api.test.mjs tests/cart-api.test.mjs` | PASS, 41 pruebas: 28 de autenticación y 13 del carrito |
| `node tests/auth-session.browser.mjs` | PASS, 27 escenarios |
| `node tests/cart-api.browser.mjs` | PASS, 15 escenarios |
| `node tests/frontend-audit.mjs` | PASS, 18 escenarios y 37 solicitudes |
| `node tests/orders-cache.browser.mjs` | PASS, 6 grupos |
| `node tests/promotions.browser.cjs` | PASS, 12 escenarios |
| `git diff --check` | PASS |

Los navegadores ejecutaron la aplicación real en Vite, con React StrictMode,
Edge headless y HTTP simulado. La suite nueva cubre los 15 escenarios solicitados:
login y registro válidos/erróneos, verificación antes de persistir, recuperación
válida/401/403/identidad inválida, logout, cambio A a B, respuestas antiguas,
rutas protegidas, roles, ausencia de GET duplicados, carrito y pedidos.
También cubre cancelación durante el POST y el GET de identidad de ambos
formularios, fallos de red, respuestas inválidas y actualización del perfil.
Las respuestas antiguas de carrito, pedidos, detalles, publicaciones y promociones
se completan deliberadamente aun ignorando el aborto del transporte: B conserva
sus datos. También se comprueba la limpieza de pedidos y detalles ya cargados.

La primera ejecución de la suite nueva falló en la preparación del historial
para probar el botón Atrás: no existía una entrada previa de la aplicación.
Se corrigió la prueba creando esa entrada privada antes del logout. La ejecución
posterior completó los 27 escenarios. Ese intento fallido no se contabiliza como PASS.

Para reproducir las pruebas de navegador: iniciar Vite en el puerto 5173,
configurar `PLAYWRIGHT_MODULE` con la ruta de una instalación existente de
Playwright cuando no esté disponible por resolución normal y ejecutar los
comandos de la tabla. Los scripts aceptan `BASE_URL`, salvo frontend-audit.mjs,
que utiliza directamente `http://localhost:5173`.

## Límites y verificación manual pendiente

- `frontend-http-audit.mjs`: **no ejecutado**. Requiere Spring/PostgreSQL, una base
  descartable, `AUDIT_LOCAL_DB=1` y `AUDIT_PSQL`; además realiza escrituras SQL y
  crea cuentas, productos y pedidos. No se habilitaron esas escrituras.
- `promotions.live.cjs`: **no ejecutado**. El GET de disponibilidad al backend
  real `http://localhost:8080/promotions/public` devolvió `ECONNREFUSED`.
- No se declara integración real aprobada. Queda pendiente comprobar login,
  registro, expiración JWT y cambio de cuenta contra Spring/PostgreSQL, incluyendo
  carrito y pedidos persistidos. Las comprobaciones automatizadas usan fixtures.
- Se conserva la estrategia localStorage existente. No se agrega sincronización
  de sesiones entre pestañas ni un mecanismo distinto de autenticación.

El trabajo se limita al bloque 2. El PR debe revisarse antes de fusionarse;
no se inició el bloque 3.
