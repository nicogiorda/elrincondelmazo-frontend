import { createSlice } from '@reduxjs/toolkit'

// Los detalles privados, el listado y sus fechas viven solamente en Redux.
// El hook conserva AbortController y referencias de peticiones, nunca el JWT.
export const ORDERS_CACHE_TTL = 60_000

const emptyHistory = () => ({ items: [], updatedAt: 0, loading: false, error: '' })
const summaryFields = ['state', 'orderDate', 'paymentMethod', 'subtotal', 'totalDiscount', 'total']

const initialState = () => ({
  ownerId: null,
  generation: null,
  history: emptyHistory(),
  details: {},
})
const sameSession = (state, { ownerId, generation }) =>
  state.ownerId === ownerId && state.generation === generation

function ensureSession(state, payload) {
  if (!sameSession(state, payload)) {
    state.ownerId = payload.ownerId
    state.generation = payload.generation
    state.history = emptyHistory()
    state.details = {}
  }
}

const ordersSlice = createSlice({
  name: 'orders',
  initialState: initialState(),
  reducers: {
    ordersSessionCleared: initialState,
    ordersHistoryStarted(state, action) {
      if (action.payload.ownerId == null) return
      ensureSession(state, action.payload)
      state.history.loading = true
      state.history.error = ''
    },
    ordersHistoryLoaded(state, action) {
      if (!sameSession(state, action.payload)) return
      const { items, updatedAt } = action.payload
      const details = {}
      for (const order of items) {
        const previous = state.details[order.id]
        if (Array.isArray(order.items) && Array.isArray(order.promotions)) {
          details[order.id] = { data: order, updatedAt, loading: false, error: '' }
        } else if (previous?.data && updatedAt - previous.updatedAt < ORDERS_CACHE_TTL
          && summaryFields.every((field) => order[field] === previous.data[field])) {
          details[order.id] = { ...previous, loading: false, error: '' }
        }
      }
      state.details = details
      state.history = { items, updatedAt, loading: false, error: '' }
    },
    ordersHistoryFailed(state, action) {
      if (!sameSession(state, action.payload)) return
      state.history.error = action.payload.message
    },
    ordersHistoryFinished(state, action) {
      if (!sameSession(state, action.payload)) return
      state.history.loading = false
    },
    ordersDetailStarted(state, action) {
      if (!sameSession(state, action.payload)) return
      const { orderId } = action.payload
      const previous = state.details[orderId]
      state.details[orderId] = {
        ...previous, data: previous?.data ?? null, loading: true, error: '',
      }
    },
    ordersDetailLoaded(state, action) {
      if (!sameSession(state, action.payload)) return
      const { orderId, data, updatedAt } = action.payload
      state.details[orderId] = { data, updatedAt, loading: false, error: '' }
    },
    ordersDetailFailed(state, action) {
      if (!sameSession(state, action.payload)) return
      const { orderId, message } = action.payload
      const previous = state.details[orderId]
      state.details[orderId] = {
        ...previous, data: previous?.data ?? null, loading: false, error: message,
      }
    },
    ordersConfirmed(state, action) {
      if (action.payload.ownerId == null) return
      ensureSession(state, action.payload)
      state.history = emptyHistory()
      const { order, updatedAt } = action.payload
      state.details = { [order.id]: { data: order, updatedAt, loading: false, error: '' } }
    },
  },
})

export const {
  ordersSessionCleared, ordersHistoryStarted, ordersHistoryLoaded,
  ordersHistoryFailed, ordersHistoryFinished, ordersDetailStarted,
  ordersDetailLoaded, ordersDetailFailed, ordersConfirmed,
} = ordersSlice.actions

export default ordersSlice.reducer
