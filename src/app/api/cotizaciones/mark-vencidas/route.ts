import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'cotizaciones.gestionar', { prismaClient: prisma })
    } catch (error) {
      if (error instanceof SesionInvalidaError || !session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para gestionar cotizaciones' }, { status: 403 })
      }
      throw error
    }

    const body = await request.json()
  const ids: number[] = Array.isArray(body.ids) ? body.ids.map((v: any) => Number(v)).filter((n: any) => Number.isFinite(n)) : []
    if (ids.length === 0) {
      return NextResponse.json({ success: true, updated: 0 })
    }

    const result = await prisma.cotizacion.updateMany({
      where: { id_cotizacion: { in: ids } },
      data: { estado: 'vencida' }
    })

    return NextResponse.json({ success: true, updated: result.count })
  } catch (error) {
    console.error('Error marcando cotizaciones vencidas:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
