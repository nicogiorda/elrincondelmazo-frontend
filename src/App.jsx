
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
import MyAlbum from './views/MyAlbum.jsx'
import PublicAlbum from './views/PublicAlbum.jsx'
import Profile from './views/Profile.jsx'
import Cart from './views/Cart.jsx'
import Checkout from './views/Checkout.jsx'
import OrderConfirmation from './views/OrderConfirmation.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import PurchaseNotice from './components/PurchaseNotice.jsx'
import useAdminPromotions from './hooks/useAdminPromotions.js'
import useAccount from './hooks/useAccount.js'
import useReviews from './hooks/useReviews.js'
import useCart from './hooks/useCart.js'
import useCartMetadata from './hooks/useCartMetadata.js'
import useSession from './hooks/useSession.js'
import useCatalog from './hooks/useCatalog.js'
import useCheckout from './hooks/useCheckout.js'
import useOrders from './hooks/useOrders.js'
import usePublications from './hooks/usePublications.js'
import { productIdFrom } from './utils/productId.js'

function App() {

  const navigate = useNavigate()
  const location = useLocation()
  const productRoute = useMatch('/producto/:id')
  const isProductRoute = Boolean(productRoute)
  const selectedProductId = productIdFrom(productRoute?.params.id)
  const legacyProductId = productIdFrom(location.state?.product?.id)
  const needsPublications = location.pathname === '/mis-publicaciones'
    || (location.pathname === '/publicar' && Boolean(location.state?.product?.id))

  const needsPromotions = ['/promociones', '/editar-promocion', '/nueva-promocion'].includes(location.pathname)

  const { user, token, loading, sessionError, setSessionError, setUser,
    login, register, logout, sessionVersion, sessionAbort, subscribeSessionChange } = useSession()

  const { profileSaving, deactivating, deactivateError, saveProfile, deactivateAccount } = useAccount({
    user, token, setUser, logout, setSessionError, sessionVersion, sessionAbort, subscribeSessionChange,
  })
  function confirmAccountDeactivation() {
    if (!profileSaving && !deactivating && window.confirm('¿Estás seguro de que deseás desactivar tu cuenta?')) {
      return deactivateAccount()
    }
  }
  const { products, cacheVersion, loadProductPage, loadProduct, recentProducts, productsLoading, productsError,
    collections, collectionsLoading, collectionsError, catalogCollections, catalogFilters, changeCatalogFilters,
    clearCatalogFilters, selectedProduct, knownProduct, needsDetail, currentDetailRequest, relatedProducts, retryDetail,
    refreshPendingCatalog, rememberProduct, upsertProduct, removeProduct, syncPublicProducts, subscribeInvalidation,
  } = useCatalog({ location, productId: selectedProductId, isProductRoute })

  const { publications, loading: publicationsLoading, loadError: publicationsLoadError,
    error: publicationError, busyId: publicationBusyId, refresh: retryPublications,
    save: publishProduct, uploadPhoto: uploadProductPhoto, toggle: togglePublication, remove: removePublication,
  } = usePublications({ user, token, active: needsPublications, sessionVersion, sessionAbort,
    subscribeSessionChange, logout, setSessionError, refreshPendingCatalog, upsertProduct, removeProduct,
    syncPublicProducts, onSaved: () => navigate('/mis-publicaciones') })

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

  const { promotions, loading: promotionLoading, error: promotionError, busyId: promotionBusyId,
    refresh: refreshPromotions, save: savePromotion, toggle: togglePromotion,
  } = useAdminPromotions({ user, token, active: needsPromotions, sessionVersion, sessionAbort,
    subscribeSessionChange, logout, setSessionError, onSaved: () => navigate('/promociones') })

  const currentUser = user
  const isAdmin = user?.role === 'ADMIN'
  const selectedPromotion = promotions.find((promotion) => promotion.id === location.state?.promotion?.id)
  const reviewProductId = productRoute ? selectedProduct?.id : undefined
  const { reviewsByProduct, reviewErrors, retryReviews, canReview, publishReview } = useReviews({
    productId: reviewProductId, user, token, sessionVersion, sessionAbort,
    subscribeSessionChange, logout, setSessionError,
  })

  const editingPublication = publications.find((product) => product.id === location.state?.product?.id)

  function openProduct(product) {
    // Una tarjeta puede venir de una página que no forma parte de la carga inicial.
    rememberProduct(product)
    navigate('/producto/' + product.id)
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

  const shared = {
    cartCount, userId: user?.id, isLoggedIn: Boolean(user),
    cartBusy: cartBusy || Boolean(user && !cart), cartError, cartMessage,
  }
  const account = { ...shared, user: currentUser, onLogout: logout }
  function confirmPublicationRemoval(product) {
    if (window.confirm('¿Querés eliminar esta publicación? Esta acción no se puede deshacer.')) return removePublication(product)
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
                                    products={products}
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
          error={publicationError} busyId={publicationBusyId} onRetry={retryPublications}
          onEdit={(product) => navigate('/publicar', { state: { product } })}
          onDelete={confirmPublicationRemoval}
          onToggleStatus={togglePublication} />
      </ProtectedRoute>} />
      <Route path="/publicar" element={<ProtectedRoute user={user}>
        {location.state?.product && publicationsLoading ? <p role="status" className="p-8 font-bold">Cargando publicación…</p>
          : location.state?.product && publicationsLoadError ? <div role="alert" className="p-8 font-bold"><p>{publicationsLoadError}</p><button type="button" onClick={retryPublications} className="underline">Reintentar</button></div>
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
      <Route path="/mi-album" element={<ProtectedRoute user={user}>
        <MyAlbum user={user} cartCount={cartCount} onLogout={logout} />
      </ProtectedRoute>} />
      <Route path="/album/usuario/:userId" element={<ProtectedRoute user={user}>
        <PublicAlbum key={location.pathname} viewer={user} cartCount={cartCount} onLogout={logout} />
      </ProtectedRoute>} />
      <Route path="/mi-perfil" element={<ProtectedRoute user={user}>
        <Profile key={JSON.stringify(user)} {...account} onSave={saveProfile} saving={profileSaving}
          onDeactivate={confirmAccountDeactivation} deactivating={deactivating} deactivateError={deactivateError} />
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
            busyId={promotionBusyId} onRefresh={refreshPromotions}
            onEdit={(promotion) => navigate('/editar-promocion', { state: { promotion } })}
            onToggle={togglePromotion} />
        : <Navigate to="/mi-perfil" replace />} />

      <Route path="/editar-promocion" element={loading || (isAdmin && promotionLoading) ? <p role="status">Cargando promociones…</p> : isAdmin ? selectedPromotion
        ? <PromotionEditor key={selectedPromotion.id} {...account} promotion={selectedPromotion} collections={collections} loadProductsPage={loadProductPage} loadProduct={loadProduct} productCacheVersion={cacheVersion} collectionsLoading={collectionsLoading} collectionsError={collectionsError} onSave={savePromotion} busy={promotionBusyId !== null} />
        : <Navigate to="/promociones" replace /> : <Navigate to="/mi-perfil" replace />} />
      <Route path="/nueva-promocion" element={loading || (isAdmin && promotionLoading) ? <p role="status">Cargando promociones…</p> : isAdmin
        ? <PromotionEditor key="new-promotion" {...account} isNew collections={collections} loadProductsPage={loadProductPage} loadProduct={loadProduct} productCacheVersion={cacheVersion} collectionsLoading={collectionsLoading} collectionsError={collectionsError} onSave={savePromotion} busy={promotionBusyId !== null} />
        : <Navigate to="/mi-perfil" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
export default App
