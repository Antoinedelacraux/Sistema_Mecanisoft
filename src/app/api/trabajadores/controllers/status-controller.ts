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

    const trabajadorActualizado = await prisma.$transaction(async (tx) => {
      if (trabajadorActual.id_usuario) {
        await tx.usuario.update({
          where: { id_usuario: trabajadorActual.id_usuario },
          data: { estado: nuevoEstado, estatus: nuevoEstado }
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
        descripcion: `Trabajador ${nuevoEstado ? 'activado' : 'desactivado'}: ${trabajadorActual.codigo_empleado}`,
        tabla: 'trabajador'
      }
    })

    return trabajadorActualizado
  }

  if (data.action === 'mark_deleted') {
    if (trabajadorActual.eliminado) {
      throw new ApiError(400, 'El trabajador ya fue dado de baja.')
    }

    const trabajadorActualizado = await prisma.$transaction(async (tx) => {
      if (trabajadorActual.id_usuario) {
        await tx.usuario.update({
          where: { id_usuario: trabajadorActual.id_usuario },
          data: { estado: false, estatus: false }
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
        descripcion: `Trabajador dado de baja: ${trabajadorActual.codigo_empleado}${data.motivo ? ` - Motivo: ${data.motivo}` : ''}`,
        tabla: 'trabajador'
      }
    })

    return trabajadorActualizado
  }

  // restore
  if (!trabajadorActual.eliminado) {
    throw new ApiError(400, 'El trabajador no se encuentra dado de baja.')
  }

  const trabajadorRestaurado = await prisma.$transaction(async (tx) => {
    if (trabajadorActual.id_usuario) {
      await tx.usuario.update({
        where: { id_usuario: trabajadorActual.id_usuario },
        data: { estado: true, estatus: true }
      })
    }

    return tx.trabajador.update({
      where: { id_trabajador: id },
      data: {
        activo: data.activo ?? true,
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
