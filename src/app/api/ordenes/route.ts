import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

// Asegura evaluación de cookies/sesión en cada request (evita cache estática accidental)
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { InventarioError } from '@/types/inventario'
import { listarOrdenes } from '@/lib/ordenes/listar'
import { crearOrdenSchema } from '@/lib/ordenes/validators'
import { crearOrden } from '@/lib/ordenes/crear'
import { OrdenServiceError } from '@/lib/ordenes/errors'
import { actualizarOrden } from '@/lib/ordenes/actualizar'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'ordenes.crear', { prismaClient: prisma })
    } catch (error) {
      if (error instanceof SesionInvalidaError) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para gestionar órdenes' }, { status: 403 })
      }
      throw error
    }

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get('page') ?? '1', 10)
    const limit = Number.parseInt(searchParams.get('limit') ?? '10', 10)
    const search = searchParams.get('search')
    const estado = searchParams.get('estado')
    const prioridad = searchParams.get('prioridad')
    const estadoPago = searchParams.get('estado_pago')
    const fechaDesdeRaw = searchParams.get('fecha_desde')
    const fechaHastaRaw = searchParams.get('fecha_hasta')
  const dateRaw = searchParams.get('date')
    const modo = searchParams.get('modo')
    const includeTareas = searchParams.get('include_tareas') === 'true'
    const includeProgreso = searchParams.get('include_progreso') === 'true'
    const trabajadorIdParam = searchParams.get('trabajador_id')
    const trabajadorId = trabajadorIdParam && /^\d+$/.test(trabajadorIdParam) ? Number.parseInt(trabajadorIdParam, 10) : undefined

    let fechaDesde: Date | undefined
    if (fechaDesdeRaw) {
      const parsed = new Date(fechaDesdeRaw)
      if (!Number.isNaN(parsed.getTime())) {
        fechaDesde = parsed
      }
    }

    let fechaHasta: Date | undefined
    if (fechaHastaRaw) {
      const parsed = new Date(fechaHastaRaw)
      if (!Number.isNaN(parsed.getTime())) {
        parsed.setHours(23, 59, 59, 999)
        fechaHasta = parsed
      }
    }

    // Si se pasa `date=YYYY-MM-DD`, lo convertimos en fechaDesde y fechaHasta para ese día
    if (!fechaDesde && !fechaHasta && dateRaw) {
      const match = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
      if (match) {
        const start = new Date(dateRaw + 'T00:00:00.000')
        const end = new Date(dateRaw + 'T23:59:59.999')
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
          fechaDesde = start
          fechaHasta = end
        }
      }
    }

    const resultado = await listarOrdenes(prisma, {
      page: Number.isFinite(page) && page > 0 ? page : 1,
      limit: Number.isFinite(limit) && limit > 0 ? limit : 10,
      search: search ?? null,
      estado: estado ?? null,
      prioridad: prioridad ?? null,
      estadoPago: estadoPago ?? null,
      modo,
      includeTareas,
      includeProgreso,
      fechaDesde: fechaDesde ?? null,
      fechaHasta: fechaHasta ?? null,
      trabajadorId
    })

    return NextResponse.json(resultado)

  } catch (error) {
    console.error('Error obteniendo órdenes:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'ordenes.crear', { prismaClient: prisma })
    } catch (error) {
      if (error instanceof SesionInvalidaError) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para crear órdenes' }, { status: 403 })
      }
      throw error
    }

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const usuarioId = Number.parseInt(session.user?.id ?? '', 10)
    if (!Number.isInteger(usuarioId)) {
      return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
    }

    const json = await request.json().catch(() => null)
    if (!json) {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

  const parsed = crearOrdenSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.format() }, { status: 400 })
    }

    const resultado = await crearOrden(prisma, parsed.data, usuarioId)
    return NextResponse.json(resultado.body, { status: resultado.status })
  } catch (error) {
    if (error instanceof OrdenServiceError) {
      return NextResponse.json({ error: error.message, ...(error.payload ?? {}) }, { status: error.status })
    }
    if (error instanceof InventarioError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Error creando orden:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// PATCH: actualizar estado / prioridad / fechas de una orden
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'ordenes.crear', { prismaClient: prisma })
    } catch (error) {
      if (error instanceof SesionInvalidaError) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para editar órdenes' }, { status: 403 })
      }
      throw error
    }

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const usuarioId = Number.parseInt(session.user?.id ?? '', 10)
    if (!Number.isInteger(usuarioId)) {
      return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })

    if (typeof body.nuevo_estado === 'string' && ['completado', 'entregado'].includes(body.nuevo_estado)) {
      try {
        await asegurarPermiso(session, 'ordenes.cerrar', { prismaClient: prisma })
      } catch (error) {
        if (error instanceof PermisoDenegadoError) {
          return NextResponse.json({ error: 'No cuentas con permisos para cerrar órdenes' }, { status: 403 })
        }
        if (error instanceof SesionInvalidaError) {
          return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }
        throw error
      }
    }

    const resultado = await actualizarOrden(prisma, body, usuarioId)
    return NextResponse.json(resultado.body, { status: resultado.status })
  } catch (error) {
    if (error instanceof OrdenServiceError) {
      return NextResponse.json({ error: error.message, ...(error.payload ?? {}) }, { status: error.status })
    }
    if (error instanceof InventarioError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Error actualizando orden:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}