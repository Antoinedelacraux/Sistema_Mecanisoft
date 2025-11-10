import { prisma } from '@/lib/prisma'
import { ApiError } from './errors'
import { defaultUsuarioSelect, normalizeUsername, resolveRolParaTrabajador } from './helpers'
import { getUsuarioOrThrow } from './detail-controller'
import { updateUsuarioSchema } from '@/lib/usuarios/validators'

export async function updateUsuario(id: number, payload: unknown, sessionUserId: number) {
  const data = updateUsuarioSchema.parse(payload)
  const usuarioActual = await getUsuarioOrThrow(id)

  const updates: Record<string, unknown> = {}

  if (data.nombre_usuario && data.nombre_usuario !== usuarioActual.nombre_usuario) {
    const normalizado = normalizeUsername(data.nombre_usuario)
    const existe = await prisma.usuario.findUnique({ where: { nombre_usuario: normalizado } })
    if (existe && existe.id_usuario !== id) {
      throw new ApiError(400, 'Ya existe un usuario con este nombre de usuario')
    }
    updates.nombre_usuario = normalizado
  }

  if (data.estado !== undefined && data.estado !== usuarioActual.estado) {
    updates.estado = data.estado
    updates.bloqueado_en = data.estado ? null : new Date()
    updates.motivo_bloqueo = data.estado ? null : (data.motivo_bloqueo ?? 'Bloqueo manual')
  }

  if (data.rol) {
    let rolId: number
    try {
      rolId = await resolveRolParaTrabajador({ cargo: usuarioActual.trabajador?.cargo ?? null, rolPreferido: data.rol }, prisma)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No fue posible resolver el rol solicitado'
      throw new ApiError(400, message)
    }
    updates.id_rol = rolId
  }

  if (Object.keys(updates).length === 0 && !data.correo) {
    return { usuario: usuarioActual }
  }

  const usuarioActualizado = await prisma.$transaction(async (tx) => {
    if (data.correo && data.correo !== usuarioActual.persona.correo) {
      await tx.persona.update({
        where: { id_persona: usuarioActual.persona.id_persona },
        data: { correo: data.correo }
      })
    }

    const nuevoRegistro = await tx.usuario.update({
      where: { id_usuario: id },
      data: updates,
      select: defaultUsuarioSelect
    })

    await tx.bitacora.create({
      data: {
        id_usuario: sessionUserId,
        accion: 'UPDATE_USUARIO',
        descripcion: `Usuario ${usuarioActual.nombre_usuario} actualizado`,
        tabla: 'usuario'
      }
    })

    return nuevoRegistro
  })

  return { usuario: usuarioActualizado }
}
