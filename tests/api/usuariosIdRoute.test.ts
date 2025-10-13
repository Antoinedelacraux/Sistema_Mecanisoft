/// <reference types="jest" />

import { NextRequest } from 'next/server'
import { GET, PATCH, DELETE } from '@/app/api/usuarios/[id]/route'
import { getServerSession } from 'next-auth/next'
import { getUsuarioOrThrow } from '@/app/api/usuarios/controllers/detail-controller'
import { updateUsuario } from '@/app/api/usuarios/controllers/update-controller'
import { changeEstadoUsuario, deleteUsuario } from '@/app/api/usuarios/controllers/status-controller'
import { resetPasswordUsuario } from '@/app/api/usuarios/controllers/reset-password-controller'
import { registrarEnvioCredenciales } from '@/app/api/usuarios/controllers/notifications-controller'
import { enviarCredencialesUsuario } from '@/app/api/usuarios/controllers/send-credentials-controller'
import { ApiError } from '@/app/api/usuarios/controllers/errors'

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/app/api/usuarios/controllers/detail-controller', () => ({
  getUsuarioOrThrow: jest.fn()
}))

jest.mock('@/app/api/usuarios/controllers/update-controller', () => ({
  updateUsuario: jest.fn()
}))

jest.mock('@/app/api/usuarios/controllers/status-controller', () => ({
  changeEstadoUsuario: jest.fn(),
  deleteUsuario: jest.fn()
}))

jest.mock('@/app/api/usuarios/controllers/reset-password-controller', () => ({
  resetPasswordUsuario: jest.fn()
}))

jest.mock('@/app/api/usuarios/controllers/notifications-controller', () => ({
  registrarEnvioCredenciales: jest.fn()
}))

jest.mock('@/app/api/usuarios/controllers/send-credentials-controller', () => ({
  enviarCredencialesUsuario: jest.fn()
}))

const ensureResponse = <T extends Response>(response: T | undefined): T => {
  if (!response) {
    throw new Error('La ruta devolvió una respuesta indefinida')
  }
  return response
}

