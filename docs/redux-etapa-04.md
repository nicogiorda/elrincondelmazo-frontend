# Redux Toolkit — etapa 4: estado del carrito

Esta etapa depende del PR #33 (integración de etapa 3 sobre main).
El PR se presenta contra `redux/03-integracion-main`.

## Responsabilidades

`Redux/cartSlice.js` controla **exclusivamente** el estado serializable:
- Carrito confirmado (ítems, cantidades y subtotal).
- Carga, operaciones pendientes, error y mensaje.
- Cantidad optimista y último ítem cuyo PUT está pendiente.
- Reintento explícito y limpieza de sesión.

`useCart.js` conserva **coordinación y efectos**:
- GET /carts, POST /carts/items, PUT y DELETE mediante `services/cartApi.js`.
- Exclusión síncrona por `operation.current`: dos clics simultáneos no duplican operaciones.
- `AbortSignal` de la sesión, referencia al intento actual, y validación de identidad.
- Coalescing de PUT consecutivos; rollback al último carrito confirmado.
- Reserva de checkout y bloqueo de ediciones mientras se confirma el pedido.
- No guarda una segunda copia del carrito con `useState`.

No hay token JWT ni `Promise` en las acciones Redux; el store registra
`ownerId` y `generation` sin datos secretos. Todos los reducers rechazan
las respuestas de otras sesiones, incluidas sesiones posteriores del mismo usuario.
La API y la interfaz siguen intactas.

**No se agregó createAsyncThunk para el carrito en esta etapa.** Sus
mutaciones tienen bloqueos síncronos, coalescing e idempotencia entre dominios
que se deben preservar; una migración ciega a thunks podría duplicar pedidos.
`createAsyncThunk` ya se utiliza en el catálogo y las colecciones.

## Pruebas antes del merge

```sh
npm ci
npm run lint
npm run build
node --test tests/*.test.mjs
node tests/cart-api.browser.mjs
node tests/checkout.browser.mjs
node tests/auth-session.browser.mjs
```

Los scripts de navegador usan Playwright externo y servidor Vite previamente
encendido. No interactúan con Supabase real ni requieren realizar compras.
En CI solo corren las pruebas Node; las pruebas de navegador son obligatorias
para el merge por el riesgo de regresión en el checkout.

## Orden de integración

1. PR #33 (entidades normalizadas) se fusiona en main tras verificarlo.
2. Actualizar la base de este PR a main, ejecutar CI y pruebas de navegador.
3. Fusionar este PR cuando pase la regresión funcional.
