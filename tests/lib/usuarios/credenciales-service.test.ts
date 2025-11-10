import { enviarCredenciales } from '@/lib/usuarios/credenciales'
import { prisma } from '@/lib/prisma'
import { sendMail } from '@/lib/mailer'
import { resetPasswordTemporal } from '@/lib/usuarios/passwords'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    usuario: {
      findUnique: jest.fn(),
      update: jest.fn()
    }
  }
}))

jest.mock('@/lib/mailer', () => ({
  sendMail: jest.fn()
}))

jest.mock('@/lib/usuarios/passwords', () => ({
  resetPasswordTemporal: jest.fn()
}))

jest.mock('@/lib/bitacora/log-event', () => ({
  logEvent: jest.fn()
}))

describe('enviarCredenciales service', () => {
  const getFindUniqueMock = () => prisma.usuario.findUnique as jest.Mock
  const getUpdateMock = () => prisma.usuario.update as jest.Mock
  const getSendMailMock = () => sendMail as jest.Mock
  const getResetPasswordMock = () => resetPasswordTemporal as jest.Mock

  beforeEach(() => {
    getFindUniqueMock().mockReset()
    getUpdateMock().mockReset()
    getSendMailMock().mockReset()
    getResetPasswordMock().mockReset()
  })

  it('envía credenciales y registra éxito', async () => {
    getFindUniqueMock().mockResolvedValue({
      id_usuario: 99,
      nombre_usuario: 'amartinez',
      estatus: true,
      persona: { nombre: 'Ana', correo: 'ana@example.com' }
    })
    getResetPasswordMock().mockResolvedValue({
      usuario: {},
      passwordTemporal: 'Temp1234'
    })
    getUpdateMock().mockResolvedValue({
      id_usuario: 99,
      nombre_usuario: 'amartinez',
      envio_credenciales_pendiente: false,
      ultimo_envio_credenciales: new Date(),
      ultimo_error_envio: null
    })

    await enviarCredenciales({ usuarioId: 99, sessionUserId: 1 })

    expect(getFindUniqueMock()).toHaveBeenCalledWith({
      where: { id_usuario: 99 },
      select: expect.any(Object)
    })
    expect(getResetPasswordMock()).toHaveBeenCalledWith(99, {
      enviar_correo: true,
      password_expira_en_horas: undefined
    }, 1)
    expect(getSendMailMock()).toHaveBeenCalledWith(expect.objectContaining({
      to: 'ana@example.com',
      subject: 'Credenciales de acceso'
    }))
    // Se llama dos veces: una para éxito, otra en registrarEnvio interno
    expect(getUpdateMock()).toHaveBeenCalled()
  })

  it('marca pendiente cuando el correo falla', async () => {
    getFindUniqueMock().mockResolvedValue({
      id_usuario: 100,
      nombre_usuario: 'jvaldez',
      estatus: true,
      persona: { nombre: 'Jorge', correo: 'jorge@example.com' }
    })
    getResetPasswordMock().mockResolvedValue({
      usuario: {},
      passwordTemporal: 'Temp1234'
    })
    getUpdateMock().mockResolvedValue({
      id_usuario: 100,
      nombre_usuario: 'jvaldez',
      envio_credenciales_pendiente: true,
      ultimo_envio_credenciales: new Date(),
      ultimo_error_envio: 'SMTP down'
    })
    getSendMailMock().mockRejectedValue(new Error('SMTP down'))

    await expect(enviarCredenciales({ usuarioId: 100, sessionUserId: 2 })).rejects.toThrow('No fue posible enviar el correo de credenciales')

    expect(getUpdateMock()).toHaveBeenCalled()
  })
})
