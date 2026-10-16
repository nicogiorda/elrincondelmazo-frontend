# Integración del flujo de compra con JWT — 14/10/2026

## 1. Qué se conectó

Carrito completo (consultar, agregar, cambiar cantidad, quitar), confirmación de compra y publicación de reseñas. Se reutiliza la autenticación que el equipo publicó en origin/main: Login/Register guardan `access_token` bajo la clave `token` de localStorage y entregan el usuario de GET /users/me a App.

La rama local master no tenía esos cambios. Se incorporó origin/main (bb477da) mediante un merge **sin commit** y se resolvió el conflicto de App conservando tanto la autenticación/promociones del equipo como el catálogo y las reseñas públicas de esta rama. Git queda con el merge resuelto, pendiente de que el usuario lo revise y lo confirme. No se hizo commit ni push.

## 2. Archivos modificados

| Archivo relativo al frontend | Para qué |
| --- | --- |
| src/App.jsx | Resuelve la integración entre ramas; recupera sesión; conserva GET públicos únicos; implementa requests protegidas, caché del carrito, orden confirmada y actualización de reseñas; limpia estado privado; conserva integración de promociones. |
| src/views/Home.jsx y src/views/Catalog.jsx | Reciben sesión, carrito y mensajes; muestran feedback de mutaciones y bloquean agregar mientras hay una operación pendiente. |
| src/views/ProductDetail.jsx | Agregar/comprar esperan promesas; informa errores; permite enviar reseñas autenticadas y muestra resultado real. Reinicia interacción local al cambiar de usuario/producto. |
| src/views/Cart.jsx | Renderiza CartResponse, carga/error/reintento; cambiar/quitar esperan backend; iniciar compra se bloquea durante una operación. |
| src/views/Checkout.jsx | Usa el POST real de App, espera la orden, muestra fallos y bloquea confirmaciones mientras hay una operación. |
| src/views/OrderConfirmation.jsx | Recibe la orden devuelta por POST y el contador actual del carrito. |
| src/components/ProductCard.jsx y src/components/CartItem.jsx | Deshabilitan controles durante requests; mantienen validaciones visuales de stock/propiedad. |
| src/components/ReviewForm.jsx | Maneja promesa, envío pendiente y errores; conserva comentario/puntuación ante rechazo. |
| src/components/PurchaseNotice.jsx | Permite reintentar carga y muestra navegación según sesión. |
| docs/frontend-backend-connections.md | Aclara que el bloqueo de JWT de la etapa anterior ya fue superado. |
| docs/frontend-jwt-integration.md | Informe de esta etapa. |

También aparecen como cambios locales los archivos incorporados del equipo: Login, Register, Profile, PromotionEditor, AccountAccess, AccountLayout, ProtectedRoute y promotionMocks. Esos archivos se conservaron **idénticos a origin/main**; no se reimplementaron sus pantallas. No cambiaron dependencias, configuración de lint ni archivos del backend.

## 3. Flujo de datos

- Ingresar → Login existente → POST authenticate → access_token → GET /users/me → localStorage token + callback con usuario → App guarda sesión → GET /carts una vez.
- Agregar → POST /carts/items → CartController → CartService → DB → CartResponse completo → setCart → contador y vistas actualizados.
- Cambiar cantidad → PUT /carts/items/{cartItemId} con cantidad absoluta → CartResponse → setCart.
- Quitar → DELETE /carts/items/{cartItemId} sin body → CartResponse → setCart.
- Confirmar → POST /orders con paymentMethod → service valida carrito, aplica promociones, guarda orden, descuenta stock y vacía carrito → OrderResponse → guardar confirmación, vaciar copia local del carrito y ajustar stock cacheado → /pedido-confirmado.
- Publicar reseña → POST /products/{productId}/reviews → Spring valida usuario, compra previa y duplicados → ReviewResponse → agregar a reviewsByProduct[productId] → render sin otro GET.

Las mutaciones fallidas conservan los datos anteriores y muestran el error. No hay creación optimista de pedidos ni reseñas ficticias.

## 4. Estado y useEffect

Productos y colecciones siguen en App y se cargan una vez por montaje de la SPA. Las reseñas se consultan bajo demanda por ID; un array vacío también queda cacheado. Navegar no repite esos GET.

