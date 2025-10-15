import { Prisma, EstadoComprobante } from '@prisma/client'
import { prisma } from '../src/lib/prisma'

const BATCH_SIZE = 100

const toDecimal = (value: Prisma.Decimal | number): Prisma.Decimal =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value)

async function backfillVentas() {
  let processed = 0
  let created = 0
  let updated = 0
  let cursor: number | null = null

  console.log('Iniciando backfill de ventas...')

  while (true) {
    const comprobantes = await prisma.comprobante.findMany({
      where: { estado: EstadoComprobante.EMITIDO },
      orderBy: { id_comprobante: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id_comprobante: cursor } } : {}),
      include: {
        venta: {
          include: {
            pagos: true
          }
        }
      }
    }) as Array<any>

    if (comprobantes.length === 0) {
      break
    }

    const operaciones = comprobantes.map((comprobante: any) => {
      const existente = comprobante.venta as any | null
      const pagos = (existente?.pagos ?? []) as Array<any>

      const total = toDecimal(comprobante.total)
      const totalPagadoDesdePagos = pagos.reduce(
        (acc: Prisma.Decimal, pago: any) => acc.plus(pago.monto),
        new Prisma.Decimal(0)
      )
      const totalPagado = pagos.length > 0
        ? totalPagadoDesdePagos
        : existente
          ? toDecimal(existente.total_pagado)
          : new Prisma.Decimal(0)

      const saldoDecimal = total.minus(totalPagado)
      const saldo = saldoDecimal.greaterThan(0) ? saldoDecimal : new Prisma.Decimal(0)
      const estadoPago = saldo.lessThanOrEqualTo(0)
        ? 'pagado'
        : totalPagado.greaterThan(0)
          ? 'parcial'
          : 'pendiente'

      const metodoPrincipal = existente?.metodo_principal ?? (pagos.length > 0 ? pagos[pagos.length - 1].metodo : null)
      const fecha = comprobante.fecha_emision ?? comprobante.creado_en

      if (existente) {
        updated += 1
        return prisma.venta.update({
          where: { id_comprobante: comprobante.id_comprobante },
          data: {
            fecha,
            total,
            total_pagado: totalPagado,
            saldo,
            estado_pago: estadoPago,
            metodo_principal: metodoPrincipal
          }
        })
      }

      created += 1
      return prisma.venta.create({
        data: {
          id_comprobante: comprobante.id_comprobante,
          fecha,
          total,
          total_pagado: totalPagado,
          saldo,
          estado_pago: estadoPago,
          metodo_principal: metodoPrincipal
        }
      })
    })

  await prisma.$transaction(operaciones)

    processed += comprobantes.length
    cursor = comprobantes[comprobantes.length - 1].id_comprobante

    console.log(`Lote procesado: ${processed} comprobantes (${created} creados, ${updated} actualizados)`) // eslint-disable-line no-console
  }

  console.log(`Backfill finalizado. Total procesado: ${processed}. Creados: ${created}. Actualizados: ${updated}.`) // eslint-disable-line no-console
}

backfillVentas()
  .catch((error) => {
    console.error('Backfill falló:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
