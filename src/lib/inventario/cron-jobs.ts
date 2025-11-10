import { logger } from '@/lib/logger'
import { enqueueInventoryAlertNotification, type InventoryAlertEnqueueResult } from '@/lib/inventario/alertas-notifier'
import { generarAlertasStockMinimo } from '@/lib/inventario/alertas'
import { liberarReservasCaducadas, type LiberarReservasCaducadasParams, type LiberarReservasCaducadasResultado } from '@/lib/inventario/reservas'

export const INVENTARIO_QUEUE_NAME = process.env.INVENTARIO_QUEUE_NAME || 'inventario'
export const INVENTARIO_JOB_LIBERAR_RESERVAS = 'inventario.liberar-reservas'
export const INVENTARIO_JOB_ALERTAS_STOCK = 'inventario.alertas-stock'

export type LiberarReservasJobPayload = Omit<LiberarReservasCaducadasParams, 'metadata'>

export type AlertasStockJobPayload = {
  force?: boolean
  triggeredBy?: number
  recipients?: string | string[]
  slackWebhook?: string | null
}

export async function procesarLiberarReservas(payload: LiberarReservasJobPayload = {}): Promise<LiberarReservasCaducadasResultado> {
  logger.info({ payload }, '[inventario] procesando liberación automática de reservas')
  const resultado = await liberarReservasCaducadas({
    limit: payload.limit,
    ttlHours: payload.ttlHours,
    motivo: payload.motivo,
    triggeredBy: payload.triggeredBy,
    dryRun: payload.dryRun === true,
  })
  return resultado
}

const resolveSlackWebhook = (payloadWebhook?: string | null) => {
  if (payloadWebhook) return payloadWebhook
  const envValue = process.env.INVENTARIO_ALERT_SLACK_WEBHOOK
  return envValue && envValue.trim().length > 0 ? envValue.trim() : null
}

export async function procesarAlertasStock(payload: AlertasStockJobPayload = {}): Promise<InventoryAlertEnqueueResult & { totalCriticos: number }> {
  logger.info({ payload }, '[inventario] procesando alerta de stock crítico')
  const { totalCriticos, productos } = await generarAlertasStockMinimo()

  const recipients = payload.recipients
  const slackWebhook = resolveSlackWebhook(payload.slackWebhook ?? null)

  const enqueueResult = await enqueueInventoryAlertNotification({
    productos,
    totalCriticos,
    triggeredBy: payload.triggeredBy,
    recipients,
    force: payload.force,
    slackWebhook,
  })

  return {
    ...enqueueResult,
    totalCriticos,
  }
}
