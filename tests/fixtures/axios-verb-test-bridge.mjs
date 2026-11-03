// Sólo para las pruebas antiguas que simulan axios.request(config).
// La aplicación real usa axios.get/post/put/patch/delete directamente.
// Este adaptador conserva la forma del registro para comparar contratos HTTP
// sin reemplazar métodos de producción ni esconder los verbos en los slices.
import axios from 'axios'

for (const method of ['get', 'delete']) {
  axios[method] = (url, config = {}) => axios.request({
    url, method: method.toUpperCase(), ...config,
  })
}
for (const method of ['post', 'put', 'patch']) {
  axios[method] = (url, data, config = {}) => axios.request({
    url, method: method.toUpperCase(), data, ...config,
  })
}
