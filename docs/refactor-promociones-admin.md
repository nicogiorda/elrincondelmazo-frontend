# Bloque 7: promociones administrativas

## Estructura y decisiones

Base: `main` en `45f005c` (bloques 1–6). Trabajo aislado en `refactor/07-promociones-admin`.
App pasó de **558 a 379 líneas**: dejó de mantener estados, referencias, solicitudes y conversiones administrativas.

```text
App → useAdminPromotions → promotionsApi → httpClient → Spring Boot
                       → promotionMapper
                       → invalidatePublicPromotions → usePublicPromotions → Home
PromotionEditor → catálogo compartido (sin cambios)
useSession → subscribeSessionChange → limpieza administrativa
```

Una única instancia de `useAdminPromotions` comparte el listado entre administración y editor.
Interfaz: `{ promotions, loading, error, busyId, refresh, save, toggle }`.
Recibe usuario/token, ruta activa, versión y cancelación de sesión, suscripción a cambios,
manejo de 401 y callback `onSaved`. App conserva la navegación y composición.

La caché administrativa conserva la regla anterior: carga al entrar con ADMIN, reutilización
al navegar y actualización manual; **no se agrega TTL**. También almacena listas vacías.
Las solicitudes pendientes se comparten. El inicio diferido evita duplicaciones por StrictMode.

Cada mutación adquiere un bloqueo síncrono compartido y cancela la lectura previa. El resultado
se incorpora localmente sin GET adicional. Identidad de solicitud, versión de sesión, token,
montaje y AbortSignal impiden aplicar respuestas antiguas, incluso si el transporte ignora
la cancelación. Logout invalida operaciones y limpia datos antes de otra sesión.
401 cierra sesión; 403 conserva el error del backend. Fallos y respuestas inválidas mantienen
el listado válido y el borrador del formulario. Los controles reflejan el bloqueo compartido.

## Contratos y conversiones

`promotionsApi` encapsula GET listado/detalle, POST, PUT y PATCH activar/desactivar mediante
`httpClient`, con JWT y señal por solicitud. Valida códigos 200/201, estructura, identidad y
estado confirmado antes de actualizar el hook. No reintenta escrituras automáticamente.

Se consultaron `PromotionController`, `CreatePromotionRequest`, `UpdatePromotionRequest`,
`PromotionResponse`, autorización y servicio del backend, exclusivamente en lectura.
Crear/editar no envían `active`: el backend activa al crear y PATCH cambia el estado.
Se mantienen los seis tipos, condiciones, IDs reales, campos opcionales, null y stackable.
`promotionMapper` conserva LocalDateTime literalmente; fechas sin hora reciben los mismos
límites de día anteriores, sin conversión UTC.

## Integración pública y problema corregido

La invalidación se ejecuta únicamente después de una mutación válida de la sesión actual.
No se mezclan datos administrativos con `GET /promotions/public`, que sigue sin JWT.

Una prueba reprodujo este caso: PATCH pendiente → entrar a Home → GET público con datos
anteriores → completar PATCH. Limpiar solamente la promesa compartida no notificaba a Home
ya montada. El escenario falló esperando el listado público actualizado. Se añadió una
suscripción a la invalidación existente: descarta inmediatamente el resultado anterior y
solicita datos vigentes. La regresión confirma dos GET en esa carrera y ningún resultado viejo;
las pruebas existentes conservan las cantidades de GET durante navegación normal.
No se agregó otra caché global ni se modificó checkout.

## Archivos

- Creados: `src/services/promotionsApi.js`, `src/hooks/useAdminPromotions.js`,
  `src/utils/promotionMapper.js`.
- Adaptados: `src/App.jsx`, `src/views/Promotions.jsx`,
  `src/views/PromotionEditor.jsx`, `src/components/ManagedPromotionCard.jsx`.
- Integración pública: `src/services/publicPromotions.js`, `src/hooks/usePublicPromotions.js`.
- Pruebas: `tests/promotions-api.test.mjs`, `tests/admin-promotions.browser.mjs`,
  `tests/fixtures/admin-promotions-harness.js`, `tests/cart-architecture.test.mjs`.
- Este informe: `docs/refactor-promociones-admin.md`.

## Validación

HTTP simulado, React real en StrictMode y navegador Edge headless; ningún backend ni base real.
`BASE_URL=http://127.0.0.1:5175`; `PLAYWRIGHT_MODULE` apunta al runtime local de Playwright.
Logs completos locales en `logs/` (ignorados por Git).

| Comando | Resultado |
|---|---|
| `node --test tests/promotions-api.test.mjs` | 32 PASS |
| `node tests/admin-promotions.browser.mjs` | 15 PASS |
| `node tests/promotions.browser.cjs` | 12 PASS |
| `npm run lint` | PASS, sin errores ni advertencias |
| `npm run build` | PASS |
| `node --test tests/*.test.mjs` | 191 PASS, 0 omitidos |
| `node tests/checkout.browser.mjs` | 26 PASS |
| `node tests/cart-api.browser.mjs` | 22 PASS |
| `node tests/catalog.browser.mjs` | 13 PASS |
| `node tests/auth-session.browser.mjs` | 27 PASS |
| `node tests/publications.browser.mjs` | 32 PASS |
| `node tests/orders-cache.browser.mjs` | 10 grupos PASS |
| `node tests/frontend-audit.mjs` | 18 escenarios PASS, 37 solicitudes |
| `git diff --check` | PASS |

Los 15 escenarios nuevos cubren StrictMode, caché vacía, solicitudes compartidas, GET anterior
a edición, bloqueo entre tarjetas/editor, doble clic, fallos sin pérdida de datos, respuestas
inválidas, reintentos, A → B durante carga/guardado/PATCH ignorando AbortSignal, 401/403,
restricciones de USUARIO e invalidación pública tardía. La suite previa conserva creación,
edición, activación, filtros, recarga del editor y selección paginada del catálogo.
Arquitectura comprueba instancia única, servicios sin React, hooks sin fetch y ausencia de ciclos.

Lint detectó inicialmente una dependencia de memoización de `user`; se corrigió capturando
su ID escalar y las pruebas focalizadas se repitieron satisfactoriamente.

## Límites y pendientes

Pendiente la comprobación integral con Spring Boot/PostgreSQL reales por el usuario.
No se ejecutó `promotions.live.cjs`, no se cambiaron credenciales, backend ni datos.
Ante fallo de red de una escritura no se reintenta automáticamente: actualizar el listado
permite comprobar el estado servidor antes de decidir otro envío. La autorización definitiva
y las reglas monetarias permanecen en Spring Boot.
