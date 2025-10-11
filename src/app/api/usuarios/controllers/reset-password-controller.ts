import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { ApiError } from './errors'
import { defaultUsuarioSelect, generateTemporalPassword, hashPassword } from './helpers'
import { getUsuarioOrThrow } from './detail-controller'

const resetSchema = z.object({
  enviar_correo: z.boolean().optional().default(true),
  password_expira_en_horas: z.number().int().min(1).max(336).optional().default(72)
})

const buildFechaExpiracion = (horas: number) => {
  const fecha = new Date()
  fecha.setHours(fecha.getHours() + horas)
  return fecha
}

export async function resetPasswordUsuario(id: number, payload: unknown, sessionUserId: number) {
  const data = resetSchema.parse(payload)
  const usuario = await getUsuarioOrThrow(id)

  if (!usuario.estatus) {
    throw new ApiError(400, 'El usuario fue dado de baja')
  }

  const temporal = generateTemporalPassword()
  const hashedTemporal = await hashPassword(temporal)
  const hashedPlaceholder = await hashPassword(generateTemporalPassword(16))

  const actualizado = await prisma.$transaction(async (tx) => {
    const result = await tx.usuario.update({
      where: { id_usuario: id },
      data: {
        password: hashedPlaceholder,
        password_temporal: hashedTemporal,
        password_temporal_expira: buildFechaExpiracion(data.password_expira_en_horas),
        requiere_cambio_password: true,
        envio_credenciales_pendiente: data.enviar_correo,
        ultimo_error_envio: null
      },
      select: defaultUsuarioSelect
    })

    await tx.bitacora.create({
      data: {
        id_usuario: sessionUserId,
        accion: 'RESET_PASSWORD_USUARIO',
        descripcion: `Se generó nueva contraseña temporal para ${usuario.nombre_usuario}`,
        tabla: 'usuario'
      }
    })

    return result
  })

  return { usuario: actualizado, passwordTemporal: temporal }
}
