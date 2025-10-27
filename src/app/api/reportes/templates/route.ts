import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'

import { authOptions } from '@/lib/auth'
import * as service from '@/lib/reportes/service'
import { templateCreateSchema } from '../validation'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

export const GET = async () => {
  try {
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'reportes.ver', { prismaClient: prisma })
    } catch (error) {
      if (error instanceof SesionInvalidaError || !session?.user?.id) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para ver plantillas' }, { status: 403 })
      }
      throw error
    }

    const rows = await service.listarTemplates()
    return NextResponse.json(rows)
  } catch (error) {
    console.error('[GET /api/reportes/templates] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export const POST = async (req: Request) => {
  try {
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'reportes.gestionar', { prismaClient: prisma })
    } catch (error) {
      if (error instanceof SesionInvalidaError || !session?.user?.id) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para crear plantillas' }, { status: 403 })
      }
      throw error
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const body = await req.json()
    const parsed = templateCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload inválido', details: parsed.error.format() }, { status: 400 })
    }
    const createdById = Number(session.user.id)
    const created = await service.crearTemplate({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      key: parsed.data.key,
      defaultParams: parsed.data.default_params ?? null,
      createdById,
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    console.error('[POST /api/reportes/templates] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
