
import { useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
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

import { orderMocks } from './data/purchaseMocks.js'
import ProtectedRoute from './components/ProtectedRoute.jsx'


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
    productId: promotion.productId ?? '',
    stackable: promotion.stackable,
    startDate: promotion.startDate?.slice(0, 10) ?? '',
    endDate: promotion.endDate?.slice(0, 10) ?? '',
    enabled: promotion.active,
  };
}

function promotionToBackend(promotion) {
  const kind = promotion.kind;

  return {
    name: promotion.name.trim(),
    description: promotion.description,
    type: promotionTypes[kind],
    discountPercentage: Number(promotion.discount),

    minimumQuantity: kind === 'quantity'
      ? Number(promotion.minimumQuantity) : null,

    minimumAmount: kind === 'minimum'
      ? Number(promotion.minimumAmount) : null,

    productType: kind === 'type'
      ? promotion.productType || null : null,

    paymentMethod: kind === 'payment'
      ? promotion.paymentMethod || null : null,

    collectionId: kind === 'collection'
      ? Number(promotion.collectionId) : null,

    productId: kind === 'product'
      ? Number(promotion.productId) : null,

    stackable: promotion.stackable,

    startDate: `${promotion.startDate}T00:00:00`,

    endDate: promotion.endDate
      ? `${promotion.endDate}T23:59:59`
      : null,
  };
}

function App() {

  const navigate = useNavigate()
  const location = useLocation()
  // Operaciones de demostración en memoria; sin persistencia.
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deactivateError, setDeactivateError] = useState("");
  useEffect(() => {
    async function recuperarSesion() {
      const token = localStorage.getItem("token");

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          "http://localhost:8080/users/me",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("token");
          }
          return;
        }

        const usuario = await response.json();
        setUser(usuario);

      } catch (error) {
        console.error("Error al recuperar la sesión:", error);
      }

      finally {
        setLoading(false);
      }
    }

    recuperarSesion();
  }, []);
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
const publications = user
  ? products.filter((product) => product.sellerId === user.id)
  : []

const [promotions, setPromotions] = useState([])
const [promotionLoading, setPromotionLoading] = useState(false)
const [promotionError, setPromotionError] = useState('')

useEffect(() => {
  if (user?.role !== 'ADMIN') {
    setPromotions([])
    setPromotionError('')
    return
  }

  let cancelled = false

  async function loadPromotions() {
    setPromotionLoading(true)
    setPromotionError('')

    try {
      const token = localStorage.getItem('token')

      const response = await fetch(
        'http://localhost:8080/promotions',
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error(
          `No se pudieron cargar las promociones (${response.status})`
        )
      }

      const data = await response.json()

      if (!cancelled) {
        setPromotions(data.map(promotionFromBackend))
      }
    } catch (error) {
      if (!cancelled) {
        setPromotionError(error.message)
      }
    } finally {
      if (!cancelled) {
        setPromotionLoading(false)
      }
    }
  }

  loadPromotions()

  return () => {
    cancelled = true
  }
}, [user?.role])

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
  const currentUser = user && demoAdmin ? { ...user, role: 'ADMIN' } : user;
  const isAdmin = currentUser?.role === 'ADMIN';
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

  function saveProfile(usuarioActualizado) {
  setUser(usuarioActualizado)
}
  
  }
  function logout() {
    localStorage.removeItem("token");
    setDemoAdmin(false)
    setUser(null);
    navigate('/ingresar', { replace: true });
  }
  
  async function savePromotion(promotion) {
  try {
    const token = localStorage.getItem('token');

    const editing = promotion.id != null;

    const url = editing
      ? `http://localhost:8080/promotions/${promotion.id}`
      : 'http://localhost:8080/promotions';

    const response = await fetch(url, {
      method: editing ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(promotionToBackend(promotion)),
    });

    if (!response.ok) {
      const detail = await response.text();

      throw new Error(
        `No se pudo guardar la promoción (${response.status}). ${detail}`
      );
    }

    const saved = promotionFromBackend(await response.json());

    setPromotions((current) =>
      editing
        ? current.map((item) =>
            item.id === saved.id ? saved : item
          )
        : [...current, saved]
    );

    navigate('/promociones');
  } catch (error) {
    console.error('Error al guardar la promoción:', error);
    alert(error.message);
  }
}
  
