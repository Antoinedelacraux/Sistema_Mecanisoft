import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'
import {
  PRODUCT_IMAGE_ALLOWED_TYPES,
  PRODUCT_IMAGE_MAX_SIZE_BYTES,
  PRODUCT_IMAGE_UPLOAD_DIR,
  type ProductImageMimeType
} from '@/lib/upload/config'
import { scanBufferWithClamAV } from '@/lib/security/antivirus'
import { checkAndIncrementDailyQuota } from '@/lib/upload/limits'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const usuarioId = Number.parseInt(session.user.id, 10)
    if (!Number.isFinite(usuarioId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    try {
      await asegurarPermiso(session, 'inventario.productos', { prismaClient: prisma })
    } catch (error) {
      if (error instanceof SesionInvalidaError || !session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para gestionar productos' }, { status: 403 })
      }
      throw error
    }

    const data = await request.formData()
    const file = data.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se encontró archivo' }, { status: 400 })
    }

    // Validar tipo de archivo
    const mimeType = file.type as ProductImageMimeType
    if (!PRODUCT_IMAGE_ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json({
        error: 'Tipo de archivo no válido. Solo se permiten: JPG, PNG, WEBP'
      }, { status: 400 })
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > PRODUCT_IMAGE_MAX_SIZE_BYTES) {
      return NextResponse.json({
        error: 'El archivo es muy grande. Máximo 5MB'
      }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const scanResult = await scanBufferWithClamAV(buffer)
    if (!scanResult.clean) {
      logger.warn({ usuarioId, filename: file.name, reason: scanResult.reason }, '[upload] Archivo bloqueado por antivirus')
      return NextResponse.json({
        error: 'El archivo no superó la verificación de antivirus',
        detalle: scanResult.reason
      }, { status: 400 })
    }
    if ('skipped' in scanResult && scanResult.skipped) {
      logger.warn({ usuarioId, reason: scanResult.reason }, '[upload] Antivirus no configurado, subida permitida sin escaneo')
    }

    const quota = await checkAndIncrementDailyQuota(usuarioId)
    if (!quota.allowed) {
      return NextResponse.json({
        error: `Has alcanzado el límite diario de subidas (${quota.limit}).`
      }, { status: 429 })
    }

    // Crear directorio si no existe
    const uploadDir = PRODUCT_IMAGE_UPLOAD_DIR
    try {
      await mkdir(uploadDir, { recursive: true })
    } catch (error) {
      // Directorio ya existe
    }

    // Generar nombre único
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const extension = path.extname(file.name)
    const fileName = `producto_${timestamp}_${randomString}${extension}`

    const filePath = path.join(uploadDir, fileName)

    // Guardar archivo
    await writeFile(filePath, buffer)

    // URL relativa para guardar en BD
    const imageUrl = `/uploads/productos/${fileName}`

    // Registrar en bitácora (no bloquear la subida si falla)
    try {
      const { logEvent } = await import('@/lib/bitacora/log-event')
      await logEvent({ usuarioId, accion: 'UPLOAD_IMAGE', descripcion: `Imagen subida: ${fileName}`, tabla: 'sistema' })
    } catch (err) {
  logger.error({ error: err }, '[upload] no se pudo registrar en bitácora')
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      fileName,
      remainingUploads: quota.remaining ?? null
    })

  } catch (error) {
    logger.error({ error }, 'Error subiendo archivo')
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}