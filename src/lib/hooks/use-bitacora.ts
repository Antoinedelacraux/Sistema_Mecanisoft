import { prisma } from '@/lib/prisma'

export const useBitacora = () => {
  const registrarAccion = async (
    id_usuario: number,
    accion: string,
    descripcion: string,
    tabla?: string,
    ip?: string
  ) => {
    try {
      await prisma.bitacora.create({
        data: {
          id_usuario,
          accion,
          descripcion,
          tabla,
          ip_publica: ip
        }
      })
    } catch (error) {
      console.error('Error registrando en bitácora:', error)
    }
  }

  return { registrarAccion }
}