import { z } from 'zod'
import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { defaultUsuarioSelect, generateTemporalPassword, hashPassword } from '@/app/api/usuarios/controllers/helpers'

export class UsuarioPasswordError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'UsuarioPasswordError'
  }
}

const resetPasswordInputSchema = z.object({
  enviar_correo: z.boolean().optional().default(true),
  password_expira_en_horas: z.number().int().min(1).max(336).optional().default(72)
})

export type ResetPasswordInput = z.input<typeof resetPasswordInputSchema>
export type ResetPasswordOptions = z.infer<typeof resetPasswordInputSchema>

type ResetPasswordResult = {
  usuario: Prisma.UsuarioGetPayload<{ select: typeof defaultUsuarioSelect }>
  passwordTemporal: string
}

const buildFechaExpiracion = (horas: number) => {
  const fecha = new Date()
  fecha.setHours(fecha.getHours() + horas)
  return fecha
}

export async function resetPasswordTemporal(
  usuarioId: number,
  payload: unknown,
  sessionUserId: number
): Promise<ResetPasswordResult> {
  const data = resetPasswordInputSchema.parse(payload ?? {})

  const usuario = await prisma.usuario.findUnique({
    where: { id_usuario: usuarioId },
    select: {
      id_usuario: true,
      nombre_usuario: true,
      estatus: true
    }
  })

  if (!usuario) {
    throw new UsuarioPasswordError(404, 'Usuario no encontrado')
  }

  if (!usuario.estatus) {
    throw new UsuarioPasswordError(400, 'El usuario fue dado de baja')
  }

  const temporal = generateTemporalPassword()
  const hashedTemporal = await hashPassword(temporal)
  const hashedPlaceholder = await hashPassword(generateTemporalPassword(16))

  const actualizado = await prisma.$transaction(async (tx) => {
    const result = await tx.usuario.update({
      where: { id_usuario: usuarioId },
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
