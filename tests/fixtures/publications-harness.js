// Montaje de navegador para intercalar una recarga y una edición desde la API
// pública del hook. La suite normal también recorre las vistas reales de App.
import React, { StrictMode, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import usePublications from '../../src/hooks/usePublications.js'
import { createProductCache } from '../../src/utils/productCache.js'

const subscribeSessionChange = () => () => {}
const noop = () => {}
function Harness() {
  const sessionVersion = useRef(0), sessionAbort = useRef(new AbortController())
  const [catalog] = useState(createProductCache)
  const publications = usePublications({ user: { id: 1 }, token: localStorage.getItem('token'), active: true,
    sessionVersion, sessionAbort, subscribeSessionChange, logout: noop, setSessionError: noop, onSaved: noop,
    refreshPendingCatalog: catalog.invalidate, upsertProduct: catalog.upsertProduct,
    removeProduct: catalog.removeProduct, syncPublicProducts: catalog.syncPublications })
  return React.createElement('div', {},
    React.createElement('button', { onClick: publications.refresh }, 'Actualizar'),
    React.createElement('button', { onClick: () => publications.save({ name: 'Edición vigente', description: 'QA', price: 200,
      stock: 7, type: 'CARTA', imageUrls: [], collectionId: 1 }, 1) }, 'Guardar edición'),
    React.createElement('pre', { id: 'private' }, JSON.stringify(publications.publications)),
    React.createElement('pre', { id: 'public' }, JSON.stringify(catalog.getSnapshot().products)))
}
createRoot(document.getElementById('root')).render(React.createElement(StrictMode, {}, React.createElement(Harness)))
