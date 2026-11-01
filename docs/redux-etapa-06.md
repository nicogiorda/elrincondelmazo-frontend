# Redux — etapa 6: GET públicos de productos, siguiendo la clase del 27/10/2026

**Alcance de este PR:** lectura de productos de Home, catálogo, detalle y
relacionados. No da por migradas las operaciones de escritura ni todas las
entidades del e-commerce.

## Flujo que explicó Gisele

1. Un componente React despacha una acción (`useDispatch`).
2. `createAsyncThunk` coordina la operación asíncrona y obtiene el resultado.
3. Axios realiza los GET públicos desde `productsApi` (capa de transporte,
   sin estado React), invocado por el thunk a través del coordinador de caché.
4. `extraReducers` aplica `pending / fulfilled / rejected` a la porción
   correspondiente del estado global.
5. Los componentes consumen el resultado de Redux mediante `useSelector`.

Home antes guardaba `homeIds`, `loading`, `error` en `useState` y
consultaba `loadPage` directamente. Productos relacionados hacía otro
`loadPage` desde `useProductDetail`. Ambos usan ahora acciones del slice.
El catálogo y el detalle ya tenían `createAsyncThunk`; los conservamos.

## Una fuente de verdad y garantías existentes

`createEntityAdapter` continúa como única fuente de entidades públicas. La
caché solamente maneja TTL 60 s, deduplicación de URL, versiones de respuesta,
AbortController y revalidación, sin duplicar objetos Product.
Home, catálogo y relacionados tienen **metadatos independientes**: una carga
de Home no puede pisar la página activa del catálogo.

El transporte se pasó a Axios sin cambiar endpoints, filtros, identidad del
producto, códigos HTTP útiles para la UI o cancelaciones. Se agregaron pruebas
del flujo, deduplicación, errores y respuestas tardías.

## Lo que falta para cumplir el resto de la clase

- `userSlice` para usuario, sesión y acciones de autenticación.
- GET/POST/PUT/PATCH/DELETE de publicaciones dentro de thunks de su entidad.
- HTTP del carrito, pedidos/checkout, promociones, reseñas y cuenta: hoy
  algunos estados están en Redux pero los HTTP se coordinan desde hooks.
- Revisión final de `fetch` restante en servicios y de los `useState`
  que contienen información de backend (no de UI).
- Pruebas de navegador y regresión funcional después de **cada etapa**.

No mezclar operaciones financieras ni autenticación en esta fase: mantener
checkout, separación de sesiones e idempotencia sin cambios.

## Verificar antes de merge

```sh
npm ci
npm run lint
npm run build
node --test tests/*.test.mjs
node tests/catalog.browser.mjs
```

El script de navegador requiere Vite en `http://localhost:5173` y Playwright.
Github Actions solo ejecuta por ahora lint, build y la suite Node.
