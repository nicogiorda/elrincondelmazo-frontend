# Limpieza del frontend antes de integrar

## Objetivo

Corregir inconsistencias del prototipo de El Rincón del Mazo que impedirían una integración clara con los contratos suministrados del backend. El trabajo se limita al frontend React + JavaScript + Tailwind. No agrega dependencias, requests, autenticación, almacenamiento persistente ni una capa API. Las operaciones existentes continúan siendo demostraciones en memoria.

## Cambios realizados

- **Contratos backend:** se retiró `window.scrollTo` de la navegación sin reemplazarlo por manipulación del DOM. Se corrigieron los campos y enums conocidos; los modelos incompletos de carrito y pedidos siguen identificados como mocks, no como DTOs reales.
- **Enums y labels:** los pedidos usan `PAGO`, con etiqueta visible «Pagado». Filtros, estilos y progreso reconocen ese valor. `paymentMethods.js` contiene un único mapping entre `TARJETA_DE_CREDITO`, `TARJETA_DE_DEBITO`, `MERCADO_PAGO`, `TRANSFERENCIA` y sus textos amigables. Checkout guarda el `value`; Checkout, Orders y PurchaseSummary muestran el `label`. El descuento mock compara con `TRANSFERENCIA`.
- **Usuario:** `accountUser` tiene únicamente `id`, `email`, `firstName`, `lastName`, `role`. Perfil, encabezado de cuenta y vista previa de publicación consumen `firstName`. Se eliminó la badge de antigüedad: `UserResponse` no proporciona `memberSince`. Guardar perfil sigue actualizando solamente el estado de App.
- **Mocks:** `productMocks.js` es la fuente canónica. Los archivos de cada pantalla seleccionan productos por ID, sin redefinir su vendedor, nombre, precio o imágenes. Se conservan las identidades 1–12, Wembanyama 13 (vendedor 2), Iron Man 14 y Kevin Durant 15. Spider-Man es siempre 4 (vendedor 3). Los productos 16 y 17 ya existentes en pedidos también se centralizaron. Las publicaciones nuevas evitan colisionar con los IDs canónicos, incluso los que solo figuraban en pedidos.
- **Productos relacionados:** se derivan del producto abierto: misma `collectionId`, distinto `id`, hasta cuatro resultados en el orden de la fuente canónica. Se reutiliza ProductCard y se elimina la lista ligada al ejemplo de LeBron. Las reseñas mock también se seleccionan por `productId`, en vez de comparar nombres.
- **Controles sin handler:** «Eliminar cuenta» y «Dejar reseña» usan `disabled` cuando falta su callback, con opacidad y cursor adecuados. La reseña también se deshabilita si el pedido está vacío. No se informa ningún éxito ficticio.

### Por qué estos cambios importan en este proyecto

`value` y `label` tienen responsabilidades diferentes. El backend espera `TRANSFERENCIA`; «Transferencia» es texto de interfaz. Si el descuento comparara el texto, un cambio de redacción o traducción alteraría su funcionamiento. Ahora el texto puede cambiar sin cambiar el valor guardado. Los textos informativos del footer y del detalle siguen siendo presentación, no valores de compra.

Un ID identifica una entidad: App agrupa el carrito por `product.id` y React utiliza IDs como keys. Si el ID 1 fuera LeBron en catálogo y Wembanyama en otro mock, agregar uno podría incrementar la cantidad del otro. La fuente única evita esa ambigüedad y conserva un único vendedor por producto. Las imágenes existentes de Home se reutilizan también en las demás vistas; fondos, variantes y etiquetas de galería quedan fuera del dominio.

«Más de Marvel» debe depender del producto Marvel abierto. Una lista fija de NBA producía recomendaciones y títulos contradictorios. Derivar los relacionados por colección también permite que las colecciones con pocos productos muestren menos de cuatro, sin rellenar con productos ajenos. La regla no define nuevas políticas de visibilidad: los estados existentes se conservan y ProductCard impide agregar productos no activos o agotados.

## Archivos modificados

