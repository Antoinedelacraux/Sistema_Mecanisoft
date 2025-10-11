import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { ApiError } from './errors'

export const defaultTrabajadorInclude = {
  persona: {
    include: {
      empresa_persona: true
    }
  },
  usuario: {
    include: {
      persona: {
        include: { empresa_persona: true }
      },
      rol: true
    }
  },
  _count: {
    select: {
      tareas_asignadas: true,
      ordenes_principales: true
    }
  }
} satisfies Prisma.TrabajadorInclude

export type TrabajadorWithRelations = Prisma.TrabajadorGetPayload<{ include: typeof defaultTrabajadorInclude }>

export async function getTrabajadorOrThrow(id: number): Promise<TrabajadorWithRelations> {
  const trabajador = await prisma.trabajador.findUnique({
    where: { id_trabajador: id },
    include: defaultTrabajadorInclude
  })

  if (!trabajador) {
    throw new ApiError(404, 'Trabajador no encontrado')
  }

  return trabajador
}
