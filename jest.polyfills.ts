try {
  require('next/dist/server/node-polyfill-fetch')
  require('next/dist/server/node-polyfill-web-streams')
} catch (error) {
  // Si la polyfill de Next no está disponible, continuamos sin lanzar el error
}

try {
  const { fetch, Headers, Request, Response, FormData, File, Blob } = require('undici')
  if (typeof global.fetch === 'undefined') {
    global.fetch = fetch
  }
  if (typeof global.Headers === 'undefined') {
    global.Headers = Headers
  }
  if (typeof global.Request === 'undefined') {
    global.Request = Request
  }
  if (typeof global.Response === 'undefined') {
    global.Response = Response
  }
  if (typeof global.FormData === 'undefined') {
    global.FormData = FormData
  }
  if (typeof global.File === 'undefined') {
    global.File = File
  }
  if (typeof global.Blob === 'undefined') {
    global.Blob = Blob
  }
} catch (error) {
  // undici puede no estar disponible en entornos antiguos de Node
}

try {
  const { TextEncoder, TextDecoder } = require('util')
  if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = TextEncoder
  }
  if (typeof global.TextDecoder === 'undefined') {
    global.TextDecoder = TextDecoder as unknown as typeof global.TextDecoder
  }
} catch (error) {
  // Entornos antiguos podrían no exponer util.TextEncoder/TextDecoder
}