| Archivo | Propósito |
| --- | --- |
| `src/App.jsx` | Retirar scroll manual, identificar el detalle por ID, delegar reseñas al detalle y evitar IDs nuevos ya ocupados por mocks. |
| `src/data/productMocks.js` (nuevo) | Definir productos una sola vez, búsqueda por ID y selección de relacionados. |
| `src/data/paymentMethods.js` (nuevo) | Centralizar enums, etiquetas y conversión para presentación. |
| `src/data/catalogMocks.js` | Derivar los doce productos originales de la fuente única. |
| `src/data/accountMocks.js` | Ajustar UserResponse y derivar publicaciones por ID. |
| `src/data/homeMocks.js` | Reutilizar productos y conservar configuración visual de Home. |
| `src/data/productCardMocks.js` | Corregir IDs/vendedores de ejemplos visuales mediante referencias canónicas. |
| `src/data/productDetailMocks.js` | Reutilizar LeBron y retirar relacionados hardcodeados. |
| `src/data/purchaseMocks.js` | Reutilizar productos en carrito/pedidos y corregir estados y pagos. |
| `src/components/AccountLayout.jsx` | Mostrar nombre e iniciales con `firstName`. |
| `src/components/PurchaseSummary.jsx` | Mostrar el label del método de pago en confirmación. |
| `src/views/Checkout.jsx` | Seleccionar y confirmar enums; mostrar etiquetas. |
| `src/views/Orders.jsx` | Reconocer PAGO, presentar pagos amigables y deshabilitar reseñas sin handler. |
| `src/views/ProductDetail.jsx` | Calcular relacionados y reseñas desde el producto actual. |
| `src/views/Profile.jsx` | Editar `firstName`, eliminar antigüedad ficticia y deshabilitar eliminación sin handler. |
| `src/views/PublishProduct.jsx` | Usar `firstName` al construir el nombre del vendedor del mock. |
| `docs/frontend-preintegration-fixes.md` (nuevo) | Registrar cambios, bloqueos y verificación. |

## Problemas deliberadamente no resueltos

### 1. Carrito: CartItemResponse no alcanza para la UI actual

El backend devuelve `CartResponse { id, items, subtotal }`. Cada item tiene `id`, `productId`, `productName`, `productImages`, `unitPrice`, `quantity`, `subtotal`. Actualmente App almacena un array de `{ id, product, quantity }`.

| Uso actual de CartItem.jsx | Contrato disponible / diferencia |
| --- | --- |
| `item.id`, `item.quantity` | Disponibles directamente; `id` identifica el renglón, no el producto. |
| `product.name`, `product.price` | Adaptables desde `productName` y `unitPrice`. |
| `product.price * quantity` | El backend ya entrega el `subtotal` del item; debe usarse su importe al integrar. |
| `product.stock` | Ausente; hoy limita QuantitySelector. No se puede asumir stock igual a quantity ni inventar un máximo. |
| `product.type`, `product.collectionName`, `product.sellerName` | Ausentes; forman el texto sobre el nombre del producto. |
| ProductThumbnail: `product.imageUrls`, `product.name` | Adaptables desde `productImages`, `productName`. |
| ProductThumbnail: `product.collectionId` | Ausente; decide el color de fondo. |

Fuera del componente, App usa `product.id` para agrupar/agregar (adaptable desde `productId`) y `product.stock` para cantidades. La suma mock de promociones usa `product.type`, que tampoco viene en el carrito. El `subtotal` de CartResponse puede alimentar el resumen; no incluye por sí solo toda la información de descuentos simulada hoy.

Alternativas pendientes, sin implementar:

1. **Enriquecer CartItemResponse** con la información que se acuerde mantener en pantalla, sin devolver una entidad completa por comodidad.
2. **Simplificar la UI** a nombre, imagen, precio y cantidad, con una estrategia acordada para validar cambios de cantidad sin conocer stock.
3. **Obtener datos complementarios** de productos mediante una estrategia acordada, considerando peticiones adicionales, errores parciales y datos desactualizados. No se presupone un endpoint nuevo.

**Recomendación para este proyecto universitario:** enriquecer el DTO con los pocos datos necesarios para conservar la UI. Mantiene una consulta sencilla y evita coordinar varias fuentes por renglón. El backend debe seguir validando stock y precios; mostrar stock no reemplaza esa validación. Es una propuesta para acordar con backend, no un contrato implementado.

