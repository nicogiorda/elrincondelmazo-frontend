
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
import { invalidatePublicPromotions } from './services/publicPromotions.js'
import { API_BASE_URL as URL, readResponse } from './services/httpClient.js'
import useCart from './hooks/useCart.js'
import useCartMetadata from './hooks/useCartMetadata.js'
import useSession from './hooks/useSession.js'
import useCatalog from './hooks/useCatalog.js'
import useCheckout from './hooks/useCheckout.js'
import useOrders from './hooks/useOrders.js'
import { productIdFrom } from './utils/productId.js'

const publicationsCacheLifetime = 60_000

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

function App() {

  const navigate = useNavigate()
  const location = useLocation()
  const productRoute = useMatch('/producto/:id')
  const isProductRoute = Boolean(productRoute)
  const selectedProductId = productIdFrom(productRoute?.params.id)
  const legacyProductId = productIdFrom(location.state?.product?.id)
  const [deactivateError, setDeactivateError] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  // Perfil y desactivación no pueden enviar operaciones simultáneas sobre la cuenta.
  const accountRequest = useRef(false)
  const reviewRequest = useRef(false)
  const [ownPublications, setOwnPublications] = useState({ userId: null, items: [], loading: false, error: '' })
  const ownPublicationsStamp = useRef(null)
  const [publicationAttempt, setPublicationAttempt] = useState(0)
  const [publicationBusyId, setPublicationBusyId] = useState(null)
  const [publicationError, setPublicationError] = useState('')
  const needsPublications = location.pathname === '/mis-publicaciones'
    || (location.pathname === '/publicar' && Boolean(location.state?.product?.id))

  const [promotions, setPromotions] = useState([])
  const [promotionLoading, setPromotionLoading] = useState(true)
  const [promotionError, setPromotionError] = useState('')
  const promotionRequest = useRef(null)
  const [promotionAttempt, setPromotionAttempt] = useState(0)
  const needsPromotions = ['/promociones', '/editar-promocion', '/nueva-promocion'].includes(location.pathname)

  // Coordinación temporal de los dominios que todavía viven en App.
  const resetPrivateData = useCallback(() => {
    accountRequest.current = false
    setProfileSaving(false)
    setDeactivating(false)
    setDeactivateError('')
    ownPublicationsStamp.current = null
    setOwnPublications({ userId: null, items: [], loading: false, error: '' })
    setPublicationBusyId(null)
    setPublicationError('')
    setPromotions([])
    setPromotionError('')
    setPromotionLoading(false)
    reviewRequest.current = false
  }, [])

  const { user, token, loading, sessionError, setSessionError, setUser,
    login, register, logout, sessionVersion, sessionAbort, subscribeSessionChange } = useSession({ onSessionChange: resetPrivateData })

  const { products, cacheVersion, loadProductPage, loadProduct, recentProducts, productsLoading, productsError,
    collections, collectionsLoading, collectionsError, catalogCollections, catalogFilters, changeCatalogFilters,
    clearCatalogFilters, selectedProduct, knownProduct, needsDetail, currentDetailRequest, relatedProducts, retryDetail,
    refreshPendingCatalog, rememberProduct, upsertProduct, removeProduct, syncPublicProducts, subscribeInvalidation,
  } = useCatalog({ location, productId: selectedProductId, isProductRoute })

  useEffect(() => {
    if (!needsPublications || !user?.id || !token) return
    if (ownPublicationsStamp.current?.userId === user.id
      && Date.now() - ownPublicationsStamp.current.time < publicationsCacheLifetime) return
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
          ownPublicationsStamp.current = { userId: user.id, time: Date.now() }
          setOwnPublications({ userId: user.id, items, loading: false, error: '' })
          syncPublicProducts(user.id, items)
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
  }, [needsPublications, user?.id, token, publicationAttempt, logout, sessionVersion, setSessionError, syncPublicProducts])

  const { cart, items, cartCount, cartLoading, cartBusy, cartError, cartMessage,
    quantitySyncItemId, addToCart, changeQuantity, removeItem, retryCart: reloadCart,
    isCartPending, beginCheckout } = useCart({ user, token, sessionVersion, sessionAbort,
    subscribeSessionChange, logout, setSessionError, products, onProductAdded: rememberProduct,
    onLoginRequired: () => navigate('/ingresar') })
  const { metadata: cartMetadata, retryMetadata } = useCartMetadata({
    cart, products, userId: user?.id, token, sessionVersion, subscribeSessionChange,
    selectedProductId, loadProduct, subscribeInvalidation,
  })

  const { orderHistory, orderDetails, loadOrders, loadOrderDetail, recordConfirmedOrder } = useOrders({
    user, token, sessionVersion, sessionAbort, subscribeSessionChange, logout, setSessionError,
    active: location.pathname === '/mis-pedidos',
  })
  const checkout = useCheckout({ active: location.pathname === '/checkout', user, token, cart, cartBusy,
    isCartPending, beginCheckout, sessionVersion, sessionAbort, subscribeSessionChange, logout, setSessionError,
    onOrderConfirmed: recordConfirmedOrder, onCatalogInvalidated: refreshPendingCatalog,
    onConfirmed: () => navigate('/pedido-confirmado'),
  })

  const publications = ownPublications.userId === user?.id ? ownPublications.items : []
  const publicationsLoading = ownPublications.loading || (needsPublications && ownPublications.userId !== user?.id)

  useEffect(() => {
    if (user?.role !== 'ADMIN' || !token || !needsPromotions) return;
    let cancelled = false;
    const version = sessionVersion.current;

    async function loadPromotions() {
      if (cancelled) return;
      const key = `${version}:${user.id}:${token}:${promotionAttempt}`;
      let request = promotionRequest.current;
      if (request?.key !== key) {
        request = { key, applied: false, promise: fetch(URL + '/promotions', {
          signal: sessionAbort.current.signal,
          headers: { Authorization: 'Bearer ' + token },
        }).then(readResponse) };
        promotionRequest.current = request;
      }
      // Un cambio de ruta puede cambiar logout. Reutilizamos la solicitud en curso
      // y nunca sobrescribimos con su resultado antiguo una edición ya guardada.
      if (request.applied) return;
      setPromotionLoading(true);
      setPromotionError('');
      try {
        const data = await request.promise;
        if (!Array.isArray(data)) throw new Error('La respuesta de promociones no es una lista.');
        if (!cancelled && version === sessionVersion.current && token === localStorage.getItem('token')) {
          request.applied = true;
          setPromotions(data.map(promotionFromBackend));
        }
      } catch (error) {
        if (cancelled || version !== sessionVersion.current || token !== localStorage.getItem('token')) return;
        if (error.status === 401) {
          logout();
          setSessionError(error.message);
        } else {
          request.applied = true;
          setPromotionError(error.message);
        }
      } finally {
        if (!cancelled && version === sessionVersion.current && token === localStorage.getItem('token')) {
          setPromotionLoading(false);
        }
      }
    }
    Promise.resolve().then(loadPromotions);
    return () => { cancelled = true; };
  }, [user?.id, user?.role, token, logout, needsPromotions, promotionAttempt, sessionAbort, sessionVersion, setSessionError]);

  useEffect(() => {
    // Una respuesta pública anterior a un guardado no se reutiliza al volver a Home.
    invalidatePublicPromotions()
  }, [promotions])

  const [reviewsByProduct, setReviewsByProduct] = useState({})
  const [reviewErrors, setReviewErrors] = useState({})
  const [reviewAttempt, setReviewAttempt] = useState(0)
  const requestedReviews = useRef(new Set())
  const currentUser = user
  const isAdmin = user?.role === 'ADMIN'
  const selectedPromotion = promotions.find((promotion) => promotion.id === location.state?.promotion?.id)
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
    rememberProduct(product)
    navigate('/producto/' + product.id)
  }
  // Solo ocultamos duplicados conocidos. Spring decide si hubo compra previa.
  function canReview(product) {
    return Boolean(user && reviewsByProduct[product.id]
      && !reviewsByProduct[product.id].some((review) => review.userId === user.id))
  }

  function buyNow(product, quantity) {
    return addToCart(product, quantity).then((saved) => {
      if (saved) navigate('/carrito')
      return saved
    })
  }
  function retryCart() {
    if (reloadCart()) retryMetadata()
  }

  function publishReview(product, { rating, comment }) {
    if (!user || !token || reviewRequest.current) return Promise.reject(new Error('Ingresá o esperá a que termine el envío.'))
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !comment.trim() || comment.length > 1000) {
      return Promise.reject(new Error('Revisá la puntuación y el comentario.'))
    }
    const version = sessionVersion.current
    reviewRequest.current = true
    return fetch(URL + '/products/' + product.id + '/reviews', {
      signal: sessionAbort.current.signal,
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
  async function uploadProductPhoto(file) {
    if (!user || !token) throw new Error('Ingresá para subir fotografías.')
    const version = sessionVersion.current
    const body = new FormData()
    body.append('file', file)
    try {
      const response = await fetch(URL + '/products/images', {
      signal: sessionAbort.current.signal,
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
      signal: sessionAbort.current.signal,
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
      signal: sessionAbort.current.signal,
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
      signal: sessionAbort.current.signal,
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
  function syncPublication(saved) {
    refreshPendingCatalog()
    setOwnPublications((current) => ({ ...current, userId: user.id,
      items: [saved, ...current.items.filter((product) => product.id !== saved.id)]
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.id - a.id),
    }))
    upsertProduct(saved)
  }
  function retryPublications() {
    ownPublicationsStamp.current = null
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
      signal: sessionAbort.current.signal,
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
        removeProduct(product.id)
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
                                    loadPage={loadProductPage}
                                    cacheVersion={cacheVersion}
                                    filters={catalogFilters}
                                    onFiltersChange={changeCatalogFilters}
                                    onClearFilters={clearCatalogFilters}
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
          onAddToCart={addToCart} onBuyNow={buyNow} product={selectedProduct} products={relatedProducts}
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
          onRetry={retryDetail} />
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
        <Orders key={user?.id + ':' + token} {...account} orders={orderHistory.items}
          loading={orderHistory.loading || (!orderHistory.updatedAt && !orderHistory.error)} error={orderHistory.error}
          onRefresh={() => loadOrders(true)} details={orderDetails} onLoadDetail={loadOrderDetail} />
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
          error={cartError} onRetry={retryCart} checkout={checkout} />
      </ProtectedRoute>} />
      <Route path="/pedido-confirmado" element={<ProtectedRoute user={user}>
        <OrderConfirmation order={checkout.confirmedOrder} cartCount={cartCount} />
      </ProtectedRoute>} />
      <Route path="/ingresar" element={<Login {...shared} onLogin={login} />} />
      <Route path="/crear-cuenta" element={<Register {...shared} onRegister={register} />} />
      <Route path="/promociones" element={loading ? <p role="status">Cargando sesión…</p> : isAdmin
        ? <Promotions {...account} promotions={promotions} loading={promotionLoading} error={promotionError}
            onRefresh={() => setPromotionAttempt((current) => current + 1)}
            onEdit={(promotion) => navigate('/editar-promocion', { state: { promotion } })}
            onToggle={togglePromotion} />
        : <Navigate to="/mi-perfil" replace />} />

      <Route path="/editar-promocion" element={loading || (isAdmin && promotionLoading) ? <p role="status">Cargando promociones…</p> : isAdmin ? selectedPromotion
        ? <PromotionEditor key={selectedPromotion.id} {...account} promotion={selectedPromotion} collections={collections} loadProductsPage={loadProductPage} loadProduct={loadProduct} productCacheVersion={cacheVersion} collectionsLoading={collectionsLoading} collectionsError={collectionsError} onSave={savePromotion} />
        : <Navigate to="/promociones" replace /> : <Navigate to="/mi-perfil" replace />} />
      <Route path="/nueva-promocion" element={loading || (isAdmin && promotionLoading) ? <p role="status">Cargando promociones…</p> : isAdmin
        ? <PromotionEditor key="new-promotion" {...account} isNew collections={collections} loadProductsPage={loadProductPage} loadProduct={loadProduct} productCacheVersion={cacheVersion} collectionsLoading={collectionsLoading} collectionsError={collectionsError} onSave={savePromotion} />
        : <Navigate to="/mi-perfil" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
export default App
