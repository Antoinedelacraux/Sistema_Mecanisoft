import { obtenerResumenVentas } from '../src/app/api/ventas/controllers/resumen-ventas'
import { prisma } from '../src/lib/prisma'

async function main() {
  console.log('Ejecutando comprobación de resumen de ventas (sin fechas)...')
  const resumen = await obtenerResumenVentas({}, prisma)
  console.log('Resultado:')
  console.log(JSON.stringify(resumen, null, 2))
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