### 2. Pedidos: OrderResponse y OrderItemResponse

El backend entrega `OrderResponse { id, orderDate, state, paymentMethod, subtotal, totalDiscount, total, items, promotions }` y `OrderItemResponse { id, productId, productName, sellerId, sellerEmail, quantity, price }`.

| Consumidor | Campos que utiliza actualmente |
| --- | --- |
| `Orders.jsx` | `order.id`, `date`, `status`, `paymentMethod`, `total`, `discounts`, `items`; en cada item, `quantity`, `product.name`, `product.price`; pasa el primer `item.product` a onReview. Construye subtotal sumando cantidad × precio. |
| `PurchaseItems.jsx` | `item.id`, `quantity`, `product.name`, `product.price`, `product.sellerName`; pasa product a ProductThumbnail, que usa `imageUrls`, `name`, `collectionId`. La variante confirmation no muestra miniatura ni vendedor. |
| `PurchaseSummary.jsx` | `summary.subtotal`, `summary.discounts[].label`, `summary.discounts[].amount`, `summary.total`; `summary.savings` solo en checkout; `paymentMethod` en confirmation. |
| `OrderConfirmation.jsx` | `order.id`, `date`, `items`, `summary`, `paymentMethod`. Su badge «Pendiente» está fija para el flujo mock; no lee el estado recibido. |

**Adaptación posible con datos existentes, pendiente de integración:**

- `state` puede reemplazar/adaptarse a `status`; los valores internos ya son compatibles. `orderDate` requiere formateo para reemplazar el texto `date`, acordando cómo interpretar su fecha/zona horaria.
- `id`, `paymentMethod`, `total`, `items`, `item.id` y `item.quantity` ya tienen equivalentes.
- `productId` → `product.id`, `productName` → `product.name`, `price` → `product.price` son cambios de estructura. No hace falta inventar información para estas equivalencias.
- `subtotal` y `totalDiscount` permiten construir subtotal y ahorro del resumen usando los importes del backend. No debe recalcularse un pedido real con precios actuales del catálogo: `OrderItemResponse.price` es el precio del pedido.
- `summary` es un agrupamiento de presentación que el backend no devuelve; podría componerse con sus totales. La confirmación deberá mostrar el `state` recibido cuando se integre.

**Información o decisiones adicionales:**

- OrderItemResponse no trae `sellerName`, imágenes ni `collectionId`. `sellerEmail` no es el nombre del vendedor: hay que decidir mostrar el email, enriquecer el contrato o simplificar la fila. Obtener datos actuales por `productId` tampoco garantiza conservar la presentación histórica del pedido.
- `promotions` no equivale automáticamente a `discounts`. No se suministró la estructura de cada promoción; no se puede asumir que tenga `label` y `amount`. Hay que confirmar ese contrato o mostrar únicamente `totalDiscount`, simplificando el desglose.
- El botón de reseña hoy apunta solo al primer producto del pedido. Al integrar debe decidirse cómo elegir el producto comprado a reseñar y usar su `productId`.

No se implementó un mapper parcial que esconda estos faltantes. Los nombres `status`, `date`, `discounts` y el producto anidado permanecen expresamente en el modelo provisional. `calculateMockSummary` conserva reglas de demostración; el backend será la fuente de verdad para importes y promociones reales.

### 3. Mis publicaciones: listado propio

**Frontend:** espera productos completos del vendedor actual para nombre, precio, stock, estado, colección y miniatura; el fixture contiene los IDs 13, 1, 14, 15.

**Backend:** existe búsqueda por `sellerId` en repository/service, pero no hay un endpoint específico del usuario autenticado expuesto para esta pantalla.

**Decisión:** acordar endpoint, autorización basada en el usuario autenticado, campos de respuesta y si necesita filtros/paginación. **Posible diseño futuro, pendiente de aprobación:** `GET /products/me`. No existe una llamada implementada ni se presenta esta ruta como disponible.

### 4. Mis publicaciones: ACTIVO / INACTIVO

**Frontend:** permite pausar/reactivar en el estado local de App; el botón de agotados ya estaba deshabilitado. Las ediciones locales no son una sincronización persistente del catálogo o de los pedidos.

