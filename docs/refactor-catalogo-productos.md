# Bloque 4: catálogo, productos, filtros y caché

Fecha de verificación: 22 de octubre de 2026.

## Alcance y preparación

Se extrajo el catálogo público de App. La base es `2b25bf5dea40007a249a58fa7007138cee2ea3e2`, con los PR #18, #19 y #20 fusionados en main. Se verificaron los módulos de sesión, servicios HTTP y carrito anteriores.

El trabajo se hizo en el worktree aislado `refactor-04-catalogo-productos`, rama `refactor/04-catalogo-productos`, inicialmente limpio. El checkout original tenía cambios locales en App y no se modificó. No se modificaron backend, base de datos, estilos, contratos, dependencias ni operaciones POST/PUT/DELETE del carrito.

## Mapa de responsabilidades y dependencias

| Módulo | Responsabilidad | Dependencias |
| --- | --- | --- |
| App | Composición, rutas y coordinación entre dominios | Una instancia de useSession, useCart y useCatalog |
| useCatalog | Componer catálogo, Home, colecciones, filtros y detalle | Hooks específicos, sin HTTP directo |
| useProductCache | Conectar la caché con React y su ciclo de vida | productCache, useSyncExternalStore |
| productCache | Entidades, páginas, frescura, deduplicación, secuencias e invalidación | productsApi; no importa React |
| useProductDetail | URL directa, disponibilidad, errores, reintento y relacionados | Interfaz de caché compartida |
| useCatalogFilters | Filtros por entrada del historial | location; sin HTTP ni caché de páginas |
| useCollections | Carga y errores de colecciones | productsApi |
| productsApi | GET de productos, detalle y colecciones; validación y errores | httpClient, productId |
| useCartMetadata | Disponibilidad y solicitudes asociadas al carrito y la sesión | loadProduct y suscripción a invalidaciones |
| Catalog, Home, ProductDetail | Presentación e interacción | Props procedentes de App |
| PromotionEditor | Formulario y selección de condiciones | Páginas compartidas y loadProduct |

Una sola instancia de useCatalog en App sirve a todas las pantallas. No se añadió Context: las conexiones por props ya comparten la instancia sin reestructurar rutas. useCatalog no importa useCart ni viceversa. La prueba de arquitectura recorre las importaciones de src y comprueba ausencia de ciclos.

Los cinco hooks nuevos separan responsabilidades concretas. El motor de caché es una instancia local, independiente de React y verificable con reloj y API inyectados. No hay token mutable ni caché global entre instancias.

## Qué salió de App

- shop y setShop; mapas productPages/productFreshness; secuencias y versiones de solicitudes.
- Estados de carga/error de productos y colecciones; carga y opciones de colecciones.
- loadProductPage y la implementación interna de refreshPendingCatalog.
- Temporizador de frescura, invalidación y protección frente a respuestas anteriores.
- homeProductIds, consulta de Home y cálculo de productos recientes.
- detailRequest/detailAttempt, detección de producto conocido, detalle por URL, reintentos y relacionados.
- catalogFilters, catalogFiltersByLocation, catalogLocationKey y restauración del historial.
- Implementaciones de incorporación de productos desde tarjetas, metadatos y publicaciones.

App pasa de **1.100 a 874 líneas**: 226 líneas menos (20,5 %), contando líneas físicas incluidas las vacías.

Permanecen temporalmente navegación, reseñas, perfil, pedidos/checkout, publicaciones privadas y promociones administrativas. App llama a operaciones públicas del catálogo después de sus cambios, pero no modifica mapas internos. La constante de vigencia que aún utiliza la lista privada de publicaciones se llama ahora publicationsCacheLifetime; su valor no cambió.

## Interfaz pública

```js
const catalog = useCatalog({ location, productId, isProductRoute })
```

| Grupo | Campos y operaciones |
| --- | --- |
| Productos y Home | products, recentProducts, productsLoading, productsError |
| Consultas | loadProductPage(query), loadProduct(id, options), cacheVersion |
| Colecciones | collections, collectionsLoading, collectionsError, catalogCollections |
| Filtros | catalogFilters, changeCatalogFilters(filters), clearCatalogFilters() |
| Detalle | selectedProduct, knownProduct, needsDetail, currentDetailRequest, relatedProducts, retryDetail() |
| Coordinación | refreshPendingCatalog(), rememberProduct(product), upsertProduct(product), removeProduct(id), syncPublicProducts(sellerId, items), subscribeInvalidation(listener) |

