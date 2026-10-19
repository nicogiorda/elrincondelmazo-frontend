# Auditoría de promociones y colecciones

Fecha: 19/10/2026. Rama en ambos repositorios: `audit/promotion-collections`.
Bases remotas consultadas: frontend `50eb70a`; backend `14b1f24`.
Trabajo realizado en worktrees separados; no se modificaron las ramas de trabajo del otro desarrollador ni se hizo push a main.

## Diagnóstico confirmado

1. El efecto administrativo de App dependía de `logout`. En el BrowserRouter usado por este proyecto, `useNavigate` depende de la ubicación; cambiar de ruta puede cambiar `navigate`, luego `logout`, y repetir el efecto. La bandera `cancelled` solo descartaba respuestas, sin compartir ni evitar los GET.
2. PromotionEditor hacía sus propios GET de colecciones y productos en cada montaje, a pesar de que App ya tenía esos recursos. El ciclo adicional de efectos de StrictMode iniciaba dos solicitudes por recurso en cada entrada al editor. Tampoco había deduplicación en curso.
3. El editor esperaba ambos recursos con Promise.all y reemplazaba toda la interfaz por un párrafo mientras cargaban, incluso para promociones de cantidad, medio de pago o monto mínimo.
4. Home importaba tres promociones ficticias de homeMocks. Los colores de productos dependían de IDs de colección fijos.
5. El backend protegía POST/PUT/PATCH pero permitía a cualquier usuario autenticado leer la administración. No existía una consulta pública de vigencia.

## Cambios

- GET `/promotions/public`: anónimo, solo lectura, `active = true`, `startDate <= ahora`, `endDate IS NULL OR endDate >= ahora`. Límites inclusivos, iguales a checkout. El repositorio trae las relaciones utilizadas por el DTO dentro de la transacción de lectura.
- Cualquier otra operación bajo `/promotions` requiere ADMIN. No se tocaron reglas de usuarios, productos, carrito ni órdenes.
- La entidad actual no tiene un atributo de visibilidad privada: sus promociones activas y vigentes se consideran publicables. No se inventó una columna ni se realizó una migración. La respuesta contiene exclusivamente los datos comerciales ya existentes en PromotionResponse; no se exponen operaciones administrativas por el endpoint público.
- Home carga los datos reales, condiciones, acumulabilidad y período. Maneja carga, error con reintento y lista vacía. No usa descuentos de reemplazo al fallar.
- La carga pública comparte peticiones simultáneas, pero no conserva resultados completados entre visitas: volver a Home consulta de nuevo al servidor. Las modificaciones administrativas invalidan una petición pública anterior todavía pendiente. No hay polling.
- App carga administración solo en sus rutas. Comparte una promesa por sesión/usuario/token/intento, descarta respuestas de sesiones anteriores y no vuelve a aplicar una respuesta vieja sobre cambios ya guardados. Una microtarea permite que la limpieza de StrictMode descarte el primer efecto antes de iniciar HTTP.
- POST y PUT ya eran reales: se conservaron y actualizan el estado con su respuesta. PATCH también era real; ahora la tarjeta bloquea clics duplicados mientras espera. No se agrega GET después de guardar o activar/desactivar. Hay un botón explícito para refrescar cambios externos.
- PromotionEditor recibe productos, colecciones y sus estados desde App. No tiene fetch. Solo espera el recurso necesario para la condición elegida, conserva el formulario ante errores y exige una selección real. IDs desaparecidos o ausentes de la carga se muestran como no disponibles; nunca se reemplazan silenciosamente por otro ID.
- Colecciones: Controller, Service, Repository y DTOs ya devolvían datos de PostgreSQL; no requirieron cambios de producción. Home, selector del editor y filtros del catálogo reciben los IDs/nombres de GET `/collections`.
- Metadata visual de Home por nombre de colección, con apariencia genérica para nombres desconocidos. No depende de posición ni ID. Se conservaron imágenes y estilos locales.
- Se eliminaron `homePromotions`, el arreglo comercial `promotionMocks`, la fecha fija `promotionMockDate` y los IDs por defecto del formulario. `promotionMocks.js` conserva configuración visual, valores iniciales del formulario y funciones de presentación; ninguna promoción de ejemplo se publica.

