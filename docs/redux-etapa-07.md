# Redux Toolkit + Axios — etapa 7: publicaciones privadas

Referencia de clase: Gisele, 27/10/2026. Una interacción despacha una acción
asíncrona, Axios envía la petición, extraReducers publica
pending/fulfilled/rejected y React consulta Redux mediante useSelector.

## Qué se cambió
- Se creó \`src/Redux/publicationsSlice.js\` como dueño de la lista privada,
  carga, errores, operación activa, fecha de vigencia y generación de sesión.
- Cinco \`createAsyncThunk\`: \`fetchOwnPublications\` (GET paginado),
  \`saveOwnPublication\` (POST/PUT), \`setOwnPublicationStatus\` (PATCH),
  \`removeOwnPublication\` (DELETE) y \`uploadOwnPublicationPhoto\` (POST FormData).
- \`src/services/publicationsApi.js\` usa Axios, conserva los endpoints, status
  exactos y validaciones de propietario. No escribe estado ni importa React.
- \`usePublications\` conserva solo coordinación del ciclo de vida:
  deduplicación de operaciones, 60 s de TTL, cancelación real en logout,
  descarte de respuestas de sesiones anteriores y sincronización de catálogo.
  No tiene copia local de lista/errores con useState.
- El JWT se resuelve desde el thunk extraArgument al iniciar la petición.
  No se introduce en Redux DevTools, acciones serializables ni store.
- Los datos de edición y fotos del formulario siguen siendo estado local;
  las fotos se envían multipart sin Content-Type manual.
- Se adaptó el harness de navegador a Provider y el monitor a XMLHttpRequest,
  ya que Axios no necesariamente usa window.fetch.

## Criterios de validación
\`\`\`sh
npm ci
npm run lint
npm run build
node --test tests/*.test.mjs
\`\`\`

Con Vite en localhost:5173 y Playwright instalado:
\`\`\`sh
node tests/publications.browser.mjs
node tests/frontend-audit.mjs
node tests/catalog.browser.mjs
\`\`\`

Los tests Playwright usan HTTP interceptado. No probar escrituras sobre la
base real de producción. No fusionar antes de validar suite de navegador.

## Pendiente para el resto del TPO
Autenticación/usuarios, carrito/checkout, pedidos, promociones y reseñas
con operaciones HTTP dentro de thunks y transporte Axios; migración gradual
de las otras entidades sin cambiar sus reglas de negocio.
