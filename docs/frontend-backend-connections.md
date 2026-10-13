# Conexiones frontend/backend — 13/10/2026

## 1. Qué conectaste

Se completó el flujo público: Home, Catalog y ProductDetail comparten los productos y colecciones que App pide al backend. Las reseñas se cargan por producto y quedan en memoria. Se continuaron los cambios no commiteados que ya empezaban a usar `reviewsByProduct` y eliminaban los fallbacks de detalle.

Carrito, checkout y confirmación quedaron preparados para los DTOs reales, pero **no están conectados por HTTP**. La autenticación del frontend todavía es demostrativa: no proporciona JWT. Por eso estas rutas muestran un aviso y los controles de compra/publicación de reseñas están deshabilitados o ausentes. No se simula una compra exitosa.

Se inspeccionaron los controllers, DTOs, enums, services y SecurityConfig del backend local. No se modificó el backend ni las pantallas asignadas al compañero. No se agregaron dependencias, servicios, Context ni almacenamiento persistente.

## 2. Archivos modificados

Las rutas de esta tabla son relativas al repositorio frontend.

| Archivo | Cambio y motivo |
| --- | --- |
| `src/App.jsx` | Conserva los GET iniciales; agrega errores/carga, evita duplicados, cachea reseñas por ID y quita compras/reseñas ficticias. Home deriva novedades de productos reales. Espera la carga inicial antes de resolver el detalle. Mantiene los estados demostrativos del otro flujo. |
| `src/views/Home.jsx` | Recibe colecciones reales y combina sus nombres con metadata visual; muestra carga/errores y distingue promociones de ejemplo. |
| `src/views/Catalog.jsx` | Conserva filtros y paginación local; muestra errores, carga y advertencia si la lista de 100 productos es parcial. |
| `src/views/ProductDetail.jsx` | Usa producto, relacionados y reseñas reales; distingue carga/error/lista vacía; ofrece reintentar reseñas; bloquea operaciones sin handler. Quita la promesa fija de descuento. |
| `src/views/Cart.jsx` | Recibe CartResponse plano; usa subtotal del servidor y aviso cuando no hay carrito real. |
| `src/views/Checkout.jsx` | Recibe CartResponse; conserva enums de pago; prepara callback con `{ paymentMethod }`, espera una promesa y muestra errores. No calcula descuentos ficticios. |
| `src/views/OrderConfirmation.jsx` | Recibe OrderResponse: orderDate, state, items planos, promotions y totales reales. Sin orden no muestra confirmación. |
| `src/components/CollectionCard.jsx` | Colecciones sin imagen/configuración propia usan una presentación neutra. |
| `src/components/ProductCard.jsx` | Agregar se deshabilita si no hay handler; no confunde ese caso con haber alcanzado el stock máximo. |
| `src/components/CartItem.jsx` | Usa productName, productImages, unitPrice, quantity y subtotal; metadata/stock solo de un producto real ya cargado. |
| `src/components/PurchaseItems.jsx` | Acepta ítems planos de carrito/confirmación y conserva la variante anterior de Orders. |
| `src/components/PurchaseSummary.jsx` | No muestra total ni ahorro si todavía no fueron provistos; mantiene compatibilidad con Orders. |
| `src/components/PurchaseNotice.jsx` | Nuevo aviso compartido para rutas de compra todavía no disponibles. |
| `src/data/homeMocks.js` | Elimina productos/identidades de colecciones mock; conserva imágenes, colores y ejemplos de presentación. |
| `src/data/catalogMocks.js` | Elimina catálogo/colecciones mock; conserva labels de tipos y fondos. |
| `src/data/productDetailMocks.js` | Completa la limpieza iniciada: sin producto/reseñas ficticias; conserva galería, fondos y textos de presentación. |
| `src/data/productMocks.js` | Quita el helper de relacionados; el detalle los deriva directamente de productos reales. Los mocks restantes siguen sirviendo al otro flujo. |
| `src/data/purchaseMocks.js` | Quita carrito/confirmación/cálculo mock; conserva orderMocks y reexporta formatPrice para no cambiar imports del compañero. |
| `src/utils/formatPrice.js` | Extrae únicamente el formateo monetario compartido para que las compras no dependan de purchaseMocks. |
| `src/utils/shopDemo.js` | Eliminado después de quitar sus consumidores: simulaba carrito, stock y creación de órdenes. |
| `docs/frontend-backend-connections.md` | Este informe. El documento previo de preintegración describe una etapa anterior. |

## 3. Flujo de datos

**Carga inicial:** montar App → GET /products?size=100 → ProductsController/service → Page<ProductResponse> → `data.content` → `shop.products` → props → Home/Catalog/ProductDetail.

**Colecciones:** montar App → GET /collections → array → `collections` → opciones del filtro y tarjetas Home. Colores e imágenes decorativas se agregan por nombre, sin reemplazar el ID real.

