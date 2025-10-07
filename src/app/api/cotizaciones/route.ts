import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { cotizacionBodySchema, CotizacionValidationError, validarCotizacionPayload } from './validation'

// Función para generar código de cotización basado en año y correlativo
async function generateCodigoCotizacion() {
  const year = new Date().getFullYear()
  // Obtenemos el último correlativo del año para minimizar colisiones (no elimina por completo condición de carrera)
  const last = await prisma.cotizacion.findFirst({
    where: { codigo_cotizacion: { startsWith: `COT-${year}-` } },
    orderBy: { id_cotizacion: 'desc' },
    select: { codigo_cotizacion: true }
  })
  const nextNumber = last ? (parseInt(last.codigo_cotizacion.split('-')[2]) + 1) : 1
  return `COT-${year}-${nextNumber.toString().padStart(3, '0')}`
}

// Función para generar token de aprobación
function generateApprovalToken() {
  return randomBytes(32).toString('hex')
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const estado = searchParams.get('estado')

    const skip = (page - 1) * limit

    // Construir filtro
    const whereCondition: Record<string, unknown> = {}

    // Filtro por estado
    if (estado) {
      whereCondition.estado = estado
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
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
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

    let cotizacionCreada: { id_cotizacion: number; codigo_cotizacion: string } | null = null
    let intentos = 0
    let ultimoError: unknown = null
    while (intentos < 5 && !cotizacionCreada) {
      intentos++
      const codigo = await generateCodigoCotizacion()
      try {
        cotizacionCreada = await prisma.$transaction(async (tx) => {
          const cot = await tx.cotizacion.create({
            data: {
              codigo_cotizacion: codigo,
              id_cliente,
              id_vehiculo,
              id_usuario: parseInt(session.user.id),
              estado: 'borrador',
              vigencia_hasta: vigenciaHasta,
              approval_token: approvalToken,
              subtotal,
              descuento_global: 0,
              impuesto,
              total
            }
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
              servicio_ref: it.servicio_ref ?? null
            } as any

            await tx.detalleCotizacion.create({ data: detalleData })
          }

          return cot
        })
      } catch (error: unknown) {
        ultimoError = error
        if ((error as { code?: string })?.code === 'P2002') {
          continue
        }
        throw error
      }
    }

    if (!cotizacionCreada) {
      console.error('Falló creación de cotización tras reintentos', ultimoError)
      return NextResponse.json({ error: 'No se pudo generar la cotización, reintente' }, { status: 500 })
    }

    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id),
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