describe('API /api/usuarios/[id]', () => {
  const getSessionMock = () => getServerSession as jest.Mock
  const getDetailMock = () => getUsuarioOrThrow as jest.Mock
  const getUpdateMock = () => updateUsuario as jest.Mock
  const getChangeEstadoMock = () => changeEstadoUsuario as jest.Mock
  const getDeleteMock = () => deleteUsuario as jest.Mock
  const getResetPasswordMock = () => resetPasswordUsuario as jest.Mock
  const getRegistrarEnvioMock = () => registrarEnvioCredenciales as jest.Mock
  const getEnviarCredencialesMock = () => enviarCredencialesUsuario as jest.Mock

  const buildContext = (id = '42') => ({ params: Promise.resolve({ id }) })

  const buildRequest = (payload: unknown) => ({
    json: jest.fn().mockResolvedValue(payload)
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET', () => {
    it('responde 401 cuando no hay sesión', async () => {
      getSessionMock().mockResolvedValue(null)

        const response = ensureResponse(await GET({} as NextRequest, buildContext()))

      expect(response.status).toBe(401)
      expect(getDetailMock()).not.toHaveBeenCalled()
    })

    it('retorna el usuario solicitado', async () => {
      const usuario = { id_usuario: 42, nombre_usuario: 'jrivera' }
      getSessionMock().mockResolvedValue({ user: { id: '7' } })
      getDetailMock().mockResolvedValue(usuario)

        const response = ensureResponse(await GET({} as NextRequest, buildContext()))

      expect(response.status).toBe(200)
      expect(getDetailMock()).toHaveBeenCalledWith(42)
      const json = await response.json()
      expect(json).toEqual({ usuario })
    })

    it('propaga errores de negocio', async () => {
      getSessionMock().mockResolvedValue({ user: { id: '7' } })
      getDetailMock().mockRejectedValue(new ApiError(404, 'Usuario no encontrado'))

        const response = ensureResponse(await GET({} as NextRequest, buildContext()))

      expect(response.status).toBe(404)
      const json = await response.json()
      expect(json).toEqual({ error: 'Usuario no encontrado' })
    })
  })

  describe('PATCH', () => {
    it('responde 401 cuando no hay sesión', async () => {
      getSessionMock().mockResolvedValue(null)

        const response = ensureResponse(await PATCH(buildRequest({}) as unknown as NextRequest, buildContext()))

      expect(response.status).toBe(401)
      expect(getUpdateMock()).not.toHaveBeenCalled()
    })

    it('actualiza el usuario cuando no se especifica acción', async () => {
      const payload = { nombre_usuario: 'nuevoNombre' }
      const resultado = { usuario: { id_usuario: 42 } }

      getSessionMock().mockResolvedValue({ user: { id: '3' } })
      getUpdateMock().mockResolvedValue(resultado)

      const response = ensureResponse(await PATCH(buildRequest(payload) as unknown as NextRequest, buildContext()))

      expect(getUpdateMock()).toHaveBeenCalledWith(42, payload, 3)
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toEqual(resultado)
    })

    it('cambia el estado del usuario cuando la acción es estado', async () => {
      const payload = { action: 'estado', estado: false, motivo: 'Bloqueo temporal' }
      const resultado = { usuario: { id_usuario: 42, estado: false } }

      getSessionMock().mockResolvedValue({ user: { id: '12' } })
      getChangeEstadoMock().mockResolvedValue(resultado)

      const response = ensureResponse(await PATCH(buildRequest(payload) as unknown as NextRequest, buildContext()))

      expect(getChangeEstadoMock()).toHaveBeenCalledWith({
        id: 42,
        estado: false,
        motivo: 'Bloqueo temporal',
        sessionUserId: 12
      })
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toEqual(resultado)
    })

    it('valida que el estado sea booleano', async () => {
      const payload = { action: 'estado', estado: 'si' }

      getSessionMock().mockResolvedValue({ user: { id: '9' } })

      const response = ensureResponse(await PATCH(buildRequest(payload) as unknown as NextRequest, buildContext()))

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json).toEqual({ error: 'Estado inválido' })
      expect(getChangeEstadoMock()).not.toHaveBeenCalled()
    })

    it('reinicia la contraseña temporal', async () => {
      const payload = { action: 'reset_password', enviar_correo: false }
      const resultado = { usuario: { id_usuario: 42 }, passwordTemporal: 'ABC123' }

      getSessionMock().mockResolvedValue({ user: { id: '15' } })
      getResetPasswordMock().mockResolvedValue(resultado)

      const response = ensureResponse(await PATCH(buildRequest(payload) as unknown as NextRequest, buildContext()))

      expect(getResetPasswordMock()).toHaveBeenCalledWith(42, payload, 15)
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toEqual(resultado)
    })

    it('registra el envío de credenciales', async () => {
      const payload = { action: 'registrar_envio', exitoso: false, error: 'SMTP down' }
      const resultado = { usuario: { id_usuario: 42, envio_credenciales_pendiente: true } }

      getSessionMock().mockResolvedValue({ user: { id: '33' } })
      getRegistrarEnvioMock().mockResolvedValue(resultado)

      const response = ensureResponse(await PATCH(buildRequest(payload) as unknown as NextRequest, buildContext()))

      expect(getRegistrarEnvioMock()).toHaveBeenCalledWith({
        id: 42,
        exitoso: false,
        error: 'SMTP down',
        sessionUserId: 33
      })
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toEqual(resultado)
    })

    it('envía credenciales por correo', async () => {
      const payload = { action: 'enviar_credenciales', asunto: 'Hola' }
      const resultado = { ok: true }

      getSessionMock().mockResolvedValue({ user: { id: '44' } })
      getEnviarCredencialesMock().mockResolvedValue(resultado)

      const response = ensureResponse(await PATCH(buildRequest(payload) as unknown as NextRequest, buildContext()))

      expect(getEnviarCredencialesMock()).toHaveBeenCalledWith(42, payload, 44)
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toEqual(resultado)
    })

    it('propaga errores de negocio en acciones secundarias', async () => {
      const payload = { action: 'enviar_credenciales' }

      getSessionMock().mockResolvedValue({ user: { id: '44' } })
      getEnviarCredencialesMock().mockRejectedValue(new ApiError(500, 'SMTP caído'))

  const response = ensureResponse(await PATCH(buildRequest(payload) as unknown as NextRequest, buildContext()))

      expect(response.status).toBe(500)
      const json = await response.json()
      expect(json).toEqual({ error: 'SMTP caído' })
    })
  })

  describe('DELETE', () => {
    it('responde 401 cuando no hay sesión', async () => {
      getSessionMock().mockResolvedValue(null)

      const response = ensureResponse(await DELETE({} as NextRequest, buildContext()))

      expect(response.status).toBe(401)
      expect(getDeleteMock()).not.toHaveBeenCalled()
    })

    it('elimina al usuario y retorna el resultado', async () => {
      const resultado = { usuario: { id_usuario: 42, estatus: false } }

      getSessionMock().mockResolvedValue({ user: { id: '18' } })
      getDeleteMock().mockResolvedValue(resultado)

        const response = ensureResponse(await DELETE({} as NextRequest, buildContext()))

      expect(getDeleteMock()).toHaveBeenCalledWith(42, 18)
      expect(response.status).toBe(200)
      const json = await response.json()
      expect(json).toEqual(resultado)
    })

    it('propaga errores de negocio', async () => {
      getSessionMock().mockResolvedValue({ user: { id: '18' } })
      getDeleteMock().mockRejectedValue(new ApiError(400, 'Ya está dado de baja'))

          const response = ensureResponse(await DELETE({} as NextRequest, buildContext()))

      expect(response.status).toBe(400)
      const json = await response.json()
      expect(json).toEqual({ error: 'Ya está dado de baja' })
    })
  })
})
