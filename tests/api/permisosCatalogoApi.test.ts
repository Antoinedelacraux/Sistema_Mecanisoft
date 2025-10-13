import { NextRequest } from 'next/server'
import { GET } from '@/app/api/permisos/catalogo/route'
import { getServerSession } from 'next-auth'
import { listarCatalogoPermisos } from '@/lib/permisos/service'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/permisos/service', () => ({
  listarCatalogoPermisos: jest.fn()
}))

describe('GET /api/permisos/catalogo', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('retorna 401 si no hay sesión', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/permisos/catalogo')
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it('retorna catálogo de permisos', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: '10' } })
    ;(listarCatalogoPermisos as jest.Mock).mockResolvedValue([{ codigo: 'clientes.listar' }])

    const request = new NextRequest('http://localhost/api/permisos/catalogo?incluirInactivos=true')
    const response = await GET(request)

    expect(listarCatalogoPermisos).toHaveBeenCalledWith({ incluirInactivos: true })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.permisos).toHaveLength(1)
  })
})