## Medición reproducida de solicitudes

Chrome headless, APIs controladas para contar solicitudes sin depender de latencia del servidor. Flujo idéntico: abrir la lista, editar y cancelar tres veces. Se cuentan los GET globales y los iniciados por el editor.

| Recurso | Original + StrictMode | Corregido + StrictMode | Corregido producción |
| --- | ---: | ---: | ---: |
| `/promotions` | 7 | 1 | 1 |
| `/collections` | 7 | 1 | 1 |
| `/products?size=100` | 7 | 1 | 1 |

El editor pasó de dos GET por recurso en cada entrada de desarrollo a cero GET propios. StrictMode explica el doble efecto del editor; la navegación y la identidad de `logout` explican los GET administrativos, por lo que atribuir todo a StrictMode habría sido incorrecto. En producción desaparece el ciclo adicional de StrictMode, pero sin la corrección seguían existiendo las consultas del editor por montaje y las de administración por navegación.

Guardar, editar, desactivar y activar no incrementaron el contador de GET administrativos. Actualizar manualmente agregó exactamente uno. Una recarga completa del documento genera una nueva carga por recurso, como corresponde.

No se reprodujeron las latencias originales de 6,50 y 12,76 segundos. En una ejecución real de Home, con el backend aislado conectado a PostgreSQL, se midieron 776 ms para productos, 783 ms para colecciones y 782 ms para promociones públicas. Son tiempos de una solicitud HTTP observada desde el cliente de prueba, no un perfil de consultas SQL ni una garantía de rendimiento. La reducción verificada corresponde a solicitudes eliminadas y a dejar de bloquear condiciones que no dependen de productos.

## Verificaciones ejecutadas

### Backend

Pruebas reales con Java 21/Maven, Spring Security/JWT y PostgreSQL configurado; `ddl-auto=none`, fixtures transaccionales con rollback:

| Suite | Pruebas | Fallos/errores |
| --- | ---: | ---: |
| PromotionCheckoutIntegrationTests | 5 | 0 |
| PromotionQuantityTests | 19 | 0 |
| PromotionStackableTests | 26 | 0 |
| PromotionAdministrationIntegrationTests | 15 | 0 |
| PromotionPublicTests | 1 | 0 |

Total: 66. Las tres suites existentes se ejecutaron primero (50); luego las dos nuevas (16). La suite pública de lista vacía usa repositorio simulado y MockMvc standalone; la nueva suite administrativa usa PostgreSQL y seguridad reales. Cubren lectura pública anónima, exclusión de futuras/vencidas/inactivas, límites exactos, ausencia de resultados, lectura administrativa restringida, usuario común rechazado en escrituras, POST/PUT/PATCH administrativos, persistencia, validaciones y colecciones reales. Las validaciones existentes rechazaron porcentaje 0 y >100, cantidades/montos no positivos, nombre vacío, fechas invertidas y campos obligatorios ausentes según tipo.

No se modificó `applyPromotions(List<CartItem>, PaymentMethod)`, su implementación de cálculo ni sus DTOs de respuesta. main ya contenía las correcciones de cantidad y la comparación de acumulables/no acumulables. No se encontró un error adicional de cálculo que requiriera reescribir el motor.

### Frontend

- `npm run build`: aprobado.
- `npm run lint`: aprobado, sin advertencias.
- `tests/promotions.browser.cjs`: 10 escenarios aprobados en Vite desarrollo con StrictMode y los mismos 10 en preview del build de producción. Usan respuestas HTTP controladas; no reemplazan los ensayos reales del backend.
- Escenarios: Home con datos de API; Home vacía; error HTTP/reintento; navegación repetida y mutaciones sin GET redundantes; productos lentos; error administrativo/guardado sin perder borrador; colecciones vacías/con error; todos los filtros de estado; recarga del editor; respuesta tardía después de cerrar sesión y abrir otra.
- `tests/promotions.live.cjs`: Home de producción contra Spring Boot real en puerto 8082 y PostgreSQL, sin login ni escrituras. Puente de puertos de prueba para conservar el backend compartido de localhost:8080. Mostró 5 promociones y 4 colecciones, cuyos nombres/descuentos se compararon con la respuesta real. `/promotions` anónimo respondió 401; CORS de la lectura pública para localhost:5173 respondió correctamente.
- Inspección visual de Home real en escritorio y control de desborde del bloque de promociones en escritorio/móvil. Se ajustó el título para evitar superposición con las tarjetas al mostrar más promociones.

