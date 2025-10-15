import { NextRequest } from 'next/server'
import { GET, PUT } from '@/app/api/permisos/roles/[id]/route'
import { getServerSession } from 'next-auth'
import { obtenerPermisosDeRol } from '@/lib/permisos/service'
import { assignPermissionsToRole } from '@/lib/roles/service'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/permisos/service', () => ({
  obtenerPermisosDeRol: jest.fn()
}))

jest.mock('@/lib/roles/service', () => ({
  assignPermissionsToRole: jest.fn()
}))

const ensureResponse = <T extends Response>(response: T | undefined): T => {
  if (!response) {
    throw new Error('La ruta devolvió una respuesta indefinida')
  }
  return response
}

describe('API permisos rol', () => {

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('GET retorna permisos del rol', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: '1', permisos: ['roles.administrar'] } })
    ;(obtenerPermisosDeRol as jest.Mock).mockResolvedValue([{ codigo: 'clientes.listar' }])

    const response = ensureResponse(
      await GET(new NextRequest('http://localhost/api/permisos/roles/2'), {
        params: Promise.resolve({ id: '2' })
      })
    )

    expect(response.status).toBe(200)
    expect(obtenerPermisosDeRol).toHaveBeenCalledWith(2)
    const data = await response.json()
    expect(data.permisos).toHaveLength(1)
  })

  it('PUT actualiza permisos del rol', async () => {
  ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: '5', permisos: ['roles.administrar'] } })
  ;(assignPermissionsToRole as jest.Mock).mockResolvedValue([{ codigo: 'clientes.listar' }])

    const request = new NextRequest('http://localhost/api/permisos/roles/2', {
      method: 'PUT',
      body: JSON.stringify({ permisos: ['clientes.listar'] }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = ensureResponse(
      await PUT(request, {
        params: Promise.resolve({ id: '2' })
      })
    )

    expect(response.status).toBe(200)
    expect(assignPermissionsToRole).toHaveBeenCalledWith(2, { permisos: ['clientes.listar'], nota: null }, 5)
  })
})
