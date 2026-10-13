
import { useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Home from './views/Home.jsx'
import Login from './views/Login.jsx'
import Register from './views/Register.jsx'
import Promotions from './views/Promotions.jsx'
import PromotionEditor from './views/PromotionEditor.jsx'
import { promotionMocks } from './data/promotionMocks.js'
import Catalog from './views/Catalog.jsx'
import ProductDetail from './views/ProductDetail.jsx'
import Publications from './views/Publications.jsx'
import PublishProduct from './views/PublishProduct.jsx'
import Orders from './views/Orders.jsx'
import Profile from './views/Profile.jsx'
import Cart from './views/Cart.jsx'
import Checkout from './views/Checkout.jsx'
import OrderConfirmation from './views/OrderConfirmation.jsx'
import { accountUser } from './data/accountMocks.js'
import { orderMocks } from './data/purchaseMocks.js'

const emptyCatalogFilters = { search: '', type: '', collection: '', minPrice: '', maxPrice: '', page: 0 }
const URL = 'http://localhost:8080'

function App() {

  const navigate = useNavigate()
  const location = useLocation()
  // Operaciones de demostración en memoria; sin persistencia.
  const [user, setUser] = useState(accountUser)
  // Sólo se habilita al iniciar una sesión de desarrollo con esta URL explícita.
  const [demoAdmin, setDemoAdmin] = useState(() => import.meta.env.DEV
    && location.pathname === '/promociones'
    && new URLSearchParams(location.search).get('demoAdmin') === '1')
  // El catálogo público empieza vacío; los mocks de cuenta siguen siendo del otro flujo.
  const [shop, setShop] = useState(() => ({
    products: [],
    orders: orderMocks,
    nextProductId: 1,
  }))
  const [collections, setCollections] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [collectionsLoading, setCollectionsLoading] = useState(true)
  const [productsError, setProductsError] = useState('')
  const [collectionsError, setCollectionsError] = useState('')
  const [totalProducts, setTotalProducts] = useState(0)
  // Estas marcas evitan duplicar los GET incluso con StrictMode en desarrollo.
  const productsRequested = useRef(false)
  const collectionsRequested = useRef(false)

  useEffect(() => {
    if (productsRequested.current) return
    productsRequested.current = true
    fetch(`${URL}/products?size=100`)
      .then((response) => {
        if (!response.ok) throw new Error(`Error ${response.status} al cargar productos`)
        return response.json()
      })
      .then((data) => {
        if (!Array.isArray(data.content)) throw new Error('La respuesta de productos no contiene una lista')
        setShop((current) => ({
          ...current,
          products: data.content,
          nextProductId: Math.max(0, ...data.content.map((product) => product.id)) + 1,
        }))
        setTotalProducts(data.totalElements)
      })
      .catch((error) => {
        console.log(error)
        setProductsError('No pudimos cargar los productos. Recargá la página para reintentar.')
      })
      .finally(() => setProductsLoading(false))
  }, [])

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
  const orders = shop.orders
  const publications = products.filter((product) => product.sellerId === user.id)
  const [promotions, setPromotions] = useState(promotionMocks)
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
  // Ir a los formularios de acceso también finaliza la vista previa.
  if (demoAdmin && ['/ingresar', '/crear-cuenta'].includes(location.pathname)) setDemoAdmin(false)
  const currentUser = demoAdmin ? { ...user, role: 'ADMIN' } : user
  const isAdmin = currentUser.role === 'ADMIN'
  const selectedPromotion = promotions.find((promotion) => promotion.id === location.state?.promotion?.id)
  // No hay sesión JWT todavía. No usamos el usuario mock para autorizar compras.
  const cartCount = 0
  const publicProducts = products.filter((product) => ['ACTIVO', 'AGOTADO'].includes(product.status))
  const recentProducts = publicProducts.filter((product) => product.status === 'ACTIVO')
    .slice().sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, 4)
  const selectedProductId = location.state?.product?.id
  const selectedProduct = products.find((product) => product.id === selectedProductId)
  const reviewProductId = location.pathname === '/producto' ? selectedProduct?.id : undefined

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

  function openProduct(product) { navigate('/producto', { state: { product } }) }
  // POST de reseñas pendiente de la sesión real; nunca se agregan reseñas ficticias.
  function canReview() { return false }
  function publishProduct(product) {
    setShop((current) => {
      const saved = { ...product, id: product.id ?? current.nextProductId }
      return { ...current,
        products: product.id ? current.products.map((item) => item.id === product.id ? saved : item)
          : [...current.products, saved],
        nextProductId: product.id ? current.nextProductId : current.nextProductId + 1,
      }
    })
    navigate('/mis-publicaciones')
  }
  function saveProfile({ firstName, lastName, email }) {
    setUser((current) => ({ ...current, firstName, lastName, email }))
  }
  function logout() {
    setDemoAdmin(false)
    setUser((current) => ({ ...current, role: accountUser.role }))
    navigate('/ingresar', { replace: true })
  }
  function savePromotion(promotion) {
    const saved = { ...promotion, id: promotion.id ?? Math.max(0, ...promotions.map((item) => item.id)) + 1 }
    setPromotions((current) => promotion.id ? current.map((item) => item.id === promotion.id ? saved : item) : [...current, saved])
    navigate('/promociones')
  }
  const shared = { cartCount }
  const account = { ...shared, user: currentUser, onLogout: logout }
  function togglePublication(product) {
    setShop((current) => ({ ...current, products: current.products.map((item) => item.id === product.id ? {
      ...item,
      status: item.status === 'ACTIVO' ? 'INACTIVO' : item.stock > 0 ? 'ACTIVO' : 'AGOTADO',
    } : item) }))
  }

  return (
    <Routes>
      <Route path="/" element={
        <Home {...shared} products={recentProducts} collections={collections} onOpenProduct={openProduct}
          productsLoading={productsLoading} productsError={productsError}
          collectionsLoading={collectionsLoading} collectionsError={collectionsError}
          onSelectCollection={(collection) => navigate('/catalogo', { state: { collectionId: collection.id } })} />
      } />
      <Route path="/catalogo" element={
                                 <Catalog
                                    {...shared}
                                    products={publicProducts}
                                    collections={catalogCollections}
                                    loading={productsLoading}
                                    error={productsError}
                                    collectionsError={collectionsError}
                                    totalProducts={totalProducts}
                                    loadedProducts={products.length}
                                    filters={catalogFilters}
                                    onFiltersChange={changeCatalogFilters}
                                    onClearFilters={() => changeCatalogFilters(emptyCatalogFilters)}
                                    onOpenProduct={openProduct}
                                />
                              } />
      <Route path="/producto" element={selectedProduct ? (
        <ProductDetail key={selectedProduct.id} {...shared} product={selectedProduct} products={publicProducts}
          reviews={reviewsByProduct[selectedProduct.id] ?? []}
          reviewsLoading={reviewsByProduct[selectedProduct.id] === undefined && !reviewErrors[selectedProduct.id]}
          reviewsError={reviewErrors[selectedProduct.id]} onRetryReviews={retryReviews}
          onOpenProduct={openProduct}
          onViewCollection={(collectionId) => navigate('/catalogo', { state: { collectionId } })} />
      ) : productsLoading ? (
        <p role="status" className="p-8 font-bold">Cargando producto…</p>
      ) : productsError ? (
        <p role="alert" className="p-8 font-bold text-rojo">{productsError}</p>
      ) : <Navigate to="/catalogo" replace />} />
      <Route path="/mis-publicaciones" element={
        <Publications {...account} products={publications}
          onEdit={(product) => navigate('/publicar', { state: { product } })}
          onDelete={(product) => setShop((current) => ({ ...current, products: current.products.filter((item) => item.id !== product.id) }))}
          onToggleStatus={togglePublication} />
      } />
      <Route path="/publicar" element={location.state?.product && !editingPublication ? (
        <Navigate to="/mis-publicaciones" replace />
      ) : <PublishProduct key={editingPublication?.id ?? 'new'} {...account} product={editingPublication} onPublish={publishProduct} />} />
      <Route path="/mis-pedidos" element={
        <Orders {...account} orders={orders} canReview={canReview} onReview={openProduct} />
      } />
      <Route path="/mi-perfil" element={<Profile {...account} onSave={saveProfile} />} />
      {/* Carrito y checkout esperan sesión real: sin requests anónimas ni compras simuladas. */}
      <Route path="/carrito" element={<Cart {...shared} cart={null} products={products} />} />
      <Route path="/checkout" element={<Checkout {...shared} cart={null} />} />
      <Route path="/pedido-confirmado" element={<OrderConfirmation order={null} />} />
      {/* Acceso de demostración: sin autenticación ni almacenamiento de contraseñas. */}
      <Route path="/ingresar" element={
        <Login {...shared} onLogin={() => { setDemoAdmin(false); navigate('/mi-perfil') }} />
      } />
      <Route path="/crear-cuenta" element={
        <Register {...shared} onRegister={({ firstName, lastName, email }) => {
          setDemoAdmin(false)
          saveProfile({ firstName, lastName, email })
          navigate('/mi-perfil')
        }} />
      } />
      <Route path="/promociones" element={isAdmin ? (
        <Promotions {...account} promotions={promotions}
          onEdit={(promotion) => navigate('/editar-promocion', { state: { promotion } })}
          onToggle={(promotion) => setPromotions((current) => current.map((item) => item.id === promotion.id
            ? { ...item, enabled: !item.enabled } : item))} />
      ) : <Navigate to="/mi-perfil" replace />} />
      <Route path="/editar-promocion" element={isAdmin ? selectedPromotion
        ? <PromotionEditor key={selectedPromotion.id} {...account} promotion={selectedPromotion} onSave={savePromotion} />
        : <Navigate to="/promociones" replace /> : <Navigate to="/mi-perfil" replace />} />
      <Route path="/nueva-promocion" element={isAdmin
        ? <PromotionEditor key="new-promotion" {...account} isNew onSave={savePromotion} />
        : <Navigate to="/mi-perfil" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
export default App
