import nodemailer from 'nodemailer'

import { logger } from '@/lib/logger'
import { createRedisConnection } from '@/lib/redisClient'
import { optionalCjsImport } from '@/lib/utils/optional-import'

const DEFAULT_REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'

const isRedisFallbackEnabled = () => process.env.REDIS_USE_MOCK === 'true' || process.env.REDIS_FALLBACK_DIRECT === 'true'

export async function checkRedisAvailability(context: string) {
  if (isRedisFallbackEnabled()) {
    logger.warn({ context }, '[reportes] Redis en modo fallback: se omite verificación activa')
    return
  }

  let connection: any | undefined
  try {
    connection = await createRedisConnection(DEFAULT_REDIS_URL)
    if (typeof connection.ping === 'function') {
      await connection.ping()
    } else if (typeof connection.get === 'function') {
      await connection.get('ping')
    }
    logger.debug({ context, redisUrl: DEFAULT_REDIS_URL }, '[reportes] Redis verificado correctamente')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`[reportes][${context}] No se pudo conectar a Redis (${DEFAULT_REDIS_URL}): ${message}`)
  } finally {
    if (connection) {
      if (typeof connection.disconnect === 'function') {
        connection.disconnect()
      } else if (typeof connection.quit === 'function') {
        await connection.quit()
      }
    }
  }
}

export async function assertS3Availability(context: string) {
  const bucket = process.env.S3_BUCKET
  if (!bucket) {
    logger.debug({ context }, '[reportes] S3 no configurado; se usará almacenamiento local para exportes')
    return
  }

  const missing: string[] = []
  if (!process.env.S3_REGION) missing.push('S3_REGION')
  if (!process.env.S3_ACCESS_KEY) missing.push('S3_ACCESS_KEY')
  if (!process.env.S3_SECRET_KEY) missing.push('S3_SECRET_KEY')

  if (missing.length > 0) {
    throw new Error(`[reportes][${context}] S3_BUCKET configurado pero faltan variables: ${missing.join(', ')}`)
  }

  const s3Module = await optionalCjsImport<any>('@aws-sdk/client-s3')
  const presignerModule = await optionalCjsImport<any>('@aws-sdk/s3-request-presigner')
  if (!s3Module || !presignerModule) {
    throw new Error(`[reportes][${context}] Requiere dependencias @aws-sdk/client-s3 y @aws-sdk/s3-request-presigner instaladas`)
  }

  const { S3Client, HeadBucketCommand } = s3Module
  const client = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!,
      secretAccessKey: process.env.S3_SECRET_KEY!,
    },
  })

  const shouldVerifyBucket = process.env.NODE_ENV === 'production' || process.env.S3_VERIFY === 'true'
  if (shouldVerifyBucket && typeof HeadBucketCommand === 'function') {
    try {
      const command = new HeadBucketCommand({ Bucket: bucket })
      await client.send(command)
      logger.debug({ context, bucket }, '[reportes] Verificación HeadBucket exitosa')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`[reportes][${context}] Error verificando bucket ${bucket}: ${message}`)
      }
      logger.warn({ context, bucket, err: message }, '[reportes] HeadBucket falló; continuaré porque no es producción')
    }
  }

  if (typeof client.destroy === 'function') {
    client.destroy()
  }
}

export async function assertSmtpAvailability(context: string) {
  const host = process.env.SMTP_HOST
  if (!host) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`[reportes][${context}] SMTP_HOST no configurado; no se pueden enviar correos de reportes`)
    }
    logger.warn({ context }, '[reportes] SMTP_HOST ausente; se usará cuenta temporal solo para entornos no productivos')
    return
  }

  const port = Number(process.env.SMTP_PORT) || 587
  const secure = process.env.SMTP_SECURE === 'true'
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  })

  const shouldVerify = process.env.NODE_ENV === 'production' || process.env.SMTP_VERIFY === 'true'
  if (shouldVerify) {
    try {
      await transporter.verify()
      logger.debug({ context, host, port }, '[reportes] Verificación SMTP exitosa')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`[reportes][${context}] No se pudo verificar SMTP (${host}:${port}): ${message}`)
    }
  } else {
    logger.debug({ context, host, port }, '[reportes] Verificación SMTP omitida (no es entorno productivo)')
  }
}

export async function verifyReportInfraPrerequisites(context: string) {
  await checkRedisAvailability(context)
  await assertS3Availability(context)
  await assertSmtpAvailability(context)
}
