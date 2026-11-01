# Redux Toolkit - etapa 2: páginas y detalle de productos

Base: `main` después del merge de PR #30. Clase del 27/10/2026: store,
dispatch, actions, createSlice, createAsyncThunk y extraReducers.

## Arquitectura

- `Redux/productsSlice.js` es el dueño del **estado de las consultas de páginas
  y detalle**, incluyendo pending/fulfilled/rejected, requestId y mensajes de error.
- `Catalog.jsx` usa `useDispatch(fetchProductPage(...))` y `useSelector`.
- `useProductDetail` usa `useDispatch(fetchProductDetail(...))` y `useSelector`.
- `Redux/store.js` inyecta la caché normalizada de productos como dependencia
  de los thunks usando `extraArgument`. La caché conserva la única copia de
  las entidades Product; el estado Redux guarda IDs de páginas y metadatos.
- `useProductCache` reutiliza esa instancia, en vez de crear otra.
- Home, catálogo, relacionados, selección de promociones y publicaciones
  siguen resolviendo entidades desde la misma caché.

## Por qué no reemplazamos todavía toda la caché

La caché ya resuelve TTL 60 segundos, GET duplicados, actualizaciones
de vendedores, AbortController, carreras entre detalle y páginas e
invalidaciones por publicaciones. Mover sus entidades sin preservar estos
contratos introduciría regresiones. La siguiente etapa migrará la propiedad de
entidades y metadatos de cache a Redux **sin almacenar dos copias**.

La red sigue pasando por `productsApi.js` (fetch) dentro del coordinador,
mientras el thunk despacha su ciclo de vida. El ejemplo de colecciones
implementado en la etapa 1 sí usa Axios, tal como se mostró en clase.

## Comprobaciones para cerrar el PR

Hay una deuda heredada del PR #30: el `package-lock.json` publicado sigue
sin `@reduxjs/toolkit`, `react-redux` y `axios`. Antes de mergear:

```sh
npm install
npm ci
npm run lint
npm run build
node --test tests/*.test.mjs
node tests/catalog.browser.mjs
```

Incluir `package-lock.json` actualizado en esta rama.

Probar además: navegación directa /producto/:id, botón reintentar,
página de resultados vacía, búsqueda rápida, volver/avanzar, actualización
de stock al publicar o pausar, sesiones y carrito.
Las operaciones persistentes deben interceptarse o ejecutarse en DB aislada.
