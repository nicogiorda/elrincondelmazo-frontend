# Integración final: autenticación por email, promociones, catálogo y compras

Fecha: 19/10/2026. Este documento reemplaza, para estas ramas de integración, el alcance anterior que incorporaba un username independiente.

## Ramas y procedencia

| Repositorio | Base origin/main verificada | Rama integrada de la compañera | Rama final para revisión |
| --- | --- | --- | --- |
| nicogiorda/elrincondelmazo | 14b1f24 | audit/promotion-collections, 60be620 | codex/integracion-final-sin-username |
| nicogiorda/elrincondelmazo-frontend | 50eb70a | audit/promotion-collections, c962e3c | codex/integracion-final-sin-username |

Se crearon ramas nuevas desde origin/main, se incorporó primero la rama de promociones/colecciones por fast-forward y después se trasladaron selectivamente las mejoras de compras y catálogo. No se hizo merge completo de codex/auditoria-usuarios-compras ni se incorporaron los commits de autenticación 22d831a y 62bcd5e. Las ramas de auditoría anteriores permanecen como historial. No se modifica main.

## 1. Autenticación original conservada

- Registro: POST /api/v1/auth/register, body `{firstname, lastname, email, password}`, respuesta **200** con `{access_token}`, igual que main.
- Login: POST /api/v1/auth/authenticate, body `{email, password}`, respuesta y manejo del backend originales.
- User, UserResponse, DTOs/controllers de autenticación, AuthenticationService, ApplicationConfig, JwtAuthenticationFilter, JwtService y UsersController coinciden con origin/main. Se comprobó comparando el contenido de esos archivos.
- User.getUsername() sigue devolviendo email, como exige la interfaz UserDetails. Ese método técnico no representa un atributo nuevo de usuario.
- No hay campo username nuevo, findByUsername, restricción de username ni migración de usuarios. Los fixtures usan la entidad original. No se trasladaron AuthenticationIntegrationTests ni UsernameMigrationIntegrationTests de la auditoría anterior.
- AccountAccess y Profile coinciden con main. Login y Register conservan el contrato por email y agregan únicamente protección contra doble envío, validación del token recibido y cancelación cuando se abandona la pantalla.
- App conserva la cancelación y control de versión de sesión; Orders cancela su GET al desmontar. Profile recibe user por props, sin consultas propias. Login/registro/restauración consultan /users/me una vez cuando corresponde.
- Única extensión de UserRepository: **lockById() con PESSIMISTIC_WRITE**, necesaria para serializar las operaciones del carrito y checkout. No altera la entidad ni el esquema de usuarios.

## 2. Promociones y colecciones integradas

Se conserva la implementación de audit/promotion-collections:

- GET /promotions/public anónimo: solo promociones activas y vigentes.
- Lectura y mutaciones administrativas protegidas para ADMIN.
- Home muestra datos reales, condiciones e importes de promociones, con carga, error, vacío y reintento.
- El listado administrativo se solicita cuando corresponde, reutiliza la solicitud en curso y se actualiza con las respuestas POST/PUT/PATCH.
- Se invalida la lectura pública después de cambios administrativos para que Home no reutilice promociones anteriores al guardado.
- Las colecciones provienen del backend y se reutilizan desde App.
- PromotionServiceImpl, PromotionService, PromotionController, PromotionRepository y SecurityConfig coinciden con la rama de la compañera. **applyPromotions no fue reescrito**. Los servicios/controllers de colecciones también se conservaron.

### Compatibilidad del editor con el catálogo paginado

La rama de la compañera esperaba una colección global de productos en App. Se sustituyó esa dependencia por un selector bajo demanda dentro de PromotionEditor:

1. Solo solicita productos al elegir la condición «Producto puntual».
2. Usa loadProductPage de App, la misma caché temporal y el contrato paginado del catálogo; páginas de 9 y búsqueda en el backend con debounce de 250 ms.
3. Conserva el producto seleccionado al cambiar página o búsqueda. No inventa IDs para completar opciones.
4. Al editar una promoción cuyo producto no está en la página visible, consulta ese producto por su ID real; la consulta no se duplica bajo StrictMode.
5. Presenta carga/error/reintento y deshabilita guardar mientras no se pueda validar la selección. Una respuesta anterior no reemplaza la página elegida después.
6. No restaura GET /products?size=100 al iniciar App ni al abrir el editor. Los tests de rendimiento pueden solicitar size=100 expresamente para comparar tamaños; eso no es una carga de la aplicación.

## 3. Catálogo, carrito y checkout preservados