async function togglePromotion(promotion) {
  try {
    const token = localStorage.getItem('token');

    const action = promotion.enabled
      ? 'deactivate'
      : 'activate';

    const response = await fetch(
      `http://localhost:8080/promotions/${promotion.id}/${action}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `No se pudo cambiar el estado (${response.status})`
      );
    }

    const updated = promotionFromBackend(await response.json());

    setPromotions((current) =>
      current.map((item) =>
        item.id === updated.id ? updated : item
      )
    );

  } catch (error) {
    console.error('Error al cambiar la promoción:', error);
    alert(error.message);
  }
}
  


  async function deactivateAccount() {
    const confirmado = window.confirm("¿Estás seguro de que deseás desactivar tu cuenta?")
    if (!confirmado) return;
    setDeactivateError("");

    try {
      const token = localStorage.getItem("token");

      const response = await fetch("http://localhost:8080/users/me", {
        method: "DELETE",
        headers: {
        Authorization: `Bearer ${token}`
      }
    });

      if (!response.ok) {
        throw new Error("No se pudo desactivar la cuenta");
      }

      logout();

    } catch (error) {
      console.error("Error al desactivar la cuenta", error)
      setDeactivateError(error.message);
    }

  }
  const shared = { cartCount, userId: user?.id }
  const account = { ...shared, user: currentUser, onLogout: logout }
  function togglePublication(product) {
    setShop((current) => ({ ...current, products: current.products.map((item) => item.id === product.id ? {
      ...item,
      status: item.status === 'ACTIVO' ? 'INACTIVO' : item.stock > 0 ? 'ACTIVO' : 'AGOTADO',
    } : item) }))
  }
  if (loading) {
    return <p>Verificando sesión...</p>
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
      <Route path="/mis-publicaciones" element={<ProtectedRoute user={user}>
        <Publications {...account} products={publications}
          onEdit={(product) => navigate('/publicar', { state: { product } })}
          onDelete={(product) => setShop((current) => ({ ...current, products: current.products.filter((item) => item.id !== product.id) }))}
          onToggleStatus={togglePublication} /> </ProtectedRoute>
      } />
<Route path="/publicar" element={
  <ProtectedRoute user={user}>
    {location.state?.product && !editingPublication ? (
      <Navigate to="/mis-publicaciones" replace />
    ) : (
      <PublishProduct
        key={editingPublication?.id ?? 'new'}
        {...account}
        product={editingPublication}
        onPublish={publishProduct}
      />
    )}
  </ProtectedRoute>
} />

<Route path="/mis-pedidos" element={
  <ProtectedRoute user={user}>
    <Orders
      {...account}
      orders={orders}
      canReview={canReview}
      onReview={openProduct}
    />
  </ProtectedRoute>
} />

<Route path="/mi-perfil" element={
  <ProtectedRoute user={user}>
    <Profile
      {...account}
      onSave={saveProfile}
      onDeactivate={deactivateAccount}
      deactivateError={deactivateError}
    />
  </ProtectedRoute>
} />

<Route path="/carrito" element={
  <ProtectedRoute user={user}>
    <Cart
      {...shared}
      cart={null}
      products={products}
    />
  </ProtectedRoute>
} />

<Route path="/checkout" element={
  <ProtectedRoute user={user}>
    <Checkout
      {...shared}
      cart={null}
      products={products}
    />
  </ProtectedRoute>
} />

<Route path="/pedido-confirmado" element={
  <ProtectedRoute user={user}>
    <OrderConfirmation order={null} />
  </ProtectedRoute>
} />

      {/* Acceso de demostración: sin autenticación ni almacenamiento de contraseñas. */}
      <Route path="/ingresar" element={
        <Login {...shared} onLogin={(usuario) => {setDemoAdmin(false); setUser(usuario); navigate('/mi-perfil');}} />} />
      <Route path="/crear-cuenta" element={
        <Register {...shared} onRegister={(usuario) => {setDemoAdmin(false); setUser(usuario); navigate("/mi-perfil", { replace: true });}} />
      } />
      
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
  )
}
export default App
