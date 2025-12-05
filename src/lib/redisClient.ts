import { optionalCjsImport } from './utils/optional-import'

type CreateRedisOptions = {
  allowMockFallback?: boolean
}

async function createMockConnection(url: string) {
  const mockModule = await optionalCjsImport<any>('ioredis-mock')
  if (!mockModule) {
    throw new Error("Falta la dependencia 'ioredis-mock' para usar el modo mock de Redis")
  }
  const MockRedis = mockModule.default ?? mockModule
  return new MockRedis(url)
}

// Lightweight helper to create a Redis connection. Si REDIS_USE_MOCK está en 'true' o la conexión real falla,
// usa ioredis-mock para que los workers/schedulers funcionen sin servicios externos.
export async function createRedisConnection(url: string, options: CreateRedisOptions = {}) {
  const allowMockFallback = options.allowMockFallback ?? true
  const isProduction = process.env.NODE_ENV === 'production'
  const mockFallbackEnabled = process.env.REDIS_ALLOW_MOCK_FALLBACK === 'true' || !isProduction
  const useMock = process.env.REDIS_USE_MOCK === 'true'

  if (useMock) {
    return createMockConnection(url)
  }

  const ioredisModule = await optionalCjsImport<any>('ioredis')
  if (!ioredisModule) {
    throw new Error("No se encontró la dependencia 'ioredis'. Instálala para usar Redis real.")
  }
  const IORedis = ioredisModule.default ?? ioredisModule
  const client = new IORedis(url, { lazyConnect: true })

  try {
    await client.connect()
    return client
  } catch (error) {
    client.disconnect()
    if (!allowMockFallback || !mockFallbackEnabled) {
      throw error
    }
    console.warn('[redis] Conexión falló, usando ioredis-mock:', (error as Error)?.message ?? error)
    process.env.REDIS_USE_MOCK = 'true'
    return createRedisConnection(url, { allowMockFallback: false })
  }
}

export default createRedisConnection
