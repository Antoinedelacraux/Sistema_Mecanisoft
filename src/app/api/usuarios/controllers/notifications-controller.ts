import { registrarEnvioCredencialesResultado, UsuarioCredencialesError } from '@/lib/usuarios/credenciales'
import { ApiError } from './errors'

interface RegistrarEnvioParams {
  id: number
  exitoso: boolean
  error?: string | null
  sessionUserId: number
}

export async function registrarEnvioCredenciales({ id, exitoso, error, sessionUserId }: RegistrarEnvioParams) {
  try {
    return await registrarEnvioCredencialesResultado({
      usuarioId: id,
      exitoso,
      error,
      sessionUserId
    })
  } catch (err) {
    if (err instanceof UsuarioCredencialesError) {
      throw new ApiError(err.status, err.message)
    }
    throw err
  }
}
