import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ProfileConfig from '@/components/usuarios/ProfileConfig'

const mockGet = jest.fn(async () => ({ usuario: { id_usuario: 1, persona: { nombre: 'Admin', correo: 'admin@local' }, imagen_usuario: null } }))

describe('ProfileConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn(async (url: any, opts: any) => {
      if (String(url).endsWith('/api/usuarios/me') && (!opts || opts.method === 'GET')) {
        return { ok: true, json: async () => ({ usuario: { id_usuario: 1, persona: { nombre: 'Admin', correo: 'admin@local' }, imagen_usuario: null } }) }
      }
      if (String(url).startsWith('/api/bitacora') || String(url).includes('/api/bitacora')) {
        return { ok: true, json: async () => ({ eventos: [{ id_bitacora: 99, fecha_hora: new Date().toISOString(), accion: 'ACTUALIZAR_PERFIL', descripcion: 'Se actualizó perfil' }] }) }
      }
      if (String(url).endsWith('/api/usuarios/me') && opts?.method === 'PATCH') {
        return { ok: true, json: async () => ({ success: true, usuario: { persona: { nombre: 'Nuevo' } } }) }
      }
      return { ok: true, json: async () => ({}) }
    }) as any
  })

  it('renders fields and allows save', async () => {
    render(<ProfileConfig />)
    await waitFor(() => expect(screen.getByPlaceholderText(/Nombre/)).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText(/Nombre/), { target: { value: 'Nuevo' } })
    fireEvent.click(screen.getByText('Guardar'))
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
  })

  it('opens versions modal and reverts to selected version', async () => {
    // override fetch for this test to include versions and revert
    const mockVersions: any[] = [{ id: 'v-1', image: '/uploads/avatars/avatar_1_123_256.webp', variants: ['/uploads/avatars/avatar_1_123_64.webp', '/uploads/avatars/avatar_1_123_128.webp', '/uploads/avatars/avatar_1_123_256.webp'], created_at: new Date().toISOString() }]
    const fetchMock = jest.fn(async (url: any, opts?: any): Promise<any> => {
      if (String(url).endsWith('/api/usuarios/me') && (!opts || opts.method === 'GET')) {
        return { ok: true, json: async () => ({ usuario: { id_usuario: 1, persona: { nombre: 'Admin', correo: 'admin@local' }, imagen_usuario: null } }) }
      }
      if (String(url).endsWith('/api/usuarios/me/avatar/versions')) {
        return { ok: true, json: async () => ({ versions: mockVersions }) }
      }
      if (String(url).endsWith('/api/usuarios/me/avatar/revert') && opts?.method === 'POST') {
        let body: any = {}
        try { body = opts?.body ? JSON.parse(opts.body) : {} } catch (_) { body = {} }
        if (body.versionId === 'v-1') return { ok: true, json: async () => ({ success: true, imageUrl: mockVersions[0].image }) }
        return { ok: false, status: 400, json: async () => ({ error: 'not found' }) }
      }
      if (String(url).startsWith('/api/bitacora')) {
        return { ok: true, json: async () => ({ eventos: [] }) }
      }
      if (String(url).endsWith('/api/usuarios/me') && opts?.method === 'PATCH') {
        return { ok: true, json: async () => ({ success: true, usuario: { persona: { nombre: 'Nuevo' } } }) }
      }
      if (String(url).endsWith('/api/auth/refresh-session')) {
        return { ok: true, json: async () => ({}) }
      }
      return { ok: true, json: async () => ({}) }
    })
    ;(global.fetch as any) = fetchMock

    render(<ProfileConfig />)
    await waitFor(() => expect(screen.getByPlaceholderText(/Nombre/)).toBeInTheDocument())
    // open versions modal
    fireEvent.click(screen.getByText('Versiones'))
    await waitFor(() => expect(screen.getByText('Versiones de avatar')).toBeInTheDocument())
    // click revert on first version
    const revertButtons = await screen.findAllByText('Revertir')
    expect(revertButtons.length).toBeGreaterThan(0)
    fireEvent.click(revertButtons[0])
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/usuarios/me/avatar/revert', expect.objectContaining({ method: 'POST' })))
  })
})
