import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import axios from 'axios'
import { API_BASE_URL } from '../config/api.js'
import { normalizeCartError } from '../utils/cartErrors.js'

// Solo estado serializable del carrito. El token, los bloqueos síncronos,
// AbortController y las promesas permanecen en useCart/useSession.

// El JWT nunca forma parte de meta.arg, las acciones ni el estado serializado.
// useCart conserva el bloqueo sincrono y pasa el AbortSignal de la sesion.
// createAsyncThunk omite por defecto campos adicionales del Error, incluido
// `status`. Conservarlo es imprescindible para que useCart detecte HTTP 401
// al hacer .unwrap(), invalide el JWT y proteja la sesion.
const serializeCartError = (error) => ({
  name: typeof error?.name === 'string' ? error.name : 'Error',
  message: typeof error?.message === 'string' ? error.message : 'No se pudo actualizar el carrito.',
  ...(typeof error?.status === 'number' ? { status: error.status } : {}),
  ...(typeof error?.code === 'string' ? { code: error.code } : {}),
})

// Mantener el chequeo de contrato igual para los cuatro endpoints.
function validCart(data) {
  if (!data || !Array.isArray(data.items)) {
    throw new Error('El carrito recibido no tiene una lista de ítems.')
  }
  return data
}
function cartHeaders(extra) {
  const token = extra?.cartToken?.()
  if (!token) throw new Error('No hay una sesion activa para el carrito.')
  return { Authorization: 'Bearer ' + token }
}

export const fetchCart = createAsyncThunk('cart/fetch', async (_, { extra, signal }) => {
  const headers = cartHeaders(extra)
  const { data } = await axios.get(API_BASE_URL + '/carts', { headers, signal })
    .catch(error => { throw normalizeCartError(error, signal) })
  signal.throwIfAborted()
  return validCart(data)
}, { serializeError: serializeCartError })

export const addItemToCart = createAsyncThunk('cart/add',
  async ({ productId, quantity }, { extra, signal }) => {
    const headers = cartHeaders(extra)
    const { data } = await axios.post(
      API_BASE_URL + '/carts/items', { productId, quantity }, { headers, signal },
    ).catch(error => { throw normalizeCartError(error, signal) })
    signal.throwIfAborted()
    return validCart(data)
  }, { serializeError: serializeCartError })

export const changeCartItemQuantity = createAsyncThunk('cart/quantity',
  async ({ id, quantity }, { extra, signal }) => {
    const headers = cartHeaders(extra)
    const { data } = await axios.put(
      API_BASE_URL + '/carts/items/' + id, { quantity }, { headers, signal },
    ).catch(error => { throw normalizeCartError(error, signal) })
    signal.throwIfAborted()
    return validCart(data)
  }, { serializeError: serializeCartError })

export const deleteCartItem = createAsyncThunk('cart/delete',
  async ({ id }, { extra, signal }) => {
    const headers = cartHeaders(extra)
    const { data } = await axios.delete(API_BASE_URL + '/carts/items/' + id, { headers, signal })
      .catch(error => { throw normalizeCartError(error, signal) })
    signal.throwIfAborted()
    return validCart(data)
  }, { serializeError: serializeCartError })

const initialCart = () => ({
  ownerId: null,
  generation: null,
  cart: null,
  cartLoading: false,
  cartBusy: false,
  cartError: '',
  cartMessage: '',
  cartAttempt: 0,
  quantitySyncItemId: null,
})

const currentOwner = (state, action) => state.ownerId === action.payload.ownerId
  && state.generation === action.payload.generation

const sameRequest = (state, action) => state.ownerId === action.meta.arg.ownerId
  && state.generation === action.meta.arg.generation

const addCartRequestCases = (builder, thunk, { quantity = false, load = false } = {}) => {
  builder
    .addCase(thunk.pending, (state, action) => {
      if (!sameRequest(state, action)) return
      state.cartBusy = true
      if (load) state.cartLoading = true
      state.cartError = ''
    })
    .addCase(thunk.fulfilled, (state, action) => {
      if (!sameRequest(state, action)) return
      // El hook aplica la ultima cantidad confirmada, no una respuesta
      // intermedia de una cadena de PUT agrupados.
      if (!quantity) {
        state.cart = action.payload
        if (!load) state.cartMessage = 'Carrito actualizado.'
      }
      if (load) state.cartLoading = false
    })
    .addCase(thunk.rejected, (state, action) => {
      if (!sameRequest(state, action)) return
      if (!action.meta.aborted && !action.meta.condition) {
        state.cartError = action.error.message || 'No se pudo actualizar el carrito.'
      }
      if (load) state.cartLoading = false
    })
}

const cartSlice = createSlice({
  name: 'cart',
  initialState: initialCart(),
  reducers: {
    cartSessionCleared: initialCart,
    cartOperationStarted(state, action) {
      const { ownerId, generation, kind } = action.payload
      if (ownerId == null) return
      // Una sesión nueva, incluso del mismo usuario, no hereda estado privado.
      if (!currentOwner(state, action)) Object.assign(state, initialCart())
      state.ownerId = ownerId
      state.generation = generation
      state.cartBusy = true
      state.cartLoading = kind === 'load'
      state.cartError = ''
      state.cartMessage = ''
      state.quantitySyncItemId = null
    },
    cartReceived(state, action) {
      if (!currentOwner(state, action)) return
      state.cart = action.payload.cart
    },
    cartUpdated(state, action) {
      if (!currentOwner(state, action)) return
      state.cart = action.payload.cart
      state.cartMessage = 'Carrito actualizado.'
    },
    cartQuantityChanged(state, action) {
      if (!currentOwner(state, action) || !state.cart) return
      const { id, quantity } = action.payload
      const item = state.cart.items.find((entry) => entry.id === id)
      if (!item || quantity < 1) return
      item.quantity = quantity
      item.subtotal = item.unitPrice * quantity
      state.cart.subtotal = state.cart.items.reduce((sum, entry) => sum + entry.subtotal, 0)
    },
    cartQuantitySyncStarted(state, action) {
      if (!currentOwner(state, action)) return
      state.quantitySyncItemId = action.payload.id
    },
    cartOperationReleased(state, action) {
      if (!currentOwner(state, action)) return
      state.cartBusy = false
      state.cartLoading = false
      state.quantitySyncItemId = null
    },
    cartFailed(state, action) {
      if (!currentOwner(state, action)) return
      state.cartError = action.payload.message
    },
    cartRetryRequested(state, action) {
      if (!currentOwner(state, action)) return
      state.cartAttempt += 1
    },
    cartCheckoutCompleted(state, action) {
      if (!currentOwner(state, action) || !state.cart) return
      state.cart.items = []
      state.cart.subtotal = 0
    },
  },
  extraReducers: (builder) => {
    addCartRequestCases(builder, fetchCart, { load: true })
    addCartRequestCases(builder, addItemToCart)
    addCartRequestCases(builder, changeCartItemQuantity, { quantity: true })
    addCartRequestCases(builder, deleteCartItem)
  },
})

export const {
  cartSessionCleared, cartOperationStarted, cartReceived, cartUpdated,
  cartQuantityChanged, cartQuantitySyncStarted, cartOperationReleased,
  cartFailed, cartRetryRequested, cartCheckoutCompleted,
} = cartSlice.actions

export default cartSlice.reducer