loadProduct admite signal, isCurrent, onlyMissing, context y revalidate. Son opciones de coordinación; los consumidores no reciben los mapas de páginas, frescura o solicitudes.

## Caché y consultas

- TTL de **60.000 ms**, capacidad de **20 consultas paginadas** y expulsión por orden de inserción, como antes.
- Las claves conservan el query string exacto. Las páginas guardan IDs y metadatos de paginación; su contenido se materializa desde una única colección de entidades. Home y relacionados también conservan IDs, no una segunda colección independiente de productos.
- Una página vigente y con productos frescos se devuelve localmente. Una petición idéntica pendiente se comparte. Los errores eliminan esa entrada para permitir reintentar.
- La vigencia se comprueba al leer. Un temporizador de 60 segundos retira entidades vencidas y notifica a las vistas y metadatos; no se convirtió en polling independiente por tarjeta.
- El detalle fresco evita otro GET. Los detalles pendientes se comparten entre pantalla y metadatos. Cada consumidor cancela su participación; la red se aborta al no quedar consumidores. Un transporte que ignore AbortSignal tampoco puede publicar resultados de una generación anterior.
- Las secuencias por producto impiden que una página vieja reemplace un detalle o publicación más reciente. Se mantiene una marca para productos retirados/inactivos para impedir su restauración por una respuesta anterior.
- La caché contiene información de productos públicos. La sincronización de la lista privada de publicaciones incorpora únicamente ACTIVO/AGOTADO.
- La selección guardada del editor de promociones usa revalidate: true, conservando el GET de verificación que ya realizaba al abrirse. Comparte una solicitud pendiente si la hay y actualiza la misma entidad.

Consultas conservadas: Home `page=0&size=4`, catálogo `size=9`, relacionados `page=0&size=5&collectionId=...`. Catalog mantiene URLSearchParams, search/type/collectionId/minPrice/maxPrice/page/size, paginación del servidor, debounce de 250 ms y retorno a página 0 al cambiar filtros. No se reemplazó por filtrado global en memoria.

El detalle valida el ID, admite entrada directa y recarga, diferencia errores recuperables de inexistencia/inactividad y conserva reintento. Las colecciones mantienen su mensaje de recargar la página ante error.

## Invalidaciones e integración

- **Publicaciones:** crear, editar, pausar/reanudar o eliminar conserva el flujo anterior en App. Tras éxito, se invalida el catálogo y se incorpora o retira la entidad pública mediante la interfaz. La lista privada sigue aislada por sesión en App.
- **Checkout:** tras confirmar exitosamente una orden se invalida el catálogo y luego se completa el carrito. Así no se reutiliza stock previo. POST /orders, idempotencia, precios, promociones y bloqueos no se trasladaron al catálogo ni se modificaron.
- **Carrito:** useCart queda intacto. useCartMetadata deja de hacer fetch y usa loadProduct, que delega en productsApi. Conserva controlador por solicitud, sessionVersion, comprobación de vigencia, mensajes y reintentos. La suscripción de sesión cancela sus consumidores al cambiar de usuario; la de catálogo limpia solicitudes y disponibilidad al invalidar o vencer productos.
- **Promociones:** únicamente se adaptó la lectura pública del producto seleccionado al nuevo servicio/caché. Formularios, escritura, cálculo y administración permanecen iguales.
- **StrictMode:** las cargas iniciales usan coordinación y comprobaciones de montaje. Las páginas pendientes se reutilizan. El desmontaje real invalida la instancia; el ciclo de comprobación de StrictMode no destruye la caché compartida.

## Archivos

Creados:

- src/services/productsApi.js
- src/hooks/useCatalog.js
- src/hooks/useProductCache.js
- src/hooks/useProductDetail.js
- src/hooks/useCatalogFilters.js
- src/hooks/useCollections.js
- src/utils/productCache.js
- src/utils/productId.js
- tests/products-api.test.mjs
- tests/product-cache.test.mjs
- tests/catalog.browser.mjs
- docs/refactor-catalogo-productos.md

Modificados:

- src/App.jsx
- src/hooks/useCartMetadata.js
- src/views/PromotionEditor.jsx
- tests/cart-architecture.test.mjs

No se modificaron las expectativas de las suites anteriores para hacerlas pasar. La prueba de arquitectura se amplió a catálogo y delegación HTTP.

## Resultados ejecutados

Todas las verificaciones siguientes terminaron con código 0 sobre la implementación final:

