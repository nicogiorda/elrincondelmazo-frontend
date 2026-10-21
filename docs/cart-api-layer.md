# Bloque 1: capa HTTP del carrito

Base: `main` en `6d3be2f`. Rama: `refactor/01-cart-api-layer`.
Se trabajó en una copia limpia porque el checkout previo tenía cambios sin confirmar
en `src/App.jsx`, en otra rama. Esos cambios se conservaron.

## Responsabilidades

- `src/services/httpClient.js`: URL base existente (`http://localhost:8080`),
  construcción de requests con `fetch`, JSON, headers y `AbortSignal` del llamador.
  `readResponse` se extrajo sin cambios de comportamiento: conserva el fallback
  `{}` ante cuerpos vacíos/no JSON, los mensajes existentes y `error.status`.
  App importa el mismo lector para los endpoints restantes, sin duplicarlo.
  El token es opcional y se recibe por solicitud; no hay sesión global ni reintentos.
- `src/services/cartApi.js`: `getCart`, `addCartItem`,
  `updateCartItemQuantity` y `removeCartItem`. Devuelve la respuesta del servidor
  y propaga los errores; no contiene estado React ni decisiones de interfaz.
- `src/App.jsx`: conserva estados, efectos, validación de `CartResponse`, navegación,
  bloqueo de operaciones incompatibles, sincronización de cantidades,
  actualización optimista y recuperación de la última respuesta confirmada.
  Conserva los tokens capturados, `sessionVersion`, `sessionAbort`, manejo de 401,
  `cartRequest`, `quantitySync` y el reintento explícito de carga.

| Operación | Servicio | Integración en App |
| --- | --- | --- |
| `GET /carts` | `getCart` | Efecto de carga de sesión y reintento explícito |
| `POST /carts/items` | `addCartItem` | `addToCart` a través de `changeCart` |
| `PUT /carts/items/{id}` | `updateCartItemQuantity` | `syncCartQuantity` |
| `DELETE /carts/items/{id}` | `removeCartItem` | `removeItem` a través de `changeCart` |

`changeCart` recibe una operación de servicio en lugar de método, URL y cuerpo HTTP.
Las mutaciones siguen aplicando directamente el carrito devuelto, sin GET posterior.
Las consultas públicas de metadata a `/products/{id}` permanecen con la lógica y
caché de productos existente. Checkout, pedidos, promociones, autenticación,
componentes visuales y estilos no se modificaron.

La dependencia nueva es `App -> cartApi -> httpClient`, con una importación directa
de App al lector y URL compartidos. Los servicios no importan App ni React: no hay ciclos.
App pasa de **1432 a 1402 líneas** (conteo del archivo real de esta base).

## Verificación ejecutada

Se reutilizaron las dependencias locales ya instaladas y Playwright del entorno.
No se instalaron dependencias ni se modificaron `package.json` o `package-lock.json`.

| Comando | Resultado |
| --- | --- |
| `npm run lint` | PASS, salida 0 |
| `npm run build` | PASS, salida 0 |
| `node --test tests/cart-api.test.mjs` | PASS, 13 pruebas |
| `node tests/cart-api.browser.mjs` | PASS, 15 escenarios |
| `node tests/frontend-audit.mjs` | PASS, 18 escenarios, 37 requests |
| `node tests/orders-cache.browser.mjs` | PASS, 6 grupos |
| `node tests/promotions.browser.cjs` | PASS, 12 escenarios |
| `git diff --check` | PASS |

Las pruebas de navegador ejecutaron la aplicación real con StrictMode, Edge headless
y respuestas HTTP simuladas, contra Vite en el puerto 5173. Cubren carga única,
contratos POST/PUT/DELETE, ausencia de GET tras mutaciones, duplicados, bloqueo de
checkout/eliminación durante PUT, cantidades optimistas agrupadas, rollback a la
última cantidad confirmada, error de red, error HTTP visible, reintento explícito
y cierre de sesión por 401 en las cuatro operaciones.

Para cada operación, una prueba deja completar deliberadamente una respuesta de
la sesión anterior aun después del aborto, y verifica que no reemplaza el carrito
de la nueva sesión. También verifica que se abortó la señal anterior y que el GET
nuevo lleva el JWT nuevo. Las pruebas unitarias comprueban la propagación del
AbortError y de TypeError sin reintentos, y la ausencia de JWT heredado entre llamadas.

El primer intento de navegador falló al iniciar Edge dentro del sandbox de Windows;
las ejecuciones exitosas usaron Edge y Vite fuera del sandbox. Esos intentos fallidos
no se contabilizan como pruebas aprobadas.

## Reproducción

Con las dependencias existentes y Vite iniciado mediante `npm run dev -- --port 5173 --strictPort`:

```powershell
# Si Playwright está fuera del proyecto, indicar la ruta de esa instalación existente.
$env:PLAYWRIGHT_MODULE = 'RUTA_A_PLAYWRIGHT'
$env:BASE_URL = 'http://localhost:5173'
node --test tests/cart-api.test.mjs
node tests/cart-api.browser.mjs
node tests/frontend-audit.mjs
node tests/orders-cache.browser.mjs
node tests/promotions.browser.cjs
```

`frontend-audit.mjs` utiliza el puerto 5173 directamente. Los otros scripts de
navegador enumerados aceptan `BASE_URL`.

## Limitaciones y revisión manual pendiente

- `tests/frontend-http-audit.mjs`: **no ejecutado**. Exige `AUDIT_LOCAL_DB=1`,
  `AUDIT_PSQL`, Spring Boot y una base PostgreSQL descartable; crea usuarios,
  productos, promociones y pedidos, y modifica roles por SQL. No corresponde
  habilitar esas escrituras en este bloque, que excluye cambios de base de datos.
- `tests/promotions.live.cjs`: **no ejecutado**. Necesita el backend real;
  el GET de disponibilidad a `http://localhost:8080/promotions/public` devolvió
  `ECONNREFUSED` fuera del sandbox. No se declara PASS de integración real.
- Queda pendiente un smoke manual con Spring/PostgreSQL: iniciar sesión, agregar
  desde catálogo/detalle, modificar cantidades rápidamente, eliminar y cerrar
  sesión durante una solicitud. La compatibilidad HTTP y el comportamiento de
  React se verificaron con fixtures, sin verificar datos persistidos reales.

Este bloque no incorpora hooks de carrito, Context Providers ni cambios del bloque 2.
