export type SendComprobanteEmailParams = {
  comprobanteId: number
  destinatario: string
  mensaje?: string | null
}

export type SendComprobanteEmailResponse = unknown

export async function sendComprobanteEmail({
  comprobanteId,
  destinatario,
  mensaje
}: SendComprobanteEmailParams): Promise<SendComprobanteEmailResponse> {
  const payload: Record<string, unknown> = {
    destinatario: destinatario.trim()
  }

  if (mensaje && mensaje.trim()) {
    payload.mensaje = mensaje.trim()
  }

  const response = await fetch(`/api/facturacion/comprobantes/${comprobanteId}/enviar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    const errorMessage = typeof body?.error === 'string' && body.error.length > 0
      ? body.error
      : 'No se pudo enviar el comprobante'
    throw new Error(errorMessage)
  }

  return body
}
