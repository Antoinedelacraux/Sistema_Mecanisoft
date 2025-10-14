import { Prisma, PrismaClient, EstadoComprobante } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type EstadoPagoVenta = Prisma.$Enums.EstadoPagoVenta
type MetodoPagoVenta = Prisma.$Enums.MetodoPagoVenta

type ResumenVentasParams = {
  fechaDesde?: Date | null
  fechaHasta?: Date | null
}

export type ResumenVentasResultado = {
  totalVentas: number
  numeroComprobantes: number
  promedio: number
  porMetodo: Record<MetodoPagoVenta | 'SIN_REGISTRO', number>
  porEstadoPago: Record<EstadoPagoVenta, number>
}

const decimalToNumber = (value: Prisma.Decimal | number | null | undefined) => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  return Number(value.toString())
}

export async function obtenerResumenVentas(
  params: ResumenVentasParams,
  prismaClient: PrismaClient | Prisma.TransactionClient = prisma
): Promise<ResumenVentasResultado> {
  const { fechaDesde = null, fechaHasta = null } = params

  const emptyResumen: ResumenVentasResultado = {
    totalVentas: 0,
    numeroComprobantes: 0,
    promedio: 0,
    porMetodo: {
      EFECTIVO: 0,
      TARJETA: 0,
      APP_MOVIL: 0,
      TRANSFERENCIA: 0,
      OTRO: 0,
      SIN_REGISTRO: 0
    },
    porEstadoPago: {
      pendiente: 0,
      parcial: 0,
      pagado: 0
    }
  }

  const where: Prisma.VentaWhereInput = {
    comprobante: {
      estado: EstadoComprobante.EMITIDO
    }
  }

  if (fechaDesde || fechaHasta) {
    where.fecha = {}
    if (fechaDesde) where.fecha.gte = fechaDesde
    if (fechaHasta) where.fecha.lte = fechaHasta
  }

  try {
    const [agregado, porMetodo, porEstado] = await Promise.all([
      prismaClient.venta.aggregate({
        where,
        _sum: { total: true },
        _count: { _all: true }
      }),
      prismaClient.venta.groupBy({
        where,
        by: ['metodo_principal'],
        _sum: { total: true }
      }),
      prismaClient.venta.groupBy({
        where,
        by: ['estado_pago'],
        _count: { _all: true }
      })
    ])

    const totalVentas = decimalToNumber(agregado._sum.total)
    const numeroComprobantes = agregado._count._all ?? 0
    const promedio = numeroComprobantes > 0 ? totalVentas / numeroComprobantes : 0

    const porMetodoMap: Record<MetodoPagoVenta | 'SIN_REGISTRO', number> = {
      EFECTIVO: 0,
      TARJETA: 0,
      APP_MOVIL: 0,
      TRANSFERENCIA: 0,
      OTRO: 0,
      SIN_REGISTRO: 0
    }

    for (const grupo of porMetodo) {
      const monto = decimalToNumber(grupo._sum.total)
      if (!grupo.metodo_principal) {
        porMetodoMap.SIN_REGISTRO += monto
      } else {
        porMetodoMap[grupo.metodo_principal] += monto
      }
    }

    const porEstadoPago: Record<EstadoPagoVenta, number> = {
      pendiente: 0,
      parcial: 0,
      pagado: 0
    }

    for (const grupo of porEstado) {
      const estado = grupo.estado_pago
      porEstadoPago[estado] = grupo._count._all ?? 0
    }

    return {
      totalVentas,
      numeroComprobantes,
      promedio,
      porMetodo: porMetodoMap,
      porEstadoPago
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
      // La tabla aún no existe (migración pendiente). Retornamos un resumen vacío para evitar errores en la UI.
      return emptyResumen
    }
    console.error('Error obteniendo resumen de ventas:', error)
    throw error
  }
}
