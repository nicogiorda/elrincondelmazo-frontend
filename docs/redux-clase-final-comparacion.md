# Auditoría — última clase de Redux y Demo Redux II

**Fuentes primarias entregadas por la cursada:**
- `Reunión en _General_ .vtt`: última clase de Gisele Cuello, transcripción con subtítulos automáticos.
- `Demo Redux II.rar`: `Client/src/components/Redux/postSlice.js`, `store.js` y componentes `PostList`, `PostForm`, `EditPostForm`, `PostCard`, `LatestPost`.

La transcripción tiene errores de reconocimiento de voz; las conclusiones sobre **el código enseñado** se corroboraron con los archivos del proyecto de la profesora. Los tiempos son aproximados.

## 1. Lo que mostró la profesora

**GET — `fetchPosts`** (repaso, alrededor de 00:04–00:06): `createAsyncThunk`, `axios.get(URL)`, `return data`; `extraReducers` gestiona `pending/fulfilled/rejected`. `PostList` despacha el GET con `useEffect` y consume `items`, `loading` y `error` con `useSelector`.

**POST — `createPosts`** (00:06:20–00:12:50; formulario 00:25–00:30):
```js
export const createPosts = createAsyncThunk("posts/createPost", async (newPost) => {
  const { data } = await axios.post(URL, newPost)
  return data
})
// fulfilled: state.items = [...state.items, action.payload]
```
El objeto nuevo llega como argumento desde `dispatch(createPosts({ title, body }))`. La respuesta se agrega al estado global sin volver a consultar el listado. Los inputs del formulario conservan `useState`.

**PUT — `updatePost`** (00:32–00:45; UI de edición 00:46–01:05):
```js
export const updatePost = createAsyncThunk("posts/updatePost", async (updatedPost) => {
  const { id, title, body } = updatedPost
  const { data } = await axios.put(`${URL}/${id}`, { title, body })
  return data
})
// fulfilled:
// const index = state.items.findIndex(post => post.id === action.payload.id)
// if (index !== -1) state.items[index] = action.payload
```
El ID identifica el recurso en la ruta y el body solo contiene los valores editables. El `fulfilled` reemplaza el elemento coincidente **por ID** directamente en Redux, sin realizar otro GET. `PostCard` usa un estado local `isEditing` para alternar vista/formulario.

**PATCH y DELETE** (aproximadamente 01:06:54–01:07:30): se explican oralmente. PATCH envía solamente los campos que cambian; DELETE identifica el recurso y se elimina de la colección. **En el archivo `postSlice.js` entregado no aparecen `axios.patch` ni `axios.delete`**; sería incorrecto atribuirle a la profesora una implementación completa que no figura en la demo.

## 2. Comparación con El Rincón del Mazo

| Ejemplo de clase | Archivo del frontend | Conclusión |
| --- | --- | --- |
| `store.js` + `Provider` | `src/Redux/store.js`, `src/main.jsx` | Mismo patrón, más reducers por dominios |
| `fetchPosts` con `axios.get` | `catalogSlice`, `productsSlice`, `ordersSlice`, otros | Coincide |
| `createPosts` con `axios.post` | `cartSlice`, `reviewsSlice`, `publicationsSlice`, `promotionsSlice`, `albumSlice` | Coincide: datos al thunk y actualización en fulfilled |
| `updatePost` con `axios.put` | `publicationsSlice`, `promotionsSlice`, `cartSlice`, `userSlice` | Coincide: ID en la ruta y payload explícito |
| PATCH de campos parciales | `publicationsSlice`, `promotionsSlice`, `albumSlice` | Método visible en thunk y contrato específico del backend |
| DELETE por ID | `cartSlice`, `publicationsSlice`, `albumSlice` | Método visible en thunk; se retira del estado solo tras éxito |
| `PostList` con `useDispatch/useSelector` | Hooks de dominio + componentes | Mismo circuito, con coordinación extra por JWT y sesiones |
| `useState` para edición e inputs | Formularios, vistas y modales | Coincide |
| Actualizar `state.items` sin reconsultar | Publicaciones, promociones, reseñas; ahora también álbum | Coincide |

No hay archivos `services/*Api.js` duplicando los endpoints: los métodos Axios están directamente en `src/Redux/*Slice.js`, como en la demo. `src/utils` solo valida, transforma o coordina sin ejecutar HTTP.

### Diferencia corregida en esta etapa: álbum

Antes, `useAlbum` hacía **dos GET** después de cada POST/PATCH/DELETE. El resultado del thunk se utilizaba solo para finalizar el indicador de carga. Esa organización no se parecía a `createPosts.fulfilled` ni a `updatePost.fulfilled`.

Ahora:
- `addAlbumPurchase.fulfilled` agrega `action.payload` a la sección y actualiza el cupo conocido de la compra.
- `addAlbumManual.fulfilled` incorpora la carta y abre la página siguiente cuando se completan los nueve espacios.
- `moveAlbumCard.fulfilled` retira por `id` la posición anterior y coloca el objeto devuelto por el PATCH, respetando reemplazos.
- `removeAlbumCard.fulfilled` elimina por `id` solo después de un DELETE confirmado con HTTP 204.
- `changeAlbumVisibility.fulfilled` usa el álbum completo devuelto por el PATCH.
- Cada uno tiene casos `pending`, `fulfilled`, `rejected` visibles en `extraReducers` (sin `addMatcher` genérico).

**Excepción justificada:** el backend `AlbumController` devuelve `CardResponse` con `id`, `pageNumber`, `slotIndex`, `name`, `imageUrl`, `origin`, **sin `orderItemId`**. Cuando se elimina una carta comprada o se reemplaza una posición ocupada, no podemos reconstruir de forma confiable qué cupo de compra se liberó. Por eso el hook solicita **solo `GET /albums/me/purchases`** en DELETE y en PATCH con `replaceExisting=true`. No reconsulta `/albums/me`. El error de esta sincronización no debe presentar como fallida una mutación ya confirmada.

## 3. Qué NO debemos copiar literalmente

La demo es didáctica y usa un API público de ejemplo. Para un ecommerce real con Spring Boot se necesitan, además:
- JWT privado fuera de los payloads Redux, permisos del backend y cierre de sesión ante 401.
- Validaciones de respuestas e identidad; rechazo de recursos ajenos.
- Cancelaciones, control de respuestas tardías y aislamiento por usuario.
- Bloqueo frente a doble POST y `requestKey` estable para checkout ambiguo.
- Errores y mensajes de UI sin perder datos confirmados.

Esas protecciones no contradicen el modelo presentado en clase. Tampoco es necesario que todos los nombres sean `postSlice`: el nombre depende de la entidad (`productsSlice`, `albumSlice`, etc.).

## 4. Comprobaciones

- `tests/redux-album-mutations.test.mjs`: comprueba que POST/PATCH/DELETE modifican el estado desde `action.payload` sin un GET del álbum, que se actualiza la cuota conocida, se abre la página siguiente, y que un GET tardío no pisa una edición.
- `tests/album.browser.mjs`: ejecuta React real y verifica que altas, movimientos y visibilidad no reconsulten el álbum; DELETE solo refresca el cupo.
- Suites existentes: arquitectura de Axios en Redux, contratos HTTP, carrito, checkout, cuentas, publicaciones, reseñas, promociones y seguridad.

El criterio académico para futuras etapas es mantener el circuito **React → `dispatch(createAsyncThunk)` → `axios.METODO` → `extraReducers` → `useSelector`**, usando el verbo HTTP y el contrato correcto de Spring, sin introducir solicitudes duplicadas.
