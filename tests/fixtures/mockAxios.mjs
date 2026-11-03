import axios from 'axios'

// Las pruebas observan los métodos que ejecuta producción, sin modificar
// globalmente axios ni recrear un cliente HTTP que no existe en la aplicación.
// El callback recibe un objeto uniforme para comprobar URL, verbo, JWT y JSON.
export function mockAxios(t, initialImplementation) {
  let implementation = initialImplementation
  let count = 0
  const calls = []
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    t.mock.method(axios, method, (...args) => {
      const url = args[0]
      const writesBody = !['get', 'delete'].includes(method)
      const data = writesBody ? args[1] : undefined
      const options = writesBody ? args[2] : args[1]
      const request = { ...options, url, method: method.toUpperCase(), data }
      calls.push(request)
      count += 1
      if (typeof implementation !== 'function') {
        throw new Error('No hay respuesta Axios simulada para ' + method + ' ' + url)
      }
      return implementation(request)
    })
  }
  return { mock: {
    callCount: () => count,
    mockImplementation: next => { implementation = next },
    calls,
  } }
}
