import type { Prisma, Rol } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type PrismaClientOrTx = typeof prisma | Prisma.TransactionClient

const CARGO_ROLE_MAP: Record<string, string> = {
  'mecánico': 'Mecánico',
  'mecanico': 'Mecánico',
  'recepcionista': 'Recepcionista',
  'administrador': 'Administrador',
  'jefe de taller': 'Jefe de Taller',
  'supervisor': 'Jefe de Taller',
}

export async function generateCodigoEmpleado(client: PrismaClientOrTx = prisma) {
  const lastWorker = await client.trabajador.findFirst({
    orderBy: { id_trabajador: 'desc' }
  })

  const nextNumber = lastWorker
    ? parseInt(lastWorker.codigo_empleado.split('-')[1] ?? '0', 10) + 1
    : 1

  return `EMP-${nextNumber.toString().padStart(4, '0')}`
}

async function findRol(nombreRol: string, client: PrismaClientOrTx): Promise<Rol | null> {
  return client.rol.findFirst({ where: { nombre_rol: nombreRol } })
}

export async function resolveRolId(
  {
    cargo,
    rolPreferido
  }: { cargo: string; rolPreferido?: string | null },
  client: PrismaClientOrTx = prisma
): Promise<number> {
  const trimmedPreferred = rolPreferido?.trim()
  if (trimmedPreferred) {
    const rol = await findRol(trimmedPreferred, client)
    if (!rol) {
      throw new Error(`Rol "${trimmedPreferred}" no existe. Configura el rol antes de asignarlo.`)
    }
    return rol.id_rol
  }

  const normalizedCargo = cargo.trim().toLowerCase()
  const mappedRolName = CARGO_ROLE_MAP[normalizedCargo] ?? cargo.trim()

  const rolByCargo = await findRol(mappedRolName, client)
  if (rolByCargo) {
    return rolByCargo.id_rol
  }

  const fallbackRoles = ['Mecánico', 'Recepcionista', 'Administrador']
  for (const fallback of fallbackRoles) {
    const rol = await findRol(fallback, client)
    if (rol) {
      return rol.id_rol
    }
  }

  throw new Error('No existen roles configurados para asignar credenciales. Crea al menos un rol en la tabla rol.')
}
