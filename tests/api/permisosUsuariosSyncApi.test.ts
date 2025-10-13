import { NextRequest } from 'next/server'
import { POST } from '@/app/api/permisos/usuarios/[id]/sincronizar/route'
import { getServerSession } from 'next-auth'
import { sincronizarPermisosUsuarioConRol } from '@/lib/permisos/service'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn()
}))

jest.mock('@/lib/permisos/service', () => ({
  sincronizarPermisosUsuarioConRol: jest.fn()
}))

describe('POST /api/permisos/usuarios/[id]/sincronizar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sincroniza permisos base del usuario', async () => {
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: { id: '3' } })
    ;(sincronizarPermisosUsuarioConRol as jest.Mock).mockResolvedValue({ totalBase: 4 })

    const request = new NextRequest('http://localhost/api/permisos/usuarios/8/sincronizar', {
      method: 'POST',
      body: JSON.stringify({ conservarPersonalizaciones: true }),
      headers: { 'Content-Type': 'application/json' }
    })

    const response = await POST(request, {
      params: Promise.resolve({ id: '8' })
    })

    expect(response.status).toBe(200)
    expect(sincronizarPermisosUsuarioConRol).toHaveBeenCalledWith({
      idUsuario: 8,
      usuarioActorId: 3,
      conservarPersonalizaciones: true
    })
  })
})
