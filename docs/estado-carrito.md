# Bloque 3: estado y operaciones del carrito

## Base y alcance

Rama: `refactor/03-estado-carrito`. Base: `main` en `8da9913`, después de verificar en GitHub que los PR [#18](https://github.com/nicogiorda/elrincondelmazo-frontend/pull/18) y [#19](https://github.com/nicogiorda/elrincondelmazo-frontend/pull/19) están fusionados. Se actualizó la copia limpia mediante fast-forward y se creó un worktree independiente. El checkout original, que tenía un cambio local en App.jsx, se conservó intacto.

Solo se extrae el dominio del carrito. No se modifican contratos HTTP, servicios del bloque 1, vistas, estilos, reglas de compra, backend, dependencias ni base de datos. No se fusiona este PR ni se inicia el bloque 4.

## Archivos

Creados:
- `src/hooks/useCart.js`: estado, carga, mutaciones, sincronización optimista, bloqueos y limpieza del carrito.
- `src/hooks/useCartMetadata.js`: consultas faltantes de productos, errores de disponibilidad, deduplicación, cancelación e invalidación de esas consultas.
- `tests/cart-architecture.test.mjs`: controles de ciclos, instancia única y propiedad de los endpoints.
- `docs/estado-carrito.md`: este informe.

Modificados:
- `src/App.jsx`: composición de hooks y coordinación de navegación, catálogo y checkout.
- `src/hooks/useSession.js`: registro de limpiezas de dominios, sin importar sus implementaciones.
- `tests/cart-api.browser.mjs`: siete escenarios adicionales y fixtures para checkout y metadatos.

## Responsabilidades e interfaz

App.jsx: **1334 → 1100 líneas** (234 menos). useCart.js: 191 líneas; useCartMetadata.js: 73 líneas. Se cuentan líneas físicas, incluidas las vacías.

Salieron de App: cart, carga, bloqueo, errores y mensajes, intentos de carga, marca de GET solicitado, referencia de operación activa, sincronización de cantidades e ítem en sincronización. También el cálculo de ítems/contador, la carga inicial, changeCart, addToCart, syncCartQuantity, changeQuantity, removeItem y el reintento HTTP.

```js
const {
  cart, items, cartCount, cartLoading, cartBusy, cartError, cartMessage,
  quantitySyncItemId,
  addToCart, changeQuantity, removeItem, retryCart,
  isCartPending, beginCheckout,
} = useCart({
  user, token, sessionVersion, sessionAbort, subscribeSessionChange,
  logout, setSessionError,
  products, onProductAdded, onLoginRequired,
})
```

- `addToCart(product, quantity = 1)`, `changeQuantity(itemId, quantity)` y `removeItem(itemId)` devuelven Promise<boolean>. False indica operación rechazada, fallida u obsoleta.
- `retryCart()` programa una recarga y devuelve true, o false si existe una operación incompatible. App acompaña el reintento con la limpieza de errores de metadatos.
- `isCartPending()` consulta el bloqueo síncrono, incluso antes del siguiente render.
- `beginCheckout()` devuelve null si no puede reservar el carrito; en otro caso devuelve `{ complete, release }`. No se exponen referencias internas ni setCart.

Se usa una única instancia de useCart desde App, fuera de Routes. Home, Catalog, ProductDetail, Cart y Checkout reciben el mismo estado y acciones mediante las props existentes. Navegar no desmonta esa instancia ni dispara otra carga. Un CartProvider se posterga porque esas pantallas ya están conectadas a App: incorporarlo ahora obligaría a cambiar consumidores sin eliminar otra fuente de estado.

## Sincronización y aislamiento

Una referencia interna identifica la operación propietaria del bloqueo. Se toma antes de enviar HTTP; dos eventos en el mismo turno no pueden iniciar mutaciones incompatibles. Las operaciones usan exclusivamente cartApi para GET/POST/PUT/DELETE de carrito, con token y señal explícitos.

Las cantidades cambian de forma optimista. Mientras hay un PUT del mismo ítem, se actualiza la cantidad deseada; cuando responde, se envía solo el último valor pendiente. No se aplican respuestas intermedias sobre la cantidad deseada. Si falla, se recupera la última respuesta confirmada; el error de red y los mensajes del backend se conservan. Agregar y quitar aplican CartResponse sin GET posterior.

useSession sigue siendo la única fuente de autenticación. `subscribeSessionChange(listener)` devuelve una función para cancelar la suscripción. useCart y useCartMetadata registran sus propias limpiezas durante el montaje; no hay referencias a funciones todavía no inicializadas ni imports entre esos hooks.

Al iniciar/cerrar sesión:
1. useSession incrementa sessionVersion y aborta el controlador anterior.
2. Ejecuta síncronamente las limpiezas registradas y el callback de App para los demás dominios.
3. Publica el nuevo usuario/token o la sesión anónima.

El carrito descarta resultados si cambió la versión, se abortó la señal, se desmontó el hook o la operación ya no es propietaria del bloqueo. La clave de carga incluye versión e identidad del usuario. No almacena una segunda sesión ni lee/escribe JWT en localStorage. Una liberación tardía no puede desbloquear otra operación.

La carga inicial se agenda en una microtarea con control de vigencia; StrictMode descarta el primer montaje de efectos antes de iniciar solicitudes. La marca de carga impide GET repetidos al cambiar de ruta. El desmontaje real sigue protegido por el ciclo de vida y aborto de useSession.

## Checkout

App conserva previewOrder, POST /orders, expectedTotal, requestKey, validación de la respuesta, caché de pedidos y navegación.

- Preview consulta isCartPending, conservando la política existente; no reserva el carrito durante toda la cotización.
- Confirmación adquiere beginCheckout antes del POST. Mientras dura la reserva, agregar, quitar, cambiar cantidades y otra confirmación quedan bloqueados.
- Solo después de validar una respuesta exitosa, App llama a complete para reflejar el vaciado realizado por Spring. No envía DELETE ni GET adicionales.
- El finally llama a release. Un fallo conserva el carrito; una respuesta de otra sesión no puede vaciar ni desbloquear el carrito actual.

## Metadatos y coordinación temporal con catálogo

useCartMetadata conserva únicamente solicitudes y estados de disponibilidad. Los productos siguen almacenados una sola vez en shop.products, la caché que ya usa el catálogo.

Su interfaz devuelve metadata, invalidateMetadata(ids opcionales), retryMetadata y getPendingProduct(id). El detalle reutiliza la promesa pendiente, evitando un segundo GET. Cada solicitud comprueba versión de sesión, identidad de la solicitud y versión del catálogo. El callback de integración agrega únicamente productos ausentes, sin reemplazar actualizaciones posteriores.

App conserva temporalmente:
- Inserción del producto que se agrega al carrito en la caché compartida.
- Incorporación de metadatos y marcas de frescura del catálogo.
- Invalidación de metadatos al vencer productos o modificarse publicaciones/pedidos.
- Navegación de buyNow y composición de los reintentos.
- Checkout, catálogo, pedidos, promociones, publicaciones y limpieza de esos dominios.

Son límites explícitos de integración; no se extrae todo el catálogo ni se crea useOrders. Las vistas y sus validaciones de publicaciones propias, disponibilidad y stock no cambian.

## Validaciones

Las pruebas de navegador ejecutan la aplicación real en React StrictMode sobre Vite y Edge headless, interceptando HTTP con fixtures. No usan Spring ni PostgreSQL. Los tokens de fixtures son valores artificiales; no se registran JWT reales.

| Comprobación | Resultado |
| --- | --- |
| npm run lint | PASS, sin errores ni advertencias |
| npm run build | PASS |
| auth-api.test.mjs | 28 PASS |
| cart-api.test.mjs | 13 PASS |
| cart-architecture.test.mjs | 3 PASS; 56 módulos sin ciclos |
| cart-api.browser.mjs | 22 escenarios PASS (15 existentes + 7 nuevos) |
| auth-session.browser.mjs | 27 escenarios PASS |
| frontend-audit.mjs | 18 escenarios PASS; 37 solicitudes |
| orders-cache.browser.mjs | 6 grupos PASS |
| promotions.browser.cjs | 12 escenarios PASS |
| git diff --check | PASS |

Cobertura de los requisitos del bloque:
- Carga después del login, recuperación y StrictMode: autenticación/sesiones y carrito; un GET por sesión/carga.
- Estado compartido al navegar y agregar sin GET redundante: carrito, incluyendo recorrido Home → Catalog → detalle → carrito.
- Incremento, decremento, cambios rápidos, eliminación, rollback HTTP/red y solicitudes incompatibles: carrito.
- Logout, A → B y respuestas que ignoran AbortSignal: carrito y autenticación; GET/POST/PUT/DELETE tardíos, metadatos tardíos y confirmación de A mientras B está actualizando cantidad.
- Checkout: bloqueo al navegar durante confirmación, éxito con carrito vacío, fallo con carrito conservado, cambio de total, cotización por medio de pago e idempotencia tras pérdida de respuesta.
- Productos ausentes, reutilización de GET en detalle, errores/reintentos de metadatos y recarga del carrito: carrito.
- Invalidación de metadatos por publicaciones y vencimiento de caché, catálogo/paginación, promociones y pedidos: auditoría general y suites existentes.
- Ciclos, instancia única de ambos hooks y capa HTTP: pruebas de arquitectura.

Intentos previos: el primer lint/build se lanzó antes de terminar de copiar node_modules y falló por módulos aún ausentes. Tras completar la copia, build pasó y lint señaló una actualización síncrona en el efecto inicial; se corrigió agendando la carga con control de vigencia. Esos intentos no se cuentan como PASS.

### Reproducción

No se agregaron dependencias. Se reutilizaron node_modules locales y Playwright del entorno. Con Vite escuchando en 127.0.0.1:5173:

```powershell
npm run lint
npm run build
node --test tests/auth-api.test.mjs tests/cart-api.test.mjs tests/cart-architecture.test.mjs
# PLAYWRIGHT_MODULE apunta al módulo de Playwright disponible en el entorno.
$env:BASE_URL = 'http://127.0.0.1:5173'
node tests/cart-api.browser.mjs
node tests/auth-session.browser.mjs
node tests/frontend-audit.mjs
node tests/orders-cache.browser.mjs
node tests/promotions.browser.cjs
git diff --check
```

La auditoría general utiliza localhost:5173. Edge y Vite se ejecutaron fuera del sandbox para permitir su comunicación local.

## Límites y comprobaciones pendientes

El GET de disponibilidad a http://localhost:8080/promotions/public devolvió ECONNREFUSED. Por eso no se ejecutó promotions.live.cjs. frontend-http-audit.mjs tampoco se ejecutó: exige AUDIT_LOCAL_DB=1, AUDIT_PSQL y una base descartable, y realiza escrituras SQL/API. No se ejecutaron suites destructivas sobre datos compartidos.

Queda pendiente el smoke manual con Spring Boot y PostgreSQL: login, recarga, agregar, cambios rápidos, eliminar, checkout exitoso/fallido, logout y cambio de cuenta. No se declara PASS de integración real.

El acoplamiento temporal con la caché pública de App queda documentado para el bloque 4; el carrito no posee ni duplica esa caché. La reserva de checkout se debe completar solamente después de validar el pedido y liberar siempre en finally, como hace App.
