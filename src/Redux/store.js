import { configureStore } from '@reduxjs/toolkit'
import catalogReducer from './catalogSlice.js'

// El store centraliza únicamente los estados migrados a Redux.
export const store = configureStore({
  reducer: {
    catalog: catalogReducer,
  },
})
