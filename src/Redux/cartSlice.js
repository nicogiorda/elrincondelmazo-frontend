import { createSlice } from '@reduxjs/toolkit'

// Solo estado serializable del carrito. El token, los bloqueos síncronos,
// AbortController y las promesas permanecen en useCart/useSession.
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
})

export const {
  cartSessionCleared, cartOperationStarted, cartReceived, cartUpdated,
  cartQuantityChanged, cartQuantitySyncStarted, cartOperationReleased,
  cartFailed, cartRetryRequested, cartCheckoutCompleted,
} = cartSlice.actions

export default cartSlice.reducer