**Navegación:** click Cartas → React Router lleva a /catalogo con selección de tipo → filtros en App → Catalog filtra y pagina el array que ya está cargado. Abrir un producto lleva su ID mediante `location.state`; App busca el objeto actual en `products`. No se pide GET /products/{id}.

**Reseñas:** abrir producto → comprobar marca de solicitud por ID → GET /products/{id}/reviews → array → `reviewsByProduct[id]` → ProductDetail. Al volver se reutiliza la entrada. Una respuesta tardía del producto A nunca reemplaza las reseñas del B.

**Compras, actualmente:** click/ruta → control deshabilitado o aviso → sin request protegida y sin modificación ficticia de stock.

**Flujo pendiente, no implementado:** sesión JWT del compañero → GET /carts → guardar CartResponse en App; agregar/cambiar/eliminar → request autenticada → CartController/service/DB → CartResponse completo → reemplazar estado del carrito. Confirmar → POST /orders → OrderResponse → guardar orden y mostrar confirmación. No hace falta repetir GET del carrito después de cada mutación: el backend ya devuelve el carrito actualizado.

## 4. Estado y useEffect

| Dato | Dónde vive y por qué |
| --- | --- |
| Productos | `shop.products`, en App. App permanece montada mientras cambian las rutas. Empieza vacío, sin productos ficticios antes de recibir HTTP. |
| Colecciones | `collections`, en App, compartido por Home y Catalog. |
| Carga, errores y totalElements | App; permiten distinguir espera, fallo y lista parcial. |
| Filtros y página | App; se conserva la lógica existente por entrada de historial (`location.key`). |
| Reseñas | `reviewsByProduct`, objeto indexado por ID en App; un array vacío también es un resultado cacheado. |
| Errores de reseñas | `reviewErrors`, por ID; el botón de reintento habilita otra solicitud únicamente para el producto fallido. |
| Marcas de solicitudes | `useRef`: dos booleanos para GET iniciales y un Set para reseñas. No son datos de pantalla ni disparan render. |
| Selección de imagen/cantidad y pasos de checkout | Estados locales de las vistas; son interacción visual, no datos persistidos. |

Los efectos iniciales tienen `[]`; las marcas evitan repetir HTTP durante la comprobación adicional de efectos que hace StrictMode en desarrollo. La marca de reseñas se registra **antes** de iniciar fetch: volver al producto mientras carga tampoco duplica el pedido. No se cancela al cambiar de ruta, porque su resultado sigue siendo útil para la caché compartida.

Una recarga real reinicia estados y marcas. Un error inicial muestra un mensaje que indica recargar; no genera reintentos automáticos al navegar. Las reseñas sí tienen reintento explícito. La promesa actualiza la entrada capturada por ID mediante un setter funcional, conservando resultados que hayan llegado en paralelo.

## 5. Mocks eliminados

Dejaron de participar `homeProducts`, `catalogProducts`, `catalogCollections`, `detailProduct`, `detailReviews`, `cartItems`, `confirmationMock`, `calculateMockSummary` y las operaciones de `shopDemo`. También se eliminó el orden de novedades/publicaciones basado en IDs del catálogo mock.

Se conservan fondos, labels, galería y metadata visual. `homePromotions` conserva ejemplos decorativos, ahora titulados **Ejemplos de promos**; no son promociones activas consultadas al servidor ni se usan para calcular importes. El detalle conserva un texto general de promociones, sin prometer un 10% fijo.

`accountUser`, `orderMocks`, `promotionMocks` y productos mock que consumen las pantallas del compañero continúan existiendo. No autorizan compras ni POST de reseñas. `PurchaseItems` conserva explícitamente la variante legacy de Orders para no romper esa pantalla compartiendo componente.

## 6. Autenticación

No se encontró un mecanismo real de token en el frontend. Login/Register conservan callbacks demostrativos; navegar al perfil no equivale a autenticarse. No se implementó otro login ni se fabricaron usuarios/JWT.

SecurityConfig permite los GET públicos de productos, colecciones y reseñas. Carrito, POST de orden y POST de reseña requieren autenticación. El backend de acceso existente responde `access_token` desde `/api/v1/auth/authenticate` y `/api/v1/auth/register`; esta tarea no llama esas rutas ni modifica sus formularios.

Cuando el compañero exponga la sesión, deberá acordarse cómo App recibe el token y el usuario real, y limpiar el estado privado al cerrar/cambiar sesión. Entonces se podrán implementar las llamadas con `Authorization: Bearer <token>`. **Ninguna operación protegida quedó funcionando por HTTP en esta entrega.**

## 7. Endpoints

