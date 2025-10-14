import { Prisma, PrismaClient, EstadoComprobante } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { FacturacionError } from '@/lib/facturacion/errors'

type EstadoPagoVenta = Prisma.$Enums.EstadoPagoVenta
type MetodoPagoVenta = Prisma.$Enums.MetodoPagoVenta

export type RegistrarPagoInput = {
  id_comprobante: number
  metodo: MetodoPagoVenta
  monto?: number | null
  referencia?: string | null
  fecha_pago?: Date | null
  notas?: string | null
  id_venta_pago?: number | null
  accion?: 'crear' | 'actualizar' | 'eliminar'
}

export type RegistrarPagoResultado = {
  venta: {
    id_venta: number
    total: number
    total_pagado: number
    saldo: number
    estado_pago: EstadoPagoVenta
    metodo_principal: MetodoPagoVenta | null
    pagos: Array<{
      id_venta_pago: number
      metodo: MetodoPagoVenta
      monto: number
      referencia: string | null
      fecha_pago: string
      notas: string | null
      registrado_por: number
    }>
  }
  comprobante_estado_pago: string
}

const decimalToNumber = (value: Prisma.Decimal | number | null | undefined) => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  return Number(value.toString())
}

const estadoPagoToComprobante = (estado: EstadoPagoVenta) => {
  if (estado === 'pagado') return 'pagado'
  if (estado === 'parcial') return 'parcial'
  return 'pendiente'
}

