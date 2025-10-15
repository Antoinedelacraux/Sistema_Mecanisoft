import { Prisma, PrismaClient, EstadoComprobante, OrigenComprobante, TipoComprobante, EstadoPagoVenta, MetodoPagoVenta } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Use enum types directly from Prisma client

export type ListarVentasParams = {
  page: number
  limit: number
  fechaDesde?: Date | null
  fechaHasta?: Date | null
  metodo?: MetodoPagoVenta | null
  estadoPago?: EstadoPagoVenta | null
  origen?: OrigenComprobante | null
  tipo?: TipoComprobante | null
  serie?: string | null
  search?: string | null
}

const decimalToNumber = (value: Prisma.Decimal | number | null | undefined) => {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  return Number(value.toString())
}

export type VentaListadoItem = {
  id_venta: number
  fecha: string
  total: number
  total_pagado: number
  saldo: number
  estado_pago: EstadoPagoVenta
  metodo_principal: MetodoPagoVenta | null
  comprobante: {
    id_comprobante: number
    serie: string
    numero: number
    codigo: string | null
    estado: EstadoComprobante
    tipo: TipoComprobante
    receptor_nombre: string
    receptor_documento: string
    origen_tipo: OrigenComprobante
    origen_id: number
    fecha_emision: string | null
    total: number
    estado_pago: string
    descripcion: string | null
  }
  pagos: Array<{
    id_venta_pago: number
    metodo: MetodoPagoVenta
    monto: number
    referencia: string | null
    fecha_pago: string
    notas: string | null
    registrado_por: number
  }>
  items: number
}

export type ListarVentasResultado = {
  ventas: VentaListadoItem[]
  pagination: {
    total: number
    pages: number
    current: number
    limit: number
  }
}

export async function listarVentas(
  params: ListarVentasParams,
  prismaClient: PrismaClient | Prisma.TransactionClient = prisma
): Promise<ListarVentasResultado> {
  const {
    page,
    limit,
    fechaDesde = null,
    fechaHasta = null,
    metodo = null,
    estadoPago = null,
    origen = null,
    tipo = null,
    serie = null,
    search = null
  } = params

  const where: Prisma.VentaWhereInput = {
    AND: [
      {
        comprobante: {
          estado: EstadoComprobante.EMITIDO
        }
      }
    ]
  }

  if (fechaDesde || fechaHasta) {
    where.fecha = {}
    if (fechaDesde) where.fecha.gte = fechaDesde
    if (fechaHasta) where.fecha.lte = fechaHasta
  }

  if (metodo) {
    where.metodo_principal = metodo
  }

  if (estadoPago) {
    where.estado_pago = estadoPago
  }

  if (origen) {
    ;(where.AND as Prisma.VentaWhereInput[]).push({ comprobante: { origen_tipo: origen } })
  }

  if (tipo) {
    ;(where.AND as Prisma.VentaWhereInput[]).push({ comprobante: { tipo } })
  }

  if (serie) {
    ;(where.AND as Prisma.VentaWhereInput[]).push({ comprobante: { serie: { equals: serie, mode: 'insensitive' } } })
  }

  if (search && search.trim().length > 0) {
    const term = search.trim()
    ;(where.AND as Prisma.VentaWhereInput[]).push({
      OR: [
        { comprobante: { serie: { contains: term, mode: 'insensitive' } } },
        { comprobante: { codigo: { contains: term, mode: 'insensitive' } } },
        { comprobante: { receptor_nombre: { contains: term, mode: 'insensitive' } } },
        { comprobante: { receptor_documento: { contains: term, mode: 'insensitive' } } }
      ]
    })
  }

  const skip = (page - 1) * limit

  const [total, ventas] = await Promise.all([
    prismaClient.venta.count({ where }),
    prismaClient.venta.findMany({
      where,
      include: {
        comprobante: {
          select: {
            id_comprobante: true,
            serie: true,
            numero: true,
            codigo: true,
            estado: true,
            tipo: true,
            receptor_nombre: true,
            receptor_documento: true,
            origen_tipo: true,
            origen_id: true,
            fecha_emision: true,
            total: true,
            estado_pago: true,
            descripcion: true,
            detalles: {
              select: {
                id_comprobante_detalle: true
              }
            }
          }
        },
        pagos: {
          orderBy: { fecha_pago: 'asc' }
        }
      },
      orderBy: { fecha: 'desc' },
      skip,
      take: limit
    })
  ])

  const items: VentaListadoItem[] = ventas.map((venta) => ({
    id_venta: venta.id_venta,
    fecha: venta.fecha.toISOString(),
    total: decimalToNumber(venta.total),
    total_pagado: decimalToNumber(venta.total_pagado),
    saldo: decimalToNumber(venta.saldo),
    estado_pago: venta.estado_pago,
    metodo_principal: venta.metodo_principal,
    comprobante: {
      id_comprobante: venta.comprobante.id_comprobante,
      serie: venta.comprobante.serie,
      numero: venta.comprobante.numero,
      codigo: venta.comprobante.codigo,
      estado: venta.comprobante.estado,
      tipo: venta.comprobante.tipo,
      receptor_nombre: venta.comprobante.receptor_nombre,
      receptor_documento: venta.comprobante.receptor_documento,
      origen_tipo: venta.comprobante.origen_tipo,
      origen_id: venta.comprobante.origen_id,
      fecha_emision: venta.comprobante.fecha_emision ? venta.comprobante.fecha_emision.toISOString() : null,
      total: decimalToNumber(venta.comprobante.total),
      estado_pago: venta.comprobante.estado_pago,
      descripcion: venta.comprobante.descripcion ?? null
    },
    pagos: venta.pagos.map((pago) => ({
      id_venta_pago: pago.id_venta_pago,
      metodo: pago.metodo,
      monto: decimalToNumber(pago.monto),
      referencia: pago.referencia ?? null,
      fecha_pago: pago.fecha_pago.toISOString(),
      notas: pago.notas ?? null,
      registrado_por: pago.registrado_por
    })),
    items: venta.comprobante.detalles.length
  }))

  return {
    ventas: items,
    pagination: {
      total,
      pages: Math.max(Math.ceil(total / limit), 1),
      current: page,
      limit
    }
  }
}
