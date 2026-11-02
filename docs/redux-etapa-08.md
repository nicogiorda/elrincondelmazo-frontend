# Redux Toolkit + Axios — Etapa 8: usuarios y autenticación

## Referencia de clase
Archivo proporcionado por Gisele: `Demo Redux/Client/src`.

- `Redux/store.js`: `configureStore` con reducers por dominio.
- `Redux/postSlice.js`: `createAsyncThunk`, petición Axios y
  `extraReducers` para `pending`, `fulfilled` y `rejected`.
- `components/Fecth/PostList.jsx`: `useDispatch`, `useSelector`, `useEffect`.
- `main.jsx`: `Provider store={store}`.

El demo muestra completamente un GET. El POST aparece como thunk, pero no tiene
`extraReducers` ni formulario asociado; completamos el patrón para login y
registro, sin copiar el ejercicio literalmente.

## Flujo aplicado

```
App / Login / Register
  └─ useSession → dispatch(fetchAuthenticatedUser / loginUser / registerUser)
      └─ createAsyncThunk → services/authApi.js (Axios)
          ├─ POST /api/v1/auth/authenticate o /register
          └─ GET /users/me con token candidato
      └─ extraReducers (loading / status / error)
          └─ useSelector(state => state.users)
```

Estado global del usuario, token de sesión y errores en `Redux/userSlice.js`.
`useSession` ya no almacena `user`, `token`, `loading` ni
`sessionError` mediante `useState`.

## Reglas del ecommerce conservadas

- El login y registro requieren POST exitoso **y verificación de identidad
  GET /users/me** antes de publicar y persistir un nuevo token.
- Los componentes de login y registro conservan estado local del formulario
  y AbortController para cancelar al navegar.
- `sessionVersion`, `sessionAbort` y los listeners siguen limpiando carrito,
  pedidos y publicaciones al cerrar sesión o cambiar de cuenta.
- No se registra la contraseña en acciones Redux:
  `stageAuthCredentials` almacena temporalmente datos en memoria y los
  thunks reciben solo un identificador. Se borra al iniciar o cancelar.
- Redux DevTools oculta el JWT en acciones y estado mostrados; el token
  guardado en el navegador conserva el mecanismo existente.
- Un thunk antiguo no puede restaurar usuario tras logout, porque
  `sessionEnded` invalida el requestId; los abortos no publican sesiones.
- `useAccount` puede seguir usando `setUser(updater)` para sincronizar
  cambios de perfil sin duplicar el estado de usuario.
- El indicador global `loading` significa **recuperar sesión**; el estado
  local de formularios indica envío. No ocultar el formulario durante login.
- No se modifica Spring Boot, roles, acceso de admin ni el checkout.

## Validación

CI:
```sh
npm ci
npm run lint
npm run build
node --test tests/*.test.mjs
```

Con Vite en puerto 5173 y Playwright:
```sh
node tests/auth-session.browser.mjs
node tests/account.browser.mjs
node tests/checkout.browser.mjs
node tests/frontend-audit.mjs
```

Se adaptó el monitor del test de sesiones para observar también Axios/XHR,
no solo fetch. Los scripts interceptan HTTP con fixtures ficticias.
**No fusionar sin CI aprobado y regresión de navegador.**

## Lo que no cubre esta etapa

La edición y desactivación de cuenta (`accountApi.js`), carrito, pedidos,
cotizaciones de checkout, promociones y reseñas todavía tienen servicios
basados en fetch y operaciones fuera de thunks. No declararlos migrados;
seguir el mismo patrón de clase en PRs posteriores.
