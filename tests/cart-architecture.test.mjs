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
  for (const hook of ['useCart', 'useSession', 'useCatalog', 'useCheckout', 'useOrders', 'usePublications', 'useAdminPromotions', 'useAccount']) {
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
