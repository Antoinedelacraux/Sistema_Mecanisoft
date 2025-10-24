import { prisma as defaultPrisma } from '@/lib/prisma'

type LogEventOptions = {
  prismaClient?: typeof defaultPrisma
  usuarioId: number
  accion: string
  descripcion?: string
  tabla?: string
  ip?: string
}

export async function logEvent(opts: LogEventOptions) {
  const prisma = opts.prismaClient ?? defaultPrisma

  try {
    await prisma.bitacora.create({
      data: {
        id_usuario: opts.usuarioId,
        accion: opts.accion,
        descripcion: opts.descripcion,
        tabla: opts.tabla,
        ip_publica: opts.ip
      }
    })
  } catch (error) {
    // Never throw from logging to avoid breaking main flow.
    // Log to console for observability.
    // eslint-disable-next-line no-console
    console.error('[bitacora] error al registrar evento', error)
  }
}

export default logEvent
