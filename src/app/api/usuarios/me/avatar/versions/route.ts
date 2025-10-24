import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import path from 'path'
import { readFile } from 'fs/promises'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const usuarioId = Number(session.user.id)
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'avatars')
    const versionsFile = path.join(uploadDir, `versions_user_${usuarioId}.json`)

    try {
      const txt = await readFile(versionsFile, 'utf-8')
      const versions = JSON.parse(txt || '[]')
      return NextResponse.json({ versions })
    } catch (e) {
      return NextResponse.json({ versions: [] })
    }
  } catch (err) {
    console.error('[usuarios/me/avatar/versions] error', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
