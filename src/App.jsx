import { useState } from 'react'
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
import { productMocks } from './data/productMocks.js'
import { accountUser, publicationProducts } from './data/accountMocks.js'
import { cartItems, orderMocks, confirmationMock } from './data/purchaseMocks.js'

const emptyCatalogFilters = { search: '', type: '', collection: '', minPrice: '', maxPrice: '', page: 0 }

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  // Operaciones de demostración en memoria; sin persistencia.
  const [user, setUser] = useState(accountUser)
  const [publications, setPublications] = useState(publicationProducts)
  const [items, setItems] = useState(cartItems)
  const [promotions, setPromotions] = useState(promotionMocks)
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
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0)

  function openProduct(product) { navigate('/producto', { state: { product } }) }
  function addToCart(product, quantity = 1) {
    if (product.status !== 'ACTIVO' || product.stock < 1 || product.sellerId === user.id) return
    setItems((current) => {
      const existing = current.find((item) => item.product.id === product.id)
      if (existing) return current.map((item) => item.id === existing.id ? { ...item, quantity: Math.min(item.quantity + quantity, product.stock) } : item)
      return [...current, { id: Math.max(0, ...current.map((item) => item.id)) + 1, product, quantity: Math.min(quantity, product.stock) }]
    })
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
  function savePromotion(promotion) {
    const saved = { ...promotion, id: promotion.id ?? Math.max(0, ...promotions.map((item) => item.id)) + 1 }
    setPromotions((current) => promotion.id ? current.map((item) => item.id === promotion.id ? saved : item) : [...current, saved])
    navigate('/promociones')
  }
  const shared = { cartCount }
  const account = { ...shared, user }
  const home = <Home {...shared} onOpenProduct={openProduct} onAddToCart={addToCart} onSelectCollection={(collection) => navigate('/catalogo', { state: { collectionId: collection.id } })} />

  return (
    <Routes>
      <Route path="/" element={home} />
      <Route path="/catalogo" element={<Catalog {...shared} filters={catalogFilters} onFiltersChange={changeCatalogFilters} onClearFilters={() => changeCatalogFilters(emptyCatalogFilters)} onOpenProduct={openProduct} onAddToCart={addToCart} />} />
      <Route path="/producto" element={<ProductDetail key={location.state?.product?.id ?? 'preview'} {...shared} onOpenProduct={openProduct} onAddToCart={addToCart} onBuyNow={(product, quantity) => { addToCart(product, quantity); navigate('/carrito') }} onViewCollection={(collectionId) => navigate('/catalogo', { state: { collectionId } })} />} />
      <Route path="/mis-publicaciones" element={<Publications {...account} products={publications} onEdit={(product) => navigate('/publicar', { state: { product } })} onDelete={(product) => setPublications((current) => current.filter((item) => item.id !== product.id))} onToggleStatus={(product) => setPublications((current) => current.map((item) => item.id === product.id ? { ...item, status: item.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' } : item))} />} />
      <Route path="/publicar" element={<PublishProduct key={location.state?.product?.id ?? 'new'} {...account} onPublish={publishProduct} />} />
      <Route path="/mis-pedidos" element={<Orders {...account} orders={confirmedOrder ? [confirmedOrder, ...orderMocks] : orderMocks} />} />
      <Route path="/mi-perfil" element={<Profile {...account} onSave={setUser} />} />
      <Route path="/carrito" element={<Cart {...shared} items={items} onQuantityChange={changeQuantity} onRemove={(id) => setItems((current) => current.filter((item) => item.id !== id))} onCheckout={() => navigate('/checkout')} />} />
      <Route path="/checkout" element={<Checkout {...shared} items={items} onConfirm={(order) => confirmOrder({ ...order, total: order.summary.total, discounts: order.summary.discounts })} />} />
      <Route path="/pedido-confirmado" element={confirmedOrder ? <OrderConfirmation order={confirmedOrder} /> : <Navigate to="/" replace />} />
      {/* Acceso de demostración: sin autenticación ni almacenamiento de contraseñas. */}
      <Route path="/ingresar" element={<Login {...shared} onLogin={() => navigate('/mi-perfil')} />} />
      <Route path="/crear-cuenta" element={<Register {...shared} onRegister={({ firstName, lastName, email }) => { setUser({ ...user, firstName, lastName, email }); navigate('/mi-perfil') }} />} />
      <Route path="/promociones" element={<Promotions {...account} promotions={promotions} onEdit={(promotion) => navigate('/editar-promocion', { state: { promotion } })} onToggle={(promotion) => setPromotions((current) => current.map((item) => item.id === promotion.id ? { ...item, enabled: !item.enabled } : item))} />} />
      <Route path="/editar-promocion" element={<PromotionEditor key={location.state?.promotion?.id ?? 'preview'} {...account} onSave={savePromotion} />} />
      <Route path="/nueva-promocion" element={<PromotionEditor key="new-promotion" {...account} isNew onSave={savePromotion} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
export default App
