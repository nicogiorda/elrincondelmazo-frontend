import { useState } from 'react'
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

function App() {
  // Navegación y operaciones de demostración en memoria; sin rutas ni persistencia.
  const [view, setView] = useState({ name: 'home', params: {} })
  const [user, setUser] = useState(accountUser)
  const [publications, setPublications] = useState(publicationProducts)
  const [items, setItems] = useState(cartItems)
  const [confirmedOrder, setConfirmedOrder] = useState(null)
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0)

  function navigate(name, params = {}) { setView({ name, params }) }
  function openProduct(product) { navigate('detail', { product }) }
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
    navigate('publications')
  }
  function confirmOrder(order) {
    setConfirmedOrder({ ...confirmationMock, ...order })
    setItems([])
    navigate('confirmation')
  }
  const shared = { cartCount, onNavigate: navigate }
  const account = { ...shared, user }

  if (view.name === 'publications') return <Publications {...account} products={publications} onEdit={(product) => navigate('publish', { product })} onDelete={(product) => setPublications((current) => current.filter((item) => item.id !== product.id))} onToggleStatus={(product) => setPublications((current) => current.map((item) => item.id === product.id ? { ...item, status: item.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO' } : item))} />
  if (view.name === 'publish') return <PublishProduct key={view.params.product?.id || 'new'} {...account} product={view.params.product} onPublish={publishProduct} />
  if (view.name === 'profile') return <Profile {...account} onSave={setUser} />
  if (view.name === 'orders') return <Orders {...account} orders={confirmedOrder ? [confirmedOrder, ...orderMocks] : orderMocks} />
  if (view.name === 'cart') return <Cart {...shared} items={items} onQuantityChange={changeQuantity} onRemove={(id) => setItems((current) => current.filter((item) => item.id !== id))} onCheckout={() => navigate('checkout')} />
  if (view.name === 'checkout') return <Checkout {...shared} items={items} onConfirm={(order) => confirmOrder({ ...order, total: order.summary.total, discounts: order.summary.discounts })} />
  if (view.name === 'confirmation' && confirmedOrder) return <OrderConfirmation order={confirmedOrder} onNavigate={navigate} />
  if (view.name === 'catalog') return <Catalog key={JSON.stringify(view.params)} {...shared} initialType={view.params.type} initialCollection={view.params.collectionId} onOpenProduct={openProduct} onAddToCart={addToCart} />
  if (view.name === 'detail') return <ProductDetail key={view.params.product.id} {...shared} product={view.params.product} onOpenProduct={openProduct} onAddToCart={addToCart} onBuyNow={(product, quantity) => { addToCart(product, quantity); navigate('cart') }} onViewCollection={(collectionId) => navigate('catalog', { collectionId })} />
  return <Home {...shared} onOpenProduct={openProduct} onAddToCart={addToCart} onSelectCollection={(collection) => navigate('catalog', { collectionId: collection.id })} onViewCollections={() => navigate('home')} onViewCatalog={() => navigate('catalog')} onStartSelling={() => navigate('publish')} />
}
export default App
