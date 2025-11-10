import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'
import { listarServicios, crearServicio } from '@/lib/servicios/service'
import { ServicioServiceError } from '@/lib/servicios/errors'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'servicios.listar', { prismaClient: prisma })
    } catch (error) {
      if (error instanceof SesionInvalidaError || !session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para ver servicios' }, { status: 403 })
      }
      throw error
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const marcaId = searchParams.get('id_marca')
    const modeloId = searchParams.get('id_modelo')
    const estado = searchParams.get('estado') // 'activos' | 'inactivos' | 'todos'

    const marcaIdNumber = marcaId && /^\d+$/.test(marcaId) ? parseInt(marcaId, 10) : undefined
    const modeloIdNumber = modeloId && /^\d+$/.test(modeloId) ? parseInt(modeloId, 10) : undefined
    const estadoFiltrado = estado === 'activos' || estado === 'inactivos' || estado === 'todos' ? estado : null

    const resultado = await listarServicios({
      page,
      limit,
      search,
      marcaId: marcaIdNumber,
      modeloId: modeloIdNumber,
      estado: estadoFiltrado,
    }, { prismaClient: prisma })

    return NextResponse.json(resultado)
  } catch (e) {
    if (e instanceof ServicioServiceError) {
      return NextResponse.json({ error: e.message, ...(e.payload ?? {}) }, { status: e.status })
    }
    console.error('Error obteniendo servicios:', e)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'servicios.gestionar', { prismaClient: prisma })
    } catch (error) {
      if (error instanceof SesionInvalidaError || !session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para gestionar servicios' }, { status: 403 })
      }
      throw error
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const usuarioId = Number.parseInt(session.user.id, 10)
    if (!Number.isFinite(usuarioId)) {
      return NextResponse.json({ error: 'Identificador de usuario inválido' }, { status: 401 })
    }

    const data = await request.json()
    const creado = await crearServicio(data, { prismaClient: prisma, usuarioId })

    return NextResponse.json(creado, { status: 201 })
  } catch (e) {
    if (e instanceof ServicioServiceError) {
      return NextResponse.json({ error: e.message, ...(e.payload ?? {}) }, { status: e.status })
    }
    console.error('Error creando servicio:', e)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}