App mantiene user y una copia reactiva del mismo token guardado por Login/Register; no es otro sistema de autenticación. Al recargar con token se recupera /users/me una sola vez, incluso con StrictMode. Si no existe token, el visitante puede explorar el catálogo.

`cart` empieza en null (aún no recibido), distinto de `{ items: [] }` (carrito vacío recibido). GET /carts se hace una vez al tener sesión, con reintento explícito ante error. Los POST/PUT/DELETE sustituyen el carrito usando su response; no disparan otro GET completo.

`cartRequest` es una marca inmediata para impedir requests simultáneas y dobles envíos. `cartBusy` actualiza los controles visibles. `sessionVersion` aumenta al ingresar/cerrar sesión; las respuestas conservan la versión con que salieron y se descartan si ya corresponde a otra sesión. Así una respuesta tardía de A no modifica el carrito de B.

`confirmedOrder` solo contiene una respuesta real de POST /orders y vive en memoria. Se limpia al cambiar/cerrar sesión. Una recarga en /pedido-confirmado no reconstruye una compra ficticia; muestra que no hay confirmación disponible.

Se usa useCallback solamente para que logout pueda compartirse con los efectos sin cambiar su referencia por cada render. Los setters, fetch, then/catch y props siguen coordinados en App, sin una capa de servicios.

## 5. Mocks

No se reintrodujeron shopDemo, cartItems, detailProduct ni detailReviews al resolver el merge. Carrito, orden confirmada, stock ajustado tras compra y reseñas publicadas provienen de respuestas reales.

Se conserva la metadata visual del frontend. Los ejemplos de promociones de Home siguen identificados como ejemplos y no calculan descuentos.

Orders y publicaciones pertenecen al otro alcance: Orders todavía recibe orderMocks y las mutaciones de publicaciones continúan siendo locales. Los pedidos mock **no se usan para habilitar una reseña** ni se mezclan con la confirmación real. La integración del historial sigue pendiente para el equipo.

## 6. Autenticación y seguridad

Cada request privada usa `Authorization: Bearer <token>`. Un visitante que intenta comprar va al login; carrito/checkout/confirmación usan ProtectedRoute existente. Los componentes públicos muestran la sesión real. Se quitó la elevación visual de rol mediante demoAdmin; administración depende del role recibido del backend.

Un 401 en carrito, checkout o POST de reseñas limpia token, usuario, carrito y confirmación, y vuelve al ingreso con un mensaje. Un 403 de negocio (por ejemplo, no haber comprado el producto) conserva la sesión y muestra el rechazo. La recuperación inicial de sesión conserva el criterio del equipo de invalidar 401/403.

La UI oculta una reseña duplicada conocida, pero no pretende saber todas las compras históricas. El usuario autenticado puede enviar el formulario; Spring es quien autoriza la reseña. Se valida rating entero 1–5 y comentario no vacío/máximo 1000 antes del envío, y el servidor vuelve a validar.

## 7. Endpoints

| Método | Endpoint | Componente | Cuándo | Estado que actualiza |
| --- | --- | --- | --- | --- |
| GET | /products?size=100 | App → Home/Catalog/ProductDetail | Una vez al montar | shop.products |
| GET | /collections | App → Home/Catalog | Una vez al montar | collections |
| GET | /products/{productId}/reviews | App → ProductDetail | Primera visita por producto o reintento explícito | reviewsByProduct |
| GET | /users/me | App | Recarga con token existente | user, estado de recuperación |
| POST | /api/v1/auth/authenticate | Login del equipo | Enviar login | token existente y user mediante callback |
| POST | /api/v1/auth/register | Register del equipo | Enviar registro | token existente y user mediante callback |
| GET | /users/me | Login/Register del equipo | Después de obtener token | Usuario real pasado a App |
| GET | /carts | App | Una vez por sesión; reintento explícito | cart |
| POST | /carts/items | App ← ProductCard/ProductDetail | Agregar/comprar ahora | cart |
| PUT | /carts/items/{cartItemId} | App ← CartItem | Cambiar cantidad | cart |
| DELETE | /carts/items/{cartItemId} | App ← CartItem | Quitar | cart |
| POST | /orders | App ← Checkout | Confirmar | confirmedOrder, cart, stock local |
| POST | /products/{productId}/reviews | App ← ReviewForm | Publicar | Caché de reseñas de ese producto |

