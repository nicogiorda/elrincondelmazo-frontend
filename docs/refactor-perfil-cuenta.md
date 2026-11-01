# Bloque 8: perfil y gestión de cuenta

## Arquitectura

Base: `main` actualizado en `710467d`, con PR #24 fusionado. Rama y worktree aislados:
`refactor/08-perfil-cuenta`. App pasa de **379 a 304 líneas**.

```text
Profile → App (confirmación explícita y conexión) → useAccount → accountApi → httpClient
                                                    ↕
                                                useSession
                                      (usuario, logout, cancelación)
```

- `accountApi.js`: PUT de perfil y desactivación, cuerpo exacto, JWT y AbortSignal por llamada.
  Valida HTTP 200, identidad, nombre/apellido/email, rol y estado esperado antes de aceptar
  la respuesta. No importa React, almacena token ni reintenta escrituras.
- `useAccount.js`: una instancia en App; bloqueo síncrono compartido, estados de operación,
  errores de desactivación, cancelación y coordinación con sesión. No guarda otra copia del usuario.
- App conserva la confirmación de desactivación y conexión con Profile. Cancelar no inicia HTTP.
  Profile conserva sin cambios sus validaciones, borrador, mensajes, presentación y manejo de null.
- `useSession` y los demás dominios permanecen sin modificaciones.

Interfaz pública:
`{ profileSaving, deactivating, deactivateError, saveProfile(form), deactivateAccount() }`.
Guardar devuelve el usuario confirmado o `null` si no debe aplicarse un resultado
(bloqueo, sesión obsoleta, logout o 401). Los errores vigentes se presentan en el formulario.
Desactivar presenta errores desde el hook y cierra sesión únicamente tras confirmación válida.

## Contratos y seguridad

Se consultaron `UsersController`, `UpdateUserRequest`, `UserResponse` y `UserServiceImpl`
del backend, exclusivamente en lectura. Ambos endpoints devuelven HTTP 200.
El servidor recorta nombres y normaliza el correo con trim/lowercase; desactivar también
retira publicaciones mediante una transacción del backend.

Un cambio efectivo se determina comparando el email **devuelto por el servidor** con el
email anterior. Nombre/apellido sin cambio de email actualizan `setUser`, conservan JWT
y no provocan GET. Otro email o desactivación válida llaman al logout existente, sin relogin.
401 conserva el manejo de sesión vencida; otros errores preservan datos válidos.

Identidad de solicitud, versión, token, señal y montaje protegen cada respuesta y liberación
del bloqueo. La suscripción de sesión cancela y limpia antes de publicar otra cuenta.
El updater de `setUser` vuelve a verificar sesión e identidad aunque React lo ejecute después
de liberar el bloqueo. StrictMode no inicia escrituras: todas requieren interacción.
Navegar conserva el bloqueo del dominio; desmontar el hook cancela y descarta resultados.

Se corrigió el mensaje anterior de fallo de red, que invitaba directamente a repetir.
Ahora una respuesta perdida o inválida informa incertidumbre y pide verificar el estado de
la cuenta antes de reenviar. No se afirma que el servidor no aplicó la operación.

## Archivos

- Nuevos: `src/services/accountApi.js`, `src/hooks/useAccount.js`.
- Modificado: `src/App.jsx`.
- Pruebas nuevas: `tests/account-api.test.mjs`, `tests/account.browser.mjs`,
  `tests/fixtures/account-harness.js`.
- Ampliado: `tests/cart-architecture.test.mjs`.
- Informe: `docs/refactor-perfil-cuenta.md`.

## Validación

HTTP simulado; React real en StrictMode y Edge headless. Vite local en
`http://127.0.0.1:5175`, mediante `BASE_URL` y runtime local `PLAYWRIGHT_MODULE`.
Logs completos en `logs/`, ignorados por Git.

| Comando | Resultado |
|---|---|
| `node --test tests/account-api.test.mjs` | 39 PASS |
| `node tests/account.browser.mjs` | 32 PASS |
| `node tests/auth-session.browser.mjs` | 27 PASS |
| `npm run lint` | PASS, sin errores ni advertencias |
| `npm run build` | PASS |
| `node --test tests/*.test.mjs` | 231 PASS, 0 omitidos |
| `node tests/cart-api.browser.mjs` | 22 PASS |
| `node tests/checkout.browser.mjs` | 26 PASS |
| `node tests/orders-cache.browser.mjs` | 10 grupos PASS |
| `node tests/publications.browser.mjs` | 32 PASS |
| `node tests/promotions.browser.cjs` | 12 PASS |
| `node tests/admin-promotions.browser.mjs` | 15 PASS |
| `node tests/catalog.browser.mjs` | 13 PASS |
| `node tests/frontend-audit.mjs` | 18 escenarios PASS, 37 solicitudes |
| `git diff --check` y `git diff --cached --check` | PASS |

Las pruebas nuevas verifican contratos, cuerpos exactos, identidad/estructura/estados
inválidos, errores HTTP y de red, normalización de email, bloqueo y doble clic, confirmación
cancelada, A → B con respuestas 200/401/500 que ignoran cancelación, bloqueo propio de B,
navegación durante ambas operaciones y desmontaje del hook.
Arquitectura comprueba instancia única, ausencia de ciclos, servicio sin React y App sin HTTP
de cuenta. No se modificaron expectativas ni fixtures de las suites anteriores.

## Límites

No se ejecutaron operaciones reales contra Spring Boot/PostgreSQL/Supabase.
Queda pendiente verificar integralmente la normalización, invalidación del JWT por cambio
de correo y retiro de publicaciones al desactivar contra el backend real.
Las escrituras no tienen protocolo de idempotencia adicional: ante un resultado ambiguo,
el usuario debe comprobar el estado antes de decidir un nuevo envío.
