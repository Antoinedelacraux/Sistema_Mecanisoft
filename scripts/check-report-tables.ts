import { prisma } from '@/lib/prisma'

async function main() {
  const res = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'report%';`
  console.log(res)
}

main().catch((e)=>{console.error(e); process.exit(1)}).finally(()=>prisma.$disconnect())