Se incorporó también el código existente del equipo para GET/POST/PUT/PATCH de promociones y PUT/DELETE de perfil, sin reemplazar esas funcionalidades. Sus flujos no forman parte de las pruebas de compra de esta entrega.

## 8. Fragmentos importantes

```js
function changeQuantity(id, quantity) {
  return changeCart('PUT', '/carts/items/' + id, { quantity })
}
```

El id es el del **ítem del carrito**, no productId. `changeCart` es una función local de App para las tres mutaciones del mismo recurso; centraliza su bloqueo, Bearer, respuesta y error.

```js
fetch(URL + '/orders', {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  body: JSON.stringify({ paymentMethod }),
})
```

No se envían totales, descuentos, usuario ni ítems: Spring usa el carrito autenticado. Los valores de paymentMethod siguen siendo los enums del backend; sus labels son solo presentación.

```js
const version = sessionVersion.current
// ... request ...
if (version !== sessionVersion.current) return false
setCart(data)
```

La comprobación impide que una respuesta de la sesión anterior repueble el estado privado después de cerrar sesión.

## 9. Conceptos para estudiar

- Un token almacenado no prueba por sí solo que siga vigente: /users/me y las respuestas de endpoints protegidos lo verifican.
- fetch necesita comprobar response.ok. Los fallos HTTP no rechazan automáticamente su promesa.
- Un 401 y un 403 pueden requerir tratamientos diferentes.
- La UI espera la respuesta antes de actualizar datos persistentes; loading/error son estados distintos del recurso.
- Los setters funcionales conservan actualizaciones concurrentes de otras claves del estado.
- App conserva datos entre rutas; recargar la página reinicia las cachés en memoria.
- La autenticación del backend nunca depende de un id/role inventado por React.

## 10. Pendientes reales

1. **Prueba con Spring/DB:** localhost:8080 no respondió durante esta ejecución. Se verificaron controllers/services/DTOs locales y flujo en navegador con respuestas controladas. Falta ejecutar una compra con una cuenta de prueba en un backend disponible; no se escribieron pedidos ni reseñas en la base real.
2. **Historial y publicaciones:** Orders todavía muestra mocks; una compra nueva no aparecerá allí hasta integrar GET /orders y sus detalles. GET /orders omite items/promotions, mientras GET /orders/{id} devuelve el detalle. No se cambió esa pantalla ni se atribuyeron compras mock al usuario para autorizar reseñas. Las publicaciones siguen teniendo operaciones locales pendientes.
3. **Stock:** se resta de la copia cacheada la cantidad confirmada y se marca AGOTADO si llega a cero, consistente con la compra que acaba de aceptar Spring. OrderResponse no informa stock restante frente a compras concurrentes; el valor local no garantiza disponibilidad futura. El backend valida cada nueva operación. No se añadió un GET completo tras comprar.
4. **Carrito incompleto respecto al diseño:** stock/tipo/colección/vendedor solo se complementan desde productos reales cacheados; si faltan, no se inventan. Cambiar cantidad requiere conocer el producto; quitar sigue disponible. Se mantiene size=100 y su aviso de lista parcial.
5. **Cotización previa:** no hay endpoint inspeccionado que devuelva el total con promociones antes de crear la orden. Checkout muestra subtotal; confirmación usa total/totalDiscount/promotions reales.
6. **Promociones ajenas:** PromotionEditor conserva sus GET propios al montarse; esos requests adicionales ya vienen del módulo del equipo. El flujo público y de compra sí conserva la carga única de App.
7. **Reintentos de compra:** no se reintenta POST automáticamente. El backend no tiene un contrato de idempotencia inspeccionado; si se pierde la respuesta después de aceptar una orden, falta una estrategia acordada para reconciliar ese resultado antes de repetir la operación.
8. **Lint heredado:** Profile y PromotionEditor tienen tres errores de set-state-in-effect ya presentes en origin/main. Se conservaron sus fuentes sin cambios y no se desactivó la regla.

