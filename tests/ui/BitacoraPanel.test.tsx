import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import BitacoraPanel from '@/components/bitacora/BitacoraPanel'

// mock fetch
const mockFetch = (body: any, ok = true, headers: any = {}) => jest.fn(async () => ({ ok, json: async () => body, headers: { get: (k: string) => headers[k] } }))

describe('BitacoraPanel', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders and displays results from the API', async () => {
    global.fetch = mockFetch({ eventos: [{ id_bitacora: 1, id_usuario: 2, accion: 'LOGIN', descripcion: 'ok', fecha_hora: new Date().toISOString() }], total: 1, page: 1 }) as any
    render(<BitacoraPanel />)
    // wait for table row
    await waitFor(() => expect(screen.getByText(/LOGIN/)).toBeInTheDocument())
    expect(screen.getByText(/ok/)).toBeInTheDocument()
  })

  it('copies description to clipboard when Copiar clicked', async () => {
    const event = { id_bitacora: 1, id_usuario: 2, accion: 'LOGIN', descripcion: 'texto a copiar', fecha_hora: new Date().toISOString() }
    global.fetch = mockFetch({ eventos: [event], total: 1, page: 1 }) as any
    Object.assign(navigator, { clipboard: { writeText: jest.fn() } })
    render(<BitacoraPanel />)
    await waitFor(() => expect(screen.getByText(/LOGIN/)).toBeInTheDocument())
    fireEvent.click(screen.getByText('Copiar'))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('texto a copiar'))
  })
})
