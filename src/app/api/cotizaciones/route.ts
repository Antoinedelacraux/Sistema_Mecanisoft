import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { Prisma } from '@prisma/client'
import { generarCodigoCorrelativo, CORRELATIVO_TIPOS } from '@/lib/correlativos/service'
import { cotizacionBodySchema, CotizacionValidationError, validarCotizacionPayload } from './validation'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

// Función para generar token de aprobación
function generateApprovalToken() {
  return randomBytes(32).toString('hex')
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    try {
      await asegurarPermiso(session, 'cotizaciones.listar', { prismaClient: prisma })
    } catch (error) {
      if (error instanceof SesionInvalidaError || !session) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
      }
      if (error instanceof PermisoDenegadoError) {
        return NextResponse.json({ error: 'No cuentas con permisos para visualizar cotizaciones' }, { status: 403 })
      }
      throw error
    }

    const { searchParams } = new URL(request.url)

    const parsePositiveInt = (value: string | null, fallback: number) => {
      const parsed = Number.parseInt(value ?? '', 10)
      if (!Number.isFinite(parsed) || parsed < 1) return fallback
      return parsed
    }

  const page = parsePositiveInt(searchParams.get('page'), 1)
    const limit = Math.min(parsePositiveInt(searchParams.get('limit'), 10), 100)
    const search = searchParams.get('search')?.trim() ?? ''
    const estadoRaw = searchParams.get('estado')?.trim()
    const modoRaw = searchParams.get('modo')?.trim()
  const dateRaw = searchParams.get('date')?.trim()

    const modosPermitidos = new Set(['solo_servicios', 'solo_productos', 'servicios_y_productos'])
    const modo = modoRaw && modosPermitidos.has(modoRaw) ? modoRaw as 'solo_servicios' | 'solo_productos' | 'servicios_y_productos' : undefined

  const estadosPermitidos = new Set(['borrador', 'enviada', 'aprobada', 'rechazada', 'vencida', 'en_facturacion', 'en_ordenes'])
    const estado = estadoRaw && estadosPermitidos.has(estadoRaw) ? estadoRaw : undefined

    const skip = (page - 1) * limit

    // Construir filtro
    const whereCondition: Prisma.CotizacionWhereInput = {}
    const andConditions: Prisma.CotizacionWhereInput[] = []

    // Filtro por estado
    if (estado) {
      whereCondition.estado = estado
    }

    if (modo === 'solo_servicios') {
      andConditions.push({
        detalle_cotizacion: {
          some: { servicio: { isNot: null } },
          every: { producto: { is: null } }
        }
      })
    } else if (modo === 'solo_productos') {
      andConditions.push({
        detalle_cotizacion: {
          some: { producto: { isNot: null } },
          every: { servicio: { is: null } }
        }
      })
    } else if (modo === 'servicios_y_productos') {
      andConditions.push({
        detalle_cotizacion: {
          some: { servicio: { isNot: null } }
        }
      })
      andConditions.push({
        detalle_cotizacion: {
          some: { producto: { isNot: null } }
        }
      })
    }

    // Filtro de búsqueda
    if (search) {
      whereCondition.OR = [
        { codigo_cotizacion: { contains: search, mode: 'insensitive' as const } },
        { cliente: { persona: { nombre: { contains: search, mode: 'insensitive' as const } } } },
        { cliente: { persona: { apellido_paterno: { contains: search, mode: 'insensitive' as const } } } },
        { cliente: { persona: { numero_documento: { contains: search, mode: 'insensitive' as const } } } },
        { vehiculo: { placa: { contains: search, mode: 'insensitive' as const } } }
      ]
    }

    // Filtro por fecha (YYYY-MM-DD). Si se provee, filtramos por created_at dentro de ese día
    if (dateRaw) {
      // Intentamos parsear como fecha ISO (YYYY-MM-DD)
      const dateMatch = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
      if (dateMatch) {
        const start = new Date(dateRaw + 'T00:00:00.000')
        const end = new Date(dateRaw + 'T23:59:59.999')
        // Asegurar que las fechas sean válidas
        if (!isNaN(start.valueOf()) && !isNaN(end.valueOf())) {
          whereCondition.created_at = { gte: start, lte: end }
        }
      }
    }

    if (andConditions.length > 0) {
      const existingAnd = Array.isArray(whereCondition.AND)
        ? whereCondition.AND as Prisma.CotizacionWhereInput[]
        : whereCondition.AND

      if (existingAnd) {
        whereCondition.AND = Array.isArray(existingAnd)
          ? [...existingAnd, ...andConditions]
          : [existingAnd, ...andConditions]
      } else {
        whereCondition.AND = andConditions
      }
    }

    // Obtener cotizaciones con paginación
    const cotizacionInclude = {
      cliente: {
        include: {
          persona: {
            include: {
              empresa_persona: true,
            },
          },
        },
      },
      vehiculo: { include: { modelo: { include: { marca: true } } } },
      usuario: {
        include: {
          persona: {
            include: {
              empresa_persona: true,
            },
          },
        },
      },
      detalle_cotizacion: { include: { producto: true, servicio: true } },
      _count: { select: { detalle_cotizacion: true } }
    }

    const [cotizaciones, total] = await Promise.all([
      prisma.cotizacion.findMany({
        where: whereCondition,
        include: cotizacionInclude,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit
      }),
      prisma.cotizacion.count({
        where: whereCondition
      })
    ])

    return NextResponse.json({
      cotizaciones,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        current: page,
        limit
      }
    })

  } catch (error) {
    console.error('Error obteniendo cotizaciones:', error)
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

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    const usuarioId = Number.parseInt(session.user.id, 10)
    if (!Number.isFinite(usuarioId)) {
      return NextResponse.json({ error: 'Identificador de usuario inválido' }, { status: 401 })
    }

    const json = await request.json()
    const parsed = cotizacionBodySchema.safeParse(json)
    if (!parsed.success) {
      console.warn('POST /api/cotizaciones validation error payload:', JSON.stringify(json))
      console.warn('Validation issues:', parsed.error.flatten())
      return NextResponse.json({ error: 'Validación fallida', detalles: parsed.error.flatten() }, { status: 400 })
    }

    const { id_cliente, id_vehiculo } = parsed.data
    let validation
    try {
      validation = await validarCotizacionPayload(parsed.data)
    } catch (error) {
      if (error instanceof CotizacionValidationError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      throw error
    }

    const {
      cliente,
      itemsValidados,
      subtotal,
      impuesto,
      total,
      vigenciaHasta
    } = validation

    const approvalToken = generateApprovalToken()

    const cotizacionCreada = await prisma.$transaction(async (tx) => {
      const { codigo } = await generarCodigoCorrelativo({
        tipo: CORRELATIVO_TIPOS.COTIZACION,
        prefijo: 'COT',
        prismaClient: tx,
      })

      const cot = await tx.cotizacion.create({
        data: {
          codigo_cotizacion: codigo,
          id_cliente,
          id_vehiculo,
          id_usuario: usuarioId,
          estado: 'borrador',
          vigencia_hasta: vigenciaHasta,
          approval_token: approvalToken,
          subtotal,
          descuento_global: 0,
          impuesto,
          total,
        },
      })

      for (const it of itemsValidados) {
        const detalleData = {
          id_cotizacion: cot.id_cotizacion,
          id_producto: it.id_producto ?? null,
          id_servicio: it.id_servicio ?? null,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
          descuento: it.descuento,
          total: it.total,
          servicio_ref: it.servicio_ref ?? null,
        } as any

        await tx.detalleCotizacion.create({ data: detalleData })
      }

      return cot
    })

    await prisma.bitacora.create({
      data: {
  id_usuario: usuarioId,
        accion: 'CREATE_COTIZACION',
        descripcion: `Cotización creada: ${cotizacionCreada.codigo_cotizacion} - Cliente: ${cliente.persona.nombre} ${cliente.persona.apellido_paterno}`,
        tabla: 'cotizacion'
      }
    })

    const cotizacionCompleta = await prisma.cotizacion.findUnique({
      where: { id_cotizacion: cotizacionCreada.id_cotizacion },
      include: {
        cliente: {
          include: {
            persona: {
              include: {
                empresa_persona: true,
              },
            },
          },
        },
        vehiculo: { include: { modelo: { include: { marca: true } } } },
        detalle_cotizacion: { include: { producto: true, servicio: true } },
        usuario: {
          include: {
            persona: {
              include: {
                empresa_persona: true,
              },
            },
          },
        }
      }
    })

    return NextResponse.json(cotizacionCompleta, { status: 201 })
  } catch (error) {
    console.error('Error creando cotización:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}