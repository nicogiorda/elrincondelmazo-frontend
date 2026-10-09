import { useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Home from './views/Home.jsx'
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
  const [confirmedOrder, setConfirmedOrder] = useState(null)
  const [catalogFilters, setCatalogFilters] = useState(emptyCatalogFilters)
  const [appliedCatalogNavigations, setAppliedCatalogNavigations] = useState([])

  const catalogSelection = location.state
  const hasCatalogSelection = location.pathname === '/catalogo'
    && (catalogSelection?.type !== undefined || catalogSelection?.collectionId !== undefined || catalogSelection?.resetFilters === true)

  // Aplicar cada selección explícita una sola vez, incluso al volver con el navegador.
  if (hasCatalogSelection && !appliedCatalogNavigations.includes(location.key)) {
    setAppliedCatalogNavigations([...appliedCatalogNavigations, location.key])
    setCatalogFilters({
      ...emptyCatalogFilters,
      type: catalogSelection.type ?? '',
      collection: String(catalogSelection.collectionId ?? ''),
    })
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
  const shared = { cartCount }
  const account = { ...shared, user }
  const home = <Home {...shared} onOpenProduct={openProduct} onAddToCart={addToCart} onSelectCollection={(collection) => navigate('/catalogo', { state: { collectionId: collection.id } })} />

  return (
    <Routes>
      <Route path="/" element={home} />
      <Route path="/catalogo" element={<Catalog {...shared} filters={catalogFilters} onFiltersChange={setCatalogFilters} onClearFilters={() => setCatalogFilters(emptyCatalogFilters)} onOpenProduct={openProduct} onAddToCart={addToCart} />} />
      <Route path="/producto" element={<ProductDetail key={location.state?.product?.id ?? 'preview'} {...shared} onOpenProduct={openProduct} onAddToCart={addToCart} onBuyNow={(product, quantity) => { addToCart(product, quantity); navigate('/carrito') }} onViewCollection={(collectionId) => navigate('/catalogo', { state: { collectionId } })} />} />
      <Route path="/mis-publicaciones" element={<Publications {...account} products={publications} onEdit={(product) => navigate('/publicar', { state: { product } })} onDelete={(product) => setPublications((current) => current.filter((item) => item.id !== product.id))} onToggleStatus={(product) => setPublications((current) => current.map((item) => item.id === product.id ? { ...item, status: item.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' } : item))} />} />
      <Route path="/publicar" element={<PublishProduct key={location.state?.product?.id ?? 'new'} {...account} onPublish={publishProduct} />} />
      <Route path="/mis-pedidos" element={<Orders {...account} orders={confirmedOrder ? [confirmedOrder, ...orderMocks] : orderMocks} />} />
      <Route path="/mi-perfil" element={<Profile {...account} onSave={setUser} />} />
      <Route path="/carrito" element={<Cart {...shared} items={items} onQuantityChange={changeQuantity} onRemove={(id) => setItems((current) => current.filter((item) => item.id !== id))} onCheckout={() => navigate('/checkout')} />} />
      <Route path="/checkout" element={<Checkout {...shared} items={items} onConfirm={(order) => confirmOrder({ ...order, total: order.summary.total, discounts: order.summary.discounts })} />} />
      <Route path="/pedido-confirmado" element={confirmedOrder ? <OrderConfirmation order={confirmedOrder} /> : <Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
export default App
