import { render, screen, fireEvent } from '@testing-library/react'
import FacturacionComprobantes from '@/components/facturacion/facturacion-comprobantes'

// Mock fetch to return a borrador comprobante from cotización
beforeAll(() => {
  global.fetch = jest.fn(async (url, opts) => {
    if (typeof url === 'string' && url.includes('/api/facturacion/comprobantes')) {
      return {
        ok: true,
        json: async () => ({
          data: [
            {
              id_comprobante: 101,
              serie: 'F001',
              numero: 1,
              tipo: 'FACTURA',
              estado: 'BORRADOR',
              origen_tipo: 'COTIZACION',
              origen_id: 1,
              receptor_nombre: 'Empresa SAC',
              receptor_documento: '20123456789',
              total: 200,
              subtotal: 169.49,
              igv: 30.51,
              detalles: [
                { id_comprobante_detalle: 1, descripcion: 'Producto A', cantidad: 2, precio_unitario: 100, descuento: 0, total: 200, tipo_item: 'PRODUCTO' }
              ],
              persona: { correo: 'cliente@correo.com' },
              bitacoras: [],
              creado_en: new Date().toISOString(),
              actualizado_en: new Date().toISOString(),
            }
          ],
          pagination: { total: 1, pages: 1, current: 1, limit: 10 }
        })
      }
    }
    // For series fetch
    if (typeof url === 'string' && url.includes('/api/facturacion/series')) {
      return {
        ok: true,
        json: async () => ({ data: [{ id_facturacion_serie: 1, tipo: 'FACTURA', serie: 'F001', correlativo_actual: 1, activo: true }] })
      }
    }
    return { ok: false, json: async () => ({}) }
  })
})

afterAll(() => {
  global.fetch && (global.fetch as any).mockRestore && (global.fetch as any).mockRestore()
})

test('renders borrador comprobante from cotización with correct badge and actions', async () => {
  render(<FacturacionComprobantes />)
  // Wait for loading to finish
  const rowText = await screen.findByText(/Empresa SAC/)
  expect(rowText).toBeInTheDocument()
  const borradores = screen.getAllByText(/Borrador/)
  expect(borradores.length).toBeGreaterThan(0)
  // Scope actions to the same row where the client name appears
  const row = rowText.closest('tr') || rowText.closest('div')
  expect(row).not.toBeNull()
  const emitBtn = row!.querySelector('button:has(svg + span), button') || screen.getByRole('button', { name: /Emitir/ })
  const enviarBtn = screen.getByRole('button', { name: /Enviar/ })
  expect(emitBtn).toBeEnabled()
  expect(enviarBtn).toBeDisabled()
})