import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const res = await prisma.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'rol';")
  console.log('rol columns:', res)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
