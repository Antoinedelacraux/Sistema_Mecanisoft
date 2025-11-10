import { ApiError } from './errors'
import { enviarCredenciales, UsuarioCredencialesError } from '@/lib/usuarios/credenciales'

export async function enviarCredencialesUsuario(
  id: number,
  payload: unknown,
  sessionUserId: number
) {
  try {
    await enviarCredenciales({
      usuarioId: id,
      payload,
      sessionUserId,
      passwordExpiraEnHoras: undefined
    })
    return { ok: true }
  } catch (error) {
    if (error instanceof UsuarioCredencialesError) {
      throw new ApiError(error.status, error.message)
    }
    throw error
  }
}
