import { prisma } from '@/lib/prisma'
import { ApiError } from './errors'
import { defaultUsuarioSelect } from './helpers'
import { getUsuarioOrThrow } from './detail-controller'

interface ChangeEstadoParams {
  id: number
  estado: boolean
  motivo?: string | null
  sessionUserId: number
}

export async function changeEstadoUsuario({ id, estado, motivo, sessionUserId }: ChangeEstadoParams) {
  const usuarioActual = await getUsuarioOrThrow(id)

  if (usuarioActual.estado === estado) {
    return { usuario: usuarioActual }
  }

  const usuarioActualizado = await prisma.$transaction(async (tx) => {
    const updated = await tx.usuario.update({
      where: { id_usuario: id },
      data: {
        estado,
        bloqueado_en: estado ? null : new Date(),
        motivo_bloqueo: estado ? null : (motivo ?? 'Bloqueo manual'),
        envio_credenciales_pendiente: estado ? usuarioActual.envio_credenciales_pendiente : false
      },
      select: defaultUsuarioSelect
    })

    await tx.bitacora.create({
      data: {
        id_usuario: sessionUserId,
        accion: estado ? 'UNBLOCK_USUARIO' : 'BLOCK_USUARIO',
        descripcion: `Usuario ${usuarioActual.nombre_usuario} ${estado ? 'desbloqueado' : 'bloqueado'}`,
        tabla: 'usuario'
      }
    })

    if (!estado) {
      await tx.trabajador.updateMany({
        where: { id_usuario: id },
        data: { activo: false }
      })
    } else {
      await tx.trabajador.updateMany({
        where: { id_usuario: id },
        data: { activo: true }
      })
    }

    return updated
  })

  return { usuario: usuarioActualizado }
}

export async function deleteUsuario(id: number, sessionUserId: number) {
  const usuario = await getUsuarioOrThrow(id)

  if (!usuario.estatus) {
    throw new ApiError(400, 'El usuario ya fue dado de baja')
  }

  const eliminado = await prisma.$transaction(async (tx) => {
    const updated = await tx.usuario.update({
      where: { id_usuario: id },
      data: {
        estado: false,
        estatus: false,
        password_temporal: null,
        password_temporal_expira: null,
        requiere_cambio_password: false,
        envio_credenciales_pendiente: false,
        bloqueado_en: new Date(),
        motivo_bloqueo: 'Baja lógica'
      },
      select: defaultUsuarioSelect
    })

    await tx.trabajador.updateMany({
      where: { id_usuario: id },
      data: { id_usuario: null, activo: false }
    })

    await tx.bitacora.create({
      data: {
        id_usuario: sessionUserId,
        accion: 'DELETE_USUARIO',
        descripcion: `Usuario ${usuario.nombre_usuario} dado de baja lógica`,
        tabla: 'usuario'
      }
    })

    return updated
  })

  return { usuario: eliminado }
}
