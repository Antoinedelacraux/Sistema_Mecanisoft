import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logEvent } from '@/lib/bitacora/log-event'

const schema = z.object({ username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/) })

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.format() }, { status: 400 })

    const usuarioId = Number(session.user.id)

    // check uniqueness
    const exists = await prisma.usuario.findUnique({ where: { nombre_usuario: parsed.data.username } })
    if (exists && exists.id_usuario !== usuarioId) return NextResponse.json({ error: 'Nombre de usuario ya en uso' }, { status: 409 })

    await prisma.usuario.update({ where: { id_usuario: usuarioId }, data: { nombre_usuario: parsed.data.username } })

    await logEvent({ usuarioId, accion: 'CAMBIO_USUARIO', descripcion: `Usuario cambió nombre de usuario a ${parsed.data.username}`, tabla: 'usuario' })

    return NextResponse.json({ success: true, username: parsed.data.username })
  } catch (error) {
    console.error('[usuarios/me/username] error', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
