import type { PrismaClient, Prisma } from '@prisma/client'
import { calcularProgresoOrden } from './helpers'

type IncludeLight = Prisma.TransaccionInclude

type ListarOrdenesWhere = Prisma.TransaccionWhereInput

export interface ListarOrdenesParams {
  page: number
  limit: number
  search?: string | null
  estado?: string | null
  prioridad?: string | null
  estadoPago?: string | null
  modo?: string | null
  includeTareas: boolean
  includeProgreso: boolean
  fechaDesde?: Date | null
  fechaHasta?: Date | null
  trabajadorId?: number
}

export interface ListarOrdenesResultado {
  ordenes: unknown[]
  pagination: {
    total: number
    pages: number
    current: number
    limit: number
  }
}

export async function listarOrdenes(prisma: PrismaClient, params: ListarOrdenesParams): Promise<ListarOrdenesResultado> {
  const {
    page,
    limit,
    search,
    estado,
    prioridad,
    estadoPago,
    modo,
    includeTareas,
    includeProgreso,
    fechaDesde,
    fechaHasta,
    trabajadorId
  } = params

  const skip = (page - 1) * limit

  const whereCondition: ListarOrdenesWhere = {
    tipo_transaccion: 'orden',
    estatus: 'activo'
  }

  if (estado) {
    whereCondition.estado_orden = estado
  }

  if (prioridad) {
    whereCondition.prioridad = prioridad
  }

  if (trabajadorId !== undefined) {
    whereCondition.id_trabajador_principal = trabajadorId
  }

  if (estadoPago) {
    whereCondition.estado_pago = estadoPago
  }

  const fechaFilter: Record<string, Date> = {}
  if (fechaDesde) {
    fechaFilter.gte = fechaDesde
  }
  if (fechaHasta) {
    fechaFilter.lte = fechaHasta
  }
  if (Object.keys(fechaFilter).length) {
    whereCondition.fecha = fechaFilter
  }

  if (search) {
    whereCondition.OR = [
      { codigo_transaccion: { contains: search, mode: 'insensitive' } },
      { persona: { nombre: { contains: search, mode: 'insensitive' } } },
      { persona: { apellido_paterno: { contains: search, mode: 'insensitive' } } },
      { persona: { numero_documento: { contains: search, mode: 'insensitive' } } },
      {
        transaccion_vehiculos: {
          some: {
            vehiculo: {
              placa: { contains: search, mode: 'insensitive' }
            }
          }
        }
      }
    ]
  }

  const includeFull: IncludeLight = {
    persona: true,
    usuario: { include: { persona: true } },
    trabajador_principal: { include: { usuario: { include: { persona: true } } } },
    transaccion_vehiculos: {
      include: {
        vehiculo: {
          include: {
            modelo: { include: { marca: true } },
            cliente: { include: { persona: true } }
          }
        }
      }
    },
    detalles_transaccion: {
      include: {
        producto: true,
        servicio: true,
        ...(includeTareas ? { tareas: true } : {}),
        servicio_asociado: { include: { servicio: true, producto: true } },
        productos_asociados: { include: { producto: true } }
      }
    },
    _count: { select: { detalles_transaccion: true } }
  }

  const includeLight: IncludeLight = {
    persona: { select: { nombre: true, apellido_paterno: true } },
    trabajador_principal: { select: { id_trabajador: true } },
    transaccion_vehiculos: { include: { vehiculo: { select: { placa: true } } } },
    _count: { select: { detalles_transaccion: true } }
  }

  const modoNormalizado = (modo || 'full').toLowerCase()
  const includeObject = modoNormalizado === 'light' ? includeLight : includeFull

  const [ordenesBase, total] = await Promise.all([
    prisma.transaccion.findMany({
      where: whereCondition,
      include: includeObject,
      orderBy: [{ prioridad: 'desc' }, { fecha: 'desc' }],
      skip,
      take: limit
    }),
    prisma.transaccion.count({ where: whereCondition })
  ])

  let ordenes = ordenesBase

  if (includeProgreso) {
    const enriquecidas: Array<typeof ordenesBase[number] & {
      progreso: {
        total: number
        pendientes: number
        en_proceso: number
        completadas: number
        verificadas: number
        porcentaje: number
      }
    }> = []

    for (const o of ordenesBase) {
      const progreso = await calcularProgresoOrden(prisma, o.id_transaccion)
      enriquecidas.push({ ...o, progreso })
    }

    ordenes = enriquecidas
  }

  return {
    ordenes,
    pagination: {
      total,
      pages: Math.ceil(total / limit),
      current: page,
      limit
    }
  }
}
