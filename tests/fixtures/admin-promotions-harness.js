import React, { StrictMode, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import useAdminPromotions from '../../src/hooks/useAdminPromotions.js'

const noop = () => {}
const subscribeSessionChange = () => noop
function Harness() {
  const sessionVersion = useRef(0), sessionAbort = useRef(new AbortController())
  const admin = useAdminPromotions({ user: { id: 1, role: 'ADMIN' }, token: localStorage.getItem('token'),
    active: true, sessionVersion, sessionAbort, subscribeSessionChange, logout: noop, setSessionError: noop, onSaved: noop })
  return React.createElement('div', {},
    React.createElement('button', { onClick: admin.refresh }, 'Actualizar'),
    React.createElement('button', { onClick: () => admin.save({ ...admin.promotions[0], name: 'Edición vigente' }).catch(noop) }, 'Guardar'),
    React.createElement('pre', { id: 'state' }, JSON.stringify(admin.promotions)),
    React.createElement('span', { id: 'busy' }, String(admin.busyId)))
}
createRoot(document.getElementById('root')).render(React.createElement(StrictMode, {}, React.createElement(Harness)))