## 11. Verificaciones

- `npm run build`: correcto, 83 módulos.
- `npm run lint`: falla únicamente por tres errores heredados: Profile.jsx:10; PromotionEditor.jsx:63 y :72. La comparación con el contenido de origin/main ejecutada con ESLint confirma las mismas reglas/líneas. Los cambios propios no agregan errores de lint.
- No hay suite npm test existente. Pruebas temporales con Edge/Playwright del entorno, sin dependencias nuevas ni tokens de prueba en la aplicación: login mediante sus formularios actuales, headers Bearer, payloads exactos, GET único de carrito, POST/PUT/DELETE, error de cantidad conservando estado, checkout 400 y luego 201 con totales del servidor, reseña 403 y luego 201, caché de reseñas, cierre/cambio de sesión con respuesta tardía, recuperación y limpieza por 401.
- Pruebas adicionales: token vencido al abrir no consulta carrito; GET de carrito fallido permite reintentar; doble click de confirmar produce un solo POST; productos/colecciones se piden una vez en cada montaje, sin repetición al navegar. Sin errores de render.
- Revisión de imports, conflicto de merge resuelto y diff. Los archivos de pantallas del equipo coinciden exactamente con origin/main. Backend, package.json y lock sin cambios. El diff conserva tres líneas con espacios finales heredadas de PromotionEditor; no se hizo limpieza cosmética de ese archivo.
- Sin commit ni push. Merge resuelto pendiente de revisión/commit por el usuario.

Checklist manual con Spring disponible:

1. Ingresar y comprobar un GET /carts; navegar Home → catálogo → detalle → carrito sin repetir GET de productos/colecciones/carrito.
2. Agregar, cambiar cantidad y quitar; comprobar los JSON devueltos y el contador del header.
3. Comprar con un enum de pago válido; comprobar que solo se muestra éxito después del 201, con el ID y los totales de esa respuesta.
4. Volver al producto comprado y publicar reseña; verificar que aparece la respuesta real sin otro GET de reviews.
5. Intentar reseñar sin compra previa y comprobar que se informa el rechazo conservando el formulario.
6. Cerrar sesión y entrar con otra cuenta: no debe aparecer el carrito/confirmación de la anterior.


## Catálogo: paginación y filtros HTTP — 16/10/2026

Catalog consulta `GET /products` sin JWT con `page`, `size=9` y los filtros no vacíos `search`, `type`, `collectionId`, `minPrice` y `maxPrice`. Usa `content`, `number`, `totalElements` y `totalPages` de Spring. Su respuesta está separada del estado privado de Mis publicaciones y de la lista compartida de Home/Carrito/Checkout. App conserva filtros y página por entrada de navegación; al abrir una tarjeta incorpora ese producto a la lista compartida, aunque no esté entre los primeros 100. Al recargar, si el ID guardado en el estado de navegación no está en la lista compartida, App consulta GET /products/{id}; no confía en una copia antigua del producto ni introduce URLs compartibles.

Las peticiones agrupan cambios durante 250 ms y se cancelan al cambiar filtros, página o salir de la vista. Una respuesta de una consulta anterior no se muestra en la nueva. Los errores permiten reintentar. Las actualizaciones locales conservan la invalidación existente de respuestas pendientes de productos compartidos.

El backend `rama-nico` ya implementa `ORDER BY p.created_at DESC, p.id DESC` en `ProductRepository.findProducts()`: publicaciones recientes primero y desempate estable por ID. La paginación por offset todavía puede desplazarse si otros usuarios agregan o eliminan productos durante la navegación. No se modificó Spring Boot.

Al agregar directamente desde cualquier página se completa la lista compartida sin reemplazar productos conocidos. Al recuperar el carrito, App consulta `GET /products/{id}` para la metadata ausente después de la carga inicial. Deduplica por producto y sesión, permite reintentar errores y cancela/descarta respuestas al cerrar o cambiar sesión. Una respuesta tardía no reemplaza metadata actualizada; productos inaccesibles o no disponibles conservan el botón Quitar, sin inventar stock. Los botones de paginación muestran primera/última página, un intervalo cercano a la actual y puntos suspensivos.
