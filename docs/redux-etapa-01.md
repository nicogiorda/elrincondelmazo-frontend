# Redux Toolkit - etapa 1: filtros y colecciones

Referencia de la cursada: clase del 27/10/2026, con `configureStore`, `Provider`,
`createSlice`, `createAsyncThunk`, `extraReducers`, `useSelector` y `useDispatch`.

## Qué migramos

- `src/Redux/store.js`: almacén centralizado, con reducer `catalog`.
- `src/Redux/catalogSlice.js`: filtros por entrada de React Router y colecciones públicas.
- `useCatalogFilters`: usa el estado de Redux; no mantiene otra copia con `useState`.
- `useCollections`: lee el store y despacha una única carga de colecciones por app.
- `main.jsx`: `Provider` envuelve las rutas.

El GET de colecciones usa **Axios dentro de createAsyncThunk**. `extraReducers`
publica los estados `loading`, `succeeded`, `failed`.
`condition` evita GET simultáneos redundantes (también bajo StrictMode).

## Qué NO migramos todavía

El listado paginado de productos y el detalle siguen usando
`useProductCache` / `createProductCache`, que contienen protección contra respuestas
tardías, deduplicación, vigencia de 60 segundos e invalidación al publicar.
No copiamos esos productos al store: sería duplicar la fuente de verdad.
La siguiente etapa es migrar la caché de páginas y sus entidades de manera integral,
manteniendo las pruebas actuales.

Carrito, JWT, checkout, pedidos y promociones también permanecen sin cambios.

## Instalación y verificación (antes de mergear)

La dependencia se declaró en `package.json`, pero el lock se debe regenerar con npm
en un entorno con acceso al registro:

```sh
npm install
npm run lint
npm run build
node --test tests/*.test.mjs
node --test tests/redux-catalog.test.mjs
```

**Importante:** incluir el `package-lock.json` regenerado en esta rama antes de mergear.
El PR debe permanecer como borrador hasta que `npm ci` y la suite estén aprobados.
Comprobar manualmente catálogo con búsqueda, filtros, paginación, navegación atrás,
colecciones en Home/Publicar, y consola de Redux DevTools.
