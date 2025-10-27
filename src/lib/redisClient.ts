import { optionalCjsImport } from './utils/optional-import'

// Lightweight helper to create a Redis connection. If REDIS_USE_MOCK env var is set to 'true',
// uses ioredis-mock so you can run worker/scheduler without a real Redis (useful for local tests).
export async function createRedisConnection(url: string) {
  const useMock = process.env.REDIS_USE_MOCK === 'true'
  if (useMock) {
    const mockModule = await optionalCjsImport<any>('ioredis-mock')
    if (!mockModule) {
      throw new Error("REDIS_USE_MOCK=true requires installing 'ioredis-mock'")
    }
    const MockRedis = mockModule.default ?? mockModule
    return new MockRedis(url)
  }

  const ioredisModule = await optionalCjsImport<any>('ioredis')
  if (!ioredisModule) {
    throw new Error("Missing 'ioredis' dependency. Install it to create real Redis connections.")
  }
  const IORedis = ioredisModule.default ?? ioredisModule
  return new IORedis(url)
}

export default createRedisConnection
