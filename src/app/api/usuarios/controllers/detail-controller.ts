import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { ApiError } from './errors'

export const defaultUsuarioInclude = {
  persona: true,
  rol: true,
  trabajador: {
    select: {
      id_trabajador: true,
      codigo_empleado: true,
      activo: true,
      eliminado: true,
      cargo: true
    }
  }
} satisfies Prisma.UsuarioInclude

export async function getUsuarioOrThrow(id: number) {
  const usuario = await prisma.usuario.findUnique({
    where: { id_usuario: id },
    include: defaultUsuarioInclude
  })

  if (!usuario) {
    throw new ApiError(404, 'Usuario no encontrado')
  }

  return usuario
}
