import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { loadPublicAlbum, publicAlbumCleared } from '../Redux/albumSlice.js'

// Redux is the only owner of remote data; this hook only starts and cancels reading.
export default function usePublicAlbum({ ownerId, viewerId, onUnauthorized }) {
  const dispatch = useDispatch()
  const view = useSelector(state => state.album.publicView)
  const validOwner = Number.isSafeInteger(ownerId) && ownerId > 0
  const validViewer = Number.isSafeInteger(viewerId) && viewerId > 0

  useEffect(() => {
    if (!validOwner || !validViewer || ownerId === viewerId) return
    const task = dispatch(loadPublicAlbum({ ownerId, viewerId }))
    task.unwrap().catch(error => {
      if (error?.status === 401) onUnauthorized?.()
    })
    return () => {
      task.abort()
      dispatch(publicAlbumCleared())
    }
  }, [dispatch, ownerId, viewerId, validOwner, validViewer, onUnauthorized])

  const sameScope = view.ownerId === ownerId && view.viewerId === viewerId
  const retry = () => {
    if (validOwner && validViewer && ownerId !== viewerId) {
      dispatch(loadPublicAlbum({ ownerId, viewerId })).unwrap().catch(error => {
        if (error?.status === 401) onUnauthorized?.()
      })
    }
  }
  return {
    album: sameScope ? view.album : null,
    loading: sameScope ? view.loading : validOwner && validViewer,
    error: sameScope ? view.error : '',
    retry,
  }
}
