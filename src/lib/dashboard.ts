import { EstadoComprobante, EstadoPagoVenta, Prisma } from '@prisma/client'
import {
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  formatISO,
  isAfter,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths
} from 'date-fns'

import { prisma } from '@/lib/prisma'
import type {
  DashboardAlert,
  DashboardAlertItem,
  DashboardCotizacionResumen,
  DashboardFilters,
  DashboardLowStockItem,
  DashboardOrdenResumen,
  DashboardPagoPendienteResumen,
  DashboardSummary,
  TopProductoEntry,
  VentasMetodoPagoEntry,
  VentasSeriesGranularity,
  VentasSeriesPoint
} from '@/types/dashboard'

const MAX_RANGE_DAYS = 365
const DEFAULT_PAGOS_PENDIENTES_DIAS = 7
const DEFAULT_COTIZACIONES_ALERTA_DIAS = 3
const FALLBACK_ALMACEN_LABEL = 'Inventario general'
const DECIMAL_ZERO = new Prisma.Decimal(0)

const ORDENES_ESTADOS_PENDIENTES = ['pendiente', 'por_hacer', 'en_proceso'] as const

const decimalToNumber = (value?: Prisma.Decimal | null): number => {
  if (!value) {
    return 0
  }
  return Number.parseFloat(value.toString())
}

const normalizeFilters = (input: DashboardFilters) => {
  const to = endOfDay(input.to)
  let from = startOfDay(input.from)

  if (isAfter(from, to)) {
    from = startOfDay(to)
  }

  const diff = Math.abs(differenceInCalendarDays(to, from))
  if (diff > MAX_RANGE_DAYS) {
    from = startOfDay(subDays(to, MAX_RANGE_DAYS))
  }

  return {
    from,
    to,
    almacenId: input.almacenId,
    usuarioId: input.usuarioId,
    alertThresholds: input.alertThresholds ?? {}
  }
}

const buildComprobanteDateWhere = (from: Date, to: Date, usuarioId?: number): Prisma.ComprobanteWhereInput => {
  const where: Prisma.ComprobanteWhereInput = {
    estado: EstadoComprobante.EMITIDO,
    OR: [
      {
        fecha_emision: {
          gte: from,
          lte: to
        }
      },
      {
        AND: [
          { fecha_emision: null },
          {
            creado_en: {
              gte: from,
              lte: to
            }
          }
        ]
      }
    ]
  }

  if (usuarioId) {
    where.creado_por = usuarioId
  }

  return where
}

const buildOrdenesWhere = (from: Date, to: Date, usuarioId?: number): Prisma.TransaccionWhereInput => {
  const where: Prisma.TransaccionWhereInput = {
    tipo_transaccion: 'orden',
    estatus: 'activo',
    estado_orden: {
      in: [...ORDENES_ESTADOS_PENDIENTES]
    },
    fecha: {
      gte: from,
      lte: to
    }
  }

  if (usuarioId) {
    where.id_usuario = usuarioId
  }

  return where
}

const formatPersonaNombre = (persona?: { nombre: string; apellido_paterno: string; apellido_materno: string | null }) => {
  if (!persona) {
    return 'Sin asignar'
  }
  const partes = [persona.nombre, persona.apellido_paterno, persona.apellido_materno?.trim()].filter(Boolean)
  return partes.join(' ')
}

const buildAlertItems = <T>(items: T[], build: (item: T) => DashboardAlertItem): DashboardAlertItem[] =>
  items.map((item) => build(item))