| Método | Endpoint real | Componente coordinador / vista | Cuándo se llama hoy | Estado actualizado |
| --- | --- | --- | --- | --- |
| GET | /products?size=100 | App → Home/Catalog/ProductDetail | Una vez al montar App | shop.products, totalProducts, carga/error |
| GET | /collections | App → Home/Catalog | Una vez al montar App | collections, carga/error |
| GET | /products/{productId}/reviews | App → ProductDetail | Primera visita por ID; reintento explícito ante fallo | reviewsByProduct[id], reviewErrors[id] |
| GET | /carts | Futuro App → Cart | No conectado: falta JWT | Pendiente: carrito real |
| POST | /carts/items | Futuro App ← ProductCard/ProductDetail | No conectado: falta JWT | Pendiente: CartResponse completo |
| PUT | /carts/items/{cartItemId} | Futuro App ← CartItem | No conectado: falta JWT | Pendiente: CartResponse completo |
| DELETE | /carts/items/{cartItemId} | Futuro App ← CartItem | No conectado: falta JWT | Pendiente: CartResponse completo |
| POST | /orders | Futuro App ← Checkout → OrderConfirmation | No conectado: falta JWT | Pendiente: orden confirmada y carrito |
| POST | /products/{productId}/reviews | Futuro App ← ProductDetail | No conectado: falta JWT | Pendiente: incorporar ReviewResponse en su caché |

Contratos verificados para continuar:

- Agregar al carrito: `{ productId, quantity }`. Cambiar: `{ quantity }`, cantidad absoluta, usando el **ID del ítem**, no el del producto. Eliminar no lleva body. Todas estas operaciones devuelven CartResponse, incluido DELETE.
- CartResponse: `{ id, items, subtotal }`; ítem: `{ id, productId, productName, productImages, unitPrice, quantity, subtotal }`.
- Crear orden: solamente `{ paymentMethod }`. El servidor toma el carrito autenticado, valida stock, calcula descuentos, crea el pedido y vacía el carrito. No enviar precios, totales ni un usuario inventado.
- PaymentMethod: `TARJETA_DE_CREDITO`, `TARJETA_DE_DEBITO`, `MERCADO_PAGO`, `TRANSFERENCIA`. Los labels amigables existentes siguen separados de los valores enviados.
- OrderResponse: `{ id, orderDate, state, paymentMethod, subtotal, totalDiscount, total, items, promotions }`. Ítems planos con `productName`, `quantity`, `price` histórico; promociones con `promotionId`, `promotionName`, `discountApplied`.
- Reseña: `{ rating, comment }`, rating entero 1–5, comentario obligatorio y máximo 1000. El service valida compra previa no cancelada y ausencia de reseña previa del usuario. Esa autorización no puede deducirse de órdenes mock.

## 8. Cambios importantes de código

Comprobar HTTP antes de interpretar el JSON:

```js
.then((response) => {
  if (!response.ok) throw new Error(`Error ${response.status} al cargar productos`)
  return response.json()
})
```

`fetch` puede resolver normalmente aunque Spring responda 400/401/500. Lanzar el error permite que `.catch()` guarde un mensaje visible. Además se comprueba que productos tenga `content` array y colecciones/reseñas sean arrays.

Preservar la caché al recibir reseñas:

```js
if (reviewProductId === undefined || requestedReviews.current.has(reviewProductId)) return
requestedReviews.current.add(reviewProductId)
// ...fetch y validación de la respuesta...
setReviewsByProduct((current) => ({ ...current, [reviewProductId]: data }))
```

El spread conserva los otros productos. El setter funcional lee el estado más reciente, por lo que dos respuestas concurrentes no se pisan.

Relacionados sin IDs del prototipo:

```js
products.filter((candidate) =>
  candidate.collectionId === product.collectionId && candidate.id !== product.id
).slice(0, 4)
```

Se aplica sobre los productos públicos cargados; no se consulta de nuevo el catálogo ni se mezclan colecciones para llenar cuatro tarjetas.

CartItem muestra directamente `item.productName`, `item.unitPrice` e `item.subtotal`. Busca opcionalmente el producto real cacheado por `productId` para mostrar metadata y limitar cantidades. Si falta, no inventa stock y bloquea cambiar cantidad. Confirmation usa el precio histórico `item.price`, aunque el precio actual del catálogo cambie.

## 9. Cosas que debo entender

- Props transportan datos; useState en App conserva los datos compartidos al navegar.
- Cambiar una ruta no equivale a recargar la SPA. La caché actual se pierde en una recarga real.
- `undefined` significa reseñas aún no recibidas; `[]` significa consulta exitosa sin reseñas.
- El ID identifica el producto; ni un nombre ni un ID del prototipo sirven para asociar otra entidad real.
- El backend de productos devuelve una página; el de colecciones, un array. HTTP 200 no garantiza que cualquier forma de JSON sirva para el render.
- El cuerpo de una request no tiene necesariamente el mismo formato que su response.
- useRef permite recordar que se inició una request sin provocar renders; useState guarda aquello que sí debe actualizar la pantalla.
- El servidor decide permisos, disponibilidad y descuentos. Un control deshabilitado ayuda a la UI, pero no reemplaza seguridad del backend.
- Datos actuales del catálogo y precios históricos de una orden cumplen funciones distintas.

