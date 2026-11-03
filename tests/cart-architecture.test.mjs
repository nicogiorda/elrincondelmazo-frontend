import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve, relative } from 'node:path'
import test from 'node:test'

const root = resolve('src')
function sources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? sources(path) : /\.(js|jsx)$/.test(path) ? [path] : []
  })
}
const modules = new Map(sources(root).map(path => [path, readFileSync(path, 'utf8')]))

test('Los módulos de src no contienen dependencias circulares', () => {
  const checked = new Set(), visiting = new Set()
  function visit(path, ancestors = []) {
    assert.ok(!visiting.has(path), 'Ciclo: ' + [...ancestors, path].map(p => relative(root, p)).join(' → '))
    if (checked.has(path)) return
    visiting.add(path)
    for (const [, target] of modules.get(path).matchAll(/(?:import|export)[\s\S]*?\bfrom\s*['"]([^'"]+)['"]/g)) {
      if (!target.startsWith('.')) continue
      const dependency = resolve(dirname(path), target)
      if (modules.has(dependency)) visit(dependency, [...ancestors, path])
    }
    visiting.delete(path)
    checked.add(path)
  }
  for (const path of modules.keys()) visit(path)
  assert.equal(checked.size, modules.size)
})

test('App compone una única instancia de cada dominio privado y catálogo', () => {
  for (const hook of ['useCart', 'useSession', 'useCatalog', 'useCheckout', 'useOrders', 'usePublications', 'useAdminPromotions', 'useAccount', 'useReviews']) {
    const sites = [...modules].filter(([, source]) => new RegExp('=\\s*' + hook + '\\(').test(source))
    assert.equal(sites.length, 1)
    assert.equal(sites[0][0], resolve(root, 'App.jsx'))
    assert.equal([...sites[0][1].matchAll(new RegExp('=\\s*' + hook + '\\(', 'g'))].length, 1)
  }
})