- Caché en App de hasta 20 páginas por query, con vigencia de 60 segundos y reutilización de solicitudes pendientes.
- Home solicita cuatro productos recientes; catálogo mantiene filtros, búsqueda y paginación del backend.
- Las respuestas nuevas actualizan productos por ID; secuencias/versiones y limpieza de efectos impiden aplicar respuestas anteriores sobre navegación/mutaciones posteriores.
- Compra y creación/edición/pausa/reactivación/baja de publicaciones invalidan páginas, productos compartidos y metadata del carrito. No se calcula stock futuro restando sobre copias antiguas.
- Relacionados por collectionId, excluyendo el producto actual y hasta cuatro resultados.
- Carrito usa respuestas reales del backend; no dispara otro GET para repetir el resultado de una mutación.
- Eliminados productMocks.js, productCardMocks.js y purchaseMocks.js tras verificar consumidores; accountMocks conserva labels/colores. Configuración visual y funciones de presentación usadas por promociones se mantienen.

### Contratos de compras

Nuevo **POST /orders/preview**, autenticado:

```json
{"paymentMethod":"TRANSFERENCIA"}
```

Respuesta ilustrativa (los importes reales los calcula Spring):

```json
{
  "subtotal":100,
  "totalDiscount":20,
  "total":80,
  "promotions":[{"promotionId":43,"promotionName":"Oferta","discountApplied":20}]
}
```

Lee el carrito del principal, valida productos/estado/stock/vendedor y usa applyPromotions. No crea órdenes, descuenta stock ni vacía el carrito. No constituye reserva de stock.

POST /orders conserva 201 y OrderResponse, y requiere:

```json
{
  "paymentMethod":"TRANSFERENCIA",
  "expectedTotal":80,
  "requestKey":"2824f705-7711-46ea-920b-187018e59d62"
}
```

El backend recalcula el total; expectedTotal solo expresa el importe aceptado. Si cambió, devuelve 409 antes de persistir y React cotiza otra vez para pedir una nueva confirmación. Un consumidor antiguo que no envíe los campos nuevos recibirá 400, por lo que ambos repositorios deben desplegarse coordinadamente.

La misma clave UUID para el mismo comprador, método e importe devuelve la orden ya persistida. Se comprobó tanto en la suite de backend como repitiendo el POST HTTP real después de vaciar el carrito. No crea una segunda orden ni vuelve a descontar stock.

### Stock y transacciones

Se bloquea primero el comprador mediante UserRepository.lockById() y luego los productos por ID ascendente. Se refresca Product con PESSIMISTIC_WRITE para validar el stock después de esperar otros compradores. CartService es transaccional; las escrituras de publicaciones también bloquean Product. Checkout mantiene precios históricos, validaciones de compra propia/productos inactivos, stock y rollback, y vacía el carrito al terminar con éxito.

## 4. Conflictos e incompatibilidades resueltos

No hubo conflictos textuales pendientes de Git; sí se resolvieron dependencias funcionales que una combinación automática no detectaba:

| Incompatibilidad | Resolución |
| --- | --- |
| lockById estaba en el commit que agregaba username | Se trasladó solo el método sobre el User original |
| Tests de compras/rendimiento construían User con username | Se eliminaron esas llamadas; fixtures originales de catálogo/publicaciones permanecen iguales a main |
| Tests existentes enviaban solo paymentMethod | Se agregaron expectedTotal y requestKey sin quitar aserciones de negocio/promociones |
| Rutas de PromotionEditor referenciaban publicProducts global | Se conectaron a loadProductPage y al selector bajo demanda |
| Tests de promociones esperaban GET global size=100 y páginas incompletas | Se adaptaron al contrato paginado real, exigiendo cero cargas globales y conservando escenarios anteriores |
| Tests de compras iniciaban sesión por username | Se adaptaron a email y al registro original; se mantienen cancelación, restauración, errores y reintentos |
| Repetición de efectos en StrictMode | El selector difiere la consulta de selección hasta comprobar que su efecto siga activo; prueba de un solo GET por ID |

## 5. Verificación ejecutada

Todas las escrituras de QA usaron **PostgreSQL local en 127.0.0.1:55432, base mazo_integration**, creada para esta integración. No se usó Supabase para escribir datos ni ejecutar migraciones. Esa base tiene **cero columnas username en users**, comprobado por information_schema.

