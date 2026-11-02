# Etapa 10 — Pedidos y checkout con Redux Toolkit + Axios

## Patrón de la cursada

Siguiendo la estructura de la demo Redux de Gisele y el énfasis de la clase del 27/10, las operaciones HTTP del historial, detalle, cotización y confirmación ahora siguen el circuito:

`React → dispatch(createAsyncThunk) → ordersApi (Axios) → extraReducers pending/fulfilled/rejected → useSelector`.

`Provider` y `configureStore` ya estaban instalados. Se añadió un reducer `checkout` y `ordersToken` como `thunk.extraArgument`: el JWT **nunca** se pasa en `meta.arg`, se persiste en Redux ni se reutiliza entre cuentas.

## Contratos

| Operación | Acción Redux | Método HTTP |
| --- | --- | --- |
| Mis pedidos | `fetchOrdersHistory` | `GET /orders` |
| Detalle de pedido | `fetchOrderDetail` | `GET /orders/{id}` |
| Cotizar carrito | `fetchCheckoutQuote` | `POST /orders/preview` |
| Confirmar compra | `confirmCheckoutOrder` | `POST /orders` |

`src/services/ordersApi.js` usa Axios, preserva mensajes del backend, `status`, `AbortSignal`, respuestas inválidas y errores de red. El método de confirmación envía **solo** `{ paymentMethod, expectedTotal, requestKey }`, exige HTTP 201 con detalle consistente y **nunca reintenta automáticamente**.

## Estado y coordinación

- `ordersSlice`: historial y detalle en Redux, TTL de 60 s, deduplicación en el hook, conservación de detalles cuando su resumen no cambió. Cada respuesta comprueba usuario, generación y requestId; un listado tardío no revive pedidos tras logout ni reemplaza una confirmación nueva.
- `checkoutSlice`: cotizaciones (precio y promociones del backend), estado de envío, mensaje de error, pedido confirmado e intento ambiguo. Rechazos serializados preservan `status` y `ambiguous`. Una respuesta de una visita anterior no puede habilitar confirmación.
- `useCheckoutQuote`: conserva únicamente revisión, cancelación y reintentos de la visita. Una transición a `pending` no cancela su propia solicitud en React.
- `useCheckout`: conserva selección de pago, referencia del intento y lock sincrónico. Redux guarda los datos y resultados de red; el hook reserva el carrito antes de confirmar y coordina los efectos entre dominios solo después de una respuesta 201 validada.
- La vista `Checkout.jsx` mantiene los tres pasos; sus controles de presentación siguen locales.

## Garantías transaccionales preservadas

1. Dos clics simultáneos generan **un solo POST**, mediante el lock sincrónico.
2. `requestKey` se genera una vez por intento lógico con `crypto.randomUUID()`. Un resultado ambiguo por red/HTTP 5xx/201 inválido conserva la misma clave y datos para un replay.
3. Si el servidor rechaza un total con **409**, se solicita una **nueva cotización**. El usuario debe aceptar explícitamente el importe antes de enviar otra clave.
4. Si el resultado es **401**, se cierra la sesión vigente. Una respuesta tardía de otra cuenta o generación se descarta.
5. El carrito solo se vacía y el catálogo/historial se invalidan **después de confirmar** el pedido. Un error no descuenta stock desde la UI ni borra el carrito.
6. Los importes dependen de la cotización del backend, no de cálculos del frontend.

## Validación

Pruebas unitarias: `tests/orders-api.test.mjs`, `tests/redux-orders.test.mjs`, `tests/redux-checkout.test.mjs`, `tests/checkout-quote.test.mjs`, `tests/cart-architecture.test.mjs`.

En GitHub Actions: `npm ci`, `npm run lint`, `npm run build`, `node --test tests/*.test.mjs`.

La suite E2E `tests/checkout.browser.mjs` mantiene contratos de moneda, rutas, 409, 422, 401, resultados ambiguos, navegación, pago, bloqueo del carrito, doble clic, cuentas distintas y reintento con misma clave. Se actualizó el monitor de red para observar **XMLHttpRequest**, transporte de Axios, además de `fetch`. Requiere Vite y Playwright + Microsoft Edge en el entorno de QA. CI actual no ejecuta pruebas E2E.

## Alcance

Sin cambios en Spring Boot ni el esquema de PostgreSQL. No se altera el contrato de `requestKey` del backend ni se fusionan ramas automáticamente. La siguiente etapa del frontend abarcará promociones y reseñas.
