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
  assert.doesNotMatch(modules.get(resolve(root, 'services/ordersApi.js')), /from\s*['"]react['"]|\buseState\(/)
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

test('Promociones administrativas separa HTTP, estado y conversiones puras', () => {
  assert.doesNotMatch(modules.get(resolve(root, 'hooks/useAdminPromotions.js')), /\bfetch\s*\(/)
  for (const path of ['services/promotionsApi.js', 'utils/promotionMapper.js']) {
    assert.doesNotMatch(modules.get(resolve(root, path)), /from\s*['"]react['"]|\buseState\(/)
  }
  assert.doesNotMatch(modules.get(resolve(root, 'App.jsx')), /promotionRequest|promotionAttempt|promotionFromBackend|promotionToBackend|API_URL.*promotions/)
})

test('Cuenta delega HTTP y conserva el usuario únicamente en useSession', () => {
  const hook = modules.get(resolve(root, 'hooks/useAccount.js'))
  assert.doesNotMatch(hook, /\bfetch\s*\(|\[user,\s*setUser\]/)
  assert.doesNotMatch(modules.get(resolve(root, 'services/accountApi.js')), /from\s*['"]react['"]|\buseState\(/)
  assert.doesNotMatch(modules.get(resolve(root, 'App.jsx')), /\/users\/me|accountRequest|setProfileSaving|setDeactivating|setDeactivateError/)
})

test('Reseñas separa HTTP, estado y composición', () => {
  assert.match(modules.get(resolve(root, 'services/reviewsApi.js')), /\/reviews/)
  assert.doesNotMatch(modules.get(resolve(root, 'App.jsx')), /\/reviews/)
  assert.doesNotMatch(modules.get(resolve(root, 'hooks/useReviews.js')), /\bfetch\s*\(/)
  assert.doesNotMatch(modules.get(resolve(root, 'services/reviewsApi.js')), /from\s*['"]react['"]|\buseState\s*\(/)
  const app = modules.get(resolve(root, 'App.jsx'))
  assert.doesNotMatch(app, /\bfetch\s*\(|setReviewsByProduct|requestedReviews|reviewRequest/)
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
  assert.doesNotMatch(slice, /\bfetch\s*\(|from ['"]react['"]|from ['"]\.\.\/services\/cartApi\.js['"]/)
  assert.match(slice, /generation/)
  assert.match(slice, /ownerId/)
  assert.match(store, /cart:\s*cartReducer/)
})

test('Redux administra el historial privado y detalles de pedidos sin caches duplicadas', () => {
  const hook = modules.get(resolve(root, 'hooks/useOrders.js'))
  const slice = modules.get(resolve(root, 'Redux/ordersSlice.js'))
  const store = modules.get(resolve(root, 'Redux/store.js'))
  assert.match(hook, /useSelector\(/)
  assert.match(hook, /useStore\(/)
  assert.match(hook, /ordersSessionCleared\(/)
  assert.match(hook, /ordersHistoryLoaded\(/)
  assert.doesNotMatch(hook, /\buseState\s*\(|historyCache|detailCache|\bfetch\s*\(/)
  assert.doesNotMatch(slice, /from ['"]react['"]|\bfetch\s*\(/)
  assert.match(slice, /ownerId/)
  assert.match(slice, /generation/)
  assert.match(store, /orders:\s*ordersReducer/)
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
