import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = file => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8')

test('Home y relacionados despachan acciones; no ejecutan llamadas HTTP desde los efectos', () => {
  const home = read('hooks/useCatalog.js')
  const related = read('hooks/useProductDetail.js')
  assert.match(home, /dispatch\(fetchHomeProducts\(/)
  assert.match(related, /dispatch\(fetchRelatedProducts\(/)
  assert.doesNotMatch(home, /await loadPage\(|setHomeIds\(|setLoading\(|setError\(/)
  assert.doesNotMatch(related, /loadPage\(|setRelatedIds\(/)
})

test('Redux administra el ciclo completo de Home, catálogo, detalle y relacionados', () => {
  const slice = read('Redux/productsSlice.js')
  const catalog = read('views/Catalog.jsx')
  assert.match(catalog, /dispatch\(fetchProductPage\(/)
  for (const name of ['fetchHomeProducts', 'fetchProductPage', 'fetchProductDetail', 'fetchRelatedProducts']) {
    assert.match(slice, new RegExp('createAsyncThunk\\('))
    for (const stage of ['pending', 'fulfilled', 'rejected']) {
      assert.ok(slice.includes('.addCase(' + name + '.' + stage), name + '.' + stage)
    }
  }
})

test('Todos los GET públicos, incluso metadatos de carrito/selector, salen de thunks Redux', () => {
  const slice = read('Redux/productsSlice.js')
  const cache = read('utils/productCache.js')
  const hook = read('hooks/useCatalog.js')
  for (const name of ['fetchProductPage', 'fetchProductDetail',
    'fetchHomeProducts', 'fetchRelatedProducts', 'fetchSelectionProducts', 'fetchCachedProduct']) {
    assert.ok(slice.includes('export const ' + name + ' = createAsyncThunk('), name)
  }
  assert.match(slice, /import axios from 'axios'/)
  assert.match(slice, /axios\.get\(/)
  assert.match(hook, /dispatch\(fetchSelectionProducts\(/)
  assert.match(hook, /dispatch\(fetchCachedProduct\(/)
  assert.doesNotMatch(cache, /import axios|productsApi|axios\.get\(|\bfetch\s*\(/)
})
