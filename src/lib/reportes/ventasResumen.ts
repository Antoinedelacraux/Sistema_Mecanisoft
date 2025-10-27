import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

type Params = {
  fechaInicio: string // ISO date
  fechaFin: string // ISO date
  sucursalId?: number | null
  vendedorId?: number | null
  agruparPor?: 'dia' | 'semana' | 'mes' | 'producto' | 'vendedor'
}

function toNumber(value: any) {
  if (value == null) return value
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'object' && 'toNumber' in value && typeof (value as any).toNumber === 'function') {
    return (value as Prisma.Decimal).toNumber()
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? value : parsed
  }
  return value
}

function normalizeRows<T extends Record<string, any>>(rows: T[], mappings: Record<string, boolean>) {
  return rows.map((row) => {
    const normalized: Record<string, any> = { ...row }
    for (const key of Object.keys(mappings)) {
      if (key in normalized) {
        normalized[key] = toNumber(normalized[key])
      }
    }
    return normalized as T
  })
}

export async function getVentasResumen(params: Params) {
  const { fechaInicio, fechaFin, sucursalId = null, vendedorId = null, agruparPor = 'dia' } = params

  // map agruparPor to a date_trunc expression or join key
  let groupExpr = "date_trunc('day', v.fecha)"
  let selectExpr = "date_trunc('day', v.fecha) as periodo"
  const orderExpr = 'periodo'

  if (agruparPor === 'semana') {
    groupExpr = "date_trunc('week', v.fecha)"
    selectExpr = "date_trunc('week', v.fecha) as periodo"
  } else if (agruparPor === 'mes') {
    groupExpr = "date_trunc('month', v.fecha)"
    selectExpr = "date_trunc('month', v.fecha) as periodo"
  } else if (agruparPor === 'producto') {
    // For producto we'll group by product id/name — join required. We'll return a different shape below.
    // Use a simple query joining detalle_transaccion and producto
    const rows = await prisma.$queryRaw`
        SELECT p.id_producto as producto_id, p.nombre as producto, sum(dt.cantidad) as cantidad_vendida,
          sum(dt.total) as total_neto
  FROM detalle_transaccion dt
        JOIN transaccion v ON v.id_transaccion = dt.id_transaccion
        JOIN producto p ON p.id_producto = dt.id_producto
        WHERE v.fecha BETWEEN ${new Date(fechaInicio)} AND ${new Date(fechaFin)}
      ${sucursalId ? Prisma.sql`AND v.sucursal_id = ${sucursalId}` : Prisma.sql``}
      ${vendedorId ? Prisma.sql`AND v.vendedor_id = ${vendedorId}` : Prisma.sql``}
      GROUP BY p.id_producto, p.nombre
      ORDER BY total_neto DESC
      LIMIT 100
    `
    return normalizeRows(rows as any[], {
      cantidad_vendida: true,
      total_neto: true,
    })
  } else if (agruparPor === 'vendedor') {
    const rows = await prisma.$queryRaw`
  SELECT v.vendedor_id as vendedor_id, u.nombre as vendedor, count(*) as cantidad_ventas, sum(v.total) as total_neto
      FROM transaccion v
      LEFT JOIN usuario u ON u.id_usuario = v.vendedor_id
  WHERE v.fecha BETWEEN ${new Date(fechaInicio)} AND ${new Date(fechaFin)}
      ${sucursalId ? Prisma.sql`AND v.sucursal_id = ${sucursalId}` : Prisma.sql``}
      ${vendedorId ? Prisma.sql`AND v.vendedor_id = ${vendedorId}` : Prisma.sql``}
      GROUP BY v.vendedor_id, u.nombre
      ORDER BY total_neto DESC
      LIMIT 100
    `
    return normalizeRows(rows as any[], {
      cantidad_ventas: true,
      total_neto: true,
    })
  }

  // Default grouped by period (day/week/month)
  const rows = await prisma.$queryRaw`
    SELECT ${Prisma.raw(selectExpr)},
      count(*) as cantidad_ventas,
      sum(v.total) as total_neto,
      sum(v.descuento) as total_descuentos,
      sum(v.impuesto) as total_impuestos
    FROM transaccion v
    WHERE v.fecha BETWEEN ${new Date(fechaInicio)} AND ${new Date(fechaFin)}
    ${sucursalId ? Prisma.sql`AND v.sucursal_id = ${sucursalId}` : Prisma.sql``}
    ${vendedorId ? Prisma.sql`AND v.vendedor_id = ${vendedorId}` : Prisma.sql``}
    GROUP BY ${Prisma.raw(groupExpr)}
    ORDER BY ${Prisma.raw(orderExpr)}
    LIMIT 1000
  `

  return normalizeRows(rows as any[], {
    cantidad_ventas: true,
    total_neto: true,
    total_descuentos: true,
    total_impuestos: true,
  })
}
