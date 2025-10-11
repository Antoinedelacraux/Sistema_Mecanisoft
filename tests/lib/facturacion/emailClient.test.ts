import { sendComprobanteEmail } from '@/lib/facturacion/email-client'

describe('sendComprobanteEmail', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    if (originalFetch) {
      global.fetch = originalFetch
    } else {
      // @ts-expect-error allow cleanup when fetch was undefined
      delete global.fetch
    }
    jest.clearAllMocks()
  })

  it('envía la solicitud con destinatario y mensaje', async () => {
    const jsonMock = jest.fn().mockResolvedValue({ data: { ok: true } })
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: jsonMock })
    global.fetch = fetchMock as unknown as typeof global.fetch

    const response = await sendComprobanteEmail({
      comprobanteId: 42,
      destinatario: 'cliente@example.com',
      mensaje: 'Gracias por su preferencia'
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/facturacion/comprobantes/42/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destinatario: 'cliente@example.com',
        mensaje: 'Gracias por su preferencia'
      })
    })
    expect(jsonMock).toHaveBeenCalled()
    expect(response).toEqual({ data: { ok: true } })
  })

  it('lanza un error con el mensaje del backend cuando la respuesta falla', async () => {
    const jsonMock = jest.fn().mockResolvedValue({ error: 'Correo no disponible' })
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, json: jsonMock })
    global.fetch = fetchMock as unknown as typeof global.fetch

    await expect(
      sendComprobanteEmail({ comprobanteId: 7, destinatario: 'sin-correo@example.com' })
    ).rejects.toThrow('Correo no disponible')
  })

  it('lanza un error genérico cuando no existe mensaje de error', async () => {
    const jsonMock = jest.fn().mockResolvedValue({})
    const fetchMock = jest.fn().mockResolvedValue({ ok: false, json: jsonMock })
    global.fetch = fetchMock as unknown as typeof global.fetch

    await expect(
      sendComprobanteEmail({ comprobanteId: 5, destinatario: 'cliente@example.com' })
    ).rejects.toThrow('No se pudo enviar el comprobante')
  })
})
