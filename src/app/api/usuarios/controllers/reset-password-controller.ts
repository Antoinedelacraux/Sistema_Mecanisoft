import { ApiError } from './errors'
import { resetPasswordTemporal, UsuarioPasswordError } from '@/lib/usuarios/passwords'

export async function resetPasswordUsuario(id: number, payload: unknown, sessionUserId: number) {
  try {
    return await resetPasswordTemporal(id, payload, sessionUserId)
  } catch (error) {
    if (error instanceof UsuarioPasswordError) {
      throw new ApiError(error.status, error.message)
    }
    throw error
  }
}
