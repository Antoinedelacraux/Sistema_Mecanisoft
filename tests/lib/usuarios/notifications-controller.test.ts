import { registrarEnvioCredencialesResultado } from '@/lib/usuarios/credenciales'
import { prisma } from '@/lib/prisma'
import { logEvent } from '@/lib/bitacora/log-event'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    usuario: {
      update: jest.fn()
    }
  }
}))

jest.mock('@/lib/bitacora/log-event', () => ({
  __esModule: true,
  logEvent: jest.fn()
}))

describe('usuarios notifications controller', () => {
  const getUpdateMock = () => (prisma.usuario.update as jest.Mock)
  const getLogEventMock = () => (logEvent as jest.Mock)

  beforeEach(() => {
    getUpdateMock().mockReset()
    getLogEventMock().mockReset()
  })

  it('marca el envío como exitoso y limpia errores previos', async () => {
    const now = new Date('2025-11-08T10:00:00Z')

    getUpdateMock().mockResolvedValue({
      id_usuario: 12,
      nombre_usuario: 'jrivera',
      envio_credenciales_pendiente: false,
      ultimo_envio_credenciales: now,
      ultimo_error_envio: null
    })

    const resultado = await registrarEnvioCredencialesResultado({
      usuarioId: 12,
      exitoso: true,
      sessionUserId: 7
    })

    expect(getUpdateMock()).toHaveBeenCalledWith({
      where: { id_usuario: 12 },
      data: {
        envio_credenciales_pendiente: false,
        ultimo_envio_credenciales: expect.any(Date),
        ultimo_error_envio: null
      },
      select: expect.any(Object)
    })

    expect(resultado.usuario).toEqual({
      id_usuario: 12,
      nombre_usuario: 'jrivera',
      envio_credenciales_pendiente: false,
      ultimo_envio_credenciales: now,
      ultimo_error_envio: null
    })

    expect(getLogEventMock()).toHaveBeenCalledWith({
      usuarioId: 7,
      accion: 'EMAIL_USUARIO_OK',
      descripcion: 'Correo de credenciales enviado a jrivera',
      tabla: 'usuario'
    })
  })

  it('registra error cuando el envío falla', async () => {
    getUpdateMock().mockResolvedValue({
      id_usuario: 12,
      nombre_usuario: 'jrivera',
      envio_credenciales_pendiente: true,
      ultimo_envio_credenciales: new Date('2025-11-08T10:05:00Z'),
      ultimo_error_envio: 'SMTP down'
    })

    const resultado = await registrarEnvioCredencialesResultado({
      usuarioId: 12,
      exitoso: false,
      error: 'SMTP down',
      sessionUserId: 7
    })

    expect(getUpdateMock()).toHaveBeenCalledWith({
      where: { id_usuario: 12 },
      data: {
        envio_credenciales_pendiente: true,
        ultimo_envio_credenciales: expect.any(Date),
        ultimo_error_envio: 'SMTP down'
      },
      select: expect.any(Object)
    })

    expect(resultado.usuario.envio_credenciales_pendiente).toBe(true)
    expect(resultado.usuario.ultimo_error_envio).toBe('SMTP down')

    expect(getLogEventMock()).toHaveBeenCalledWith({
      usuarioId: 7,
      accion: 'EMAIL_USUARIO_FAIL',
      descripcion: 'Fallo al enviar credenciales a jrivera: SMTP down',
      tabla: 'usuario'
    })
  })
})
