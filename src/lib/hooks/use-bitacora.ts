import { prisma } from '@/lib/prisma'
import { logEvent } from '@/lib/bitacora/log-event'

export const useBitacora = () => {
  const registrarAccion = async (
    id_usuario: number,
    accion: string,
    descripcion: string,
    tabla?: string,
    ip?: string
  ) => {
    try {
      await logEvent({ usuarioId: id_usuario, accion, descripcion, tabla, ip })
    } catch (error) {
      console.error('Error registrando en bitácora:', error)
    }
  }

  return { registrarAccion }
}