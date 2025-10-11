import { prisma } from '@/lib/prisma'
import { ApiError } from './errors'
import { getTrabajadorOrThrow } from './detail-controller'
import { z } from 'zod'

const patchSchema = z.object({
  action: z.enum(['toggle_status', 'mark_deleted', 'restore']),
  activo: z.boolean().optional(),
  motivo: z.string().optional().nullable()
})

type PatchInput = z.infer<typeof patchSchema>

const defaultInclude = {
  persona: true as any,
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
} as const

export async function handleTrabajadorStatus(id: number, payload: unknown, sessionUserId: number) {
  const data: PatchInput = patchSchema.parse(payload)
  const trabajadorActualRaw = await getTrabajadorOrThrow(id)
  const trabajadorActual = trabajadorActualRaw as typeof trabajadorActualRaw & { eliminado: boolean }

  if (data.action === 'toggle_status') {
    if (trabajadorActual.eliminado) {
      throw new ApiError(400, 'No puedes activar o desactivar un trabajador en baja lógica. Restaura primero el registro.')
    }

    const nuevoEstado = data.activo ?? !trabajadorActual.activo
    const ahora = new Date()
    const motivoBloqueo = data.motivo?.trim() || 'Actualizado desde trabajador'

    const trabajadorActualizado = await prisma.$transaction(async (tx) => {
      if (trabajadorActual.id_usuario) {
        await tx.usuario.update({
          where: { id_usuario: trabajadorActual.id_usuario },
          data: nuevoEstado
            ? {
                estado: true,
                estatus: true,
                bloqueado_en: null,
                motivo_bloqueo: null
              }
            : {
                estado: false,
                estatus: true,
                bloqueado_en: ahora,
                motivo_bloqueo: motivoBloqueo,
                envio_credenciales_pendiente: false
              }
        })
      }

      return tx.trabajador.update({
        where: { id_trabajador: id },
        data: {
          activo: nuevoEstado
        } as any,
        include: defaultInclude
      })
    })

    await prisma.bitacora.create({
      data: {
        id_usuario: sessionUserId,
        accion: 'TOGGLE_STATUS_TRABAJADOR',
        descripcion: `Trabajador ${nuevoEstado ? 'activado' : 'desactivado'}: ${trabajadorActual.codigo_empleado}${
          !nuevoEstado ? ` - Motivo: ${motivoBloqueo}` : ''
        }`,
        tabla: 'trabajador'
      }
    })

    return trabajadorActualizado
  }

  if (data.action === 'mark_deleted') {
    if (trabajadorActual.eliminado) {
      throw new ApiError(400, 'El trabajador ya fue dado de baja.')
    }

    const motivoBaja = data.motivo?.trim() || 'Baja lógica desde trabajadores'

    const trabajadorActualizado = await prisma.$transaction(async (tx) => {
      if (trabajadorActual.id_usuario) {
        await tx.usuario.update({
          where: { id_usuario: trabajadorActual.id_usuario },
          data: {
            estado: false,
            estatus: false,
            password_temporal: null,
            password_temporal_expira: null,
            requiere_cambio_password: false,
            envio_credenciales_pendiente: false,
            bloqueado_en: new Date(),
            motivo_bloqueo: motivoBaja
          }
        })
      }

      return tx.trabajador.update({
        where: { id_trabajador: id },
        data: {
          activo: false,
          eliminado: true
        } as any,
        include: defaultInclude
      })
    })

    await prisma.bitacora.create({
      data: {
        id_usuario: sessionUserId,
        accion: 'DELETE_TRABAJADOR',
        descripcion: `Trabajador dado de baja: ${trabajadorActual.codigo_empleado} - Motivo: ${motivoBaja}`,
        tabla: 'trabajador'
      }
    })

    return trabajadorActualizado
  }

  // restore
  if (!trabajadorActual.eliminado) {
    throw new ApiError(400, 'El trabajador no se encuentra dado de baja.')
  }

  const restaurarActivo = data.activo ?? true
  const trabajadorRestaurado = await prisma.$transaction(async (tx) => {
    if (trabajadorActual.id_usuario) {
      await tx.usuario.update({
        where: { id_usuario: trabajadorActual.id_usuario },
        data: {
          estado: restaurarActivo,
          estatus: true,
          bloqueado_en: restaurarActivo ? null : new Date(),
          motivo_bloqueo: restaurarActivo ? null : 'Actualizado desde trabajador'
        }
      })
    }

    return tx.trabajador.update({
      where: { id_trabajador: id },
      data: {
        activo: restaurarActivo,
        eliminado: false
      } as any,
      include: defaultInclude
    })
  })

  await prisma.bitacora.create({
    data: {
      id_usuario: sessionUserId,
      accion: 'RESTORE_TRABAJADOR',
      descripcion: `Trabajador restaurado: ${trabajadorActual.codigo_empleado}`,
      tabla: 'trabajador'
    }
  })

  return trabajadorRestaurado
}
