import type { PrismaClient } from '@prisma/client'
import type { Session } from 'next-auth'

import { asegurarPermiso, sessionTienePermiso } from '@/lib/permisos/guards'

export type InventoryPermissionLevel = 'read' | 'write'

const PERMISOS: Record<InventoryPermissionLevel, string> = {
  read: 'inventario.ver',
  write: 'inventario.movimientos'
}

export const getPermisoPorNivel = (level: InventoryPermissionLevel) => PERMISOS[level]

export const hasInventoryPermission = (session: Session | null, level: InventoryPermissionLevel) => {
  const codigo = getPermisoPorNivel(level)
  return sessionTienePermiso(session, codigo)
}

export const requireInventoryPermission = async (
  session: Session | null,
  level: InventoryPermissionLevel,
  opts: { prismaClient?: PrismaClient; mensaje?: string } = {}
) => {
  const codigo = getPermisoPorNivel(level)
  return asegurarPermiso(session, codigo, {
    prismaClient: opts.prismaClient,
    mensaje: opts.mensaje
  })
}

export const getInventoryGuardMessage = (level: InventoryPermissionLevel) =>
  level === 'write'
    ? 'No cuentas con permisos para modificar el inventario.'
    : 'No cuentas con permisos para visualizar el inventario.'
