# Etapa 13 — Limpieza de servicios HTTP: una sola arquitectura Redux Toolkit + Axios

## Referencia de la cursada

Objetivo: que cualquiera que conozca `postSlice.js` de la profesora pueda encontrar la llamada al servidor **en el mismo archivo donde está definido el `createAsyncThunk`**. Los estados de carga, éxito y error se actualizan con `extraReducers` y los componentes usan `dispatch` y `useSelector`.

**No queda ninguna capa HTTP paralela.** La carpeta `src/services/` se eliminó porque los archivos `*Api.js` duplicaban los mismos endpoints ya implementados dentro de los thunks. No hay `axios.request()` genérico ni nuevas funciones que hagan HTTP escondidas detrás de un nombre como `getCart()`.

## Estructura final

```text
src/
├── Redux/
│   ├── store.js                configureStore + todos los reducers
│   ├── userSlice.js            axios.get / axios.post / axios.put
│   ├── catalogSlice.js         axios.get colecciones
│   ├── productsSlice.js        axios.get catálogo, detalle, Home, relacionados, selección, metadatos
│   ├── cartSlice.js            axios.get / post / put / delete
│   ├── ordersSlice.js          axios.get historial y detalle
│   ├── checkoutSlice.js        axios.post preview y confirmación
│   ├── publicationsSlice.js    axios.get / post / put / patch / delete
│   ├── promotionsSlice.js      axios.get / post / put / patch
│   └── reviewsSlice.js         axios.get / post
├── hooks/                     useDispatch, useSelector y coordinación de interfaz
├── config/
│   └── api.js                 solamente API_BASE_URL
└── utils/
    ├── authValidation.js
    ├── accountValidation.js
    ├── cartErrors.js
    ├── orderValidation.js
    ├── productValidation.js
    ├── productCache.js        TTL, deduplicación y cancelación SIN HTTP
    ├── promotionValidation.js
    ├── publicationValidation.js
    ├── reviewValidation.js
    ├── promotionMapper.js
    └── publicPromotionEvents.js
```

**Regla:** `utils` no importa Axios, no crea peticiones, no guarda credenciales. Sus funciones validan y transforman datos o coordinan la caché. La única excepción aparente, `productCache.js`, no es una API: organiza solicitudes enviadas por los thunks, sin conocer Axios ni rutas HTTP.

## Flujo de una operación

```text
React → useCart → dispatch(addItemToCart(...))
                  ↓
     src/Redux/cartSlice.js
       createAsyncThunk('cart/add', async (...) => {
         const { data } = await axios.post(API_BASE_URL + '/carts/items', body, { headers, signal })
         return data
       })
                  ↓
       extraReducers (pending, fulfilled, rejected)
                  ↓
          Redux Store → useSelector → React
```

Para `productsSlice.js`, una solicitud de metadatos del carrito o una selección de promociones sigue el mismo patrón con `fetchCachedProduct` / `fetchSelectionProducts`. Los thunks pasan el callback `axios.get()` al coordinador `productCache`, que conserva la deduplicación, TTL de 60 segundos y el aislamiento de respuestas antiguas. `useCatalog` ofrece funciones estables que **despachan esos thunks**, no llaman un servicio HTTP.

## Garantías que se conservaron

- Login/registro: las contraseñas se almacenan temporalmente fuera de Redux, y el JWT candidato se verifica con `GET /users/me` antes de autenticar.
- Todas las operaciones privadas usan el JWT de la sesión actual, obtenido del `thunk.extraArgument` y nunca embebido en el payload.
- Checkout: una respuesta 201 sin detalle, un fallo de red o un 5xx siguen marcándose como ambiguos. Se conserva la misma `requestKey` y no se envía otra compra automáticamente.
- Mis pedidos, publicaciones, carrito y administración conservan aislamiento entre usuarios y abortos.
- El catálogo conserva TTL, deduplicación, invalidación y protección contra respuestas que ignoran abortos.
- El formulario de reseñas conserva el bloqueo sincrónico contra doble publicación.

## Qué se eliminó

Se eliminaron los ocho servicios HTTP duplicados `accountApi.js`, `authApi.js`, `cartApi.js`, `ordersApi.js`, `productsApi.js`, `promotionsApi.js`, `publicationsApi.js` y `reviewsApi.js`, además de trasladar `httpClient.js` a `config/api.js` y el notificador público a `utils/publicPromotionEvents.js`.

También se retiraron las pruebas de wrappers HTTP que ya no existen. Fueron sustituidas por:
- `tests/redux-transport.test.mjs`: ejecuta los **thunks reales**, simulando los métodos de Axios por separado y comprobando método, endpoint, JWT, cuerpos, respuesta y número de intentos.
- `tests/domain-validation.test.mjs`: comprueba las validaciones puras, códigos 401/403, abortos, respuestas inválidas, URLs seguras, idempotencia e identidad.
- `tests/fixtures/mockAxios.mjs`: test-only. Espía `axios.get/post/put/patch/delete` sin parchear globalmente Axios ni generar un servicio de producción paralelo.

Se mantienen los tests `redux-*.test.mjs`, `product-cache.test.mjs` y los flujos funcionales de navegador (Playwright). Las pruebas de arquitectura exigen que **únicamente los nueve slices importen Axios** y que no exista `src/services/`.

## Verificación

```powershell
npm ci
npm run lint
npm run build
node --test tests/*.test.mjs
```

GitHub Actions ejecuta estas comprobaciones y, adicionalmente, Playwright con Microsoft Edge y backend simulado. Los cambios están en un PR de frontend sobre `main`; no hay migraciones ni cambios en Spring Boot o PostgreSQL.

Los documentos de etapas anteriores describen versiones históricas de la arquitectura. Este documento es la referencia vigente después de la limpieza.
