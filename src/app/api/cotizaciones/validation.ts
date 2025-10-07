import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export type CotizacionModo = 'solo_servicios' | 'solo_productos' | 'servicios_y_productos'

export const itemSchema = z.object({
  id_producto: z.union([z.number(), z.string()])
    .transform((v) => parseInt(String(v), 10))
    .refine((v) => v > 0, 'id_producto inválido'),
  cantidad: z.union([z.number(), z.string()])
    .transform((v) => parseInt(String(v), 10))
    .refine((v) => v > 0, 'cantidad debe ser > 0'),
  precio_unitario: z.union([z.number(), z.string()])
    .transform((v) => parseFloat(String(v)))
    .refine((v) => v >= 0, 'precio_unitario inválido'),
  descuento: z.union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => (v === undefined || v === null || String(v).trim() === '') ? 0 : parseFloat(String(v)))
    .refine((v) => v >= 0 && v <= 100, 'descuento debe estar entre 0 y 100'),
  servicio_ref: z.union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === null || String(v).trim() === '') return null
      const parsed = parseInt(String(v), 10)
      return Number.isFinite(parsed) ? parsed : null
    })
    .refine((v) => v === null || v > 0, 'servicio_ref inválido'),
  tipo: z.enum(['producto', 'servicio']).optional()
})

export const cotizacionBodySchema = z.object({
  id_cliente: z.union([z.number(), z.string()])
    .transform((v) => parseInt(String(v), 10))
    .refine((v) => v > 0, 'id_cliente inválido'),
  id_vehiculo: z.union([z.number(), z.string()])
    .transform((v) => parseInt(String(v), 10))
    .refine((v) => v > 0, 'id_vehiculo inválido'),
  vigencia_dias: z.union([z.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined ? 7 : parseInt(String(v), 10)))
    .refine((v) => v > 0 && v <= 90, 'vigencia_dias debe estar entre 1 y 90'),
  observaciones: z.string().optional(),
  modo_cotizacion: z.enum(['solo_servicios', 'solo_productos', 'servicios_y_productos']).optional().default('servicios_y_productos'),
  items: z.array(itemSchema).min(1, 'Debe enviar al menos un item')
})

export class CotizacionValidationError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'CotizacionValidationError'
    this.status = status
  }
}

export type CotizacionBodyInput = z.infer<typeof cotizacionBodySchema>

export interface CotizacionItemValidado {
  id_producto: number | null
  id_servicio: number | null
  cantidad: number
  precio_unitario: number
  descuento: number
  total: number
  servicio_ref: number | null
  tipo: 'producto' | 'servicio'
}

export interface CotizacionValidationResult {
  cliente: NonNullable<Awaited<ReturnType<typeof prisma.cliente.findUnique>>>
  vehiculo: NonNullable<Awaited<ReturnType<typeof prisma.vehiculo.findUnique>>>
  itemsValidados: CotizacionItemValidado[]
  subtotal: number
  impuesto: number
  total: number
  vigenciaHasta: Date
  modoCotizacion: CotizacionModo
}

type PrismaClientLike = typeof prisma