| Verificación | Resultado |
| --- | --- |
| npm run lint | PASS |
| npm run build | PASS; 93 módulos |
| auth-api.test.mjs | 28 pruebas PASS |
| cart-api.test.mjs | 13 pruebas PASS |
| cart-architecture.test.mjs | 4 pruebas PASS |
| products-api.test.mjs | 19 pruebas PASS |
| product-cache.test.mjs | 17 pruebas PASS |
| Total Node | **81 pruebas PASS**, 0 fallos, 0 omitidas |
| catalog.browser.mjs | **13 escenarios PASS** |
| cart-api.browser.mjs | **22 escenarios PASS** |
| auth-session.browser.mjs | **27 escenarios PASS** |
| orders-cache.browser.mjs | **6 grupos PASS** |
| promotions.browser.cjs | **12 escenarios PASS** |
| frontend-audit.mjs | **18 escenarios PASS**, 37 solicitudes |
| git diff --check | PASS |

Las pruebas de servicio utilizan fetch simulado. Las de caché inyectan API y reloj. Las de navegador ejecutan la aplicación React real bajo StrictMode en Edge, con rutas HTTP simuladas; catálogo también usa el reloj controlado de Playwright. **Estos resultados no son integración contra Spring Boot/PostgreSQL.**

Durante el desarrollo las pruebas detectaron una liberación tardía de solicitudes de detalle ya resueltas y la omisión del GET de selección del editor. Se corrigió la implementación; se volvieron a ejecutar las suites completas correspondientes con sus expectativas originales.

### Cobertura funcional del bloque

| Requisitos | Evidencia |
| --- | --- |
| 1–6: Home, paginación, búsqueda, filtros, debounce, historial | catalog.browser |
| 7–10: reutilización, TTL, capacidad 20, deduplicación | product-cache, catalog.browser |
| 11–12: HTTP y reintentos | products-api, product-cache, catalog.browser |
| 13–16: URL directa, detalle conocido, inexistente/inactivo, relacionados | catalog.browser |
| 17–18: metadatos y ausencia de GET duplicados | cart-api.browser, product-cache, catalog.browser |
| 19: invalidación después de compra | frontend-audit, cart-api.browser |
| 20: actualización/eliminación de publicaciones | frontend-audit, catalog.browser, product-cache |
| 21: editor de promociones | promotions.browser |
| 22: respuestas antiguas y cancelación | product-cache, catalog.browser, cart-api.browser |
| 23: StrictMode | catalog.browser, auth-session.browser, frontend-audit |
| 24: ausencia de ciclos y estado único | cart-architecture |
| 25: sesiones, carrito, checkout y pedidos | auth-session.browser, cart-api.browser, orders-cache.browser, frontend-audit |

### Reproducción

```powershell
npm run lint
npm run build
node --test tests/auth-api.test.mjs tests/cart-api.test.mjs tests/cart-architecture.test.mjs tests/products-api.test.mjs tests/product-cache.test.mjs
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
# En otra terminal, con Playwright disponible y Microsoft Edge instalado:
$env:BASE_URL = 'http://127.0.0.1:5173'
# PLAYWRIGHT_MODULE puede indicar una instalación externa existente.
node tests/catalog.browser.mjs
node tests/cart-api.browser.mjs
node tests/auth-session.browser.mjs
node tests/orders-cache.browser.mjs
node tests/promotions.browser.cjs
node tests/frontend-audit.mjs
git diff --check
```

Se utilizó Playwright del runtime existente de Codex; no se añadió al package.json ni se cambió el lockfile.

## Limitaciones y verificaciones pendientes

- El GET de comprobación a http://localhost:8080/collections falló con curl (7): conexión rechazada. No había Spring Boot disponible. Por ello **no se ejecutó promotions.live.cjs y no se declara PASS**.
- **No se ejecutó frontend-http-audit.mjs**: exige AUDIT_LOCAL_DB=1 y AUDIT_PSQL para preparar fixtures en una base descartable (mazo_integration, puerto 55432). No se verificó una base aislada disponible y no se ejecutaron escrituras contra una base compartida.
- Queda pendiente ejecutar el smoke real y la auditoría HTTP con Spring Boot y PostgreSQL aislados; comprobar allí stock, publicación y compra con datos reales de prueba.
- No se realizó una auditoría visual manual completa. Las vistas y estilos no cambiaron; los recorridos automatizados cubren los controles y mensajes relevantes.
- Las coordinaciones de publicaciones privadas, pedidos, perfil y promociones siguen en App por alcance. Su extracción pertenece a los bloques posteriores.

La validación automatizada del frontend está aprobada. La integración real queda pendiente por los impedimentos anteriores; no se presenta el bloque como validado de extremo a extremo contra el backend.
