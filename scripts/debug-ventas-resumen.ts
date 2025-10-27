import { getVentasResumen } from '@/lib/reportes/ventasResumen'

async function main() {
  const rows = await getVentasResumen({
    fechaInicio: '2025-01-01',
    fechaFin: '2025-12-31',
    agruparPor: 'dia',
  })
  console.log(rows.slice(0, 5))
}

main().catch((error) => {
  console.error('Error during getVentasResumen:', error)
}).finally(async () => {
  const { prisma } = await import('@/lib/prisma')
  await prisma.$disconnect()
})
