import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { defaultUsuarioSelect } from './helpers'

export interface ListUsuariosParams {
  search?: string | null
  rol?: string | null
  estado?: 'activos' | 'inactivos' | 'todos'
  requiereCambio?: boolean | null
  pendientesEnvio?: boolean | null
  fechaDesde?: Date | null
  fechaHasta?: Date | null
  page?: number
  limit?: number
}

const sanitizePagination = (value: number | undefined, fallback: number) => {
  if (!value || Number.isNaN(value) || value <= 0) return fallback
  return Math.min(value, 100)
}

const buildSearchFilter = (term: string): Prisma.UsuarioWhereInput => {
  const normalized = term.trim()
  if (!normalized) return {}
  return {
    OR: [
      { nombre_usuario: { contains: normalized, mode: 'insensitive' } },
      { persona: { nombre: { contains: normalized, mode: 'insensitive' } } },
      { persona: { apellido_paterno: { contains: normalized, mode: 'insensitive' } } },
      { persona: { numero_documento: { contains: normalized, mode: 'insensitive' } } },
      { persona: { correo: { contains: normalized, mode: 'insensitive' } } }
    ]
  }
}

const buildEstadoFilter = (estado?: 'activos' | 'inactivos' | 'todos') => {
  if (!estado || estado === 'todos') return {}
  return estado === 'activos'
    ? { estado: true, estatus: true }
    : { estado: false }
}

export async function listUsuarios(params: ListUsuariosParams) {
  const {
    search,
    rol,
    estado,
    requiereCambio,
    pendientesEnvio,
    fechaDesde,
    fechaHasta,
    page,
    limit
  } = params

  const where: Prisma.UsuarioWhereInput = {
    ...buildEstadoFilter(estado ?? undefined)
  }

  if (search) {
    Object.assign(where, buildSearchFilter(search))
  }

  if (rol) {
    where.rol = {
      is: { nombre_rol: { equals: rol, mode: 'insensitive' } }
    }
  }

  if (typeof requiereCambio === 'boolean') {
    where.requiere_cambio_password = requiereCambio
  }

  if (typeof pendientesEnvio === 'boolean') {
    where.envio_credenciales_pendiente = pendientesEnvio
  }

  if (fechaDesde || fechaHasta) {
    where.fecha_creacion = {}
    if (fechaDesde) {
      where.fecha_creacion.gte = fechaDesde
    }
    if (fechaHasta) {
      where.fecha_creacion.lte = fechaHasta
    }
  }

  const parsedPage = sanitizePagination(page, 1)
  const parsedLimit = sanitizePagination(limit, 20)
  const skip = (parsedPage - 1) * parsedLimit

  const [usuarios, total] = await prisma.$transaction([
    prisma.usuario.findMany({
      where,
      orderBy: [
        { envio_credenciales_pendiente: 'desc' },
        { estado: 'desc' },
        { fecha_creacion: 'desc' }
      ],
      select: defaultUsuarioSelect,
      skip,
      take: parsedLimit
    }),
    prisma.usuario.count({ where })
  ])

  return {
    usuarios,
    pagination: {
      total,
      limit: parsedLimit,
      current: parsedPage,
      pages: Math.ceil(total / parsedLimit)
    }
  }
}
