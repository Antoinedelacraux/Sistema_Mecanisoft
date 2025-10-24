import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import path from 'path'
import { readFile, writeFile } from 'fs/promises'
import { prisma } from '@/lib/prisma'
import { logEvent } from '@/lib/bitacora/log-event'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const usuarioId = Number(session.user.id)
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars')
    const versionsFile = path.join(uploadDir, `versions_user_${usuarioId}.json`)

    // read versions file
    let versions: any[] = []
    try {
      const txt = await readFile(versionsFile, 'utf-8')
      versions = JSON.parse(txt || '[]')
    } catch (e) {
      return NextResponse.json({ error: 'No hay versiones anteriores' }, { status: 400 })
    }

    if (!versions.length) return NextResponse.json({ error: 'No hay versiones anteriores' }, { status: 400 })

    // attempt to parse body for versionId
    let body: any = {}
    try { body = await request.json() } catch (_) { body = {} }
    const versionId = body?.versionId as string | undefined

    let chosen: any = null

    if (versionId) {
      const idx = versions.findIndex((v) => v && (v.id === versionId || String(v.id) === String(versionId)))
      if (idx === -1) return NextResponse.json({ error: 'Versión no encontrada' }, { status: 404 })
      chosen = versions[idx]
    } else {
      // legacy behavior: pop the most recent previous
      chosen = versions.shift()
    }

    // determine image URL to set
    let previous: string | null = null
    if (!chosen) previous = null
    else if (typeof chosen === 'string') previous = chosen
    else previous = chosen?.variants?.[2] ?? chosen?.image ?? chosen?.original ?? null

    // if versionId was used, we keep versions list intact; if legacy revert we already removed first item
    try {
      await writeFile(versionsFile, JSON.stringify(versions, null, 2), 'utf-8')
    } catch (e) {
      console.error('Error actualizando versions file', e)
    }

    if (!previous) return NextResponse.json({ error: 'No hay imagen para restaurar' }, { status: 400 })

    await prisma.usuario.update({ where: { id_usuario: usuarioId }, data: { imagen_usuario: previous } })

    await logEvent({ usuarioId, accion: 'REVERT_AVATAR', descripcion: `Avatar revertido a ${previous} (versionId: ${versionId ?? 'legacy'})`, tabla: 'usuario' })

    return NextResponse.json({ success: true, imageUrl: previous })
  } catch (error) {
    console.error('[usuarios/me/avatar/revert] error', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
