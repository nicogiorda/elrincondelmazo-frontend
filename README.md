# El Rincón del Mazo — Frontend

Ecommerce de cartas y coleccionables del TPO de **Aplicaciones Interactivas**. Frontend en React + Vite, Redux Toolkit y Axios; backend Spring Boot con API REST.

## Arquitectura (referencia: demo Redux de la cursada)

**Regla principal: las llamadas HTTP se hacen en los `createAsyncThunk` de Redux**, usando `axios.get()`, `axios.post()`, `axios.put()`, `axios.patch()` y `axios.delete()`, tal como en `postSlice.js` de la profesora.

```text
Componente React
  → hook (useDispatch)
  → src/Redux/*Slice.js
       createAsyncThunk → axios.get/post/put/patch/delete
       extraReducers → pending / fulfilled / rejected
  → store Redux
  → useSelector → componente
```

**No hay servicios HTTP paralelos.** Las validaciones y transformaciones son funciones puras dentro de `src/utils/`. Para encontrar el endpoint de una operación, abrí su slice.

| Dominio | Archivo | Métodos |
| --- | --- | --- |
| Login, registro y perfil | `src/Redux/userSlice.js` | GET, POST, PUT |
| Colecciones | `src/Redux/catalogSlice.js` | GET |
| Catálogo, detalles y metadatos | `src/Redux/productsSlice.js` | GET |
| Carrito | `src/Redux/cartSlice.js` | GET, POST, PUT, DELETE |
| Historial y detalle de pedidos | `src/Redux/ordersSlice.js` | GET |
| Cotización y compra | `src/Redux/checkoutSlice.js` | POST |
| Publicaciones propias y fotos | `src/Redux/publicationsSlice.js` | GET, POST, PUT, PATCH, DELETE |
| Promociones públicas y admin | `src/Redux/promotionsSlice.js` | GET, POST, PUT, PATCH |
| Reseñas | `src/Redux/reviewsSlice.js` | GET, POST |

### Carpetas principales

- **`src/Redux/`** — `configureStore`, reducers, thunks y llamadas Axios.
- **`src/hooks/`** — coordinación React, navegación, formularios, cancelaciones y `dispatch`.
- **`src/views/` / `src/components/`** — pantallas y UI.
- **`src/utils/`** — validaciones, mapeos, eventos e infraestructura pura de caché, sin Axios.
- **`src/config/api.js`** — URL base del backend.
- **`tests/`** — pruebas unitarias de thunks, contratos HTTP y escenarios Playwright.

El coordinador `src/utils/productCache.js` **no hace solicitudes**: únicamente conserva TTL de 60 segundos, deduplicación, abortos e invalidación. El thunk de `productsSlice.js` proporciona el `axios.get()`, también cuando lo necesita el carrito o el selector de productos de promociones.

### Seguridad y comportamiento

El JWT de las operaciones privadas se obtiene del `extraArgument` de Redux; la contraseña no se incluye en acciones Redux. El checkout conserva el mismo `requestKey` para reintentar un resultado ambiguo y evita compras duplicadas. Las solicitudes antiguas no pueden restablecer datos de otra sesión. La lógica de permisos y stock sigue validándose en el backend.

## Desarrollo local

Requiere Node.js 22. Desde la carpeta frontend:

```powershell
npm ci
npm run dev
```

El frontend utiliza por defecto `http://localhost:8080` para el backend, configurable en `src/config/api.js`.

### Validaciones

```powershell
npm run lint
npm run build
node --test tests/*.test.mjs
```

En GitHub Actions también se ejecutan los escenarios de navegador con Playwright y Microsoft Edge contra HTTP simulado, sin modificar PostgreSQL. Si la instalación falla con `EPERM` en Windows, cerrá los servidores Node y considerá tener el repositorio fuera de una carpeta sincronizada por OneDrive.

## Referencias técnicas

- [Etapa 13 — Limpieza y arquitectura vigente](docs/redux-etapa-13.md)
- [Etapa 12 — Migración a Axios explícito](docs/redux-etapa-12.md)
- [Integración final del frontend](docs/integracion-final.md)

Las etapas anteriores son el historial de refactorizaciones, no el modelo vigente de carpetas.
