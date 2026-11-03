# Etapa 11 — Promociones y reseñas con Redux Toolkit + Axios

## Referencias obligatorias de la cursada

Comparado con la **clase de Gisele del 27/10/2026**, en particular la explicación de `createAsyncThunk`, `createSlice`, `extraReducers`, `Provider`, `useSelector` y `useDispatch`, y con la demo `Demo Redux` (`postSlice.js`, `store.js`, `PostList.jsx`).

En la demo la función del thunk llama directamente a Axios. Para este ecommerce mantenemos **el mismo flujo asíncrono**, pero la lógica de transporte y validación específica del endpoint vive en archivos `services/*Api.js`. No hay ninguna solicitud HTTP ejecutada directamente por un componente React ni por un hook:

```
Home / Promotions / PromotionEditor / ProductDetail
  → hooks: dispatch(createAsyncThunk)
  → promotionsSlice / reviewsSlice (payload creator)
  → promotionsApi / reviewsApi (axios.request)
  → HTTP Spring Boot
  → thunk fulfilled/rejected
  → extraReducers (loading / data / error)
  → useSelector → React
```

**Diferencia deliberada de la demo:** la llamada `axios.request` se encapsula en servicios puros reutilizables, y el thunk la espera y retorna su resultado. La semántica de Redux y la ubicación de la coordinación asíncrona son las mismas. `useState` se mantiene para campos de formulario/reintentos visuales, no para los datos retornados por el backend.

## Promociones

| Operación | Acción Redux | Endpoint Axios |
| --- | --- | --- |
| Promociones administrativas | `fetchAdminPromotions` | `GET /promotions` |
| Crear promoción | `saveAdminPromotion` | `POST /promotions` |
| Editar promoción | `saveAdminPromotion` | `PUT /promotions/{id}` |
| Activar o desactivar | `toggleAdminPromotion` | `PATCH /promotions/{id}/activate\|deactivate` |
| Promociones visibles en Home | `fetchPublicPromotions` | `GET /promotions/public` |

El slice `promotionsSlice.js` separa el estado **admin privado** del listado **público**. Cada solicitud tiene sus tres casos `pending`, `fulfilled` y `rejected` y captura errores serializados con su `status` para respetar HTTP 401.

- La lista privada usa `ownerId` + `generation` + `requestId`. No sobrevive al logout ni admite que una respuesta anterior reemplace un guardado reciente.
- Las mutaciones toman un lock sincrónico en `useAdminPromotions`; el slice expone `busyId` y conserva datos ante fallas. La respuesta POST/PUT/PATCH actualiza el listado directamente sin GET redundante.
- `GET /promotions/public` no envía JWT. Cada visita a Home comprueba vigencia. La invalidación de una escritura administrativa descarta respuestas públicas anteriores y dispara una nueva lectura; dos GET simultáneos se evitan con `condition`.
- `publicPromotions.js` solo notifica invalidaciones entre vistas, no ejecuta peticiones ni guarda otra caché.
- `promotionMapper.js` conserva la transformación de importes, condiciones y fechas sin convertir valores del backend en datos inventados.

## Reseñas

| Operación | Acción Redux | Endpoint Axios |
| --- | --- | --- |
| Ver reseñas | `fetchProductReviews` | `GET /products/{id}/reviews` |
| Publicar reseña | `publishProductReview` | `POST /products/{id}/reviews` |

- `reviewsSlice.js` almacena reseñas públicas por `productId`, errores de carga y estado de publicación. React no conserva copias `reviewsByProduct` en `useState`.
- El GET es anónimo. El POST obtiene JWT temporalmente de `thunk.extraArgument.reviewsToken`, sin guardarlo en Redux ni pasarlo como `meta.arg`.
- La validación del rating y comentario permanece en el hook y el formulario. El hook protege doble envío antes del primer `await`; el backend sigue imponiendo elegibilidad y una reseña por comprador.
- El POST exige HTTP 201 y comprueba el `productId` confirmado; en éxito inserta la reseña sin hacer un nuevo GET.
- Un GET pendiente anterior a la publicación no borra la reseña recién publicada. Una escritura de la sesión A que llega después del logout o login B no modifica el estado.
- Los campos de formulario (`rating`, `comment`, `showReviewForm`) permanecen locales porque son estado de presentación.

## Pruebas y validación

- `tests/promotions-api.test.mjs`, `tests/reviews-api.test.mjs`: rutas, verbos, JWT, señales, errores, mapeos y contratos de éxito con Axios simulado.
- `tests/public-promotions.test.mjs`, `tests/redux-promotions.test.mjs`, `tests/redux-reviews.test.mjs`: ciclo de vida del thunk, estado global, cancelación, errores, deduplicación, cambio de sesión y respuestas tardías.
- `tests/cart-architecture.test.mjs`: evita introducir fetch o `useState` para datos remotos y exige `createAsyncThunk` + `extraReducers` + Axios.
- Playwright: `tests/promotions.browser.cjs`, `tests/admin-promotions.browser.mjs` y `tests/reviews.browser.mjs`, además de las pruebas de carrito/checkout anteriores. Todo simula HTTP sin escribir en el backend ni en PostgreSQL.
- CI: `npm ci`, `npm run lint`, `npm run build`, `node --test tests/*.test.mjs` y suites Playwright en Microsoft Edge.

## Restricciones

Sin cambios en Spring Boot, PostgreSQL, los DTO o los endpoints. `main` no se modifica directamente. Ninguna refactorización debe relajar validaciones del backend ni los permisos de ADMIN/USUARIO.