Para reproducir pruebas de navegador, usar una instalación externa de Playwright/Chrome; no se agregó una dependencia al proyecto:

```powershell
$env:PLAYWRIGHT_MODULE = 'ruta/a/node_modules/playwright'
$env:BASE_URL = 'http://127.0.0.1:5175' # Vite dev
node tests/promotions.browser.cjs
$env:BASE_URL = 'http://127.0.0.1:5176' # Vite preview, después del build
node tests/promotions.browser.cjs
$env:API_URL = 'http://127.0.0.1:8082' # backend aislado, ddl-auto=none
node tests/promotions.live.cjs
```

## Archivos modificados

Frontend:

- `src/App.jsx`: exclusivamente estado/efectos de promociones, import asociado, props y rutas de promociones.
- `src/views/Home.jsx`, `src/views/PromotionEditor.jsx`, `src/views/Promotions.jsx`.
- `src/components/PromotionCard.jsx`, `src/components/ManagedPromotionCard.jsx`.
- `src/data/homeMocks.js`, `src/data/promotionMocks.js`.
- Nuevos: `src/hooks/usePublicPromotions.js`, `src/services/publicPromotions.js`.
- Nuevos: `tests/promotions.browser.cjs`, `tests/promotions.live.cjs`, este informe.

Backend:

- `src/main/java/com/uade/elrincondelmazo/controllers/PromotionController.java`.
- `src/main/java/com/uade/elrincondelmazo/controllers/config/SecurityConfig.java` (solo promociones).
- `src/main/java/com/uade/elrincondelmazo/repository/PromotionRepository.java`.
- `src/main/java/com/uade/elrincondelmazo/service/PromotionService.java` (método de lectura pública añadido).
- `src/main/java/com/uade/elrincondelmazo/service/impl/PromotionServiceImpl.java` (lectura pública y límites transaccionales de administración).
- Nuevos: `src/test/java/com/uade/elrincondelmazo/PromotionAdministrationIntegrationTests.java`, `src/test/java/com/uade/elrincondelmazo/PromotionPublicTests.java`, `docs/promociones-colecciones.md`.

## Pendientes y coordinación

1. **Catálogo/productos:** App solo carga `/products?size=100` y no conserva metadata de paginación. El editor reutiliza esa lista, que puede ser incompleta con más de 100 productos. El responsable del catálogo debe proveer la colección completa o un selector paginado compartido, con estado de vigencia/recarga. No se alteraron su efecto, ProductServiceImpl ni Catalog. Un producto ausente se informa y bloquea el guardado de esa condición hasta elegir uno disponible.
2. **Metadata fuera del módulo:** Catalog, ProductDetail y ProductThumbnail todavía usan mapas visuales por ID en otros archivos. Se recomienda que su responsable los migre a nombre/slug; no se tocaron. `publicationCollections` sigue declarado en accountMocks pero no está importado por ninguna vista. Un slug estable sería preferible si las colecciones se renombraran; requeriría acordar un campo nuevo. Hoy un nombre desconocido solo pierde la decoración específica, nunca cambia su identidad comercial.
3. **Actualización externa:** administración mantiene la lista durante la sesión y permite refresco manual; productos/colecciones conservan la política de carga global existente. Home vuelve a consultar al entrar o reintentar. No se agregaron sondeos automáticos.
4. **Privacidad de campañas:** el modelo no distingue campañas privadas; si el negocio las necesita, debe definirse esa regla antes de agregar visibilidad y su migración.
5. **Checkout:** no requiere cambios para integrar estas ramas. Conservar las correcciones que ya están en main; no integrar sobre la rama backend antigua `rama-vic`, que no las contenía. La política existente de LocalDateTime sin zona tampoco se cambió.
6. Las latencias originales del backend siguen sin diagnóstico causal: harían falta trazas de esas solicitudes, SQL y condiciones de red comparables. No se adjudicó la demora al backend.
