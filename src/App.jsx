import { useState } from 'react'
import { canBuyProduct } from './utils/productPurchase.js'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Home from './views/Home.jsx'
import Login from './views/Login.jsx'
import Register from './views/Register.jsx'
import Promotions from './views/Promotions.jsx'
import PromotionEditor from './views/PromotionEditor.jsx'
import { promotionMocks } from './data/promotionMocks.js'
import { homeProducts } from './data/homeMocks.js'
import { detailProduct, detailReviews } from './data/productDetailMocks.js'
import Catalog from './views/Catalog.jsx'
import ProductDetail from './views/ProductDetail.jsx'
import Publications from './views/Publications.jsx'
import PublishProduct from './views/PublishProduct.jsx'
import Orders from './views/Orders.jsx'
import Profile from './views/Profile.jsx'
import Cart from './views/Cart.jsx'
import Checkout from './views/Checkout.jsx'
import OrderConfirmation from './views/OrderConfirmation.jsx'
import { productMocks } from './data/productMocks.js'
import { accountUser, publicationProducts } from './data/accountMocks.js'
import { cartItems, orderMocks, confirmationMock } from './data/purchaseMocks.js'

const emptyCatalogFilters = { search: '', type: '', collection: '', minPrice: '', maxPrice: '', page: 0 }

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  // Operaciones de demostración en memoria; sin persistencia.
  const [user, setUser] = useState(accountUser)
  // Sólo se habilita al iniciar una sesión de desarrollo con esta URL explícita.
  const [demoAdmin, setDemoAdmin] = useState(() => import.meta.env.DEV
    && location.pathname === '/promociones'
    && new URLSearchParams(location.search).get('demoAdmin') === '1')
  const [publications, setPublications] = useState(publicationProducts)
  const [items, setItems] = useState(cartItems)
  const [promotions, setPromotions] = useState(promotionMocks)
  const [reviews, setReviews] = useState(detailReviews)
  const [confirmedOrder, setConfirmedOrder] = useState(null)
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
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0)
  // Las publicaciones reemplazan a los originales del usuario, incluso al eliminarlos.
  // El resto conserva el orden original; las nuevas se agregan al final.
  const products = [
    ...productMocks.map((product) => product.sellerId === accountUser.id
      ? publications.find((publication) => publication.id === product.id)
      : product).filter(Boolean),
    ...publications.filter((publication) => !productMocks.some((product) => product.id === publication.id)),
  ]
  const publicProducts = products.filter((product) => ['ACTIVO', 'AGOTADO'].includes(product.status))
  const newProducts = publicProducts.filter((product) => !productMocks.some((original) => original.id === product.id))
  const recentProducts = [
    ...newProducts.slice().reverse(),
    ...homeProducts.map((original) => publicProducts.find((product) => product.id === original.id)).filter(Boolean),
    ...publicProducts.filter((product) => !homeProducts.some((original) => original.id === product.id)
      && productMocks.some((original) => original.id === product.id)),
  ].filter((product) => product.status === 'ACTIVO').slice(0, 4)
  const selectedProduct = products.find((product) => product.id === (location.state?.product?.id ?? detailProduct.id))
  const editingPublication = publications.find((product) => product.id === location.state?.product?.id)

  function openProduct(product) { navigate('/producto', { state: { product } }) }
  function addToCart(requestedProduct, quantity = 1) {
    const product = products.find((item) => item.id === requestedProduct.id)
    if (!product || !canBuyProduct(product, user.id)) return false
    setItems((current) => {
      const existing = current.find((item) => item.product.id === product.id)
      if (existing) return current.map((item) => item.id === existing.id ? { ...item, product, quantity: Math.min(item.quantity + quantity, product.stock) } : item)
      return [...current, { id: Math.max(0, ...current.map((item) => item.id)) + 1, product, quantity: Math.min(quantity, product.stock) }]
    })
    return true
  }
  function buyNow(product, quantity) {
    if (addToCart(product, quantity)) navigate('/carrito')
  }
  // Los pedidos y las reseñas pertenecen al usuario mock; no es autenticación real.
  const orders = confirmedOrder ? [confirmedOrder, ...orderMocks] : orderMocks
  function canReview(product) {
    return orders.some((order) => order.status !== 'CANCELADO'
      && order.items.some((item) => item.product.id === product.id))
      && !reviews.some((review) => review.productId === product.id && review.userId === user.id)
  }
  function publishReview(product, { rating, comment }) {
    if (!canReview(product) || !Number.isInteger(rating) || rating < 1 || rating > 5
      || !comment.trim() || comment.length > 1000) return false
    setReviews((current) => {
      if (current.some((review) => review.productId === product.id && review.userId === user.id)) return current
      return [{ id: Math.max(0, ...current.map((review) => review.id)) + 1,
        productId: product.id, userId: user.id, userName: `${user.firstName} ${user.lastName}`,
        rating, comment: comment.trim(), createdAt: new Date().toISOString() }, ...current]
    })
    return true
  }
  function changeQuantity(id, quantity) { setItems((current) => current.map((item) => item.id === id && quantity >= 1 && quantity <= item.product.stock ? { ...item, quantity } : item)) }
  function publishProduct(product) {
    const saved = { ...product, id: product.id ?? Math.max(0, ...productMocks.map((item) => item.id), ...publications.map((item) => item.id)) + 1 }
    setPublications((current) => product.id ? current.map((item) => item.id === product.id ? saved : item) : [...current, saved])
    navigate('/mis-publicaciones')
  }
  function confirmOrder(order) {
    setConfirmedOrder({ ...confirmationMock, ...order })
    setItems([])
    navigate('/pedido-confirmado')
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
  const shared = { cartCount, userId: user.id }
  const account = { ...shared, user: currentUser, onLogout: logout }
  function togglePublication(product) {
    setPublications((current) => current.map((item) => item.id === product.id ? {
      ...item,
      status: item.status === 'ACTIVO' ? 'INACTIVO' : item.stock > 0 ? 'ACTIVO' : 'AGOTADO',
    } : item))
  }

  return (
    <Routes>
      <Route path="/" element={
        <Home {...shared} products={recentProducts} onOpenProduct={openProduct} onAddToCart={addToCart}
          onSelectCollection={(collection) => navigate('/catalogo', { state: { collectionId: collection.id } })} />
      } />
      <Route path="/catalogo" element={
        <Catalog {...shared} products={publicProducts} filters={catalogFilters}
          onFiltersChange={changeCatalogFilters} onClearFilters={() => changeCatalogFilters(emptyCatalogFilters)}
          onOpenProduct={openProduct} onAddToCart={addToCart} />
      } />
      <Route path="/producto" element={selectedProduct ? (
        <ProductDetail key={selectedProduct.id} {...shared} product={selectedProduct} products={publicProducts}
          user={currentUser} reviews={reviews} canReview={canReview} onPublishReview={publishReview}
          onOpenProduct={openProduct} onAddToCart={addToCart} onBuyNow={buyNow}
          onViewCollection={(collectionId) => navigate('/catalogo', { state: { collectionId } })} />
      ) : <Navigate to="/catalogo" replace />} />
      <Route path="/mis-publicaciones" element={
        <Publications {...account} products={publications}
          onEdit={(product) => navigate('/publicar', { state: { product } })}
          onDelete={(product) => setPublications((current) => current.filter((item) => item.id !== product.id))}
          onToggleStatus={togglePublication} />
      } />
      <Route path="/publicar" element={location.state?.product && !editingPublication ? (
        <Navigate to="/mis-publicaciones" replace />
      ) : <PublishProduct key={editingPublication?.id ?? 'new'} {...account} product={editingPublication} onPublish={publishProduct} />} />
      <Route path="/mis-pedidos" element={
        <Orders {...account} orders={orders} canReview={canReview} onReview={openProduct} />
      } />
      <Route path="/mi-perfil" element={<Profile {...account} onSave={saveProfile} />} />
      <Route path="/carrito" element={
        <Cart {...shared} items={items} onQuantityChange={changeQuantity}
          onRemove={(id) => setItems((current) => current.filter((item) => item.id !== id))}
          onCheckout={() => navigate('/checkout')} />
      } />
      <Route path="/checkout" element={
        <Checkout {...shared} items={items}
          onConfirm={(order) => confirmOrder({ ...order, total: order.summary.total, discounts: order.summary.discounts })} />
      } />
      <Route path="/pedido-confirmado" element={confirmedOrder
        ? <OrderConfirmation order={confirmedOrder} /> : <Navigate to="/" replace />} />
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
