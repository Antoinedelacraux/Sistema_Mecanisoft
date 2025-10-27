import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'

import { authOptions } from '@/lib/auth'
import * as service from '@/lib/reportes/service'
import { templateUpdateSchema } from '../../validation'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

export const PATCH = async (_req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'reportes.gestionar', { prismaClient: prisma })
    } catch (error) {
      if (error instanceof SesionInvalidaError || !session?.user?.id) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para editar plantillas' }, { status: 403 })
      }
      throw error
    }

    const { id: idRaw } = await context.params
    const id = Number(idRaw)
    const body = await _req.json()
    const parsed = templateUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Payload inválido', details: parsed.error.format() }, { status: 400 })
    }
    const updated = await service.actualizarTemplate(id, {
      name: parsed.data.name,
      description: parsed.data.description,
      defaultParams: parsed.data.default_params,
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('[PATCH /api/reportes/templates/:id] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export const DELETE = async (_req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'reportes.gestionar', { prismaClient: prisma })
    } catch (error) {
      if (error instanceof SesionInvalidaError || !session?.user?.id) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para eliminar plantillas' }, { status: 403 })
      }
      throw error
    }

    const { id: idRaw } = await context.params
    const id = Number(idRaw)
    await service.eliminarTemplate(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[DELETE /api/reportes/templates/:id] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
