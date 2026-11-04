import { useCallback, useEffect, useRef } from 'react'
import { useDispatch, useSelector, useStore } from 'react-redux'
import {
  loadOwnAlbum, loadAlbumPurchases, addAlbumPurchase, addAlbumManual,
  moveAlbumCard, removeAlbumCard, changeAlbumVisibility,
  albumMutationErrorCleared,
} from '../Redux/albumSlice.js'

// Redux owns all remote data. This hook only coordinates view requests and form actions.
export default function useAlbum({ userId, onUnauthorized }) {
  const dispatch = useDispatch()
  const store = useStore()
  const mutationInFlight = useRef(false)
  const state = useSelector(s => s.album)

  useEffect(() => {
    if (!userId) return
    const own = dispatch(loadOwnAlbum({ ownerId: userId }))
    const purchases = dispatch(loadAlbumPurchases({ ownerId: userId }))
    for (const task of [own, purchases]) {
      task.unwrap().catch(error => {
        if (error?.status === 401) onUnauthorized?.()
      })
    }
    return () => { own.abort(); purchases.abort() }
  }, [dispatch, userId, onUnauthorized])

  const run = useCallback(async (action, { refreshPurchases = false } = {}) => {
    if (!userId || state.saving || mutationInFlight.current) return false
    mutationInFlight.current = true
    try {
      await dispatch(action).unwrap()
      // Como en la demo: el fulfilled ya actualizó el álbum, sin un nuevo GET.
      // El backend NO devuelve el orderItemId al quitar/reemplazar una carta,
      // por eso sólo en esos casos se vuelve a consultar el cupo de compras.
      const sameUser = () => store.getState().users?.user?.id === userId
        && store.getState().album.ownerId === userId
      if (!sameUser()) return false
      if (refreshPurchases) {
        try {
          await dispatch(loadAlbumPurchases({ ownerId: userId })).unwrap()
        } catch (error) {
          // La carta ya fue confirmada: un fallo de sincronización de compras
          // no debe presentarse como un fallo del POST/PATCH/DELETE.
          if (error?.status === 401) onUnauthorized?.()
        }
      }
      return sameUser()
    } catch (error) {
      if (error?.status === 401) onUnauthorized?.()
      return false
    } finally {
      mutationInFlight.current = false
    }
  }, [dispatch, store, userId, state.saving, onUnauthorized])

  const addPurchase = useCallback(args => run(addAlbumPurchase({ ...args, ownerId: userId })),
    [run, userId])
  const addManual = useCallback(args => run(addAlbumManual({ ...args, ownerId: userId })),
    [run, userId])
  const moveCard = useCallback(args => run(moveAlbumCard({ ...args, ownerId: userId }),
    { refreshPurchases: args.replaceExisting === true }), [run, userId])
  const removeCard = useCallback(cardId => run(removeAlbumCard({ cardId, ownerId: userId }),
    { refreshPurchases: true }), [run, userId])
  const setVisibility = useCallback(visibility => run(changeAlbumVisibility({ visibility, ownerId: userId })),
    [run, userId])

  const retry = useCallback(() => {
    if (!userId) return
    dispatch(loadOwnAlbum({ ownerId: userId }))
    dispatch(loadAlbumPurchases({ ownerId: userId }))
  }, [dispatch, userId])

  const clearError = useCallback(() => dispatch(albumMutationErrorCleared()), [dispatch])

  // Never render album data from account A while account B is being restored.
  const belongsToUser = state.ownerId === userId
  return { ...state,
    album: belongsToUser ? state.album : null,
    purchases: belongsToUser ? state.purchases : [],
    addPurchase, addManual, moveCard, removeCard, setVisibility, retry, clearError,
  }
}
