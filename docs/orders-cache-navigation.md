# Caché de Mis pedidos

## Diagnóstico previo a modificar la implementación

Base frontend: origin/main 5b8b845. Working tree limpio al iniciar; rama fix/orders-cache-navigation creada desde esa base. Backend inspeccionado en modo lectura.

Orders.jsx declara orders, loading, error y attempt con useState locales y un efecto dependiente de token, attempt y onUnauthorized. Desmontar la ruta descarta la lista; montarla nuevamente ejecuta GET /orders. El efecto ya difiere el fetch a una microtarea y cancela el primer efecto de StrictMode: no corresponde atribuir el GET de cada navegación a StrictMode. Los filtros trabajan localmente.

App conserva orderDetails por ID y evita repetir detalles cargados; logout/startSession los limpian y sessionVersion descarta respuestas anteriores. Sin embargo, los detalles no tienen vencimiento y un nuevo listado no invalida su contenido. confirmOrder solo guarda confirmedOrder y actualiza carrito/productos: no había caché compartida del listado para actualizar/invalidate.

OrderServiceImpl.getOrdersByUserId en origin/main devuelve resúmenes mediante mapToResponse, sin items/promotions. Por eso sigue siendo necesario GET /orders/{id} al abrir un pedido, salvo que ya se disponga de un detalle completo real (por ejemplo, respuesta de checkout). No se requiere cambiar el backend.

## Corrección implementada

- `App.jsx` conserva el listado en memoria durante la sesión. `Orders.jsx` recibe datos/estados/callbacks y mantiene solamente el filtro y el pedido abierto.
- Vigencia de **60 segundos desde una respuesta exitosa**, también para listas vacías. Una referencia registra la petición en curso: entrar nuevamente mientras carga reutiliza esa petición. StrictMode conserva su protección mediante microtarea y limpieza del efecto.
- Al vencer mientras el historial está abierto, se actualiza automáticamente. Fuera de esa ruta no hay consultas periódicas; volver verifica el vencimiento. «Actualizar pedidos» permite anticiparlo y se deshabilita durante la petición.
- La compra exitosa invalida el listado y conserva el detalle completo recibido de POST /orders. Volver al historial consulta nuevamente la fuente real. No se cambió la cotización ni la confirmación de compra.
- Logout e inicio de sesión limpian listado y detalles, abortan pendientes y descartan sus resultados mediante la versión de sesión y la identidad de cada petición. Los pedidos nunca se guardan en localStorage.
- Una respuesta fallida muestra un aviso y permite reintentar sin eliminar la última lista válida; un 401 usa el cierre de sesión existente. No hay fallback a mocks ni reintentos automáticos infinitos.
- Los detalles tienen el mismo límite de vigencia. Al actualizar el listado se conservan solamente los detalles vigentes cuyos campos de resumen coinciden. Un detalle abierto invalidado se consulta otra vez; las respuestas de detalle anteriores a esa actualización se cancelan/descartan. Si el listado contiene realmente items y promotions, se aprovechan directamente sin otro GET.

## Mediciones comparativas

Medición en navegador Edge headless, Vite con React StrictMode, misma secuencia de navegación y respuestas HTTP controladas. Son cantidades de solicitudes observadas, no mediciones de latencia de Spring o PostgreSQL.

| Secuencia | Antes (GET acumulados /orders) | Después |
| --- | ---: | ---: |
| Primera entrada | 1 | 1 |
| Ir a Mi perfil y volver antes de 60 s | 2 | 1 |
| Alternar los cuatro filtros | 2 | 1 |

Abrir/reabrir el mismo detalle conserva **1 GET /orders/{id}** tanto antes como después. Una actualización manual agrega exactamente 1 GET al listado; vencer su vigencia agrega 1. Una compra posterior a haber cargado el historial produce una nueva consulta al volver y muestra la nueva orden. Se verificó que su detalle completo no requiere otra llamada.

## Archivos modificados

