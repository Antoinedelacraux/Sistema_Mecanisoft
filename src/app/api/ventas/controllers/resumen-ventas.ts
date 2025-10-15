import { Prisma, PrismaClient, EstadoComprobante, EstadoPagoVenta, MetodoPagoVenta } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Use the enum types exported by Prisma client

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
    // Use a safe findMany + in-memory reduction to avoid SQL ambiguity when multiple tables
    // have a `total` column (Postgres can complain about ambiguous references).
    const ventas = await prismaClient.venta.findMany({
      where,
      select: { metodo_principal: true, estado_pago: true, total: true }
    })

    let totalVentas = 0
    let numeroComprobantes = 0

    const porMetodoMap: Record<MetodoPagoVenta | 'SIN_REGISTRO', number> = {
      EFECTIVO: 0,
      TARJETA: 0,
      APP_MOVIL: 0,
      TRANSFERENCIA: 0,
      OTRO: 0,
      SIN_REGISTRO: 0
    }

    const porEstadoPago: Record<EstadoPagoVenta, number> = {
      pendiente: 0,
      parcial: 0,
      pagado: 0
    }

    for (const v of ventas) {
      const monto = decimalToNumber(v.total)
      totalVentas += monto
      numeroComprobantes += 1

      if (!v.metodo_principal) {
        porMetodoMap.SIN_REGISTRO += monto
      } else {
        const key = v.metodo_principal as MetodoPagoVenta
        porMetodoMap[key] = (porMetodoMap[key] ?? 0) + monto
      }

      const estadoKey = v.estado_pago as EstadoPagoVenta
      porEstadoPago[estadoKey] = (porEstadoPago[estadoKey] ?? 0) + 1
    }

    const promedio = numeroComprobantes > 0 ? totalVentas / numeroComprobantes : 0

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
