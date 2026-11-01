# Redux Toolkit — etapa 5: pedidos privados

## Objetivo
Guardar el estado compartido de «Mis pedidos» y el detalle de cada pedido
en `Redux/ordersSlice.js`, sin perder el aislamiento por sesión ni la caché
de 60 segundos de la implementación anterior.

## Responsabilidades
- `ordersSlice`: `ownerId`, `generation`, `history` y `details`.
  Reducers para carga, éxito, fallo, actualización, invalidación, logout y confirmación.
  Cada acción comprueba propietario + generación para rechazar respuestas tardías.
- `useOrders`: coordinación de peticiones HTTP, cancelación, TTL, deduplicación
  y suscripción al cambio de sesión. Lee Redux mediante `useSelector` y
  `useStore`; no mantiene una segunda caché en `useRef` o `useState`.
- `services/ordersApi.js`: único propietario de los endpoints.
- `useCheckout`: conserva requestKey, confirmación e idempotencia.
  Solo llama a `recordConfirmedOrder` tras una respuesta validada del backend.
- `Orders.jsx`: filtros visuales y apertura de tarjetas siguen siendo estado local.

No se persisten pedidos, tokens ni datos privados en localStorage mediante Redux.
Los AbortController, señales y promesas tampoco entran al store.

## Pruebas de CI
```sh
npm ci
npm run lint
npm run build
node --test tests/*.test.mjs
```

## Pruebas de navegador previas al merge
Ejecutar Vite y, en otra terminal, los scripts Playwright existentes:
```sh
node tests/orders-cache.browser.mjs
node tests/checkout.browser.mjs
node tests/auth-session.browser.mjs
```

Verificar: GET inicial único bajo StrictMode; refresco manual; lista vacía;
TTL 60 s; cambio de resumen que invalida detalle; fallo 503 y reintentos;
logout y cambio de cuenta con respuestas tardías; pedido confirmado.

No alterar el login/JWT ni ejecutar compras contra la base de datos real.
La siguiente etapa puede considerar sesión, pero con evaluación separada
de necesidades y riesgos de seguridad.