export async function getDashboardSummary(input: DashboardFilters): Promise<DashboardSummary> {
  const filters = normalizeFilters(input)
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)
  const monthStart = startOfMonth(now)
  const monthEnd = endOfMonth(now)
  const previousMonthStart = startOfMonth(subMonths(now, 1))
  const previousMonthEnd = endOfMonth(subMonths(now, 1))

  const [ventasHoyAgg, ventasMesAgg, ventasPrevMesAgg, ventasRangoAgg] = await Promise.all([
    prisma.comprobante.aggregate({
      _count: { _all: true },
      _sum: { total: true },
      where: buildComprobanteDateWhere(todayStart, todayEnd, filters.usuarioId)
    }),
    prisma.comprobante.aggregate({
      _count: { _all: true },
      _sum: { total: true },
      where: buildComprobanteDateWhere(monthStart, monthEnd, filters.usuarioId)
    }),
    prisma.comprobante.aggregate({
      _count: { _all: true },
      _sum: { total: true },
      where: buildComprobanteDateWhere(previousMonthStart, previousMonthEnd, filters.usuarioId)
    }),
    prisma.comprobante.aggregate({
      _count: { _all: true },
      _sum: { total: true },
      where: buildComprobanteDateWhere(filters.from, filters.to, filters.usuarioId)
    })
  ])

  const ventasHoyTotal = decimalToNumber(ventasHoyAgg._sum.total)
  const ventasMesTotal = decimalToNumber(ventasMesAgg._sum.total)
  const ventasPrevMesTotal = decimalToNumber(ventasPrevMesAgg._sum.total)
  const ventasRangoTotal = decimalToNumber(ventasRangoAgg._sum.total)

  const ventasMesDelta = ventasPrevMesTotal > 0 ? ((ventasMesTotal - ventasPrevMesTotal) / ventasPrevMesTotal) * 100 : null
  const ticketPromedio = ventasRangoAgg._count._all > 0 ? ventasRangoTotal / ventasRangoAgg._count._all : 0

  const ordenesWhere = buildOrdenesWhere(filters.from, filters.to, filters.usuarioId)
  const [ordenesPendientes, totalOrdenesPendientes] = await Promise.all([
    prisma.transaccion.findMany({
      where: ordenesWhere,
      orderBy: [{ prioridad: 'desc' }, { fecha_fin_estimada: 'asc' }, { fecha: 'asc' }],
      take: 5,
      select: {
        id_transaccion: true,
        codigo_transaccion: true,
        estado_orden: true,
        prioridad: true,
        fecha: true,
        fecha_fin_estimada: true,
        persona: {
          select: {
            nombre: true,
            apellido_paterno: true,
            apellido_materno: true
          }
        }
      }
    }),
    prisma.transaccion.count({ where: ordenesWhere })
  ])

  type LowStockRow = {
    id_inventario_producto: number
    id_producto: number
    producto_nombre: string
    almacen_nombre: string
    stock_disponible: Prisma.Decimal
    stock_minimo: Prisma.Decimal
  }

  const lowStockWhereAlmacen = filters.almacenId
    ? Prisma.sql`AND ip.id_almacen = ${filters.almacenId}`
    : Prisma.sql``

  const [lowStockRows, lowStockCount] = await Promise.all([
    prisma.$queryRaw<LowStockRow[]>(Prisma.sql`
      SELECT
        ip.id_inventario_producto,
        ip.id_producto,
        p.nombre AS producto_nombre,
        a.nombre AS almacen_nombre,
        ip.stock_disponible,
        ip.stock_minimo
      FROM inventario_producto ip
      INNER JOIN producto p ON p.id_producto = ip.id_producto
      INNER JOIN almacen a ON a.id_almacen = ip.id_almacen
      WHERE ip.stock_minimo > 0
        AND ip.stock_disponible <= ip.stock_minimo
        ${lowStockWhereAlmacen}
      ORDER BY (ip.stock_minimo - ip.stock_disponible) DESC
      LIMIT 10
    `),
    prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total
      FROM inventario_producto ip
      WHERE ip.stock_minimo > 0
        AND ip.stock_disponible <= ip.stock_minimo
        ${lowStockWhereAlmacen}
    `)
  ])

  let lowStockItems: DashboardLowStockItem[] = lowStockRows.map((row) => ({
    inventarioId: row.id_inventario_producto,
    productoId: row.id_producto,
    nombreProducto: row.producto_nombre,
    almacen: row.almacen_nombre,
    stockDisponible: decimalToNumber(row.stock_disponible),
    stockMinimo: decimalToNumber(row.stock_minimo)
  }))

  let lowStockTotal = lowStockCount[0] ? Number(lowStockCount[0].total) : 0

  if (lowStockTotal === 0 && !filters.almacenId) {
    type ProductoLowStockRow = {
      id_producto: number
      nombre: string
      stock: number
      stock_minimo: number
    }

    const productoLowStockWhere = Prisma.sql`
      WHERE p.estatus = true
        AND p.stock_minimo > 0
        AND p.stock <= p.stock_minimo
    `

    const [productoLowStockRows, productoLowStockCount] = await Promise.all([
      prisma.$queryRaw<ProductoLowStockRow[]>(Prisma.sql`
        SELECT
          p.id_producto,
          p.nombre,
          p.stock,
          p.stock_minimo
        FROM producto p
        ${productoLowStockWhere}
        ORDER BY (p.stock_minimo - p.stock) DESC
        LIMIT 10
      `),
      prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS total
        FROM producto p
        ${productoLowStockWhere}
      `)
    ])

    lowStockTotal = productoLowStockCount[0] ? Number(productoLowStockCount[0].total) : 0
    lowStockItems = productoLowStockRows.map((producto) => ({
      inventarioId: producto.id_producto,
      productoId: producto.id_producto,
      nombreProducto: producto.nombre,
      almacen: FALLBACK_ALMACEN_LABEL,
      stockDisponible: producto.stock,
      stockMinimo: producto.stock_minimo
    }))
  }

  const alertCotizacionesDias = filters.alertThresholds?.cotizacionesPorVencerDias ?? DEFAULT_COTIZACIONES_ALERTA_DIAS
  const cotizacionVencidaLimite = subDays(now, alertCotizacionesDias)

  const [cotizacionesVencidas, cotizacionesVencidasTotal] = await Promise.all([
    prisma.cotizacion.findMany({
      where: {
        vigencia_hasta: {
          lt: now
        },
        estado: {
          notIn: ['aprobada', 'rechazada']
        }
      },
      orderBy: [{ vigencia_hasta: 'desc' }],
      take: 5,
      select: {
        id_cotizacion: true,
        codigo_cotizacion: true,
        vigencia_hasta: true,
        estado: true,
        cliente: {
          select: {
            persona: {
              select: {
                nombre: true,
                apellido_paterno: true,
                apellido_materno: true
              }
            }
          }
        }
      }
    }),
    prisma.cotizacion.count({
      where: {
        vigencia_hasta: {
          lt: now
        },
        estado: {
          notIn: ['aprobada', 'rechazada']
        }
      }
    })
  ])

  const pagosPendientesDias = filters.alertThresholds?.pagosPendientesDias ?? DEFAULT_PAGOS_PENDIENTES_DIAS
  const pagosPendientesLimite = subDays(now, pagosPendientesDias)

  const pagosPendientes = await prisma.venta.findMany({
    where: {
      estado_pago: {
        in: [EstadoPagoVenta.pendiente, EstadoPagoVenta.parcial]
      },
      fecha: {
        lt: pagosPendientesLimite
      }
    },
    orderBy: [{ fecha: 'asc' }],
    take: 5,
    select: {
      id_venta: true,
      fecha: true,
      total: true,
      saldo: true,
      estado_pago: true,
      comprobante: {
        select: {
          serie: true,
          numero: true
        }
      }
    }
  })

  const pagosPendientesTotal = await prisma.venta.count({
    where: {
      estado_pago: {
        in: [EstadoPagoVenta.pendiente, EstadoPagoVenta.parcial]
      },
      fecha: {
        lt: pagosPendientesLimite
      }
    }
  })

  const ordenesResumen: DashboardOrdenResumen[] = ordenesPendientes.map((orden) => ({
    id: orden.id_transaccion,
    codigo: orden.codigo_transaccion,
    cliente: formatPersonaNombre(orden.persona),
    estado: orden.estado_orden,
    prioridad: orden.prioridad,
    fecha: orden.fecha ? formatISO(orden.fecha) : '',
    fechaEstimada: orden.fecha_fin_estimada ? formatISO(orden.fecha_fin_estimada) : null
  }))

  const cotizacionesResumen: DashboardCotizacionResumen[] = cotizacionesVencidas.map((cotizacion) => ({
    id: cotizacion.id_cotizacion,
    codigo: cotizacion.codigo_cotizacion,
    cliente: formatPersonaNombre(cotizacion.cliente?.persona),
    vigenciaHasta: cotizacion.vigencia_hasta ? formatISO(cotizacion.vigencia_hasta) : formatISO(cotizacionVencidaLimite),
    estado: cotizacion.estado
  }))

  const pagosPendientesResumen: DashboardPagoPendienteResumen[] = pagosPendientes.map((pago) => ({
    id: pago.id_venta,
    comprobante: pago.comprobante ? `${pago.comprobante.serie}-${pago.comprobante.numero}` : 'N/D',
    fecha: formatISO(pago.fecha),
    total: decimalToNumber(pago.total),
    saldo: decimalToNumber(pago.saldo),
    estado: pago.estado_pago
  }))

  const alerts: DashboardAlert[] = []

  if (lowStockTotal > 0) {
    alerts.push({
      type: 'LOW_STOCK',
      severity: lowStockTotal > 10 ? 'critical' : 'warning',
      title: 'Productos con stock bajo',
      description: `Hay ${lowStockTotal} productos por debajo del stock mínimo configurado.`,
      items: buildAlertItems(lowStockItems, (item) => ({
        id: `low-stock-${item.inventarioId}`,
        title: item.nombreProducto,
        subtitle: `${item.almacen} • Disponible: ${item.stockDisponible} • Mínimo: ${item.stockMinimo}`,
        href: `/dashboard/inventario/productos/${item.productoId}`
      }))
    })
  }

  if (cotizacionesVencidasTotal > 0) {
    alerts.push({
      type: 'QUOTE_EXPIRED',
      severity: cotizacionesVencidasTotal > 5 ? 'critical' : 'warning',
      title: 'Cotizaciones vencidas',
      description: `Existen ${cotizacionesVencidasTotal} cotizaciones vencidas que requieren seguimiento.`,
      items: buildAlertItems(cotizacionesResumen, (cotizacion) => ({
        id: `cotizacion-${cotizacion.id}`,
        title: cotizacion.codigo,
        subtitle: `${cotizacion.cliente} • Venció: ${cotizacion.vigenciaHasta}`,
        href: `/dashboard/cotizaciones/${cotizacion.id}`
      }))
    })
  }

  if (totalOrdenesPendientes > 0) {
    alerts.push({
      type: 'ORDER_PENDING',
      severity: totalOrdenesPendientes > 10 ? 'critical' : 'warning',
      title: 'Órdenes pendientes por iniciar',
      description: `Tienes ${totalOrdenesPendientes} órdenes en estado pendiente o en proceso.`,
      items: buildAlertItems(ordenesResumen, (orden) => ({
        id: `orden-${orden.id}`,
        title: orden.codigo,
        subtitle: `${orden.cliente} • Estado: ${orden.estado} • Prioridad: ${orden.prioridad}`,
        href: `/dashboard/ordenes?orden=${orden.id}`
      }))
    })
  }

  if (pagosPendientesTotal > 0) {
    alerts.push({
      type: 'PAYMENT_PENDING',
      severity: pagosPendientesTotal > 10 ? 'critical' : 'warning',
      title: 'Pagos pendientes',
      description: `Hay ${pagosPendientesTotal} ventas con pagos pendientes o parciales.`,
      items: buildAlertItems(pagosPendientesResumen, (pago) => ({
        id: `pago-${pago.id}`,
        title: pago.comprobante,
        subtitle: `Emitido: ${pago.fecha} • Saldo: S/ ${pago.saldo.toFixed(2)}`,
        href: `/dashboard/ventas/${pago.id}`
      }))
    })
  }

  return {
    ventasHoy: {
      total: ventasHoyTotal,
      comprobantes: ventasHoyAgg._count._all
    },
    ventasMes: {
      total: ventasMesTotal,
      comprobantes: ventasMesAgg._count._all,
      deltaPorcentaje: ventasMesDelta
    },
    ticketPromedio,
    ordenesPendientes: {
      total: totalOrdenesPendientes,
      top: ordenesResumen
    },
    stockBajo: {
      total: lowStockTotal,
      items: lowStockItems
    },
    cotizacionesVencidas: {
      total: cotizacionesVencidasTotal,
      items: cotizacionesResumen
    },
    pagosPendientes: {
      total: pagosPendientesTotal,
      items: pagosPendientesResumen
    },
    alerts
  }
}

