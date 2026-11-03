import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import axios from 'axios'
import { API_BASE_URL } from '../services/httpClient.js'
import { validateQuote, isConfirmedOrder, normalizeOrderError, ambiguousFailure } from '../services/ordersApi.js'

// Un fallo de transporte / 201 sin detalle puede haber creado una orden.
// Conservar ambiguous y status en rejected es esencial para no duplicar pagos.
const serializeCheckoutError = error => ({
  name: typeof error?.name === 'string' ? error.name : 'Error',
  message: typeof error?.message === 'string' ? error.message : 'No se pudo completar la operación.',
  ...(typeof error?.status === 'number' ? { status: error.status } : {}),
  ...(typeof error?.code === 'string' ? { code: error.code } : {}),
  ...(error?.ambiguous === true ? { ambiguous: true } : {}),
})

export const fetchCheckoutQuote = createAsyncThunk('checkout/fetchQuote',
  async ({ paymentMethod }, { extra, signal }) => {
    const token = extra?.ordersToken?.()
    if (!token) throw new Error('No hay una sesion activa para cotizar.')
    const response = await axios.post(API_BASE_URL + '/orders/preview',
      { paymentMethod }, { signal, headers: { Authorization: 'Bearer ' + token } },
    ).catch(error => { throw normalizeOrderError(error, signal) })
    signal.throwIfAborted()
    if (response.status < 200 || response.status >= 300) {
      throw normalizeOrderError({ response }, signal)
    }
    return validateQuote(response.data)
  }, { serializeError: serializeCheckoutError })

export const confirmCheckoutOrder = createAsyncThunk('checkout/confirm',
  async ({ payload }, { extra, signal }) => {
    const token = extra?.ordersToken?.()
    if (!token) throw new Error('No hay una sesion activa para confirmar.')
    try {
      // Un solo POST por intento. El hook conserva el UUID para cualquier
      // respuesta ambigua y no genera otra orden automáticamente.
      const { data, status } = await axios.post(API_BASE_URL + '/orders', {
        paymentMethod: payload.paymentMethod,
        expectedTotal: payload.expectedTotal,
        requestKey: payload.requestKey,
      }, { signal, headers: { Authorization: 'Bearer ' + token } })
      signal.throwIfAborted()
      if (status !== 201 || !isConfirmedOrder(data, payload.paymentMethod, payload.expectedTotal)) {
        throw Object.assign(new Error('La respuesta no contiene el detalle del pedido. Revisá tus pedidos antes de reintentar.'), {
          status, ambiguous: true,
        })
      }
      return data
    } catch (failure) {
      const error = normalizeOrderError(failure, signal)
      if (error.ambiguous || !error.status || error.status >= 500) throw ambiguousFailure(error)
      throw error
    }
  }, { serializeError: serializeCheckoutError })

const newQuote = () => ({ key: null, status: 'idle', data: null, error: '', requestId: null })
const newConfirmation = () => ({
  submitting: false, submitError: '', confirmedOrder: null, unresolved: null, requestId: null,
})
const initialState = () => ({
  ownerId: null, generation: null,
  quote: newQuote(),
  confirmation: newConfirmation(),
})
const sameSession = (state, args) => state.ownerId === args.ownerId
  && state.generation === args.generation

function ensureSession(state, args) {
  if (!sameSession(state, args)) {
    state.ownerId = args.ownerId
    state.generation = args.generation
    state.quote = newQuote()
    state.confirmation = newConfirmation()
  }
}

const ambiguousMessage = 'No pudimos comprobar si el pedido se creó. Revisá tus pedidos antes de iniciar otra compra; podés reintentar este mismo intento sin cambiar sus datos.'
const priceChangedMessage = 'El total cambió. Revisá el nuevo importe y confirmá otra vez.'

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState: initialState(),
  reducers: {
    checkoutSessionCleared: initialState,
    checkoutSubmitErrorSet(state, action) {
      if (!sameSession(state, action.payload)) return
      state.confirmation.submitError = action.payload.message
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchCheckoutQuote.pending, (state, action) => {
        if (action.meta.arg.ownerId == null) return
        ensureSession(state, action.meta.arg)
        state.quote = { key: action.meta.arg.quoteKey, status: 'loading',
          data: null, error: '', requestId: action.meta.requestId }
      })
      .addCase(fetchCheckoutQuote.fulfilled, (state, action) => {
        if (!sameSession(state, action.meta.arg)
          || state.quote.requestId !== action.meta.requestId) return
        state.quote = { key: action.meta.arg.quoteKey, status: 'succeeded',
          data: action.payload, error: '', requestId: null }
      })
      .addCase(fetchCheckoutQuote.rejected, (state, action) => {
        if (!sameSession(state, action.meta.arg)
          || state.quote.requestId !== action.meta.requestId) return
        state.quote = { key: action.meta.arg.quoteKey,
          status: action.meta.aborted || action.meta.condition ? 'idle' : 'failed',
          data: null,
          error: action.meta.aborted || action.meta.condition ? '' : action.error.message,
          requestId: null }
      })
      .addCase(confirmCheckoutOrder.pending, (state, action) => {
        if (action.meta.arg.ownerId == null) return
        ensureSession(state, action.meta.arg)
        state.confirmation.submitting = true
        state.confirmation.submitError = ''
        state.confirmation.requestId = action.meta.requestId
      })
      .addCase(confirmCheckoutOrder.fulfilled, (state, action) => {
        if (!sameSession(state, action.meta.arg)
          || state.confirmation.requestId !== action.meta.requestId) return
        state.confirmation.submitting = false
        state.confirmation.requestId = null
        state.confirmation.submitError = ''
        state.confirmation.unresolved = null
        state.confirmation.confirmedOrder = action.payload
      })
      .addCase(confirmCheckoutOrder.rejected, (state, action) => {
        if (!sameSession(state, action.meta.arg)
          || state.confirmation.requestId !== action.meta.requestId) return
        state.confirmation.submitting = false
        state.confirmation.requestId = null
        if (action.meta.aborted || action.meta.condition) return
        if (action.error.status === 409) {
          state.confirmation.unresolved = null
          state.confirmation.submitError = priceChangedMessage
        } else if (action.error.ambiguous) {
          state.confirmation.unresolved = {
            quoteKey: action.meta.arg.quoteKey,
            cartKey: action.meta.arg.cartKey,
            payload: action.meta.arg.payload,
          }
          state.confirmation.submitError = (action.error.message
            ? action.error.message + ' ' : '') + ambiguousMessage
        } else {
          state.confirmation.submitError = action.error.message || 'No pudimos confirmar el pedido.'
        }
      })
  },
})

export const { checkoutSessionCleared, checkoutSubmitErrorSet } = checkoutSlice.actions
export default checkoutSlice.reducer
