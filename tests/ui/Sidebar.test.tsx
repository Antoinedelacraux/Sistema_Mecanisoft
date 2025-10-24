import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'

// Mock next-auth useSession
jest.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { id: '1', name: 'Admin Pruebas', image: null, role: 'Administrador', permisos: [] } }, status: 'authenticated' })
}))

// Mock usePathname used by Sidebar
jest.mock('next/navigation', () => ({ usePathname: () => '/' }))

// Provide a minimal usePermisos hook if imported from real hook - the component imports the hook but our mock of next-auth is enough
jest.mock('@/hooks/use-permisos', () => ({ usePermisos: () => ({ puede: () => true }) }))

import { Sidebar } from '@/components/layout/sidebar'

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // default fetch for /api/usuarios/me
    global.fetch = jest.fn(async (url: any) => {
      if (String(url).endsWith('/api/usuarios/me')) {
        return { ok: true, json: async () => ({ usuario: { id_usuario: 1, persona: { nombre: 'Admin', apellido_paterno: 'Pruebas' }, imagen_usuario: null, rol: { nombre_rol: 'Administrador' } } }) }
      }
      return { ok: true, json: async () => ({}) }
    }) as any
  })

  it('shows initial name and updates avatar when user-profile-updated event is dispatched', async () => {
    render(<Sidebar />)

  // initially we should see the loading skeleton while profile fetch runs
  expect(screen.getByTestId('sidebar-avatar-skeleton')).toBeInTheDocument()

  // wait for profile to load and skeleton to disappear
  await waitFor(() => expect(screen.queryByTestId('sidebar-avatar-skeleton')).not.toBeInTheDocument())

  // after load, the name (from fetched profile) should appear
  expect(screen.getByText('Admin Pruebas')).toBeInTheDocument()

    // dispatch event with new image
    act(() => {
      window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: { imagen_usuario: '/uploads/avatars/new.png', usuario: { persona: { nombre: 'Juan', apellido_paterno: 'Perez' }, imagen_usuario: '/uploads/avatars/new.png', rol: { nombre_rol: 'Administrador' } } } }))
    })

    await waitFor(() => {
      const img = screen.getByAltText('Avatar') as HTMLImageElement
      expect(img).toBeInTheDocument()
      expect(img.src).toContain('/uploads/avatars/new.png')
    })

    // name should update from event.usuario
    await waitFor(() => expect(screen.getByText('Juan Perez')).toBeInTheDocument())
  })
})
