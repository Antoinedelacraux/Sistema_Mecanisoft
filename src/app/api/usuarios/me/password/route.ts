import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '../../controllers/helpers'

const schema = z.object({
  password_actual: z.string().min(8).optional(),
  password: z.string().min(8),
  confirmar_password: z.string().min(8)
}).refine((data) => data.password === data.confirmar_password, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmar_password']
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const payload = await request.json()
    const data = schema.parse(payload)

    const usuario = await prisma.usuario.findUnique({
      where: { id_usuario: Number(session.user.id) },
      include: {
        persona: true
      }
    })

    if (!usuario) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    if (!usuario.estatus) {
      return NextResponse.json({ error: 'El usuario fue dado de baja' }, { status: 400 })
    }

    if (!usuario.estado) {
      return NextResponse.json({ error: 'La cuenta está bloqueada' }, { status: 403 })
    }

    const requiereCambio = Boolean(usuario.requiere_cambio_password)

    if (!requiereCambio) {
      if (!data.password_actual) {
        return NextResponse.json({ error: 'Debes indicar tu contraseña actual' }, { status: 400 })
      }

      const coincideActual = await bcrypt.compare(data.password_actual, usuario.password)
      if (!coincideActual) {
        return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 400 })
      }
    } else {
      if (!usuario.password_temporal) {
        return NextResponse.json({ error: 'No hay contraseña temporal disponible. Solicita un reinicio.' }, { status: 400 })
      }

      if (usuario.password_temporal_expira && new Date(usuario.password_temporal_expira) < new Date()) {
        return NextResponse.json({ error: 'La contraseña temporal expiró. Solicita una nueva.' }, { status: 400 })
      }
    }

    const hashed = await hashPassword(data.password)

    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id_usuario: usuario.id_usuario },
        data: {
          password: hashed,
          password_temporal: null,
          password_temporal_expira: null,
          requiere_cambio_password: false,
          ultimo_cambio_password: new Date(),
          envio_credenciales_pendiente: false,
          ultimo_error_envio: null
        }
      })

      await tx.bitacora.create({
        data: {
          id_usuario: usuario.id_usuario,
          accion: 'CAMBIO_PASSWORD_USUARIO',
          descripcion: `El usuario ${usuario.nombre_usuario} actualizó su contraseña`,
          tabla: 'usuario'
        }
      })
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0]
      return NextResponse.json({ error: firstIssue?.message ?? 'Datos inválidos' }, { status: 400 })
    }

    console.error('[Usuarios API] Cambio password error', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
