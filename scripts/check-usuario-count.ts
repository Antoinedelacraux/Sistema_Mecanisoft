import { prisma } from '@/lib/prisma'

async function main() {
  const res = await prisma.$queryRaw`SELECT count(*)::int as c FROM "usuario"`
  console.log(res)
}

main().catch((e)=>{console.error(e); process.exit(1)}).finally(()=>prisma.$disconnect())
