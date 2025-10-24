import { PrismaClient } from '@prisma/client'

// Deletes bitacora entries older than N days (default 365)
async function main() {
  const prisma = new PrismaClient()
  try {
    const days = Number(process.env.DAYS ?? '365')
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    console.log(`Deleting bitacora entries older than ${cutoff.toISOString()}...`)
    const res = await prisma.bitacora.deleteMany({ where: { fecha_hora: { lt: cutoff } } })
    console.log(`Deleted ${res.count} entries.`)
  } catch (e) {
    console.error('Error cleaning bitacora', e)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

