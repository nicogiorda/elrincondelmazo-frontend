# Etapa 12 — Axios explícito dentro de los thunks (alineación con Demo Redux)

> **Arquitectura vigente desde etapa 13:** se eliminaron los servicios HTTP duplicados. Esta etapa 12 describe el estado intermedio de la migración; la estructura definitiva está en [etapa 13](redux-etapa-13.md): Axios solo en los thunks, validaciones puras en `utils` y URL en `config/api.js`.


## Por qué se cambió

El ejemplo compartido por la profesora tiene dos archivos principales:

- `store.js`: `configureStore({ reducer: { posts: postReducer } })`.
- `postSlice.js`: importa **`createAsyncThunk`, `createSlice` y `axios`**. `fetchPosts` realiza `axios(URL)` y `createPosts` utiliza `axios.post(URL)`. `extraReducers` maneja `fetchPosts.pending`, `fulfilled` y `rejected`.

En el ecommerce se había implementado un patrón equivalente pero no tan parecido visualmente: un thunk como `fetchCart` importaba `getCart` desde `cartApi.js`; ese servicio utilizaba `axios.request({ method: 'GET' })`. Para comprender el método, había que abrir varios archivos, y el código no reflejaba de forma inmediata la demo de clase.

**Decisión solicitada para el TPO:** que cada thunk muestre con claridad **`axios.get()`, `axios.post()`, `axios.put()`, `axios.patch()` o `axios.delete()`**, y luego `extraReducers` decida cómo cambia el estado. Los `services/*Api.js` mantienen temporalmente funciones exportadas para compatibilidad de pruebas antiguas, pero **los thunks ya no importan funciones que hagan peticiones HTTP**. Solo importan validaciones/normalizadores puros.

## Patrón de código

```javascript
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import axios from 'axios'

export const fetchProductReviews = createAsyncThunk(
  'reviews/fetchProduct',
  async ({ productId }, { signal }) => {
    const { data } = await axios.get(URL, { signal })
    return data
  }
)

export const publishProductReview = createAsyncThunk(
  'reviews/publishProduct',
  async ({ productId, rating, comment }, { extra, signal }) => {
    const { data } = await axios.post(URL, { rating, comment }, {
      signal,
      headers: { Authorization: 'Bearer ' + extra.reviewsToken() }
    })
    return data
  }
)
```

*El bloque anterior es ilustrativo: los archivos reales también validan ID, estado HTTP, respuesta y errores.*

`extraReducers` conserva los tres estados `pending / fulfilled / rejected`. `useDispatch` inicia la operación y `useSelector` obtiene los datos compartidos. Los formularios y sus indicadores de UI pueden seguir usando estado local.

## Mapa de solicitudes por slice

| Slice | Métodos Axios y rutas |
| --- | --- |
| `catalogSlice.js` | GET colecciones |
| `productsSlice.js` | GET página del catálogo, detalle, recientes y relacionados |
| `cartSlice.js` | GET carrito, POST agregar, PUT cantidad, DELETE ítem |
| `ordersSlice.js` | GET historial y detalle |
| `checkoutSlice.js` | POST cotización y POST confirmación |
| `publicationsSlice.js` | GET mis publicaciones, POST/PUT guardar, PATCH estado, DELETE producto, POST foto |
| `userSlice.js` | GET sesión, POST login/registro, GET verificación JWT y PUT perfil/desactivación |
| `promotionsSlice.js` | GET público/administrador, POST nueva, PUT editar, PATCH activar/desactivar |
| `reviewsSlice.js` | GET reseñas y POST reseña |

El módulo `httpClient.js` conserva **solo `API_BASE_URL`**; no hay un cliente `fetch()` genérico ni un `axios.request()` que oculte el método. Los servicios de compatibilidad con pruebas también usan métodos explícitos.

## Particularidades que la demo de posts no necesitaba

1. **JWT y contraseña:** las credenciales no se escriben en las acciones ni en DevTools. El token de cada sesión se obtiene de `extraArgument`, sin ponerlo en `meta.arg`.
2. **Errores:** Axios lanza para 4xx/5xx; se normaliza `status` para los casos de Redux. Una compra con error ambiguo mantiene `requestKey` y no se reintenta automáticamente.
3. **Sesión:** `ownerId`, `generation` y `requestId` descartan respuestas tardías de otra cuenta.
4. **Catálogo:** conserva un coordinador TTL de 60 segundos, deduplicación y cancelaciones. Los thunks de productos proporcionan una función con `axios.get()` al coordinador. Otras lecturas puntuales de metadatos siguen compartiendo ese coordinador y su servicio de productos para no perder deduplicación.
5. **Estado local:** búsqueda de formularios, modales y locks inmediatos siguen locales cuando no son datos compartidos del backend.

## Pruebas

- `npm ci`, `npm run lint`, `npm run build`, `node --test tests/*.test.mjs`.
- Suites Playwright (Microsoft Edge): carrito, checkout, promociones admin/públicas, reseñas, cuenta, autenticación, publicaciones y catálogo según los scripts del repositorio.
- `tests/cart-architecture.test.mjs` exige cada verbo explícito en el slice y prohíbe `axios.request()` y `fetch()` en servicios HTTP.
- `tests/fixtures/axios-verb-test-bridge.mjs` permite que los tests antiguos con mocks de `axios.request(config)` sigan verificando los contratos. **Solo se importa en tests:** no entra en el bundle de producción.

**Alcance:** refactor del frontend, sin cambios de endpoints ni DTO de Spring Boot y sin cambio de base de datos. Los PRs siguen saliendo de ramas nuevas hacia `main` y no se fusionan automáticamente.
