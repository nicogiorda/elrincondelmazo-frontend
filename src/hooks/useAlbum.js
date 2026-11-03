import { useCallback, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  loadOwnAlbum, loadAlbumPurchases, addAlbumPurchase, addAlbumManual,
  moveAlbumCard, removeAlbumCard, changeAlbumVisibility,
  albumMutationErrorCleared,
} from '../Redux/albumSlice.js'

// Redux owns all remote data. This hook only coordinates view requests and form actions.
export default function useAlbum({ userId, onUnauthorized }) {
  const dispatch = useDispatch()
  const state = useSelector(s => s.album)

  useEffect(() => {
    if (!userId) return
    const own = dispatch(loadOwnAlbum({ ownerId: userId }))
    const purchases = dispatch(loadAlbumPurchases({ ownerId: userId }))
    return () => { own.abort(); purchases.abort() }
  }, [dispatch, userId])

  const run = useCallback(async (action) => {
    if (!userId || state.saving) return false
    try {
      await dispatch(action).unwrap()
      // The backend returns the canonical page count and remaining purchase quota.
      const scope = { ownerId: userId }
      await Promise.all([
        dispatch(loadOwnAlbum(scope)).unwrap(),
        dispatch(loadAlbumPurchases(scope)).unwrap(),
      ])
      return true
    } catch (error) {
      if (error?.status === 401) onUnauthorized?.()
      return false
    }
  }, [dispatch, userId, state.saving, onUnauthorized])

  const addPurchase = useCallback(args => run(addAlbumPurchase({ ...args, ownerId: userId })),
    [run, userId])
  const addManual = useCallback(args => run(addAlbumManual({ ...args, ownerId: userId })),
    [run, userId])
  const moveCard = useCallback(args => run(moveAlbumCard({ ...args, ownerId: userId })),
    [run, userId])
  const removeCard = useCallback(cardId => run(removeAlbumCard({ cardId, ownerId: userId })),
    [run, userId])
  const setVisibility = useCallback(visibility => run(changeAlbumVisibility({ visibility, ownerId: userId })),
    [run, userId])

  const retry = useCallback(() => {
    if (!userId) return
    dispatch(loadOwnAlbum({ ownerId: userId }))
    dispatch(loadAlbumPurchases({ ownerId: userId }))
  }, [dispatch, userId])

  const clearError = useCallback(() => dispatch(albumMutationErrorCleared()), [dispatch])

  return { ...state, addPurchase, addManual, moveCard, removeCard, setVisibility, retry, clearError }
}
