
import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useMatch, useNavigate } from 'react-router-dom'
import Home from './views/Home.jsx'
import Login from './views/Login.jsx'
import Register from './views/Register.jsx'
import Promotions from './views/Promotions.jsx'
import PromotionEditor from './views/PromotionEditor.jsx'
import Catalog from './views/Catalog.jsx'
import ProductDetail from './views/ProductDetail.jsx'
import Publications from './views/Publications.jsx'
import PublishProduct from './views/PublishProduct.jsx'
import Orders from './views/Orders.jsx'
import Profile from './views/Profile.jsx'
import Cart from './views/Cart.jsx'
import Checkout from './views/Checkout.jsx'
import OrderConfirmation from './views/OrderConfirmation.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import PurchaseNotice from './components/PurchaseNotice.jsx'

const emptyCatalogFilters = { search: '', type: '', collection: '', minPrice: '', maxPrice: '', page: 0 }
const URL = 'http://localhost:8080'

const promotionTypes = {
  quantity: 'CANTIDAD',
  collection: 'COLECCION',
  type: 'TIPO_PRODUCTO',
  payment: 'METODO_PAGO',
  minimum: 'MONTO_MINIMO',
  product: 'PRODUCTO',
};

const frontendPromotionTypes = Object.fromEntries(
  Object.entries(promotionTypes).map(([key, value]) => [value, key])
);

function promotionFromBackend(promotion) {
  return {
    id: promotion.id,
    name: promotion.name,
    description: promotion.description ?? '',
    kind: frontendPromotionTypes[promotion.type],
    discount: Number(promotion.discountPercentage),
    minimumQuantity: promotion.minimumQuantity ?? 1,
    minimumAmount: Number(promotion.minimumAmount ?? 0),
    productType: promotion.productType ?? '',
    paymentMethod: promotion.paymentMethod ?? '',
    collectionId: promotion.collectionId ?? '',
    collectionName: promotion.collectionName ?? '',
    productId: promotion.productId ?? '',
    productName: promotion.productName ?? '',
    stackable: promotion.stackable,
    startDate: promotion.startDate ?? '',
    endDate: promotion.endDate ?? '',
    enabled: promotion.active,
  };
}

function promotionToBackend(promotion) {
  const kind = promotion.kind;
  if (kind === 'type' && !['CARTA', 'SOBRE', 'LOOTBOX'].includes(promotion.productType)) {
    throw new Error('Seleccioná un tipo de producto válido.');
  }

  return {
    name: promotion.name.trim(),
    description: promotion.description,
    type: promotionTypes[kind],
    discountPercentage: Number(promotion.discount),

    minimumQuantity: kind === 'quantity'
      ? Number(promotion.minimumQuantity) : null,

    minimumAmount: kind === 'minimum'
      ? Number(promotion.minimumAmount) : null,

    productType: ['type', 'quantity'].includes(kind)
      ? promotion.productType || null : null,

    paymentMethod: kind === 'payment'
      ? promotion.paymentMethod || null : null,

    collectionId: kind === 'collection'
      ? Number(promotion.collectionId) : null,

    productId: kind === 'product'
      ? Number(promotion.productId) : null,

    stackable: promotion.stackable,

    startDate: promotion.startDate.includes('T')
      ? promotion.startDate : `${promotion.startDate}T00:00:00`,

    endDate: promotion.endDate
      ? (promotion.endDate.includes('T') ? promotion.endDate : `${promotion.endDate}T23:59:59`)
      : null,
  };
}

// Solo interpreta respuestas; las requests y su estado siguen en App.
function readResponse(response) {
  return response.json().catch(() => ({})).then((data) => {
    if (!response.ok) {
      const error = new Error(response.status === 401
        ? 'Tu sesión venció. Volvé a ingresar.'
        : data.message || data.detail || 'No se pudo completar la operación (HTTP ' + response.status + ').')
      error.status = response.status
      throw error
    }
    return data
  })
}

function productIdFrom(value) {
  const text = String(value ?? '')
  return /^[1-9]\d*$/.test(text) && Number.isSafeInteger(Number(text)) ? Number(text) : null
}

function updateCartQuantity(cart, itemId, quantity) {
  const items = cart.items.map((item) => item.id === itemId? {...item, quantity, subtotal: item.unitPrice * quantity,} : item)
  return {
    ...cart, items, subtotal: items.reduce((total, item) => total + item.subtotal, 0),}
}

