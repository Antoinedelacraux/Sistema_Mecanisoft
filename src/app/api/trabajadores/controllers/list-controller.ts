import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { defaultTrabajadorInclude } from './detail-controller'

export type ListTrabajadoresParams = {
  search?: string | null
  cargo?: string | null
  estado?: 'activos' | 'inactivos' | 'baja' | 'todos'
  includeInactive?: boolean
  soloActivos?: boolean
  usuarioId?: number | null
}

const buildEstadoFilter = (estado?: ListTrabajadoresParams['estado']) => {
  if (!estado || estado === 'activos') {
    return { activo: true, eliminado: false }
  }

  if (estado === 'inactivos') {
    return { activo: false, eliminado: false }
  }

  if (estado === 'baja') {
    return { eliminado: true }
  }

  return {}
}

export async function listTrabajadores(params: ListTrabajadoresParams) {
  const where: Prisma.TrabajadorWhereInput = {}

  const { search, cargo, estado, includeInactive, soloActivos, usuarioId } = params

  if (usuarioId) {
    where.id_usuario = usuarioId
  } else {
    if (cargo) {
      where.cargo = cargo
    }

    if (estado) {
      Object.assign(where, buildEstadoFilter(estado))
    } else if (soloActivos) {
      where.activo = true
      where.eliminado = false
    } else if (!includeInactive) {
      where.eliminado = false
    }
  }

  if (search) {
    const term = search.trim().toLowerCase()
    const searchFilters: Prisma.TrabajadorWhereInput[] = [
      { codigo_empleado: { contains: term, mode: 'insensitive' } },
      { especialidad: { contains: term, mode: 'insensitive' } },
    ]

    searchFilters.push(
      {
        persona: {
          is: {
            nombre: { contains: term, mode: 'insensitive' }
          }
        }
      } as Prisma.TrabajadorWhereInput
    )

    searchFilters.push(
      {
        persona: {
          is: {
            apellido_paterno: { contains: term, mode: 'insensitive' }
          }
        }
      } as Prisma.TrabajadorWhereInput
    )

    searchFilters.push(
      {
        persona: {
          is: {
            apellido_materno: { contains: term, mode: 'insensitive' }
          }
        }
      } as Prisma.TrabajadorWhereInput
    )

    where.OR = searchFilters
  }

  const trabajadores = await prisma.trabajador.findMany({
    where,
    include: defaultTrabajadorInclude,
    orderBy: [
      { eliminado: 'asc' },
      { activo: 'desc' },
      { persona: { nombre: 'asc' } }
    ]
  })

  return trabajadores
}
