import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { resolveRolId } from '@/app/api/trabajadores/controllers/helpers'
import { ApiError } from './errors'

export type PrismaClientOrTx = typeof prisma | Prisma.TransactionClient

export const defaultUsuarioSelect = {
  id_usuario: true,
  nombre_usuario: true,
  estado: true,
  estatus: true,
  requiere_cambio_password: true,
  envio_credenciales_pendiente: true,
  ultimo_envio_credenciales: true,
  ultimo_error_envio: true,
  bloqueado_en: true,
  motivo_bloqueo: true,
  fecha_creacion: true,
  ultimo_cambio_password: true,
  persona: {
    select: {
      id_persona: true,
      nombre: true,
      apellido_paterno: true,
      apellido_materno: true,
      numero_documento: true,
      correo: true,
      telefono: true
    }
  },
  rol: {
    select: {
      id_rol: true,
      nombre_rol: true
    }
  },
  trabajador: {
    select: {
      id_trabajador: true,
      codigo_empleado: true,
      activo: true,
      eliminado: true,
      cargo: true
    }
  }
} satisfies Prisma.UsuarioSelect

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase()
}

export function generateTemporalPassword(length = 12) {
  // Base64 genera caracteres / y +, los reemplazamos.
  return randomBytes(Math.ceil(length * 0.75))
    .toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, length)
}

export function hashPassword(value: string) {
  return bcrypt.hash(value, 10)
}

export async function ensureTrabajadorDisponible(
  idTrabajador: number,
  client: PrismaClientOrTx = prisma
) {
  const trabajador = await client.trabajador.findUnique({
    where: { id_trabajador: idTrabajador },
    select: {
      id_trabajador: true,
      id_usuario: true,
      activo: true,
      eliminado: true,
      cargo: true,
      persona: {
        select: {
          id_persona: true,
          nombre: true,
          apellido_paterno: true,
          apellido_materno: true,
          numero_documento: true,
          correo: true
        }
      }
    }
  })

  if (!trabajador || trabajador.eliminado) {
    throw new ApiError(404, 'Trabajador no encontrado o dado de baja')
  }

  if (!trabajador.activo) {
    throw new ApiError(400, 'El trabajador está inactivo. Actívalo antes de asignar credenciales.')
  }

  if (trabajador.id_usuario) {
    throw new ApiError(400, 'El trabajador ya tiene credenciales asignadas')
  }

  return trabajador
}

export async function resolveRolParaTrabajador(
  options: { cargo?: string | null; rolPreferido?: string | null },
  client: PrismaClientOrTx = prisma
) {
  const cargo = options.cargo ?? ''
  return resolveRolId({ cargo, rolPreferido: options.rolPreferido }, client)
}