## 10. Bloqueos o pendientes

1. **JWT real:** faltan GET/mutaciones del carrito, POST de orden, POST de reseña y estado privado en App. Las vistas están preparadas; los handlers HTTP y la actualización de cachés tras mutaciones siguen pendientes, no escondidos detrás de un token falso.
2. **Carrito y metadata:** CartItemResponse no trae stock, type, collectionName ni sellerName. Se usa únicamente información complementaria real de `products`. Si un producto no está en los primeros 100 o el catálogo quedó desactualizado, la UI no conoce su disponibilidad actual. Acordar si alcanza esta estrategia para el TPO o se amplía el DTO/consulta complementaria; el backend valida al comprar.
3. **Stock después de comprar:** OrderResponse no incluye el stock restante. Vaciar el carrito local después de éxito es coherente con el service; restar cantidades del catálogo sería solo una estimación si hubo compras concurrentes. Elegir respuesta enriquecida o actualización puntual cuando se conecte checkout; no se agregó un refetch completo automático ni se afirma tener stock autoritativo.
4. **Total previo:** CartResponse aporta subtotal y POST /orders determina promociones/total. No se encontró un endpoint de cotización previa. Checkout muestra subtotal sin inventar ahorro; si se exige conocer el total exacto antes de confirmar, hace falta acordar ese contrato.
5. **Paginación:** se mantuvo size=100 y paginación local de 9. Si totalElements es mayor, se informa que filtros/páginas abarcan la lista cargada. La estrategia completa para catálogos más grandes queda pendiente; no se agregaron GET por navegación.
6. **Pantallas del compañero:** conservan demostraciones, no autenticación/persistencia real. Sus callbacks de publicaciones aún cambian productos en memoria; no deben confundirse con operaciones de backend. GET /orders usa un mapper resumido sin items/promotions, mientras POST /orders y GET /orders/{id} entregan el detalle; tendrá que contemplarlo al integrar Orders. No se modificaron esas pantallas.
7. **Promociones de Home:** son ejemplos de presentación explícitos, pendientes de datos reales; no se integró administración de promociones.
8. **Prueba real:** el backend local no respondió en localhost:8080 durante la verificación, también comprobado fuera del sandbox. Falta verificar con Spring/DB disponibles y después con una sesión real. No se realizaron compras ni reseñas en una base de datos.

## 11. Verificaciones

- `npm run lint`: correcto, sin cambiar reglas.
- `npm run build`: correcto.
- No hay script de tests existente en package.json. Se hicieron comprobaciones automatizadas temporales con Edge/Playwright disponible en el entorno, sin agregar dependencias ni fixtures a la aplicación.
- Navegador con respuestas HTTP controladas que reproducen los DTOs inspeccionados: GET iniciales exactamente una vez incluso con StrictMode; navegación/filtros/paginación; IDs reales de colecciones; reseñas vacías cacheadas; deduplicación durante carga; respuestas de diferentes productos aisladas; error/reintento; recarga en detalle sin redirección prematura; carrito bloqueado sin sesión. Sin errores de render.
- Comprobación adicional en navegador: error inicial visible y sin fallback ficticio; render de CartResponse/OrderResponse planos; metadata ausente sin inventar; controles sin handlers bloqueados; null no muestra una compra confirmada; Orders anterior sigue renderizando. Un intento auxiliar de render SSR no fue utilizable por la carga de CommonJS de React Router en Vite; esas mismas comprobaciones se completaron en navegador.
- Revisión de diff, imports y referencias a mocks reemplazados. Pantallas del compañero, package.json/lock y backend sin modificaciones. Sin commit ni push.

Checklist para repetir con Spring disponible:

1. Recargar Home con Network abierto: un GET de productos y uno de colecciones.
2. Ir a Cartas, filtrar, paginar, abrir detalle y volver: ningún GET adicional de esos dos recursos.
3. Abrir dos productos y volver al primero, incluso rápido mientras cargan reseñas: un GET por ID; reseñas de cada producto separadas.
4. Abrir un producto sin reseñas: mostrar lista vacía sin reseñas ficticias ni repetir GET al volver.
5. Simular fallo de reseñas y reintentar; comprobar aviso y recuperación.
6. Revisar relacionados: misma colección, excluye actual, máximo cuatro.
7. Sin JWT, verificar avisos en carrito/checkout y ausencia de compra/reseña simulada.
