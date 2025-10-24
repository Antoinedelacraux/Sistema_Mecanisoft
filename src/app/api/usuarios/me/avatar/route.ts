import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { writeFile, mkdir, readFile } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { logEvent } from '@/lib/bitacora/log-event'
import sharp from 'sharp'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const data = await request.formData()
    const file = data.get('avatar') as unknown as File | null
    if (!file) return NextResponse.json({ error: 'No se encontró avatar' }, { status: 400 })

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de archivo no válido. Solo JPG/PNG/WEBP' }, { status: 400 })
    }

    const maxSize = 3 * 1024 * 1024 // 3MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'El archivo es muy grande. Máximo 3MB' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars')
    await mkdir(uploadDir, { recursive: true })

    const usuarioId = Number(session.user.id)
    const timestamp = Date.now()
    const baseName = `avatar_${usuarioId}_${timestamp}`

    // save original (as uploaded)
    const origExt = path.extname(file.name) || '.png'
    const origName = `${baseName}${origExt}`
    const origPath = path.join(uploadDir, origName)
    await writeFile(origPath, buffer)

    // generate optimized webp variants
    const sizes = [64, 128, 256]
    const variantNames: string[] = []
    await Promise.all(sizes.map(async (s) => {
      const filename = `${baseName}_${s}.webp`
      const outPath = path.join(uploadDir, filename)
      try {
        await sharp(buffer)
          .resize(s, s, { fit: 'cover' })
          .webp({ quality: 80 })
          .toFile(outPath)
        variantNames.push(filename)
      } catch (err) {
        console.error('Error generating variant', err)
      }
    }))

    const imageUrl = `/uploads/avatars/${baseName}_256.webp`

    // save previous avatar reference for possible revert (file-based versioning)
    try {
      const usuario = await prisma.usuario.findUnique({ where: { id_usuario: usuarioId } })
      const versionsFile = path.join(uploadDir, `versions_user_${usuarioId}.json`)
      const prev = usuario?.imagen_usuario ?? null
      let versions: any[] = []
      try {
        const txt = await readFile(versionsFile, 'utf-8')
        versions = JSON.parse(txt || '[]')
      } catch (e) {
        // ignore if file doesn't exist
      }
      if (prev) {
        // Attempt to derive variants for the previous image if it follows our naming convention
        let prevVariants: string[] = []
        try {
          if (typeof prev === 'string') {
            const m = prev.match(/(avatar_\d+_\d+)(_\d+)?.webp$/)
            if (m) {
              const base = m[1]
              prevVariants = [64, 128, 256].map(s => `/uploads/avatars/${base}_${s}.webp`)
            }
          }
        } catch (_) {}

        // store as object for richer metadata and add unique id for future revert-by-id
        versions.unshift({ id: randomUUID(), image: prev, variants: prevVariants, created_at: new Date().toISOString() })
        // keep last 5 versions
        versions = versions.slice(0, 5)
        await writeFile(versionsFile, JSON.stringify(versions, null, 2), 'utf-8')
      }

      await prisma.usuario.update({ where: { id_usuario: usuarioId }, data: { imagen_usuario: imageUrl } })

      // Additionally, append the newly uploaded image as a version entry (so versions list contains historic entries)
      try {
        const versionsFile = path.join(uploadDir, `versions_user_${usuarioId}.json`)
        let versions2: any[] = []
        try {
          const txt = await readFile(versionsFile, 'utf-8')
          versions2 = JSON.parse(txt || '[]')
        } catch (_) {}
        // add id so UI and API can reference versions individually
        versions2.unshift({ id: randomUUID(), image: imageUrl, variants: variantNames.map(n => `/uploads/avatars/${n}`), original: origName, created_at: new Date().toISOString() })
        versions2 = versions2.slice(0, 20)
        await writeFile(versionsFile, JSON.stringify(versions2, null, 2), 'utf-8')
      } catch (e) {
        // ignore
      }
    } catch (e) {
      console.error('Error guardando versión de avatar', e)
      // non-blocking: still update user
      await prisma.usuario.update({ where: { id_usuario: usuarioId }, data: { imagen_usuario: imageUrl } })
    }

  await logEvent({ usuarioId, accion: 'UPLOAD_AVATAR', descripcion: `Avatar subido: ${origName}`, tabla: 'usuario' })

    return NextResponse.json({ success: true, imageUrl })
  } catch (error) {
    console.error('[usuarios/me/avatar] error', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
