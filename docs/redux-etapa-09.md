# Etapa 09 — Carrito: Redux Toolkit + Axios

## Referencia de cursada

Se mantiene el flujo explicado por la profesora Gisele en la clase del 27/10 y en su demo: componente React → `dispatch(createAsyncThunk)` → Axios → `extraReducers` (`pending`, `fulfilled`, `rejected`) → `useSelector`. No se reemplaza Redux por un estado local ni se deja la peticion HTTP dentro de los hooks.

## Implementacion

- `src/services/cartApi.js`: Axios para `GET /carts`, `POST /carts/items`, `PUT /carts/items/{id}`, `DELETE /carts/items/{id}`; envia JWT y AbortSignal por solicitud. Conserva mensajes HTTP, estado 401 y error de red como `TypeError`.
- `src/Redux/cartSlice.js`: `fetchCart`, `addItemToCart`, `changeCartItemQuantity`, `deleteCartItem` con `createAsyncThunk`. Sus `extraReducers` reflejan pendiente, exito y error. El estado del carrito sigue serializable.
- `src/Redux/store.js`: `cartToken` inyectado por `extraArgument`, sin colocar JWT en `meta.arg` ni en Redux.
- `src/hooks/useCart.js`: despacha thunks en vez de ejecutar peticiones del servicio. Conserva el lock sincrono de una operacion por vez, identidad de usuario + generacion, cancelacion, rollback a la ultima respuesta confirmada y la reserva para checkout.

## Importante sobre PUT optimista

Puede haber varios clics de cantidad mientras el primer PUT esta pendiente. La interfaz muestra la ultima cantidad elegida. El thunk de cantidad valida la respuesta y publica su ciclo async, pero **no confirma en el estado una respuesta intermedia**; `useCart` coordina el siguiente PUT y solo aplica el ultimo carrito confirmado. Si falla una solicitud, se restaura la ultima respuesta valida recibida del backend.

## Alcance de seguridad

Los thunks verifican `ownerId` y `generation` antes de mutar el estado. Una respuesta vieja luego de cerrar sesion o cambiar de cuenta se descarta. El token no se almacena en el slice. La cancelacion no debe mostrar un error nuevo. El checkout y su `requestKey` idempotente no cambian.

## Pruebas

- `tests/cart-api.test.mjs`: Axios, paths, verbos, body, JWT, abort, HTTP y red.
- `tests/redux-cart-async.test.mjs`: transiciones async, respuestas fuera de orden y sesiones.
- `tests/redux-cart.test.mjs`: garantias anteriores de estado y rollback.
- `tests/cart-architecture.test.mjs`: reglas de Redux y Axios.
- `tests/cart-api.browser.mjs` y `tests/checkout.browser.mjs`: contratos e interacciones reales en navegador. Se agrega observacion de XHR para Axios.

Ejecutar `npm ci && npm run lint && npm run build && node --test tests/*.test.mjs`. Los escenarios de navegador requieren Vite y Playwright configurado, conforme al procedimiento de QA del repositorio.

## Limitaciones

Este PR cambia solo el carrito. Pedidos, cotizaciones y confirmacion de checkout todavia tienen HTTP coordinado por sus hooks y son la siguiente migracion. La refactorizacion no cambia el backend.
