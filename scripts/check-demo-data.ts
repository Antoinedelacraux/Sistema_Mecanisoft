import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DAY_MS = 1000 * 60 * 60 * 24

async function main() {
  const now = new Date()
  const windowStart = new Date(now.getTime() - 30 * DAY_MS)

  const [ordenes, comprobantes, ventas, tareas, feedbacks] = await Promise.all([
    prisma.transaccion.count({ where: { tipo_transaccion: 'orden', fecha: { gte: windowStart } } }),
    prisma.comprobante.count({ where: { fecha_emision: { gte: windowStart } } }),
    prisma.venta.count({ where: { fecha: { gte: windowStart } } }),
    prisma.tarea.count({ where: { fecha_inicio: { gte: windowStart } } }),
    prisma.feedback.count({ where: { creado_en: { gte: windowStart } } })
  ])

  console.log('✅ Datos en los últimos 30 días:')
  console.table({ ordenes, comprobantes, ventas, tareas, feedbacks })
}

main()
  .catch((error) => {
    console.error('❌ Error validando datos demo:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
