import { prisma } from '@/lib/prisma'
import { defaultUsuarioSelect } from './helpers'

interface RegistrarEnvioParams {
  id: number
  exitoso: boolean
  error?: string | null
  sessionUserId: number
}

export async function registrarEnvioCredenciales({ id, exitoso, error, sessionUserId }: RegistrarEnvioParams) {
  const resultado = await prisma.usuario.update({
    where: { id_usuario: id },
    data: {
      envio_credenciales_pendiente: !exitoso,
      ultimo_envio_credenciales: new Date(),
      ultimo_error_envio: exitoso ? null : (error ?? 'Error desconocido')
    },
    select: defaultUsuarioSelect
  })

  try {
    const { logEvent } = await import('@/lib/bitacora/log-event')
    await logEvent({ usuarioId: sessionUserId, accion: exitoso ? 'EMAIL_USUARIO_OK' : 'EMAIL_USUARIO_FAIL', descripcion: exitoso ? `Correo de credenciales enviado a ${resultado.nombre_usuario}` : `Fallo al enviar credenciales a ${resultado.nombre_usuario}: ${error ?? 'Error desconocido'}`, tabla: 'usuario' })
  } catch (err) {
    console.error('[usuarios] no se pudo registrar en bitácora:', err)
  }

  return { usuario: resultado }
}
