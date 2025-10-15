import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const rows: { modulo: string }[] = await prisma.$queryRawUnsafe(`SELECT DISTINCT modulo FROM permiso`)
  console.log('distinct modulo in permiso:', rows)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