- `src/App.jsx`: estado compartido, vigencia, deduplicación, invalidación de lista/detalles e integración con sesión y compra.
- `src/views/Orders.jsx`: recepción por props, actualización/reintento y conservación de datos visibles durante un error o actualización; recarga de un detalle abierto invalidado.
- `tests/orders-cache.browser.mjs`: seis grupos de pruebas de navegador con API controlada, sin conexión a la base compartida.
- `tests/frontend-audit.mjs`: agrega comprobaciones de historial actualizado después de comprar y reutilización del detalle de checkout.
- `docs/orders-cache-navigation.md`: diagnóstico previo, decisiones, mediciones y resultados.

No se modificaron backend, dependencias, fotografías, componentes de producto, editor de publicaciones, promociones ni reglas de descuentos. No se agregaron endpoints ni migraciones.

## Pruebas ejecutadas y resultados

Fecha: 19/10/2026.

- `npm run lint`: **PASS**, sin errores.
- `npm run build`: **PASS**, compilación de producción completa.
- `node tests/orders-cache.browser.mjs`: **PASS**, seis grupos que comprueban primera entrada única con StrictMode, navegación, filtros locales, detalles reutilizados, actualización manual, petición pendiente compartida, vencimiento en pantalla y al volver, error inicial y de actualización con reintento, preservación de datos, fallo/reintento de detalle, 401, logout/cambio de cuenta con respuestas tardías, carrera listado/detalle, vencimiento de detalle abierto, listado completo y listado vacío.
- `node tests/frontend-audit.mjs`: **PASS**. Regresión de catálogo, sesión, carrito, publicaciones, checkout, recotización, conflicto de importe, reintento con misma clave, compra/historial y vencimiento de productos. Se agregaron y ejecutaron las dos aserciones de historial/detalle tras comprar.
- `node tests/promotions.browser.cjs`: **PASS**, los doce escenarios existentes. Administración y sección pública permanecen compatibles con App.
- Medición de navegación antes/después: **PASS**, resultados de la tabla anterior.

Los scripts requieren Vite en localhost:5173, Edge y Playwright disponible externamente mediante PLAYWRIGHT_MODULE (o una instalación ya disponible). No se agregó Playwright al package.json. Las respuestas interceptadas existen únicamente en las pruebas; la aplicación sigue consultando Spring Boot. No se ejecutaron escrituras ni pruebas de backend sobre PostgreSQL compartido.

## Revisión y límites

Se evita el tráfico repetido por desmontaje sin cambiar la arquitectura: App administra comunicaciones/estado, la vista presenta y filtra. Las referencias identifican solicitudes y permiten deduplicarlas antes del siguiente render; los estados activan la actualización visual. La limpieza de efectos evita iniciar trabajo desde vistas desmontadas. La separación por sesión impide restaurar pedidos de otra cuenta.

El límite de 60 s implica que un cambio externo puede tardar hasta la siguiente actualización en verse; el botón permite solicitarlo inmediatamente. No hay sincronización en tiempo real entre pestañas. Si la API falla se conserva el último dato con un aviso: no se presenta como una actualización exitosa. Los productos de un pedido se muestran al recuperar su detalle porque el listado actual del backend no trae items; no se inventaron campos ni se agregó un GET por cada fila.

## Checklist manual

1. Ingresar y abrir Mis pedidos: un GET /orders.
2. Ir al perfil y volver antes de 60 s; alternar filtros: ningún GET adicional.
3. Abrir/cerrar/reabrir un pedido: un solo GET de detalle vigente.
4. Actualizar manualmente o esperar 60 s: recuperar estados e importes actuales.
5. Comprar y abrir el historial: encontrar el pedido recién confirmado.
6. Interrumpir la API y actualizar: aviso/reintento conservando datos previos.
7. Cerrar sesión con una petición pendiente e ingresar con otra cuenta: mostrar únicamente sus pedidos.

Entrega en rama `fix/orders-cache-navigation`, sin merge a main:
https://github.com/nicogiorda/elrincondelmazo-frontend/compare/main...fix/orders-cache-navigation
