import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({ log: ['query','warn','error'] })

async function main() {
  prisma.$on('query', (e) => {
    console.log('SQL:', e.query)
  })
  const rows = await prisma.rol.findMany()
  console.log('rows:', rows)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
