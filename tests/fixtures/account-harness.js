import React, { StrictMode, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import useAccount from '../../src/hooks/useAccount.js'
const noop = () => {}
const subscribeSessionChange = () => noop
const user = { id: 1, firstName: 'A', lastName: 'Prueba', email: 'a@example.invalid', role: 'USUARIO', active: true }
function Account({ onApply }) {
  const sessionVersion = useRef(0), sessionAbort = useRef(new AbortController())
  const account = useAccount({ user, token: 'fixture-a', setUser: onApply, logout: onApply, setSessionError: onApply,
    sessionVersion, sessionAbort, subscribeSessionChange })
  return React.createElement('button', { onClick: () => account.saveProfile(user).catch(onApply) }, 'Guardar')
}
function Harness() {
  const [visible, setVisible] = useState(true), [applied, setApplied] = useState(0)
  return React.createElement('div', {}, visible && React.createElement(Account, { onApply: () => setApplied(n => n + 1) }),
    React.createElement('button', { onClick: () => setVisible(false) }, 'Desmontar'), React.createElement('span', { id: 'applied' }, applied))
}
createRoot(document.getElementById('root')).render(React.createElement(StrictMode, {}, React.createElement(Harness)))
