import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/mailer'
import { logEvent } from '@/lib/bitacora/log-event'
import { enviarCredencialesSchema, type EnviarCredencialesInput } from './validators'
import { resetPasswordTemporal } from './passwords'

export class UsuarioCredencialesError extends Error {
  status: number
  code?: string

  constructor(status: number, message: string, options?: { code?: string; cause?: unknown }) {
    super(message)
    this.status = status
    this.name = 'UsuarioCredencialesError'
    if (options?.code) {
      this.code = options.code
    }
    if (options?.cause) {
      this.cause = options.cause
    }
  }
}

type UsuarioConCorreo = Prisma.UsuarioGetPayload<{
  select: {
    id_usuario: true
    nombre_usuario: true
    estatus: true
    persona: {
      select: {
        nombre: true
        correo: true
      }
    }
  }
}>

type RegistrarEnvioOptions = {
  usuario: { id_usuario: number; nombre_usuario: string }
  exitoso: boolean
  error?: string | null
  sessionUserId: number
}

const buildEmailBody = (
  usuario: UsuarioConCorreo,
  passwordTemporal: string,
  mensajeAdicional: string | null
) => `
    <p>Hola ${usuario.persona?.nombre ?? usuario.nombre_usuario},</p>
    <p>Se generaron nuevas credenciales de acceso para el sistema del taller mecánico.</p>
    <p><strong>Usuario:</strong> ${usuario.nombre_usuario}</p>
    <p><strong>Contraseña temporal:</strong> ${passwordTemporal}</p>
    <p>Deberás cambiar tu contraseña en el primer ingreso. Esta contraseña caduca en las próximas 72 horas.</p>
    ${mensajeAdicional ? `<p>${mensajeAdicional}</p>` : ''}
    <p>Saludos,<br/>Equipo MecaniSoft</p>
  `

async function registrarEnvio({ usuario, exitoso, error, sessionUserId }: RegistrarEnvioOptions) {
  const resultado = await prisma.usuario.update({
    where: { id_usuario: usuario.id_usuario },
    data: {
      envio_credenciales_pendiente: !exitoso,
      ultimo_envio_credenciales: new Date(),
      ultimo_error_envio: exitoso ? null : (error ?? 'Error desconocido')
    },
    select: {
      id_usuario: true,
      nombre_usuario: true,
      envio_credenciales_pendiente: true,
      ultimo_envio_credenciales: true,
      ultimo_error_envio: true
    }
  })

  try {
    await logEvent({
      usuarioId: sessionUserId,
      accion: exitoso ? 'EMAIL_USUARIO_OK' : 'EMAIL_USUARIO_FAIL',
      descripcion: exitoso
        ? `Correo de credenciales enviado a ${usuario.nombre_usuario}`
        : `Fallo al enviar credenciales a ${usuario.nombre_usuario}: ${error ?? 'Error desconocido'}`,
      tabla: 'usuario'
    })
  } catch (err) {
    console.error('[usuarios] no se pudo registrar en bitácora:', err)
  }

  return { usuario: resultado }
}

type EnviarCredencialesOptions = {
  usuarioId: number
  payload?: unknown
  sessionUserId: number
  passwordExpiraEnHoras?: number
}

export async function enviarCredenciales(options: EnviarCredencialesOptions) {
  const input = enviarCredencialesSchema.parse((options.payload ?? {}) as Partial<EnviarCredencialesInput>)

  const usuario = await prisma.usuario.findUnique({
    where: { id_usuario: options.usuarioId },
    select: {
      id_usuario: true,
      nombre_usuario: true,
      estatus: true,
      persona: {
        select: {
          nombre: true,
          correo: true
        }
      }
    }
  })

  if (!usuario) {
    throw new UsuarioCredencialesError(404, 'Usuario no encontrado')
  }

  if (!usuario.estatus) {
    throw new UsuarioCredencialesError(400, 'El usuario fue dado de baja')
  }

  const correoDestino = usuario.persona?.correo?.trim()
  if (!correoDestino) {
    throw new UsuarioCredencialesError(400, 'El usuario no tiene correo registrado')
  }

  const { passwordTemporal } = await resetPasswordTemporal(
    options.usuarioId,
    {
      enviar_correo: true,
      password_expira_en_horas: options.passwordExpiraEnHoras
    },
    options.sessionUserId
  )

  const html = buildEmailBody(usuario, passwordTemporal, input.mensaje_adicional ?? null)

  try {
    await sendMail({
      to: correoDestino,
      subject: input.asunto,
      html
    })
  } catch (error) {
    await registrarEnvio({
      usuario,
      exitoso: false,
      error: error instanceof Error ? error.message : 'No fue posible enviar el correo',
      sessionUserId: options.sessionUserId
    })
    throw new UsuarioCredencialesError(502, 'No fue posible enviar el correo de credenciales', {
      code: 'SMTP_ERROR',
      cause: error
    })
  }

  await registrarEnvio({
    usuario,
    exitoso: true,
    sessionUserId: options.sessionUserId
  })

  return { ok: true }
}

export async function registrarEnvioCredencialesResultado(params: {
  usuarioId: number
  exitoso: boolean
  error?: string | null
  sessionUserId: number
}) {
  const usuario = await prisma.usuario.findUnique({
    where: { id_usuario: params.usuarioId },
    select: {
      id_usuario: true,
      nombre_usuario: true
    }
  })

  if (!usuario) {
    throw new UsuarioCredencialesError(404, 'Usuario no encontrado para registrar envío')
  }

  return registrarEnvio({
    usuario,
    exitoso: params.exitoso,
    error: params.error,
    sessionUserId: params.sessionUserId
  })
}