function App() {

  const navigate = useNavigate()
  const location = useLocation()
  const productRoute = useMatch('/producto/:id')
  const selectedProductId = productIdFrom(productRoute?.params.id)
  const legacyProductId = productIdFrom(location.state?.product?.id)
  // Reutiliza exactamente el token que guardan Login y Register del compañero.
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('token')))
  const [sessionError, setSessionError] = useState('')
  const [deactivateError, setDeactivateError] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  // Perfil y desactivación no pueden enviar operaciones simultáneas sobre la cuenta.
  const accountRequest = useRef(false)
  const sessionRequested = useRef(false)
  const sessionVersion = useRef(0)
  const [cart, setCart] = useState(null)
  const [cartLoading, setCartLoading] = useState(false)
  const [cartBusy, setCartBusy] = useState(false)
  const [cartError, setCartError] = useState('')
  const [cartMessage, setCartMessage] = useState('')
  const [cartAttempt, setCartAttempt] = useState(0)
  const cartRequested = useRef(null)
  const cartRequest = useRef(false)
  const quantitySync = useRef(null)
  const [quantitySyncItemId, setQuantitySyncItemId] = useState(null)
  const cartMetadataRequests = useRef(new Map())
  const [cartMetadata, setCartMetadata] = useState({})
  const reviewRequest = useRef(false)
  const [confirmedOrder, setConfirmedOrder] = useState(null)
  const [orderDetails, setOrderDetails] = useState({})
  const [ownPublications, setOwnPublications] = useState({ userId: null, items: [], loading: false, error: '' })
  const [publicationAttempt, setPublicationAttempt] = useState(0)
  const [publicationBusyId, setPublicationBusyId] = useState(null)
  const [publicationError, setPublicationError] = useState('')
  const needsPublications = location.pathname === '/mis-publicaciones'
    || (location.pathname === '/publicar' && Boolean(location.state?.product?.id))

  const [promotions, setPromotions] = useState([])
  const [promotionLoading, setPromotionLoading] = useState(false)
  const [promotionError, setPromotionError] = useState('')

  // La misma función se usa desde botones y desde requests que reciben 401.
  const logout = useCallback(() => {
    sessionVersion.current += 1
    accountRequest.current = false
    setProfileSaving(false)
    setDeactivating(false)
    setDeactivateError('')
    cartMetadataRequests.current.forEach((request) => request.controller.abort())
    cartMetadataRequests.current.clear()
    setCartMetadata({})
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    setCart(null)
    setConfirmedOrder(null)
    setOrderDetails({})
    setOwnPublications({ userId: null, items: [], loading: false, error: '' })
    setPublicationBusyId(null)
    setPublicationError('')
    setCartError('')
    setCartMessage('')
    setCartLoading(false)
    setCartBusy(false)
    setPromotions([])
    setPromotionError('')
    setPromotionLoading(false)
    cartRequested.current = null
    cartRequest.current = false
    quantitySync.current = null
    setQuantitySyncItemId(null)
    reviewRequest.current = false
    navigate('/ingresar', { replace: true })
  }, [navigate])

  useEffect(() => {
    if (sessionRequested.current) return
    sessionRequested.current = true
    const savedToken = localStorage.getItem('token')
    if (!savedToken) return
    const version = sessionVersion.current
    fetch(URL + '/users/me', { headers: { Authorization: 'Bearer ' + savedToken } })
      .then(readResponse)
      .then((usuario) => {
        if (version === sessionVersion.current) setUser(usuario)
      })
      .catch((error) => {
        if (version !== sessionVersion.current) return
        if (error.status === 401 || error.status === 403) logout()
        setSessionError(error.message)
      })
      .finally(() => {
        if (version === sessionVersion.current || !localStorage.getItem('token')) setLoading(false)
      })
  }, [logout])

  useEffect(() => {
    if (!user?.id || !token) return
    const version = sessionVersion.current
    const requestKey = version + ':' + cartAttempt
    if (cartRequested.current === requestKey) return
    cartRequested.current = requestKey
    cartRequest.current = true
    setCartLoading(true)
    setCartBusy(true)
    setCartError('')
    fetch(URL + '/carts', { headers: { Authorization: 'Bearer ' + token } })
      .then(readResponse)
      .then((data) => {
        if (!Array.isArray(data.items)) throw new Error('El carrito recibido no tiene una lista de ítems.')
        if (version === sessionVersion.current) setCart(data)
      })
      .catch((error) => {
        if (version !== sessionVersion.current) return
        if (error.status === 401) {
          logout()
          setSessionError(error.message)
        } else setCartError(error.message)
      })
      .finally(() => {
        if (version !== sessionVersion.current) return
        cartRequest.current = false
        setCartLoading(false)
        setCartBusy(false)
      })
  }, [user?.id, token, cartAttempt, logout])

  useEffect(() => {
    if (!needsPublications || !user?.id || !token) return
    let active = true
    const controller = new AbortController()
    const version = sessionVersion.current
    Promise.resolve().then(async () => {
      if (!active) return
      setOwnPublications((current) => ({
        userId: user.id, items: current.userId === user.id ? current.items : [], loading: true, error: '',
      }))
      try {
        const items = []
        let page = 0
        let totalPages
        do {
          const response = await fetch(URL + '/products/mine?page=' + page + '&size=20', {
            headers: { Authorization: 'Bearer ' + token }, signal: controller.signal,
          })
          const data = await readResponse(response)
          if (!active || version !== sessionVersion.current) return
          if (!Array.isArray(data.content) || !Number.isInteger(data.totalPages) || data.totalPages < 0
            || data.content.some((product) => product.sellerId !== user.id)) {
            throw new Error('La respuesta de publicaciones no contiene una página válida del usuario.')
          }
          items.push(...data.content)
          totalPages = data.totalPages
          page += 1
        } while (page < totalPages)
        if (active && version === sessionVersion.current) {
          setOwnPublications({ userId: user.id, items, loading: false, error: '' })
          setShop((current) => ({ ...current, products: [
            ...current.products.filter((product) => product.sellerId !== user.id),
            ...items.filter((product) => ['ACTIVO', 'AGOTADO'].includes(product.status)),
          ] }))
        }
      } catch (error) {
        if (!active || version !== sessionVersion.current) return
        if (error.status === 401) {
          logout()
          setSessionError(error.message)
        } else {
          setOwnPublications((current) => ({ ...current, loading: false, error: error.status === 403
            ? 'No tenés permiso para consultar tus publicaciones.' : error.message }))
        }
      }
    })
    return () => { active = false; controller.abort() }
  }, [needsPublications, user?.id, token, publicationAttempt, logout])

  // El catálogo público empieza vacío.
  const [shop, setShop] = useState(() => ({
    products: [],
  }))
  const [collections, setCollections] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [collectionsLoading, setCollectionsLoading] = useState(true)
  const [productsError, setProductsError] = useState('')
  const [collectionsError, setCollectionsError] = useState('')
  // Estas marcas evitan duplicar los GET incluso con StrictMode en desarrollo.
  const productsRequestVersion = useRef(0)
  const [productsAttempt, setProductsAttempt] = useState(0)
  const collectionsRequested = useRef(false)

  useEffect(() => {
    let active = true
    const version = ++productsRequestVersion.current
    const controller = new AbortController()
    Promise.resolve().then(async () => {
      if (!active) return
      try {
        setProductsLoading(true)
        const response = await fetch(URL + '/products?size=100', { signal: controller.signal })
        if (!response.ok) throw new Error('Error al cargar productos')
        const data = await response.json()
        if (!active || version !== productsRequestVersion.current) return
        if (!Array.isArray(data.content)) throw new Error('La respuesta de productos no contiene una lista')
        setShop((current) => ({ ...current, products: [
          // La carga general no pisa metadata obtenida o actualizada mientras esperaba.
          ...data.content.map((product) => current.products.find((item) => item.id === product.id) ?? product),
          ...current.products.filter((product) => !data.content.some((item) => item.id === product.id)),
        ] }))
        setProductsError('')
      } catch {
        if (active && version === productsRequestVersion.current) {
          setProductsError('No pudimos cargar los productos. Recargá la página para reintentar.')
        }
      } finally {
        if (active && version === productsRequestVersion.current) setProductsLoading(false)
      }
    })
    return () => { active = false; controller.abort() }
  }, [productsAttempt])

  useEffect(() => {
    if (collectionsRequested.current) return
    collectionsRequested.current = true
    fetch(`${URL}/collections`)
      .then((response) => {
        if (!response.ok) throw new Error(`Error ${response.status} al cargar colecciones`)
        return response.json()
      })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('La respuesta de colecciones no es una lista')
        setCollections(data)
      })
      .catch((error) => {
        console.log(error)
        setCollectionsError('No pudimos cargar las colecciones. Recargá la página para reintentar.')
      })
      .finally(() => setCollectionsLoading(false))
  }, [])

  const catalogCollections = [
    { value: '', label: 'Todas' },
    ...collections.map((collection) => ({
      value: String(collection.id),
      label: collection.name,
    })),
  ]
  const products = shop.products
  // La metadata es pública; las requests y sus errores pertenecen a esta sesión.
  // Esperamos la carga inicial para no pedir otra vez los productos que ya trae.
  useEffect(() => {
    if (!user?.id || !token || !cart || productsLoading) return
    const version = sessionVersion.current
    const productVersion = productsRequestVersion.current
    const missingIds = new Set(cart.items.filter((item) => !products.some((product) => product.id === item.productId))
      .map((item) => item.productId).filter((id) => !productRoute || selectedProductId !== id))
    missingIds.forEach((id) => {
      if (cartMetadataRequests.current.has(id)) return
      const request = { controller: new AbortController() }
      cartMetadataRequests.current.set(id, request)
      const isCurrent = () => version === sessionVersion.current && cartMetadataRequests.current.get(id) === request
      Promise.resolve().then(async () => {
        if (!isCurrent()) return
        setCartMetadata((current) => ({ ...current, [id]: { loading: true } }))
        try {
          request.promise = fetch(URL + '/products/' + id, { signal: request.controller.signal }).then(readResponse)
          const product = await request.promise
          if (product.id !== id) throw new Error('El producto recibido no coincide con el del carrito.')
          if (!isCurrent()) return
          if (productVersion !== productsRequestVersion.current) {
            cartMetadataRequests.current.delete(id)
            setCartMetadata((current) => ({ ...current, [id]: undefined }))
            return
          }
          // Completar ausentes nunca reemplaza una publicación actualizada mientras esperábamos.
          setShop((current) => !isCurrent() || current.products.some((item) => item.id === id)
            ? current : { ...current, products: [...current.products, product] })
          setCartMetadata((current) => ({ ...current, [id]: { loading: false } }))
        } catch (error) {
          if (!isCurrent()) return
          request.failed = true
          setCartMetadata((current) => ({ ...current, [id]: { loading: false, error: error.status === 404 || error.status === 403
            ? 'Este producto ya no está disponible. Podés quitarlo del carrito.'
            : 'No pudimos confirmar la disponibilidad de este producto.' } }))
        }
      })
    })
  }, [cart, products, productsLoading, user?.id, token, cartAttempt, cartMetadata, productRoute, selectedProductId])

  useEffect(() => () => {
    cartMetadataRequests.current.forEach((request) => request.controller.abort())
    cartMetadataRequests.current.clear()
  }, [])

  const publications = ownPublications.userId === user?.id ? ownPublications.items : []
  const publicationsLoading = ownPublications.loading || (needsPublications && ownPublications.userId !== user?.id)

  useEffect(() => {
    if (user?.role !== 'ADMIN' || !token) return;
    let cancelled = false;
    const version = sessionVersion.current;

    async function loadPromotions() {
      setPromotionLoading(true);
      setPromotionError('');
      try {
        const response = await fetch(URL + '/promotions', {
          headers: { Authorization: 'Bearer ' + token },
        });
        const data = await readResponse(response);
        if (!cancelled && version === sessionVersion.current && token === localStorage.getItem('token')) {
          setPromotions(data.map(promotionFromBackend));
        }
      } catch (error) {
        if (cancelled || version !== sessionVersion.current || token !== localStorage.getItem('token')) return;
        if (error.status === 401) {
          logout();
          setSessionError(error.message);
        } else setPromotionError(error.message);
      } finally {
        if (!cancelled && version === sessionVersion.current && token === localStorage.getItem('token')) {
          setPromotionLoading(false);
        }
      }
    }
    loadPromotions();
    return () => { cancelled = true; };
  }, [user?.id, user?.role, token, logout]);

  const [reviewsByProduct, setReviewsByProduct] = useState({})
  const [reviewErrors, setReviewErrors] = useState({})
  const [reviewAttempt, setReviewAttempt] = useState(0)
  const requestedReviews = useRef(new Set())
  const [catalogFilters, setCatalogFilters] = useState(emptyCatalogFilters)
  const [catalogFiltersByLocation, setCatalogFiltersByLocation] = useState({})
  const [catalogLocationKey, setCatalogLocationKey] = useState(null)

  // Una entrada existente recupera su propia copia; una nueva parte de su selección o de los últimos filtros.
  if (location.pathname === '/catalogo' && catalogLocationKey !== location.key) {
    const selection = location.state
    const hasSelection = selection?.type !== undefined || selection?.collectionId !== undefined
    const initialFilters = selection?.resetFilters ? emptyCatalogFilters : hasSelection ? {
      ...emptyCatalogFilters,
      type: selection.type ?? '',
      collection: String(selection.collectionId ?? ''),
    } : catalogFilters
    const restoredFilters = catalogFiltersByLocation[location.key] ?? initialFilters

    setCatalogLocationKey(location.key)
    setCatalogFilters(restoredFilters)
    setCatalogFiltersByLocation({ ...catalogFiltersByLocation, [location.key]: restoredFilters })
  }

  function changeCatalogFilters(filters) {
    setCatalogFilters(filters)
    setCatalogFiltersByLocation((current) => ({ ...current, [location.key]: filters }))
  }
  const currentUser = user
  const isAdmin = user?.role === 'ADMIN'
  const selectedPromotion = promotions.find((promotion) => promotion.id === location.state?.promotion?.id)
  const items = cart?.items ?? []
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const publicProducts = products.filter((product) => ['ACTIVO', 'AGOTADO'].includes(product.status))
  const recentProducts = publicProducts.filter((product) => product.status === 'ACTIVO')
    .slice().sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, 4)
  const [detailRequest, setDetailRequest] = useState(null)
  const [detailAttempt, setDetailAttempt] = useState(0)
  const detailKey = selectedProductId + ':' + detailAttempt
  const currentDetailRequest = detailRequest?.key === detailKey ? detailRequest : null
  const knownProduct = products.find((product) => product.id === selectedProductId)
  const selectedProduct = !currentDetailRequest?.notFound && knownProduct && ['ACTIVO', 'AGOTADO'].includes(knownProduct.status)
    ? knownProduct : undefined
  const needsDetail = Boolean(productRoute && selectedProductId && !knownProduct && !currentDetailRequest)

  useEffect(() => {
    if (!needsDetail) return
    let active = true
    const controller = new AbortController()
    const version = productsRequestVersion.current
    Promise.resolve().then(async () => {
      if (!active) return
      try {
        const pendingMetadata = cartMetadataRequests.current.get(selectedProductId)
        const product = await (pendingMetadata && !pendingMetadata.failed && pendingMetadata.promise
          ? pendingMetadata.promise
          : fetch(URL + '/products/' + selectedProductId, { signal: controller.signal }).then(readResponse))
        if (!active) return
        if (version !== productsRequestVersion.current) {
          setDetailAttempt((current) => current + 1)
          return
        }
        if (product.id !== selectedProductId) throw new Error('El producto recibido no coincide con el seleccionado.')
        if (!['ACTIVO', 'AGOTADO'].includes(product.status)) {
          setDetailRequest({ key: detailKey, notFound: true })
          return
        }
        setShop((current) => current.products.some((item) => item.id === product.id)
          ? current : { ...current, products: [...current.products, product] })
      } catch (error) {
        if (!active) return
        if (version !== productsRequestVersion.current) {
          setDetailAttempt((current) => current + 1)
          return
        }
        setDetailRequest(error.status === 404
          ? { key: detailKey, notFound: true } : { key: detailKey, error: error.message })
      }
    })
    return () => { active = false; controller.abort() }
  }, [needsDetail, selectedProductId, detailKey])

  const reviewProductId = productRoute ? selectedProduct?.id : undefined

  useEffect(() => {
    if (reviewProductId === undefined || requestedReviews.current.has(reviewProductId)) return
    // Registrar antes del fetch evita duplicados si salimos y volvemos mientras carga.
    requestedReviews.current.add(reviewProductId)
    fetch(`${URL}/products/${reviewProductId}/reviews`)
      .then((response) => {
        if (!response.ok) throw new Error(`Error ${response.status} al cargar reseñas`)
        return response.json()
      })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('La respuesta de reseñas no es una lista')
        setReviewsByProduct((current) => ({ ...current, [reviewProductId]: data }))
      })
      .catch((error) => {
        console.log(error)
        setReviewErrors((current) => ({ ...current, [reviewProductId]: 'No pudimos cargar las reseñas.' }))
      })
  }, [reviewProductId, reviewAttempt])

  function retryReviews() {
    if (!reviewErrors[reviewProductId]) return
    requestedReviews.current.delete(reviewProductId)
    setReviewErrors((current) => ({ ...current, [reviewProductId]: '' }))
    setReviewAttempt((current) => current + 1)
  }

  const editingPublication = publications.find((product) => product.id === location.state?.product?.id)

  function openProduct(product) {
    // Una tarjeta puede venir de una página que no forma parte de la carga inicial.
    refreshPendingCatalog()
    setShop((current) => current.products.some((item) => item.id === product.id)
      ? current : { ...current, products: [...current.products, product] })
    navigate('/producto/' + product.id)
  }
  // Solo ocultamos duplicados conocidos. Spring decide si hubo compra previa.
  function canReview(product) {
    return Boolean(user && reviewsByProduct[product.id]
      && !reviewsByProduct[product.id].some((review) => review.userId === user.id))
  }

  function changeCart(method, path, body) {
    if (!user || !token) {
      navigate('/ingresar')
      return Promise.resolve(false)
    }
    if (cartRequest.current || !cart) return Promise.resolve(false)
    const version = sessionVersion.current
    cartRequest.current = true
    setCartBusy(true)
    setCartError('')
    setCartMessage('')
    return fetch(URL + path, {
      method,
      headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
      .then(readResponse)
      .then((data) => {
        if (version !== sessionVersion.current) return false
        if (!Array.isArray(data.items)) throw new Error('El carrito recibido no tiene una lista de ítems.')
        setCart(data)
        setCartMessage('Carrito actualizado.')
        return true
      })
      .catch((error) => {
        if (version !== sessionVersion.current) return false
        if (error.status === 401) {
          logout()
          setSessionError(error.message)
        } else setCartError(error.message)
        return false
      })
      .finally(() => {
        if (version !== sessionVersion.current) return
        cartRequest.current = false
        setCartBusy(false)
      })
  }

  function addToCart(product, quantity = 1) {
    if (user && token && cart && !cartRequest.current) {
      refreshPendingCatalog()
      setShop((current) => current.products.some((item) => item.id === product.id)
        ? current : { ...current, products: [...current.products, product] })
    }
    return changeCart('POST', '/carts/items', { productId: product.id, quantity })
  }

  async function syncCartQuantity(sync) {
    const version = sessionVersion.current
    const savedToken = token
    let confirmedCart = sync.originalCart

    try {
      while (version === sessionVersion.current) {
        const quantity = sync.desiredQuantity

        const response = await fetch(
          URL + '/carts/items/' + sync.id,
          {
            method: 'PUT',
            headers: {
              Authorization: 'Bearer ' + savedToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ quantity }),
          })

          const data = await readResponse(response)

          if (version !== sessionVersion.current) return false
          if (!Array.isArray(data.items)) {
            throw new Error('El servidor devolvió un carrito inválido.')
          }

          confirmedCart = data

          if (sync.desiredQuantity !== quantity) continue

          setCart(data)
          setCartMessage('Carrito actualizado.')
          return true
        }

        return false
      } catch (error) {
        if (version !== sessionVersion.current) return false

        setCart(confirmedCart)

        if (error.status === 401) {
          logout()
          setSessionError(error.message)
        } else {
          setCartError(error instanceof TypeError ? 'No pudimos conectar con el servidor. Recuperamos la última cantidad guardada.' : error.message)
        }

        return false
      } finally {
        if (
          version === sessionVersion.current &&
          quantitySync.current === sync
        ) {
          quantitySync.current = null
          cartRequest.current = false
          setQuantitySyncItemId(null)
          setCartBusy(false)
        }
      }
  }


  function changeQuantity(id, quantity) {
    if (!user || !token || !cart || quantity < 1) {return Promise.resolve(false)}

    const sync = quantitySync.current

    if (cartRequest.current && (!sync || sync.id !== id)) {return Promise.resolve(false)}

    const item = cart.items.find((item) => item.id === id)
    const product = products.find((product) => product.id === item?.productId)

    if (!item || !product || (quantity > item.quantity && quantity > product.stock)) {return Promise.resolve(false)}

    setCart(updateCartQuantity(cart, id, quantity))

    if (sync) {
      sync.desiredQuantity = quantity
      return sync.promise
    }

    const request = {id, desiredQuantity: quantity, originalCart: cart, promise: null}

    quantitySync.current = request
    cartRequest.current = true
    setCartBusy(true)
    setQuantitySyncItemId(id)
    setCartError('')
    setCartMessage('')

    request.promise = syncCartQuantity(request)
    return request.promise
  }

  function removeItem(id) {
    return changeCart('DELETE', '/carts/items/' + id)
  }
  function buyNow(product, quantity) {
    return addToCart(product, quantity).then((saved) => {
      if (saved) navigate('/carrito')
      return saved
    })
  }
  function retryCart() {
    if (cartRequest.current) return
    cartMetadataRequests.current.forEach((request, id) => {
      if (request.failed) cartMetadataRequests.current.delete(id)
    })
    setCartMetadata({})
    setCartAttempt((attempt) => attempt + 1)
  }

  function confirmOrder({ paymentMethod }) {
    if (!user || !token || !cart?.items.length || cartRequest.current) {
      return Promise.reject(new Error('Revisá el carrito antes de confirmar.'))
    }
    const version = sessionVersion.current
    cartRequest.current = true
    setCartBusy(true)
    setCartError('')
    setCartMessage('')
    return fetch(URL + '/orders', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod }),
    })
      .then(readResponse)
      .then((order) => {
        if (version !== sessionVersion.current) throw new Error('La sesión cambió.')
        if (!order.id || !Array.isArray(order.items) || !Array.isArray(order.promotions)) {
          throw new Error('La respuesta no contiene el detalle del pedido. Revisá tus pedidos antes de reintentar.')
        }
        setConfirmedOrder(order)
        refreshPendingCatalog()
        // El service vacía el carrito. Ajustamos la copia local con las cantidades confirmadas.
        setCart((current) => ({ ...current, items: [], subtotal: 0 }))
        setShop((current) => ({ ...current, products: current.products.map((product) => {
          const purchased = order.items.find((item) => item.productId === product.id)
          if (!purchased) return product
          const stock = Math.max(0, product.stock - purchased.quantity)
          return { ...product, stock, status: stock === 0 ? 'AGOTADO' : product.status }
        }) }))
        navigate('/pedido-confirmado')
        return order
      })
      .catch((error) => {
        if (version === sessionVersion.current && error.status === 401) {
          logout()
          setSessionError(error.message)
        }
        throw error
      })
      .finally(() => {
        if (version !== sessionVersion.current) return
        cartRequest.current = false
        setCartBusy(false)
      })
  }

  function publishReview(product, { rating, comment }) {
    if (!user || !token || reviewRequest.current) return Promise.reject(new Error('Ingresá o esperá a que termine el envío.'))
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !comment.trim() || comment.length > 1000) {
      return Promise.reject(new Error('Revisá la puntuación y el comentario.'))
    }
    const version = sessionVersion.current
    reviewRequest.current = true
    return fetch(URL + '/products/' + product.id + '/reviews', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating, comment: comment.trim() }),
    })
      .then(readResponse)
      .then((review) => {
        if (version !== sessionVersion.current) throw new Error('La sesión cambió.')
        if (!review.id || review.productId !== product.id) throw new Error('La respuesta no contiene la reseña esperada.')
        setReviewsByProduct((current) => ({
          ...current,
          [product.id]: [review, ...(current[product.id] ?? []).filter((item) => item.id !== review.id)],
        }))
        return true
      })
      .catch((error) => {
        if (version === sessionVersion.current && error.status === 401) {
          logout()
          setSessionError(error.message)
        }
        throw error
      })
      .finally(() => {
        if (version === sessionVersion.current) reviewRequest.current = false
      })
  }
  function loadOrderDetail(orderId) {
    if (!user || !token || orderDetails[orderId]?.data || orderDetails[orderId]?.loading) return
    const version = sessionVersion.current
    setOrderDetails((current) => ({ ...current, [orderId]: { loading: true, error: '', data: null } }))
    fetch(URL + '/orders/' + orderId, { headers: { Authorization: 'Bearer ' + token } })
      .then(readResponse)
      .then((data) => {
        if (data.id !== orderId || !Array.isArray(data.items)) throw new Error('El detalle recibido no corresponde al pedido.')
        if (version === sessionVersion.current) {
          setOrderDetails((current) => ({ ...current, [orderId]: { loading: false, error: '', data } }))
        }
      })
      .catch((error) => {
        if (version !== sessionVersion.current) return
        if (error.status === 401) {
          logout()
          setSessionError(error.message)
        } else {
          setOrderDetails((current) => ({ ...current, [orderId]: { loading: false, error: error.message, data: null } }))
        }
      })
  }
  async function uploadProductPhoto(file) {
    if (!user || !token) throw new Error('Ingresá para subir fotografías.')
    const version = sessionVersion.current
    const body = new FormData()
    body.append('file', file)
    try {
      const response = await fetch(URL + '/products/images', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }, body,
      })
      const data = await readResponse(response)
      if (version !== sessionVersion.current) throw new Error('La sesión cambió.')
      if (typeof data.url !== 'string' || !/^https?:\/\//.test(data.url)) throw new Error('La subida no devolvió una URL de imagen válida.')
      return data.url
    } catch (error) {
      if (version === sessionVersion.current && error.status === 401) {
        logout()
        setSessionError(error.message)
      }
      throw error
    }
  }
  async function publishProduct(request, productId) {
    if (!user || !token) throw new Error('Ingresá para guardar la publicación.')
    const version = sessionVersion.current
    try {
      const response = await fetch(URL + '/products' + (productId == null ? '' : '/' + productId), {
        method: productId == null ? 'POST' : 'PUT',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })
      const saved = await readResponse(response)
      if (version !== sessionVersion.current) throw new Error('La sesión cambió.')
      if (!saved.id || saved.sellerId !== user.id || (productId != null && saved.id !== productId)) throw new Error('La respuesta no contiene la publicación esperada.')
      syncPublication(saved)
      navigate('/mis-publicaciones')
    } catch (error) {
      if (version === sessionVersion.current && error.status === 401) {
        logout()
        setSessionError(error.message)
      }
      throw error
    }
  }
  async function saveProfile(form) {
    if (!user || !token) throw new Error('Ingresá para actualizar tu perfil.')
    if (accountRequest.current) return null
    const version = sessionVersion.current
    const savedToken = token
    const userId = user.id
    const previousEmail = user.email
    const isCurrent = () => version === sessionVersion.current && savedToken === localStorage.getItem('token')
    accountRequest.current = true
    setProfileSaving(true)
    try {
      const response = await fetch(URL + '/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + savedToken },
        body: JSON.stringify({ firstName: form.firstName, lastName: form.lastName, email: form.email }),
      })
      const updated = await readResponse(response)
      if (!isCurrent()) return null
      if (updated.id !== userId) throw new Error('El usuario recibido no coincide con tu cuenta.')
      if (updated.email !== previousEmail) {
        logout()
        return null
      }
      setUser((current) => isCurrent() && current?.id === userId ? updated : current)
      return updated
    } catch (error) {
      if (!isCurrent()) return null
      if (error.status === 401) {
        logout()
        setSessionError(error.message)
        return null
      }
      throw new Error(error instanceof TypeError ? 'No pudimos conectar con el servidor. Volvé a intentar.' : error.message, { cause: error })
    } finally {
      if (isCurrent()) {
        accountRequest.current = false
        setProfileSaving(false)
      }
    }
  }
  function startSession(usuario) {
    sessionVersion.current += 1
    accountRequest.current = false
    setProfileSaving(false)
    setDeactivating(false)
    setDeactivateError('')
    cartMetadataRequests.current.forEach((request) => request.controller.abort())
    cartMetadataRequests.current.clear()
    setCartMetadata({})
    cartRequested.current = null
    cartRequest.current = false
    quantitySync.current = null
    setQuantitySyncItemId(null)
    reviewRequest.current = false
    setCart(null)
    setConfirmedOrder(null)
    setOrderDetails({})
    setOwnPublications({ userId: null, items: [], loading: false, error: '' })
    setPublicationBusyId(null)
    setPublicationError('')
    setCartError('')
    setCartMessage('')
    setCartBusy(false)
    setCartLoading(false)
    setSessionError('')
    setPromotions([])
    setPromotionError('')
    setPromotionLoading(false)
    setToken(localStorage.getItem('token'))
    setUser(usuario)
    navigate('/mi-perfil', { replace: true })
  }

  async function savePromotion(promotion) {
    if (user?.role !== 'ADMIN' || !token) throw new Error('Ingresá con una cuenta administradora.');
    const version = sessionVersion.current;
    try {
      const editing = promotion.id != null;
      const response = await fetch(URL + '/promotions' + (editing ? '/' + promotion.id : ''), {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(promotionToBackend(promotion)),
      });
      const data = await readResponse(response);
      if (version !== sessionVersion.current || token !== localStorage.getItem('token')) return;
      const saved = promotionFromBackend(data);
      setPromotions((current) => editing
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [...current, saved]);
      navigate('/promociones');
    } catch (error) {
      if (version !== sessionVersion.current || token !== localStorage.getItem('token')) return;
      if (error.status === 401) {
        logout();
        setSessionError(error.message);
      }
      throw error;
    }
  }

  async function togglePromotion(promotion) {
    if (user?.role !== 'ADMIN' || !token) return;
    const version = sessionVersion.current;
    try {
      const action = promotion.enabled ? 'deactivate' : 'activate';
      const response = await fetch(URL + '/promotions/' + promotion.id + '/' + action, {
        method: 'PATCH', headers: { Authorization: 'Bearer ' + token },
      });
      const data = await readResponse(response);
      if (version !== sessionVersion.current || token !== localStorage.getItem('token')) return;
      const updated = promotionFromBackend(data);
      setPromotions((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      if (version !== sessionVersion.current || token !== localStorage.getItem('token')) return;
      if (error.status === 401) {
        logout();
        setSessionError(error.message);
      } else alert(error.message);
    }
  }

  async function deactivateAccount() {
    if (!user || !token || accountRequest.current) return
    const confirmado = window.confirm('¿Estás seguro de que deseás desactivar tu cuenta?')
    if (!confirmado) return
    const version = sessionVersion.current
    const savedToken = token
    const userId = user.id
    const isCurrent = () => version === sessionVersion.current && savedToken === localStorage.getItem('token')
    accountRequest.current = true
    setDeactivating(true)
    setDeactivateError('')
    try {
      const response = await fetch(URL + '/users/me/deactivate', {
        method: 'PUT', headers: { Authorization: 'Bearer ' + savedToken },
      })
      const updated = await readResponse(response)
      if (!isCurrent()) return
      if (updated.id !== userId || updated.active !== false) throw new Error('El servidor no confirmó la desactivación de tu cuenta.')
      logout()
    } catch (error) {
      if (!isCurrent()) return
      if (error.status === 401) {
        logout()
        setSessionError(error.message)
      } else setDeactivateError(error instanceof TypeError
        ? 'No pudimos conectar con el servidor. Volvé a intentar.' : error.message)
    } finally {
      if (isCurrent()) {
        accountRequest.current = false
        setDeactivating(false)
      }
    }
  }
  const shared = {
    cartCount, userId: user?.id, isLoggedIn: Boolean(user),
    cartBusy: cartBusy || Boolean(user && !cart), cartError, cartMessage,
  }
  const account = { ...shared, user: currentUser, onLogout: logout }
  function refreshPendingCatalog() {
    // Una respuesta iniciada antes del PATCH/POST/DELETE no puede deshacer su resultado.
    productsRequestVersion.current += 1
    if (productsLoading) {
      setProductsAttempt((current) => current + 1)
    }
  }
  function syncPublication(saved) {
    refreshPendingCatalog()
    const isPublic = ['ACTIVO', 'AGOTADO'].includes(saved.status)
    setOwnPublications((current) => ({ ...current, userId: user.id,
      items: [saved, ...current.items.filter((product) => product.id !== saved.id)]
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.id - a.id),
    }))
    setShop((current) => ({ ...current,
      products: !isPublic ? current.products.filter((product) => product.id !== saved.id)
        : current.products.some((product) => product.id === saved.id)
          ? current.products.map((product) => product.id === saved.id ? saved : product)
          : [...current.products, saved],
    }))
  }
  function retryPublications() {
    setPublicationError('')
    setPublicationAttempt((current) => current + 1)
  }
  async function changePublication(product, action) {
    if (!user || !token || publicationBusyId !== null || publicationsLoading || product.sellerId !== user.id) return
    if (action === 'delete' && !window.confirm('¿Querés eliminar esta publicación? Esta acción no se puede deshacer.')) return
    const version = sessionVersion.current
    setPublicationBusyId(product.id)
    setPublicationError('')
    try {
      const response = await fetch(URL + '/products/' + product.id + (action === 'delete' ? '' : '/' + action), {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        headers: { Authorization: 'Bearer ' + token },
      })
      if (action === 'delete') {
        if (response.status !== 204) {
          await readResponse(response)
          throw new Error('El servidor no confirmó la eliminación.')
        }
        if (version !== sessionVersion.current) return
        refreshPendingCatalog()
        setOwnPublications((current) => ({ ...current, items: current.items.filter((item) => item.id !== product.id) }))
        setShop((current) => ({ ...current, products: current.products.filter((item) => item.id !== product.id) }))
      } else {
        const saved = await readResponse(response)
        if (version !== sessionVersion.current) return
        if (saved.id !== product.id || saved.sellerId !== user.id) throw new Error('La respuesta no contiene la publicación esperada.')
        syncPublication(saved)
      }
    } catch (error) {
      if (version !== sessionVersion.current) return
      if (error.status === 401) {
        logout()
        setSessionError(error.message)
      } else {
        setPublicationError(error.status === 404
          ? 'La publicación ya no está disponible. Actualizá el listado.'
          : error.status === 403 ? 'No tenés permiso para modificar esta publicación.' : error.message)
      }
    } finally {
      if (version === sessionVersion.current) setPublicationBusyId(null)
    }
  }
  function togglePublication(product) {
    if (!['ACTIVO', 'INACTIVO'].includes(product.status)) return
    return changePublication(product, product.status === 'ACTIVO' ? 'pause' : 'resume')
  }

  if (loading) return <p role="status" className="p-8">Verificando sesión…</p>

  return (
    <>
    {sessionError && <p role="alert" className="p-4 font-bold text-rojo">{sessionError}</p>}
    <Routes>
      <Route path="/" element={
        <Home {...shared} cartItems={items} onAddToCart={addToCart} products={recentProducts} collections={collections} onOpenProduct={openProduct}
          productsLoading={productsLoading} productsError={productsError}
          collectionsLoading={collectionsLoading} collectionsError={collectionsError}
          onSelectCollection={(collection) => navigate('/catalogo', { state: { collectionId: collection.id } })} />
      } />
      <Route path="/catalogo" element={
                                 <Catalog
                                    {...shared}
                                    cartItems={items}
                                    onAddToCart={addToCart}
                                    collections={catalogCollections}
                                    collectionsError={collectionsError}
                                    filters={catalogFilters}
                                    onFiltersChange={changeCatalogFilters}
                                    onClearFilters={() => changeCatalogFilters(emptyCatalogFilters)}
                                    onOpenProduct={openProduct}
                                />
                              } />
      <Route path="/producto" element={legacyProductId
        ? <Navigate to={'/producto/' + legacyProductId} replace />
        : <PurchaseNotice {...shared} title="Producto no disponible" message="La URL del producto no es válida." />} />
      <Route path="/producto/:id" element={selectedProduct ? (
        <ProductDetail key={(user?.id ?? 'guest') + ':' + selectedProduct.id} {...shared}
          user={user} canReview={canReview} onPublishReview={publishReview}
          cartItems={items} cartQuantity={items.find((item) => item.productId === selectedProduct.id)?.quantity ?? 0}
          onAddToCart={addToCart} onBuyNow={buyNow} product={selectedProduct} products={publicProducts}
          reviews={reviewsByProduct[selectedProduct.id] ?? []}
          reviewsLoading={reviewsByProduct[selectedProduct.id] === undefined && !reviewErrors[selectedProduct.id]}
          reviewsError={reviewErrors[selectedProduct.id]} onRetryReviews={retryReviews}
          onOpenProduct={openProduct}
          onViewCollection={(collectionId) => navigate('/catalogo', { state: { collectionId } })} />
      ) : !selectedProductId ? (
        <PurchaseNotice {...shared} title="Producto no disponible" message="La URL del producto no es válida." />
      ) : !knownProduct && !currentDetailRequest && (productsLoading || needsDetail) ? (
        <PurchaseNotice {...shared} title="Detalle del producto" message="Cargando producto…" />
      ) : currentDetailRequest?.error ? (
        <PurchaseNotice {...shared} title="Detalle del producto" message={currentDetailRequest.error}
          onRetry={() => setDetailAttempt((current) => current + 1)} />
      ) : <PurchaseNotice {...shared} title="Producto no disponible" message="El producto no existe o ya no está disponible." />} />
      <Route path="/mis-publicaciones" element={<ProtectedRoute user={user}>
        <Publications {...account} products={publications} loading={publicationsLoading}
          error={ownPublications.error || publicationError} busyId={publicationBusyId} onRetry={retryPublications}
          onEdit={(product) => navigate('/publicar', { state: { product } })}
          onDelete={(product) => changePublication(product, 'delete')}
          onToggleStatus={togglePublication} />
      </ProtectedRoute>} />
      <Route path="/publicar" element={<ProtectedRoute user={user}>
        {location.state?.product && publicationsLoading ? <p role="status" className="p-8 font-bold">Cargando publicación…</p>
          : location.state?.product && ownPublications.error ? <div role="alert" className="p-8 font-bold"><p>{ownPublications.error}</p><button type="button" onClick={retryPublications} className="underline">Reintentar</button></div>
          : location.state?.product && !editingPublication ? <Navigate to="/mis-publicaciones" replace />
          : <PublishProduct key={(user?.id ?? '') + ':' + (editingPublication?.id ?? 'new')} {...account}
              product={editingPublication} collections={collections} collectionsLoading={collectionsLoading} collectionsError={collectionsError}
              onUploadPhoto={uploadProductPhoto} onPublish={(request) => publishProduct(request, editingPublication?.id)} />}
      </ProtectedRoute>} />
      <Route path="/mis-pedidos" element={<ProtectedRoute user={user}>
        <Orders key={user?.id + ':' + token} {...account} token={token} details={orderDetails}
          onLoadDetail={loadOrderDetail} onUnauthorized={logout} />
      </ProtectedRoute>} />
      <Route path="/mi-perfil" element={<ProtectedRoute user={user}>
        <Profile key={JSON.stringify(user)} {...account} onSave={saveProfile} saving={profileSaving}
          onDeactivate={deactivateAccount} deactivating={deactivating} deactivateError={deactivateError} />
      </ProtectedRoute>} />
      <Route path="/carrito" element={<ProtectedRoute user={user}>
        <Cart {...shared} cart={cart} products={products} metadata={cartMetadata} loading={cartLoading} onRetry={retryCart}
          quantitySyncItemId={quantitySyncItemId} onQuantityChange={changeQuantity} onRemove={removeItem} onCheckout={() => navigate('/checkout')} />
      </ProtectedRoute>} />
      <Route path="/checkout" element={<ProtectedRoute user={user}>
        <Checkout {...shared} cart={cart} products={products} loading={cartLoading}
          error={cartError} onRetry={retryCart} onConfirm={confirmOrder} />
      </ProtectedRoute>} />
      <Route path="/pedido-confirmado" element={<ProtectedRoute user={user}>
        <OrderConfirmation order={confirmedOrder} cartCount={cartCount} />
      </ProtectedRoute>} />
      <Route path="/ingresar" element={<Login {...shared} onLogin={startSession} />} />
      <Route path="/crear-cuenta" element={<Register {...shared} onRegister={startSession} />} />
      <Route path="/promociones" element={isAdmin ? (
        promotionLoading
          ? <p>Cargando promociones...</p>
          : promotionError
            ? <p role="alert">{promotionError}</p>
            : <Promotions
                {...account}
                promotions={promotions}
                onEdit={(promotion) =>
                  navigate('/editar-promocion', {
                    state: { promotion }
                  })
                }
                onToggle={togglePromotion}
              />
      ) : <Navigate to="/mi-perfil" replace />} />

      <Route path="/editar-promocion" element={isAdmin ? selectedPromotion
        ? <PromotionEditor key={selectedPromotion.id} {...account} promotion={selectedPromotion} onSave={savePromotion} />
        : <Navigate to="/promociones" replace /> : <Navigate to="/mi-perfil" replace />} />
      <Route path="/nueva-promocion" element={isAdmin
        ? <PromotionEditor key="new-promotion" {...account} isNew onSave={savePromotion} />
        : <Navigate to="/mi-perfil" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
export default App
