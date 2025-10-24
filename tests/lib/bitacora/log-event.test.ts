import { logEvent } from '@/lib/bitacora/log-event'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    bitacora: { create: jest.fn() }
  }
}))

import { prisma } from '@/lib/prisma'

describe('logEvent', () => {
  afterEach(() => { jest.clearAllMocks() })

  it('calls prisma.bitacora.create with provided data', async () => {
    await logEvent({ usuarioId: 1, accion: 'TEST', descripcion: 'desc', tabla: 'sistema', ip: '1.2.3.4' })

    expect(prisma.bitacora.create).toHaveBeenCalledTimes(1)
    expect(prisma.bitacora.create).toHaveBeenCalledWith({
      data: {
        id_usuario: 1,
        accion: 'TEST',
        descripcion: 'desc',
        tabla: 'sistema',
        ip_publica: '1.2.3.4'
      }
    })
  })

  it('does not throw if prisma.create throws', async () => {
    ;(prisma.bitacora.create as jest.Mock).mockImplementationOnce(() => { throw new Error('DB down') })

    await expect(logEvent({ usuarioId: 2, accion: 'FAIL' })).resolves.toBeUndefined()
    expect(prisma.bitacora.create).toHaveBeenCalled()
  })
})