export async function registrarPagoVenta(
  input: RegistrarPagoInput,
  usuarioId: number,
  prismaClient: PrismaClient | Prisma.TransactionClient = prisma
): Promise<RegistrarPagoResultado> {
  const accion = input.accion ?? (input.id_venta_pago ? 'actualizar' : 'crear')

  return prismaClient.$transaction(async (tx) => {
    const comprobante = await tx.comprobante.findUnique({
      where: { id_comprobante: input.id_comprobante },
      include: {
        venta: true
      }
    })

    if (!comprobante) {
      throw new FacturacionError('Comprobante no encontrado', 404)
    }

    if (comprobante.estado !== EstadoComprobante.EMITIDO) {
      throw new FacturacionError('Solo se pueden conciliar pagos de comprobantes emitidos.', 409)
    }

    const venta = comprobante.venta
      ? comprobante.venta
      : await tx.venta.create({
          data: {
            id_comprobante: comprobante.id_comprobante,
            fecha: comprobante.fecha_emision ?? new Date(),
            total: comprobante.total,
            total_pagado: new Prisma.Decimal(0),
            saldo: comprobante.total,
            estado_pago: 'pendiente'
          }
        })

    if (accion === 'eliminar') {
      if (!input.id_venta_pago) {
        throw new FacturacionError('Identificador del pago requerido para eliminar.', 400)
      }
      await tx.ventaPago.delete({
        where: { id_venta_pago: input.id_venta_pago }
      })
      await tx.comprobanteBitacora.create({
        data: {
          id_comprobante: comprobante.id_comprobante,
          id_usuario: usuarioId,
          accion: 'ELIMINAR_PAGO',
          descripcion: `Se eliminó el pago ${input.id_venta_pago ?? ''}`
        }
      })
    } else {
      const monto = input.monto ?? decimalToNumber(venta.saldo)
      if (monto <= 0) {
        throw new FacturacionError('El monto debe ser mayor a cero.', 400)
      }

      const montoDecimal = new Prisma.Decimal(monto)
      const limiteSaldo = new Prisma.Decimal(venta.saldo)
      const montoFinal = montoDecimal.greaterThan(limiteSaldo) && limiteSaldo.greaterThan(0) ? limiteSaldo : montoDecimal
      const fechaPago = input.fecha_pago ?? new Date()

      if (accion === 'actualizar') {
        if (!input.id_venta_pago) {
          throw new FacturacionError('Identificador del pago requerido para actualizar.', 400)
        }
        await tx.ventaPago.update({
          where: { id_venta_pago: input.id_venta_pago },
          data: {
            metodo: input.metodo,
            monto: montoFinal,
            referencia: input.referencia ?? null,
            fecha_pago: fechaPago,
            notas: input.notas ?? null
          }
        })
        await tx.comprobanteBitacora.create({
          data: {
            id_comprobante: comprobante.id_comprobante,
            id_usuario: usuarioId,
            accion: 'ACTUALIZAR_PAGO',
            descripcion: `Pago ${input.id_venta_pago} actualizado a ${input.metodo}`
          }
        })
      } else {
        const nuevoPago = await tx.ventaPago.create({
          data: {
            id_venta: venta.id_venta,
            metodo: input.metodo,
            monto: montoFinal,
            referencia: input.referencia ?? null,
            fecha_pago: fechaPago,
            notas: input.notas ?? null,
            registrado_por: usuarioId
          }
        })
        await tx.comprobanteBitacora.create({
          data: {
            id_comprobante: comprobante.id_comprobante,
            id_usuario: usuarioId,
            accion: 'REGISTRAR_PAGO',
            descripcion: `Pago ${nuevoPago.id_venta_pago} registrado por ${montoFinal.toString()} ${input.metodo}`
          }
        })
      }
    }

    const pagos = await tx.ventaPago.findMany({
      where: { id_venta: venta.id_venta },
      orderBy: { fecha_pago: 'asc' }
    })

    const totalPagadoDecimal = pagos.reduce(
      (acc, pago) => acc.plus(pago.monto),
      new Prisma.Decimal(0)
    )
    const saldoDecimal = new Prisma.Decimal(comprobante.total).minus(totalPagadoDecimal)
    const saldoAjustado = saldoDecimal.greaterThan(0) ? saldoDecimal : new Prisma.Decimal(0)

    let metodoPrincipal: MetodoPagoVenta | null = venta.metodo_principal
    if (pagos.length === 0) {
      metodoPrincipal = null
    } else if (!metodoPrincipal) {
      metodoPrincipal = pagos[pagos.length - 1].metodo
    } else if (accion !== 'crear') {
      // Recalcular método principal si el actual ya no existe
      if (!pagos.some((pago) => pago.metodo === metodoPrincipal)) {
        metodoPrincipal = pagos[pagos.length - 1]?.metodo ?? null
      }
    }

    const estadoPago: EstadoPagoVenta = saldoAjustado.lessThanOrEqualTo(0)
      ? 'pagado'
      : totalPagadoDecimal.greaterThan(0)
        ? 'parcial'
        : 'pendiente'

    const ventaActualizada = await tx.venta.update({
      where: { id_venta: venta.id_venta },
      data: {
        total_pagado: totalPagadoDecimal,
        saldo: saldoAjustado,
        estado_pago: estadoPago,
        metodo_principal: metodoPrincipal
      },
      include: { pagos: { orderBy: { fecha_pago: 'asc' } } }
    })

    await tx.comprobante.update({
      where: { id_comprobante: comprobante.id_comprobante },
      data: {
        estado_pago: estadoPagoToComprobante(estadoPago)
      }
    })

    return {
      venta: {
        id_venta: ventaActualizada.id_venta,
        total: decimalToNumber(ventaActualizada.total),
        total_pagado: decimalToNumber(ventaActualizada.total_pagado),
        saldo: decimalToNumber(ventaActualizada.saldo),
        estado_pago: ventaActualizada.estado_pago,
        metodo_principal: ventaActualizada.metodo_principal,
        pagos: ventaActualizada.pagos.map((pago) => ({
          id_venta_pago: pago.id_venta_pago,
          metodo: pago.metodo,
          monto: decimalToNumber(pago.monto),
          referencia: pago.referencia ?? null,
          fecha_pago: pago.fecha_pago.toISOString(),
          notas: pago.notas ?? null,
          registrado_por: pago.registrado_por
        }))
      },
      comprobante_estado_pago: estadoPagoToComprobante(estadoPago)
    }
  })
}
