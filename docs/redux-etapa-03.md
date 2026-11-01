# Redux Toolkit — Etapa 3: entidades normalizadas

Base: PR #31 (etapa 2). Esta etapa se envía en un PR dependiente
contra `redux/02-productos-paginados-detalle`, que sigue sin fusionar.

## Qué cambió

- `productsSlice` usa `createEntityAdapter` para almacenar las entidades
  públicas de productos de forma normalizada en `state.products.entities` y
  `state.products.ids`. Una sola entidad por ID.
- La caché `createProductCache` es un **coordinador de lecturas**, vigencia,
  expiración a los 60 segundos, invalidaciones, deduplicación y cancelaciones.
  Ya no guarda una `Map` de entidades en producción: usa `entityStore`,
  un adaptador pequeño entre su interfaz y las acciones Redux.
- `useProductCache` consulta los productos mediante `useSelector` y mantiene
  `useSyncExternalStore` únicamente para notificaciones de versión de caché.
- Las páginas y el detalle continúan usando `createAsyncThunk` y
  `extraReducers` de la etapa 2. Guardan IDs y estado de la solicitud,
  **no copias de productos**.
- El adaptador normalizado utiliza solo objetos serializables. No se agregan
  `Promise`, `Map` ni `AbortController` al store.
- Las pruebas `product-cache.test.mjs` continúan utilizando una `Map`
  aislada por defecto, de manera que no dependen del store global.
- CI ahora valida pull requests sobre cualquier rama, incluidos PRs encadenados.

## Responsabilidades

```
React (useSelector, useDispatch)
  ├─ Redux/productsSlice: IDs, entidades públicas, estado de solicitudes
  └─ createProductCache: TTL, solicitudes y reglas de invalidación
      └─ services/productsApi: API REST Spring Boot
```

No migramos JWT, carrito, pedidos ni la información privada de publicaciones.
El checkout conserva su implementación y seguridad originales.

## Riesgos y pruebas obligatorias

1. `npm ci && npm run lint && npm run build && node --test tests/*.test.mjs`
2. `node tests/catalog.browser.mjs` y regresión de catálogo/URL directa.
3. Al publicar/pausar/eliminar, comprobar que Redux invalida las entidades
   con el mismo comportamiento que la caché anterior.
4. Error HTTP, reintento, navegación rápida, expiración y cambio de sesión.

No mergear sin aprobación del pipeline. Primero fusionar PR #31 a main;
después ajustar el PR de esta etapa para que su base sea main.