| Verificación | Resultado |
| --- | --- |
| Bootstrap de esquema local con ElrincondelmazoApplicationTests | PASS |
| Suite completa backend con perfil audit | **113 tests, 0 fallos, 0 errores, 0 omitidos** |
| mvnw.cmd -B -ntp package -DskipTests | BUILD SUCCESS; tests ejecutados antes por separado |
| npm run lint | PASS, sin errores |
| npm run build | PASS, 79 módulos |
| tests/frontend-audit.mjs | PASS, 16 escenarios controlados |
| tests/promotions.browser.cjs | PASS, 12 escenarios, incluidos los anteriores y selector entre páginas/reintento |
| tests/frontend-http-audit.mjs | PASS, HTTP real React → Spring → PostgreSQL sin interceptar la API |
| tests/promotions.live.cjs | PASS, Home real, restricción de administración, CORS y visualización móvil |
| 002_order_request_key.sql ejecutado dos veces en QA local | PASS; repetible sobre el esquema existente |

La suite backend incluye registro original, BCrypt/rol USUARIO, email duplicado, login, JWT con subject email emitido previamente, token inválido, catálogo, administración/promociones públicas, descuentos, compra propia/stock, rollback, idempotencia y dos compradores intentando adquirir la última unidad.

El recorrido HTTP real creó una cuenta administrativa de fixture únicamente en QA, registró un vendedor, publicó 13 productos y entró al editor desde la UI. Seleccionó un producto de otra página conservando la selección, creó una promoción al 10%, la editó al 20% y la verificó en Home. Después registró al comprador, restauró su JWT tras recargar, cotizó y compró por **80 sobre subtotal 100**, comprobó descuento 20, stock final 1, carrito vacío, precio histórico 100 e historial persistido. Repetir el POST de compra devolvió el mismo ID de orden. Finalmente verificó login por email y publicaciones del vendedor. Sin errores de página.

El fixture ADMIN se obtiene con una actualización directa del rol de una única cuenta de prueba en mazo_integration. El registro público sigue sin permitir elegir roles. Los scripts se niegan a correr el flujo de escritura real sin AUDIT_LOCAL_DB=1 y requieren la ruta de psql local.

### Reproducción

1. PostgreSQL local descartable en 55432, base mazo_integration, usuario postgres; configuración src/test/resources/application-audit.properties.
2. Con Java 21: `mvnw.cmd -B -ntp test '-Dspring.profiles.active=audit' '-Dtest=ElrincondelmazoApplicationTests'` para inicializar esquema; luego `mvnw.cmd -B -ntp test '-Dspring.profiles.active=audit'`.
3. Empaquetar y ejecutar temporalmente el backend con `--spring.config.additional-location=file:src/test/resources/application-audit.properties --server.address=127.0.0.1 --server.port=8080`.
4. Vite en localhost:5173. Ejecutar lint/build y los cuatro scripts de tests mencionados. Playwright se proporciona externamente mediante PLAYWRIGHT_MODULE; no se agregó una dependencia al repositorio.
5. Para frontend-http-audit.mjs: AUDIT_LOCAL_DB=1 y AUDIT_PSQL apuntando al ejecutable psql de QA. Este script crea fixtures; los otros scripts controlados interceptan las respuestas, y promotions.live.cjs solo lee HTTP real.
6. Detener los tres procesos temporales al terminar.

## 6. Migración pendiente exacta

**Solo db/migrations/002_order_request_key.sql.** Agrega orders.request_key UUID nullable y unicidad por (user_id, request_key). Las órdenes históricas pueden seguir con null. No altera users.

**001_username.sql queda excluida y no debe ejecutarse para esta integración.** No hay migración necesaria de usuarios. Antes del despliegue, se debe autorizar y ejecutar 002 en la base compartida con el procedimiento acordado de respaldo/mantenimiento; esta tarea no la ejecutó allí. No depender únicamente de ddl-auto=update para el despliegue.

## 7. Riesgos y coordinación pendientes

- La clave de reintento de React vive en memoria de Checkout: sobrevive a un error/reintento en la misma pantalla, pero no a recarga/desmontaje. Ante respuesta perdida seguida de recarga, consultar Mis pedidos antes de comprar otra vez. El backend conserva idempotencia para cualquier replay con la misma clave.
- expectedTotal protege el importe aceptado; no es una reserva ni una firma del contenido del carrito. El backend revalida al confirmar.
- La caché de 60 s puede mostrar información anterior dentro de ese lapso; nunca autoriza stock ni precio definitivo.
- Home puede mostrar menos de cuatro productos disponibles si los más recientes incluyen agotados. No se inventó un filtro status.
- Los tiempos medidos son locales. La última repetición HTTP del catálogo de 9 productos tuvo TTFB de 8,13–8,98 ms y click→tarjetas de 399,22 ms, incluyendo debounce/búsqueda. No explican los cuatro segundos del video ni permiten atribuirlos a Supabase o Hibernate. Sigue pendiente medir el entorno remoto.
- La confirmación visual sigue en memoria; el historial sí está persistido. No hay pasarela de pago y la orden sigue PENDIENTE.
- Los informes de la rama de auditoría anterior que recomendaban username ya no describen estas ramas. Este documento y el contrato original de main son la referencia para autenticación.
- Integrar ambos repositorios juntos y coordinar 002 y el nuevo body de checkout con la compañera. No hace falta modificar su motor de descuentos.

