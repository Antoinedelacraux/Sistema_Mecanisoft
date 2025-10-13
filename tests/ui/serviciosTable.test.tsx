/** @jest-environment jsdom */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { ServiciosTable } from '@/components/servicios/servicios-table'
import type { ServicioCompleto } from '@/types'

const originalFetch = global.fetch
const mockFetch = jest.fn() as jest.Mock

type JsonResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

const createJsonResponse = (data: unknown, status = 200): JsonResponse => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data
})

const buildServicio = (overrides: Partial<ServicioCompleto> = {}): ServicioCompleto => ({
  id_servicio: 1,
  codigo_servicio: 'SER-2025-001',
  nombre: 'Balanceo Rápido',
  descripcion: 'Balanceo de ruedas',
  es_general: true,
  id_marca: null,
  id_modelo: null,
  precio_base: 80,
  descuento: 0,
  oferta: false,
  tiempo_minimo: 30,
  tiempo_maximo: 45,
  unidad_tiempo: 'minutos',
  estatus: true,
  fecha_registro: '2025-01-01',
  marca: null,
  modelo: null,
  ...overrides
})

beforeAll(() => {
  global.fetch = mockFetch as unknown as typeof global.fetch
})

afterAll(() => {
  global.fetch = originalFetch
})

afterEach(() => {
  mockFetch.mockReset()
})

describe('ServiciosTable UI', () => {
  it('oculta controles de gestión cuando canManage es falso', async () => {
    const servicio = buildServicio()

    mockFetch
      .mockResolvedValueOnce(createJsonResponse({ marcas: [] }))
      .mockResolvedValueOnce(
        createJsonResponse({
          servicios: [servicio],
          pagination: { total: 1, pages: 1, current: 1, limit: 50 }
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          servicios: [servicio],
          pagination: { total: 1, pages: 1, current: 1, limit: 50 }
        })
      )

    render(
      <ServiciosTable
        onCreate={jest.fn()}
        onEdit={jest.fn()}
        refreshKey={0}
        canManage={false}
      />
    )

    expect(await screen.findByText('Balanceo Rápido')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /nuevo/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /desactivar/i })).not.toBeInTheDocument()
  })

  it('muestra acciones y permite alternar el estado cuando canManage es verdadero', async () => {
    const servicio = buildServicio()
    const servicioInactivo = buildServicio({ estatus: false })

    mockFetch
      .mockResolvedValueOnce(createJsonResponse({ marcas: [] }))
      .mockResolvedValueOnce(
        createJsonResponse({
          servicios: [servicio],
          pagination: { total: 1, pages: 1, current: 1, limit: 50 }
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          servicios: [servicio],
          pagination: { total: 1, pages: 1, current: 1, limit: 50 }
        })
      )
      .mockResolvedValueOnce(createJsonResponse(servicioInactivo))
      .mockResolvedValueOnce(
        createJsonResponse({
          servicios: [servicioInactivo],
          pagination: { total: 1, pages: 1, current: 1, limit: 50 }
        })
      )

    const onCreate = jest.fn()
    const onEdit = jest.fn()
    const user = userEvent.setup()

    render(
      <ServiciosTable
        onCreate={onCreate}
        onEdit={onEdit}
        refreshKey={0}
        canManage
      />
    )

    await screen.findByText('Balanceo Rápido')

    expect(screen.getByRole('button', { name: /nuevo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /desactivar/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /desactivar/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/servicios/1'),
        expect.objectContaining({ method: 'PATCH' })
      )
    })

    expect(await screen.findByRole('button', { name: /activar/i })).toBeInTheDocument()
  })
})
