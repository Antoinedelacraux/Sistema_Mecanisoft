import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    console.log('[DB-TEST] Starting test query')
    // Simple lightweight query to check connectivity
    const result = await prisma.$queryRaw`SELECT 1 as ok`
    console.log('[DB-TEST] Query result:', JSON.stringify(result))
    return new Response(JSON.stringify({ ok: true, result }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('[DB-TEST] Error connecting to DB:', error)
    const message = (error && (error as any).message) ? (error as any).message : String(error)
    return new Response(JSON.stringify({ ok: false, error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
