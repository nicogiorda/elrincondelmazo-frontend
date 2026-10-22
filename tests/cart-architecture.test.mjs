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

test('App compone una única instancia de sesión y de carrito compartida por las rutas', () => {
  for (const hook of ['useCart', 'useSession']) {
    const sites = [...modules].filter(([, source]) => new RegExp('=\\s*' + hook + '\\(').test(source))
    assert.equal(sites.length, 1)
    assert.equal(sites[0][0], resolve(root, 'App.jsx'))
    assert.equal([...sites[0][1].matchAll(new RegExp('=\\s*' + hook + '\\(', 'g'))].length, 1)
  }
})

test('Los endpoints del carrito pertenecen a cartApi y useCart no hace HTTP directo', () => {
  const owners = [...modules].filter(([, source]) => /['"`]\/carts(?:\/|['"`])/.test(source))
  assert.deepEqual(owners.map(([path]) => relative(root, path).replaceAll('\\', '/')), ['services/cartApi.js'])
  assert.doesNotMatch(modules.get(resolve(root, 'hooks/useCart.js')), /\bfetch\s*\(/)
})
