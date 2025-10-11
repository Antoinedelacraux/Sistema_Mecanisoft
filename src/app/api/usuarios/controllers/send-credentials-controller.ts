import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/mailer'
import { ApiError } from './errors'
import { resetPasswordUsuario } from './reset-password-controller'
import { registrarEnvioCredenciales } from './notifications-controller'

const payloadSchema = z.object({
  asunto: z.string().min(3).max(120).optional().default('Credenciales de acceso'),
  mensaje_adicional: z.string().max(500).optional().nullable()
})

export async function enviarCredencialesUsuario(
  id: number,
  payload: unknown,
  sessionUserId: number
) {
  const data = payloadSchema.parse(payload)

  const usuario = await prisma.usuario.findUnique({
    where: { id_usuario: id },
    include: {
      persona: true
    }
  })

  if (!usuario) {
    throw new ApiError(404, 'Usuario no encontrado')
  }

  if (!usuario.estatus) {
    throw new ApiError(400, 'El usuario fue dado de baja')
  }

  const correoDestino = usuario.persona.correo?.trim()
  if (!correoDestino) {
    throw new ApiError(400, 'El usuario no tiene correo registrado')
  }

  const { passwordTemporal } = await resetPasswordUsuario(
    id,
    { enviar_correo: false },
    sessionUserId
  )

  const cuerpoHtml = `
    <p>Hola ${usuario.persona.nombre},</p>
    <p>Se generaron nuevas credenciales de acceso para el sistema del taller mecánico.</p>
    <p><strong>Usuario:</strong> ${usuario.nombre_usuario}</p>
    <p><strong>Contraseña temporal:</strong> ${passwordTemporal}</p>
    <p>Deberás cambiar tu contraseña en el primer ingreso. Esta contraseña caduca en las próximas 72 horas.</p>
    ${data.mensaje_adicional ? `<p>${data.mensaje_adicional}</p>` : ''}
    <p>Saludos,<br/>Equipo MecaniSoft</p>
  `

  try {
    await sendMail({
      to: correoDestino,
      subject: data.asunto,
      html: cuerpoHtml
    })
  } catch (error) {
    await registrarEnvioCredenciales({
      id,
      exitoso: false,
      error: error instanceof Error ? error.message : 'No fue posible enviar el correo',
      sessionUserId
    })
    throw new ApiError(500, 'Fallo el envío de correo')
  }

  await registrarEnvioCredenciales({
    id,
    exitoso: true,
    sessionUserId
  })

  return { ok: true }
}
