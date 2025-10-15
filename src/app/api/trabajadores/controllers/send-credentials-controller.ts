import { z } from 'zod'

import { sendMail } from '@/lib/mailer'
import { ApiError } from './errors'
import { getTrabajadorOrThrow } from './detail-controller'
import { resetPasswordUsuario } from '@/app/api/usuarios/controllers/reset-password-controller'
import { registrarEnvioCredenciales } from '@/app/api/usuarios/controllers/notifications-controller'

const payloadSchema = z.object({
  mensaje_adicional: z.string().max(500).optional().nullable()
})

export async function enviarCredencialesTrabajador(id: number, payload: unknown, sessionUserId: number) {
  const data = payloadSchema.parse(payload ?? {})

  const trabajador = await getTrabajadorOrThrow(id)

  if (!trabajador.usuario) {
    throw new ApiError(400, 'El trabajador no tiene usuario asignado todavía')
  }

  if (!trabajador.usuario.estatus) {
    throw new ApiError(400, 'El usuario asociado al trabajador fue dado de baja')
  }

  const correoDestino = trabajador.usuario.persona?.correo?.trim() || trabajador.persona.correo?.trim()
  if (!correoDestino) {
    throw new ApiError(400, 'No hay un correo registrado para enviar las credenciales')
  }

  const usuarioNombre = trabajador.usuario.nombre_usuario || trabajador.persona.numero_documento

  const { passwordTemporal } = await resetPasswordUsuario(
    trabajador.usuario.id_usuario,
    { enviar_correo: false },
    sessionUserId
  )

  const cuerpoHtml = `
    <p>Hola ${trabajador.persona.nombre} ${trabajador.persona.apellido_paterno ?? ''},</p>
    <p>Se generaron nuevas credenciales de acceso para el sistema del taller.</p>
    <ul>
      <li><strong>Usuario:</strong> ${usuarioNombre}</li>
      <li><strong>Contraseña temporal:</strong> ${passwordTemporal}</li>
    </ul>
    <p>Al iniciar sesión se te pedirá cambiar la contraseña. Esta contraseña temporal caduca en 72 horas.</p>
    ${data.mensaje_adicional ? `<p>${data.mensaje_adicional}</p>` : ''}
    <p>Saludos,<br/>Equipo MecaniSoft</p>
  `

  try {
    await sendMail({
      to: correoDestino,
      subject: 'Credenciales de acceso al sistema',
      html: cuerpoHtml
    })
  } catch (error) {
    await registrarEnvioCredenciales({
      id: trabajador.usuario.id_usuario,
      exitoso: false,
      error: error instanceof Error ? error.message : 'No fue posible enviar el correo',
      sessionUserId
    })
    throw new ApiError(500, 'No se pudieron enviar las credenciales por correo')
  }

  const registro = await registrarEnvioCredenciales({
    id: trabajador.usuario.id_usuario,
    exitoso: true,
    sessionUserId
  })

  return {
    ok: true,
    credenciales: {
      usuario: usuarioNombre,
      passwordTemporal,
      correo: correoDestino
    },
    usuario: registro.usuario
  }
}