export async function validarCotizacionPayload(
  data: CotizacionBodyInput,
  prismaClient: PrismaClientLike = prisma
): Promise<CotizacionValidationResult> {
  const { id_cliente, id_vehiculo, vigencia_dias, modo_cotizacion, items } = data
  const modoCotizacion: CotizacionModo = modo_cotizacion ?? 'servicios_y_productos'

  const cliente = await prismaClient.cliente.findUnique({
    where: { id_cliente },
    include: { persona: true }
  })

  if (!cliente || cliente.estatus === false) {
    throw new CotizacionValidationError('El cliente no existe o está inactivo')
  }

  const vehiculo = await prismaClient.vehiculo.findUnique({ where: { id_vehiculo } })
  if (!vehiculo || vehiculo.id_cliente !== id_cliente) {
    throw new CotizacionValidationError('El vehículo no pertenece al cliente seleccionado')
  }

  const itemIds = [...new Set(items.map((i) => i.id_producto))]
  const serviciosReferenciados = items
    .map((i) => i.servicio_ref)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const servicioIds = [...new Set([...itemIds, ...serviciosReferenciados])]

  const [productos, servicios] = await Promise.all([
    prismaClient.producto.findMany({ where: { id_producto: { in: itemIds } } }),
    prismaClient.servicio.findMany({ where: { id_servicio: { in: servicioIds } } })
  ])

  const productosMap = new Map(productos.map((p) => [p.id_producto, p]))
  const serviciosMap = new Map(servicios.map((s) => [s.id_servicio, s]))

  const itemsValidados: CotizacionItemValidado[] = []
  let subtotal = 0
  const serviciosIncluidos = new Set<number>()
  const serviciosConProducto = new Set<number>()

  for (const item of items) {
    const producto = productosMap.get(item.id_producto)
    const servicio = serviciosMap.get(item.id_producto)
    const tipoSolicitado = item.tipo

    let tipoDetectado: 'producto' | 'servicio' | null = null
    if (tipoSolicitado === 'producto') {
      if (!producto || producto.estatus === false) {
        throw new CotizacionValidationError(`Producto con ID ${item.id_producto} no está disponible`)
      }
      tipoDetectado = 'producto'
    } else if (tipoSolicitado === 'servicio') {
      if (!servicio || servicio.estatus === false) {
        throw new CotizacionValidationError(`Servicio con ID ${item.id_producto} no está disponible`)
      }
      tipoDetectado = 'servicio'
    } else {
      const servicioDisponible = servicio && servicio.estatus !== false
      const productoDisponible = producto && producto.estatus !== false
      if (servicioDisponible && !productoDisponible) {
        tipoDetectado = 'servicio'
      } else if (productoDisponible && !servicioDisponible) {
        tipoDetectado = 'producto'
      } else if (servicioDisponible) {
        tipoDetectado = 'servicio'
      } else if (productoDisponible) {
        tipoDetectado = 'producto'
      }
    }

    if (!tipoDetectado) {
      throw new CotizacionValidationError(`Item con ID ${item.id_producto} no está disponible`)
    }

    if (modoCotizacion === 'solo_servicios' && tipoDetectado !== 'servicio') {
      throw new CotizacionValidationError('Modo Solo servicios: no se permiten productos en la cotización.')
    }
    if (modoCotizacion === 'solo_productos' && tipoDetectado !== 'producto') {
      throw new CotizacionValidationError('Modo Solo productos: no se permiten servicios en la cotización.')
    }

    let servicioRef: number | null = null
    if (tipoDetectado === 'producto') {
      if (item.servicio_ref) {
        if (modoCotizacion !== 'servicios_y_productos') {
          throw new CotizacionValidationError('Solo puedes asociar productos a servicios en el modo combinado.')
        }
        const servicioAsociado = serviciosMap.get(item.servicio_ref)
        if (!servicioAsociado || servicioAsociado.estatus === false) {
          throw new CotizacionValidationError('Servicio asociado no válido para el producto')
        }
        if (serviciosConProducto.has(item.servicio_ref)) {
          throw new CotizacionValidationError('Cada servicio solo puede tener un producto asociado.')
        }
        serviciosConProducto.add(item.servicio_ref)
        servicioRef = item.servicio_ref
      }
    } else {
      serviciosIncluidos.add(item.id_producto)
    }

    const descuentoAplicado = typeof item.descuento === 'number' ? item.descuento : 0
    const totalItem = item.cantidad * item.precio_unitario * (1 - descuentoAplicado / 100)
    subtotal += totalItem

    itemsValidados.push({
      id_producto: tipoDetectado === 'producto' ? item.id_producto : null,
      id_servicio: tipoDetectado === 'servicio' ? item.id_producto : null,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      descuento: descuentoAplicado,
      total: totalItem,
      servicio_ref: tipoDetectado === 'producto' ? servicioRef ?? null : null,
      tipo: tipoDetectado
    })
  }

  if (modoCotizacion === 'servicios_y_productos') {
    for (const item of items) {
      const servicio = serviciosMap.get(item.id_producto)
      const producto = productosMap.get(item.id_producto)
      if ((item.tipo === 'servicio' || (!item.tipo && servicio && (!producto || producto.estatus === false))) && servicio) {
        serviciosIncluidos.add(item.id_producto)
      }
    }

    for (const item of itemsValidados) {
      if (item.tipo === 'producto' && item.servicio_ref && !serviciosIncluidos.has(item.servicio_ref)) {
        throw new CotizacionValidationError('El servicio asociado a un producto debe estar incluido en la cotización.')
      }
    }
  }

  const impuesto = subtotal * 0.18
  const total = subtotal + impuesto

  const vigenciaHasta = new Date()
  vigenciaHasta.setDate(vigenciaHasta.getDate() + vigencia_dias)

  return {
    cliente: cliente as NonNullable<typeof cliente>,
    vehiculo: vehiculo as NonNullable<typeof vehiculo>,
    itemsValidados,
    subtotal,
    impuesto,
    total,
    vigenciaHasta,
    modoCotizacion
  }
}