**Backend:** no expone actualmente un mecanismo específico para esa transición.

**Decisión:** definir transiciones válidas, validación de propietario/stock, contenido del request, respuesta actualizada y manejo de errores. **Un PATCH del estado del producto es solamente una propuesta pendiente de aprobación**, sin ruta ni DTO inventados aquí. Se conserva la demostración en memoria y no se agrega una llamada ficticia.

### 5. Eliminar cuenta

**Frontend:** Profile espera `onDeactivate(user)`; App no lo proporciona. El control queda deshabilitado.

**Backend:** `DELETE /users/me` ya existe. No se necesita inventar un endpoint ni enviar el objeto UserResponse como request.

**Decisión de integración:** conectar el handler y manejar confirmación, errores y actualización de la sesión/vistas después de una respuesta real. El texto actual sobre desactivación/publicaciones deberá validarse contra la semántica efectiva de la operación. No se simula eliminación ni se usan alert/confirm.

### 6. Reseñas

**Frontend:** Orders espera `onReview(product)` sin implementación en App; el detalle muestra reseñas mock del producto abierto.

**Backend:** existen `GET /products/{productId}/reviews` y `POST /products/{productId}/reviews`. La creación recibe `{ rating, comment }`: rating de 1 a 5 y comentario obligatorio de hasta 1000 caracteres.

**Decisión de integración:** diseñar la selección de producto y formulario, conectar lectura/escritura, validar esos límites y manejar errores/actualización de la lista. Debe confirmarse la respuesta de lectura y las reglas de elegibilidad antes de depender de campos/reglas del mock. No se implementa ninguna request en esta etapa.

## Verificación realizada

- `npm ci --no-audit --no-fund`: instaló las dependencias ya declaradas; `package.json` y `package-lock.json` no cambiaron.
- `npm run lint`: **OK**, sin errores, tanto en la base como después de las correcciones.
- `npm run build`: **OK**, tanto en la base como después de las correcciones.
- Búsqueda en fuentes: sin scroll manual, enum antiguo, `user.name`, `memberSince` ni lista fija de relacionados. Los labels «Pagado» son válidos.
- Comprobaciones puntuales con Node, Vite y React ya instalados: 17 IDs únicos; referencias canónicas en todas las listas; identidades 1–12 y vendedores de Wembanyama/Spider-Man conservados; relacionados de las cuatro colecciones, sin autorreferencias y con máximo cuatro; enums de pago/estado y descuento de transferencia correctos.
- Renderizado a HTML de Home, catálogo por colección, detalles de todos los productos, Checkout, Orders, Profile y confirmación con los cuatro pagos. Se comprobó que los dos controles estén deshabilitados sin handler y habilitados con él; Profile renderiza sin antigüedad; las reseñas de LeBron no aparecen en otros productos.
- Se revisó el recorrido Home → Catalog → ProductDetail por callbacks y datos. Estas verificaciones no sustituyen una prueba visual/interactiva en navegador; no se afirma haber realizado esa prueba.

## Checklist manual corto

- [ ] Desde Home abrir Wembanyama y Spider-Man: IDs/vendedores coherentes con publicaciones/catálogo.
- [ ] Navegar al catálogo y abrir productos de NBA, Marvel, Cars y My Little Pony: «Más de…» contiene solo su colección, excluye el actual y tiene hasta cuatro tarjetas.
- [ ] Agregar el mismo producto desde dos vistas: se conserva un solo renglón de carrito, respetando el stock mock.
- [ ] Recorrer Checkout con los cuatro pagos: textos amigables, descuento por transferencia y etiqueta correcta en confirmación/Mis pedidos.
- [ ] Abrir el pedido pagado y filtrar «En curso»: etiqueta «Pagado», estilo y progreso correctos.
- [ ] Guardar el nombre en Mi perfil: se actualiza en memoria sin depender de `name` ni de antigüedad.
- [ ] Verificar que «Eliminar cuenta» y «Dejar reseña» no aceptan interacción mientras no haya handlers.
- [ ] Crear una publicación de prueba: su ID no colisiona con los productos 1–17. Recargar reinicia las demostraciones en memoria.