## 8. Archivos incluidos frente a origin/main

M = modificado, A = agregado, D = eliminado. Incluye los archivos de promociones/colecciones incorporados desde la rama de la compañera y las adaptaciones posteriores.

### elrincondelmazo

```text
A	db/migrations/002_order_request_key.sql
A	docs/promociones-colecciones.md
M	src/main/java/com/uade/elrincondelmazo/controllers/OrderController.java
M	src/main/java/com/uade/elrincondelmazo/controllers/PromotionController.java
M	src/main/java/com/uade/elrincondelmazo/controllers/config/SecurityConfig.java
M	src/main/java/com/uade/elrincondelmazo/entity/Order.java
A	src/main/java/com/uade/elrincondelmazo/entity/dto/CheckoutPreviewResponse.java
M	src/main/java/com/uade/elrincondelmazo/entity/dto/CheckoutRequest.java
M	src/main/java/com/uade/elrincondelmazo/repository/OrderRepository.java
M	src/main/java/com/uade/elrincondelmazo/repository/ProductRepository.java
M	src/main/java/com/uade/elrincondelmazo/repository/PromotionRepository.java
M	src/main/java/com/uade/elrincondelmazo/repository/UserRepository.java
M	src/main/java/com/uade/elrincondelmazo/service/OrderService.java
M	src/main/java/com/uade/elrincondelmazo/service/PromotionService.java
M	src/main/java/com/uade/elrincondelmazo/service/impl/CartServiceImpl.java
M	src/main/java/com/uade/elrincondelmazo/service/impl/OrderServiceImpl.java
M	src/main/java/com/uade/elrincondelmazo/service/impl/ProductServiceImpl.java
M	src/main/java/com/uade/elrincondelmazo/service/impl/PromotionServiceImpl.java
A	src/test/java/com/uade/elrincondelmazo/CheckoutSafetyIntegrationTests.java
A	src/test/java/com/uade/elrincondelmazo/PromotionAdministrationIntegrationTests.java
M	src/test/java/com/uade/elrincondelmazo/PromotionCheckoutIntegrationTests.java
A	src/test/java/com/uade/elrincondelmazo/PromotionPublicTests.java
M	src/test/java/com/uade/elrincondelmazo/SellerDeactivationIntegrationTests.java
A	src/test/java/com/uade/elrincondelmazo/CatalogPerformanceIntegrationTests.java
A	src/test/java/com/uade/elrincondelmazo/EmailAuthenticationIntegrationTests.java
A	src/test/resources/application-audit.properties
A	docs/integracion-final.md
```

### rincon del mazo-frontend

```text
A	docs/promociones-colecciones.md
M	src/App.jsx
M	src/components/ManagedPromotionCard.jsx
M	src/components/ProductPreview.jsx
M	src/components/PromotionCard.jsx
M	src/data/accountMocks.js
M	src/data/homeMocks.js
D	src/data/productCardMocks.js
D	src/data/productMocks.js
M	src/data/promotionMocks.js
D	src/data/purchaseMocks.js
A	src/hooks/usePublicPromotions.js
A	src/services/publicPromotions.js
M	src/views/Cart.jsx
M	src/views/Catalog.jsx
M	src/views/Checkout.jsx
M	src/views/Home.jsx
M	src/views/Login.jsx
M	src/views/Orders.jsx
M	src/views/PromotionEditor.jsx
M	src/views/Promotions.jsx
M	src/views/Publications.jsx
M	src/views/Register.jsx
A	tests/frontend-audit.mjs
A	tests/frontend-http-audit.mjs
A	tests/promotions.browser.cjs
A	tests/promotions.live.cjs

A	docs/integracion-final.md
```


## Cierre operativo

Spring, Vite y PostgreSQL de QA fueron detenidos al finalizar. Se verificó que no hay listeners en 8080, 5173, 5174, 4173 ni 55432. Las ramas de integración se entregan para revisión previa a PR/merge; no se mergeó ni se hizo push directo a main.
