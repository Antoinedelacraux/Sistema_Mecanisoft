import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logEvent } from '@/lib/bitacora/log-event'

const patchSchema = z.object({
  nombre: z.string().min(1).optional(),
  apellido_paterno: z.string().optional(),
  apellido_materno: z.string().optional(),
  correo: z.string().email().optional()
})

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const usuarioId = Number(session.user.id)
    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario: usuarioId },
      include: { persona: true, rol: true }
    })

    if (!usuario) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    return NextResponse.json({ usuario })
  } catch (error) {
    console.error('[usuarios/me] GET error', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.format() }, { status: 400 })
    }

    const usuarioId = Number(session.user.id)

    // transaction: update persona (email/names) and maybe usuario fields in future
    const updated = await prisma.$transaction(async (tx) => {
      const personaUpdate: any = {}
      if (parsed.data.nombre) personaUpdate.nombre = parsed.data.nombre
      if (parsed.data.apellido_paterno) personaUpdate.apellido_paterno = parsed.data.apellido_paterno
      if (parsed.data.apellido_materno) personaUpdate.apellido_materno = parsed.data.apellido_materno
      if (parsed.data.correo) personaUpdate.correo = parsed.data.correo

      if (Object.keys(personaUpdate).length > 0) {
        await tx.persona.update({ where: { id_persona: (await tx.usuario.findUniqueOrThrow({ where: { id_usuario: usuarioId } })).id_persona }, data: personaUpdate })
      }

      const usr = await tx.usuario.findUnique({ where: { id_usuario: usuarioId }, include: { persona: true } })
      return usr
    })

    await logEvent({ usuarioId, accion: 'ACTUALIZAR_PERFIL', descripcion: 'Perfil de usuario actualizado', tabla: 'usuario' })

    return NextResponse.json({ success: true, usuario: updated })
  } catch (error) {
    console.error('[usuarios/me] PATCH error', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
