import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { getOrders, getOrderDetail } from '../services/ordersApi.js'

// Las respuestas privadas y el estado de las solicitudes viven en Redux.
// Los AbortController y el JWT se mantienen fuera del store.
export const ORDERS_CACHE_TTL = 60_000
const emptyHistory = () => ({ items: [], updatedAt: 0, loading: false, error: '', requestId: null })
const summaryFields = ['state', 'orderDate', 'paymentMethod', 'subtotal', 'totalDiscount', 'total']

const initialState = () => ({
  ownerId: null,
  generation: null,
  history: emptyHistory(),
  details: {},
})
const sameSession = (state, { ownerId, generation }) =>
  state.ownerId === ownerId && state.generation === generation

function ensureSession(state, scope) {
  if (!sameSession(state, scope)) {
    state.ownerId = scope.ownerId
    state.generation = scope.generation
    state.history = emptyHistory()
    state.details = {}
  }
}

// Redux Toolkit omite 'status' del Error al serializarlo por defecto.
// Sin el codigo 401 el hook no podria cerrar la sesion vencida.
const serializeOrderError = error => ({
  name: typeof error?.name === 'string' ? error.name : 'Error',
  message: typeof error?.message === 'string' ? error.message : 'No se pudo consultar tus pedidos.',
  ...(typeof error?.status === 'number' ? { status: error.status } : {}),
  ...(typeof error?.code === 'string' ? { code: error.code } : {}),
})

export const fetchOrdersHistory = createAsyncThunk('orders/fetchHistory',
  async (_, { extra, signal }) => {
    const token = extra?.ordersToken?.()
    if (!token) throw new Error('No hay una sesion activa para consultar pedidos.')
    const items = await getOrders({ token, signal })
    if (!Array.isArray(items) || !items.every(order => order && Number.isSafeInteger(order.id)
      && typeof order.orderDate === 'string' && typeof order.state === 'string' && Number.isFinite(order.total))) {
      throw new Error('La respuesta de pedidos no contiene una lista válida.')
    }
    return { items, updatedAt: Date.now() }
  }, { serializeError: serializeOrderError })

export const fetchOrderDetail = createAsyncThunk('orders/fetchDetail',
  async ({ orderId }, { extra, signal }) => {
    const token = extra?.ordersToken?.()
    if (!token) throw new Error('No hay una sesion activa para consultar pedidos.')
    const data = await getOrderDetail(orderId, { token, signal })
    if (data?.id !== orderId || !Array.isArray(data.items)) {
      throw new Error('El detalle recibido no corresponde al pedido.')
    }
    return { orderId, data, updatedAt: Date.now() }
  }, { serializeError: serializeOrderError })

function setHistory(state, { items, updatedAt }) {
  const details = {}
  for (const order of items) {
    const previous = state.details[order.id]
    if (Array.isArray(order.items) && Array.isArray(order.promotions)) {
      details[order.id] = { data: order, updatedAt, loading: false, error: '', requestId: null }
    } else if (previous?.data && updatedAt - previous.updatedAt < ORDERS_CACHE_TTL
      && summaryFields.every(field => order[field] === previous.data[field])) {
      details[order.id] = { ...previous, loading: false, error: '', requestId: null }
    }
  }
  state.details = details
  state.history = { items, updatedAt, loading: false, error: '', requestId: null }
}

const ordersSlice = createSlice({
  name: 'orders',
  initialState: initialState(),
  reducers: {
    ordersSessionCleared: initialState,
    ordersConfirmed(state, action) {
      if (action.payload.ownerId == null) return
      ensureSession(state, action.payload)
      state.history = emptyHistory()
      const { order, updatedAt } = action.payload
      state.details = { [order.id]: { data: order, updatedAt, loading: false, error: '', requestId: null } }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchOrdersHistory.pending, (state, action) => {
        if (action.meta.arg.ownerId == null) return
        ensureSession(state, action.meta.arg)
        state.history.loading = true
        state.history.error = ''
        state.history.requestId = action.meta.requestId
      })
      .addCase(fetchOrdersHistory.fulfilled, (state, action) => {
        if (!sameSession(state, action.meta.arg)
          || state.history.requestId !== action.meta.requestId) return
        setHistory(state, action.payload)
      })
      .addCase(fetchOrdersHistory.rejected, (state, action) => {
        if (!sameSession(state, action.meta.arg)
          || state.history.requestId !== action.meta.requestId) return
        state.history.loading = false
        state.history.requestId = null
        if (!action.meta.aborted && !action.meta.condition) {
          state.history.error = 'No pudimos actualizar tus pedidos. ' + action.error.message
        }
      })
      .addCase(fetchOrderDetail.pending, (state, action) => {
        if (!sameSession(state, action.meta.arg)) return
        const { orderId } = action.meta.arg
        const previous = state.details[orderId]
        state.details[orderId] = { ...previous, data: previous?.data ?? null,
          loading: true, error: '', requestId: action.meta.requestId }
      })
      .addCase(fetchOrderDetail.fulfilled, (state, action) => {
        if (!sameSession(state, action.meta.arg)
          || state.details[action.meta.arg.orderId]?.requestId !== action.meta.requestId) return
        const { orderId, data, updatedAt } = action.payload
        state.details[orderId] = { data, updatedAt, loading: false, error: '', requestId: null }
      })
      .addCase(fetchOrderDetail.rejected, (state, action) => {
        if (!sameSession(state, action.meta.arg)
          || state.details[action.meta.arg.orderId]?.requestId !== action.meta.requestId) return
        const { orderId } = action.meta.arg
        const previous = state.details[orderId]
        state.details[orderId] = { ...previous, data: previous.data ?? null,
          loading: false, error: action.meta.aborted || action.meta.condition ? '' : action.error.message,
          requestId: null }
      })
  },
})

export const { ordersSessionCleared, ordersConfirmed } = ordersSlice.actions
export default ordersSlice.reducer