type VentasSeriesRow = {
  periodo: Date
  total: Prisma.Decimal
}

export async function getVentasSeries(
  input: DashboardFilters,
  granularity: VentasSeriesGranularity = 'day'
): Promise<VentasSeriesPoint[]> {
  const filters = normalizeFilters(input)

  const dateTrunc = granularity === 'week' ? 'week' : granularity === 'month' ? 'month' : 'day'

  const rows = await prisma.$queryRaw<VentasSeriesRow[]>(Prisma.sql`
    SELECT
      date_trunc(${Prisma.sql`${dateTrunc}`}, COALESCE(c.fecha_emision, c.creado_en)) AS periodo,
      SUM(c.total) AS total
    FROM comprobante c
    WHERE c.estado::text = ${EstadoComprobante.EMITIDO}
      AND COALESCE(c.fecha_emision, c.creado_en) BETWEEN ${filters.from} AND ${filters.to}
    GROUP BY 1
    ORDER BY 1 ASC
  `)

  return rows.map((row) => ({
    label: formatISO(row.periodo, { representation: 'date' }),
    date: formatISO(row.periodo),
    total: decimalToNumber(row.total)
  }))
}

export async function getTopProductos(
  input: DashboardFilters,
  limit = 10
): Promise<TopProductoEntry[]> {
  const filters = normalizeFilters(input)
  const topLimit = Math.min(Math.max(limit, 1), 50)

  type TopProductoRow = {
    id_producto: number
    nombre_producto: string
    cantidad_total: Prisma.Decimal
    total_vendido: Prisma.Decimal
  }

  const rows = await prisma.$queryRaw<TopProductoRow[]>(Prisma.sql`
    SELECT
      cd.id_producto,
      p.nombre AS nombre_producto,
      SUM(cd.cantidad) AS cantidad_total,
      SUM(cd.total) AS total_vendido
    FROM comprobante_detalle cd
    INNER JOIN comprobante c ON c.id_comprobante = cd.id_comprobante
    INNER JOIN producto p ON p.id_producto = cd.id_producto
    WHERE cd.id_producto IS NOT NULL
      AND c.estado::text = ${EstadoComprobante.EMITIDO}
      AND COALESCE(c.fecha_emision, c.creado_en) BETWEEN ${filters.from} AND ${filters.to}
    GROUP BY cd.id_producto, p.nombre
    ORDER BY SUM(cd.total) DESC
    LIMIT ${topLimit}
  `)

  return rows.map((row) => ({
    idProducto: row.id_producto,
    nombreProducto: row.nombre_producto,
    cantidad: decimalToNumber(row.cantidad_total),
    total: decimalToNumber(row.total_vendido)
  }))
}

type VentasMetodoPagoRow = {
  metodo: string | null
  total: Prisma.Decimal
}

export async function getVentasPorMetodoPago(input: DashboardFilters): Promise<VentasMetodoPagoEntry[]> {
  const filters = normalizeFilters(input)

  const rows = await prisma.$queryRaw<VentasMetodoPagoRow[]>(Prisma.sql`
    SELECT
      COALESCE(v.metodo_principal::text, 'SIN_ASIGNAR') AS metodo,
      SUM(v.total) AS total
    FROM venta v
    INNER JOIN comprobante c ON c.id_comprobante = v.id_comprobante
    WHERE c.estado::text = ${EstadoComprobante.EMITIDO}
      AND COALESCE(c.fecha_emision, c.creado_en) BETWEEN ${filters.from} AND ${filters.to}
    GROUP BY 1
    ORDER BY SUM(v.total) DESC
  `)

  return rows.map((row) => ({
    metodo: row.metodo ?? 'SIN_ASIGNAR',
    total: decimalToNumber(row.total)
  }))
}
