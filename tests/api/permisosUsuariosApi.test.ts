import { NextRequest } from 'next/server'
import { GET, PUT } from '@/app/api/permisos/usuarios/[id]/route'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import {
  obtenerPermisosDeRol,
  obtenerPermisosPersonalizadosDeUsuario,
  obtenerPermisosResueltosDeUsuario,
  setPermisosPersonalizadosDeUsuario
} from '@/lib/permisos/service'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/prisma', () => {
  return {
    prisma: {
      usuario: {
        findUnique: jest.fn()
      }
    }
  }
})

jest.mock('@/lib/permisos/service', () => ({
  obtenerPermisosDeRol: jest.fn(),
  obtenerPermisosPersonalizadosDeUsuario: jest.fn(),
  obtenerPermisosResueltosDeUsuario: jest.fn(),
  setPermisosPersonalizadosDeUsuario: jest.fn()
}))

const ensureResponse = <T extends Response>(response: T | undefined): T => {
  if (!response) {
    throw new Error('La ruta devolvió una respuesta indefinida')
  }
  return response
}

describe('API permisos usuario', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GET retorna permisos base, personalizados y resueltos', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: '1' } })
    ;(prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id_usuario: 7, id_rol: 3 })
    ;(obtenerPermisosDeRol as jest.Mock).mockResolvedValue([{ codigo: 'clientes.listar' }])
    ;(obtenerPermisosPersonalizadosDeUsuario as jest.Mock).mockResolvedValue([])
    ;(obtenerPermisosResueltosDeUsuario as jest.Mock).mockResolvedValue([{ codigo: 'clientes.listar' }])

    const response = ensureResponse(
      await GET(new NextRequest('http://localhost/api/permisos/usuarios/7'), {
        params: Promise.resolve({ id: '7' })
      })
    )

    expect(response.status).toBe(200)
    expect(prisma.usuario.findUnique).toHaveBeenCalled()
    const data = await response.json()
    expect(data.permisos.base).toHaveLength(1)
  })

  it('PUT actualiza personalizaciones del usuario', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: '9' } })
    ;(setPermisosPersonalizadosDeUsuario as jest.Mock).mockResolvedValue([{ codigo: 'clientes.editar' }])
    ;(obtenerPermisosResueltosDeUsuario as jest.Mock).mockResolvedValue([{ codigo: 'clientes.editar' }])

    const request = new NextRequest('http://localhost/api/permisos/usuarios/7', {
      method: 'PUT',
      body: JSON.stringify({
        personalizaciones: [
          { codigo: 'clientes.editar', concedido: true, origen: 'EXTRA_MANUAL', comentario: 'Necesario' }
        ]
      }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = ensureResponse(
      await PUT(request, {
        params: Promise.resolve({ id: '7' })
      })
    )

    expect(response.status).toBe(200)
    expect(setPermisosPersonalizadosDeUsuario).toHaveBeenCalledWith({
      idUsuario: 7,
      usuarioActorId: 9,
      personalizaciones: [
        { codigo: 'clientes.editar', concedido: true, origen: 'EXTRA_MANUAL', comentario: 'Necesario' }
      ],
      descripcion: undefined
    })
  })
})