test('Pedidos delega HTTP en ordersApi y Checkout no duplica cotizaciones ni confirmaciones', () => {
  const owners = [...modules].filter(([, source]) => /['"`]\/orders(?:\/|['"`])/.test(source))
  assert.deepEqual(owners.map(([path]) => relative(root, path).replaceAll('\\', '/')), ['services/ordersApi.js'])
  for (const name of ['useCheckout', 'useCheckoutQuote', 'useOrders']) {
    assert.doesNotMatch(modules.get(resolve(root, 'hooks/' + name + '.js')), /\bfetch\s*\(/)
  }
  const service = modules.get(resolve(root, 'services/ordersApi.js'))
  assert.doesNotMatch(service, /from\s*['"]react['"]|\buseState\(/)
  assert.match(service, /import axios from 'axios'/)
  assert.match(service, /axios\.request\(/)
  assert.doesNotMatch(service, /\bfetch\s*\(|requestJson\s*\(|readResponse\s*\(/)
  assert.doesNotMatch(modules.get(resolve(root, 'views/Checkout.jsx')), /randomUUID|\buseEffect\s*\(|\buseRef\s*\(/)
})

test('Los hooks de catálogo y metadatos delegan HTTP y el servicio no depende de React', () => {
  for (const name of ['useCatalog', 'useProductCache', 'useProductDetail', 'useCatalogFilters', 'useCollections', 'useCartMetadata']) {
    assert.doesNotMatch(modules.get(resolve(root, 'hooks/' + name + '.js')), /\bfetch\s*\(/)
  }
  assert.doesNotMatch(modules.get(resolve(root, 'services/productsApi.js')), /from\s*['"]react['"]|\buseState\(/)
})

test('Los endpoints del carrito pertenecen a cartApi y useCart no hace HTTP directo', () => {
  const owners = [...modules].filter(([, source]) => /['"`]\/carts(?:\/|['"`])/.test(source))
  assert.deepEqual(owners.map(([path]) => relative(root, path).replaceAll('\\', '/')), ['services/cartApi.js'])
  assert.doesNotMatch(modules.get(resolve(root, 'hooks/useCart.js')), /\bfetch\s*\(/)
})

test('Publicaciones delega HTTP y App solo compone su interfaz', () => {
  assert.doesNotMatch(modules.get(resolve(root, 'hooks/usePublications.js')), /\bfetch\s*\(/)
  assert.doesNotMatch(modules.get(resolve(root, 'services/publicationsApi.js')), /from\s*['"]react['"]|\buseState\(/)
  assert.doesNotMatch(modules.get(resolve(root, 'App.jsx')), /ownPublications|products\/mine|products\/images/)
})

test('Promociones públicas y administrativas usan Redux Toolkit + Axios según la demo', () => {
  const admin = modules.get(resolve(root, 'hooks/useAdminPromotions.js'))
  const publicHook = modules.get(resolve(root, 'hooks/usePublicPromotions.js'))
  const slice = modules.get(resolve(root, 'Redux/promotionsSlice.js'))
  const service = modules.get(resolve(root, 'services/promotionsApi.js'))
  const events = modules.get(resolve(root, 'services/publicPromotions.js'))
  const store = modules.get(resolve(root, 'Redux/store.js'))
  assert.match(admin, /useSelector\(/)
  assert.match(admin, /dispatch\(fetchAdminPromotions\(/)
  assert.match(admin, /dispatch\(operation\(/)
  assert.doesNotMatch(admin, /\buseState\s*\(|\bgetPromotions\s*\(|\bsavePromotion\s*\(|\bfetch\s*\(/)
  assert.match(publicHook, /useSelector\(/)
  assert.match(publicHook, /dispatch\(fetchPublicPromotions\(/)
  assert.doesNotMatch(publicHook, /\bloadPublicPromotions\s*\(|\bfetch\s*\(/)
  assert.doesNotMatch(events, /\bfetch\s*\(|axios\.request\(/)
  for (const name of ['fetchAdminPromotions', 'saveAdminPromotion',
    'toggleAdminPromotion', 'fetchPublicPromotions']) {
    assert.ok(slice.includes('export const ' + name + ' = createAsyncThunk('), name)
    for (const stage of ['pending', 'fulfilled', 'rejected']) {
      assert.ok(slice.includes('.addCase(' + name + '.' + stage), name + '.' + stage)
    }
  }
  assert.match(service, /import axios from 'axios'/)
  assert.match(service, /axios\.request\(/)
  assert.doesNotMatch(service, /\bfetch\s*\(|requestJson\s*\(|readResponse\s*\(/)
  assert.match(store, /promotions:\s*promotionsReducer/)
  assert.match(store, /promotionToken: \(\) =>/)
  assert.doesNotMatch(slice, /\blocalStorage\s*\(|\buseState\s*\(/)
  assert.doesNotMatch(modules.get(resolve(root, 'App.jsx')),
    /promotionRequest|promotionAttempt|promotionFromBackend|promotionToBackend|API_URL.*promotions/)
})

test('Cuenta delega HTTP y conserva el usuario únicamente en useSession', () => {
  const hook = modules.get(resolve(root, 'hooks/useAccount.js'))
  assert.doesNotMatch(hook, /\bfetch\s*\(|\[user,\s*setUser\]/)
  assert.doesNotMatch(modules.get(resolve(root, 'services/accountApi.js')), /from\s*['"]react['"]|\buseState\(/)
  assert.doesNotMatch(modules.get(resolve(root, 'App.jsx')), /\/users\/me|accountRequest|setProfileSaving|setDeactivating|setDeactivateError/)
})

test('Reseñas usan Redux Toolkit + Axios y conservan formularios locales', () => {
  const hook = modules.get(resolve(root, 'hooks/useReviews.js'))
  const slice = modules.get(resolve(root, 'Redux/reviewsSlice.js'))
  const service = modules.get(resolve(root, 'services/reviewsApi.js'))
  const store = modules.get(resolve(root, 'Redux/store.js'))
  const app = modules.get(resolve(root, 'App.jsx'))
  assert.match(hook, /useSelector\(/)
  assert.match(hook, /dispatch\(fetchProductReviews\(/)
  assert.match(hook, /dispatch\(publishProductReview\(/)
  assert.doesNotMatch(hook, /\buseState\s*\(|\bgetReviews\s*\(|\bcreateReview\s*\(|\bfetch\s*\(/)
  for (const name of ['fetchProductReviews', 'publishProductReview']) {
    assert.ok(slice.includes('export const ' + name + ' = createAsyncThunk('), name)
    for (const stage of ['pending', 'fulfilled', 'rejected']) {
      assert.ok(slice.includes('.addCase(' + name + '.' + stage), name + '.' + stage)
    }
  }
  assert.match(service, /import axios from 'axios'/)
  assert.match(service, /axios\.request\(/)
  assert.doesNotMatch(service, /\bfetch\s*\(|requestJson\s*\(|readResponse\s*\(/)
  assert.match(store, /reviews:\s*reviewsReducer/)
  assert.match(store, /reviewsToken: \(\) =>/)
  assert.doesNotMatch(slice, /\blocalStorage\s*\(|\buseState\s*\(/)
  assert.doesNotMatch(app, /\/reviews|\bfetch\s*\(|setReviewsByProduct|requestedReviews|reviewRequest/)
  assert.doesNotMatch(app, /\bfunction\s+canReview\s*\(/)
  assert.match(app, /useReviews\s*\(/)
})

test('Redux concentra el estado de las páginas y el detalle, pero no duplica entidades', () => {
  const page = modules.get(resolve(root, 'views/Catalog.jsx'))
  const detail = modules.get(resolve(root, 'hooks/useProductDetail.js'))
  const slice = modules.get(resolve(root, 'Redux/productsSlice.js'))
  const cacheHook = modules.get(resolve(root, 'hooks/useProductCache.js'))
  const store = modules.get(resolve(root, 'Redux/store.js'))
  assert.match(page, /dispatch\(fetchProductPage\(/)
  assert.match(detail, /dispatch\(fetchProductDetail\(/)
  assert.doesNotMatch(detail, /\[needsDetail,\s*productId/)
  assert.match(detail, /request\.status !== 'loading'/)
  assert.doesNotMatch(page, /\[result,\s*setResult\]/)
  assert.doesNotMatch(detail, /\[request,\s*setRequest\]/)
  assert.doesNotMatch(slice, /\bfetch\s*\(/)
  assert.doesNotMatch(slice, /\buseState\s*\(/)
  assert.doesNotMatch(slice, /\bentities\s*:/)
  assert.match(cacheHook, /catalogProductCache/)
  assert.match(store, /productCache:\s*catalogProductCache/)
})

test('Redux administra el estado del carrito; useCart coordina mutaciones y sesión', () => {
  const hook = modules.get(resolve(root, 'hooks/useCart.js'))
  const slice = modules.get(resolve(root, 'Redux/cartSlice.js'))
  const store = modules.get(resolve(root, 'Redux/store.js'))
  assert.match(hook, /useSelector\(/)
  assert.match(hook, /cartSessionCleared\(/)
  assert.match(hook, /cartOperationStarted\(/)
  assert.doesNotMatch(hook, /\buseState\s*\(/)
  assert.doesNotMatch(slice, /\bfetch\s*\(|from ['"]react['"]/)
  assert.match(slice, /generation/)
  assert.match(slice, /ownerId/)
  for (const thunk of ['fetchCart', 'addItemToCart', 'changeCartItemQuantity', 'deleteCartItem']) {
    assert.match(slice, new RegExp('export const ' + thunk + ' = cartRequest\\('))
  }
  assert.match(slice, /addCartRequestCases\(builder, fetchCart/)
  assert.match(slice, /addCartRequestCases\(builder, changeCartItemQuantity/)
  assert.doesNotMatch(hook, /\b(getCart|addCartItem|updateCartItemQuantity|removeCartItem)\s*\(/)
  assert.match(hook, /dispatch\(fetchCart\(/)
  assert.match(hook, /dispatch\(changeCartItemQuantity\(/)
  assert.match(modules.get(resolve(root, 'services/cartApi.js')), /import axios from 'axios'/)
  assert.match(modules.get(resolve(root, 'services/cartApi.js')), /axios\.request\(/)
  assert.doesNotMatch(modules.get(resolve(root, 'services/cartApi.js')), /\bfetch\s*\(|requestJson\s*\(/)
  assert.match(store, /cartToken: \(\) =>/)
  assert.match(store, /cart:\s*cartReducer/)
})

test('Redux administra el historial privado y detalles de pedidos sin caches duplicadas', () => {
  const hook = modules.get(resolve(root, 'hooks/useOrders.js'))
  const slice = modules.get(resolve(root, 'Redux/ordersSlice.js'))
  const store = modules.get(resolve(root, 'Redux/store.js'))
  assert.match(hook, /useSelector\(/)
  assert.match(hook, /useStore\(/)
  assert.match(hook, /ordersSessionCleared\(/)
  assert.match(hook, /dispatch\(fetchOrdersHistory\(/)
  assert.match(hook, /dispatch\(fetchOrderDetail\(/)
  assert.doesNotMatch(hook, /\bgetOrders\s*\(|\bgetOrderDetail\s*\(/)
  for (const name of ['fetchOrdersHistory', 'fetchOrderDetail']) {
    assert.ok(slice.includes('export const ' + name + ' = createAsyncThunk('), name)
    for (const stage of ['pending', 'fulfilled', 'rejected']) {
      assert.ok(slice.includes('.addCase(' + name + '.' + stage), name + '.' + stage)
    }
  }
  assert.match(store, /ordersToken: \(\) =>/)
  assert.doesNotMatch(hook, /\buseState\s*\(|historyCache|detailCache|\bfetch\s*\(/)
  assert.doesNotMatch(slice, /from ['"]react['"]|\bfetch\s*\(/)
  assert.match(slice, /ownerId/)
  assert.match(slice, /generation/)
  assert.match(store, /orders:\s*ordersReducer/)
})

test('Redux + Axios coordinan cotizacion y confirmacion con respuestas serializables', () => {
  const checkout = modules.get(resolve(root, 'hooks/useCheckout.js'))
  const quote = modules.get(resolve(root, 'hooks/useCheckoutQuote.js'))
  const slice = modules.get(resolve(root, 'Redux/checkoutSlice.js'))
  const store = modules.get(resolve(root, 'Redux/store.js'))
  assert.match(checkout, /useSelector\(/)
  assert.match(quote, /useSelector\(/)
  assert.match(checkout, /dispatch\(confirmCheckoutOrder\(/)
  assert.match(quote, /dispatch\(fetchCheckoutQuote\(/)
  assert.doesNotMatch(checkout, /\bcreateOrder\s*\(|\bfetch\s*\(/)
  assert.doesNotMatch(quote, /\bpreviewOrder\s*\(|\bfetch\s*\(/)
  assert.match(checkout, /crypto\.randomUUID\(\)/)
  assert.match(checkout, /beginCheckout\(\)/)
  assert.match(checkout, /\.unwrap\(\)/)
  assert.match(slice, /serializeCheckoutError/)
  for (const name of ['fetchCheckoutQuote', 'confirmCheckoutOrder']) {
    assert.ok(slice.includes('export const ' + name + ' = createAsyncThunk('), name)
    for (const stage of ['pending', 'fulfilled', 'rejected']) {
      assert.ok(slice.includes('.addCase(' + name + '.' + stage), name + '.' + stage)
    }
  }
  assert.match(store, /checkout:\s*checkoutReducer/)
  assert.match(store, /ordersToken: \(\) =>/)
  assert.doesNotMatch(slice, /\blocalStorage\s*\(|\buseState\s*\(/)
})

test('Publicaciones administra GET, POST, PUT, PATCH, DELETE y fotos mediante Redux y Axios', () => {
  const hook = modules.get(resolve(root, 'hooks/usePublications.js'))
  const slice = modules.get(resolve(root, 'Redux/publicationsSlice.js'))
  const service = modules.get(resolve(root, 'services/publicationsApi.js'))
  const store = modules.get(resolve(root, 'Redux/store.js'))
  assert.match(hook, /useSelector\(/)
  assert.match(hook, /dispatch\(/)
  assert.doesNotMatch(hook, /\buseState\s*\(|getPublications\s*\(|savePublication\s*\(/)
  for (const name of ['fetchOwnPublications', 'saveOwnPublication', 'setOwnPublicationStatus',
    'removeOwnPublication', 'uploadOwnPublicationPhoto']) {
    assert.ok(slice.includes('export const ' + name + ' = createAsyncThunk('), name)
    for (const stage of ['pending', 'fulfilled', 'rejected']) {
      assert.ok(slice.includes('.addCase(' + name + '.' + stage), name + '.' + stage)
    }
  }
  assert.match(service, /import axios from 'axios'/)
  assert.match(service, /axios\.request\(/)
  assert.doesNotMatch(service, /\bfetch\s*\(|requestJson\s*\(|readResponse\(/)
  assert.match(store, /publications:\s*publicationsReducer/)
  assert.match(store, /publicationToken: \(\) =>/)
  assert.doesNotMatch(slice, /\buseState\s*\(|\blocalStorage\s*\(/)
})

test('Usuarios replica el flujo Redux Toolkit + Axios del demo de Gisele', () => {
  const hook = modules.get(resolve(root, 'hooks/useSession.js'))
  const slice = modules.get(resolve(root, 'Redux/userSlice.js'))
  const api = modules.get(resolve(root, 'services/authApi.js'))
  const store = modules.get(resolve(root, 'Redux/store.js'))
  assert.match(store, /users:\s*userReducer/)
  assert.match(hook, /useSelector\(/)
  assert.match(hook, /dispatch\(fetchAuthenticatedUser\(\)\)/)
  assert.match(hook, /dispatch\(operation\(requestId\)\)/)
  assert.doesNotMatch(hook, /\buseState\s*\(|getCurrentUser\s*\(|authenticate\s*\(/)
  for (const name of ['fetchAuthenticatedUser', 'loginUser', 'registerUser']) {
    assert.ok(slice.includes('export const ' + name + ' = createAsyncThunk('), name)
    for (const stage of ['pending', 'fulfilled', 'rejected']) {
      assert.ok(slice.includes('.addCase(' + name + '.' + stage), name + '.' + stage)
    }
  }
  assert.match(api, /import axios from 'axios'/)
  assert.match(api, /axios\.request\(/)
  assert.doesNotMatch(api, /\bfetch\s*\(|requestJson\s*\(/)
  assert.match(slice, /stageAuthCredentials/)
  assert.match(store, /stateSanitizer:/)
  assert.doesNotMatch(slice, /password:\s*[^,]+/)
})
