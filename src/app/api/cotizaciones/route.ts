import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { z } from 'zod'

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
    let whereCondition: any = {}

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
      cliente: { include: { persona: true } },
      vehiculo: { include: { modelo: { include: { marca: true } } } },
      usuario: { include: { persona: true } },
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

// ===== Zod Schemas =====
const itemSchema = z.object({
  id_producto: z.union([z.number(), z.string()])
    .transform(v => parseInt(String(v)))
    .refine(v => v > 0, 'id_producto inválido'),
  cantidad: z.union([z.number(), z.string()])
    .transform(v => parseInt(String(v)))
    .refine(v => v > 0, 'cantidad debe ser > 0'),
  precio_unitario: z.union([z.number(), z.string()])
    .transform(v => parseFloat(String(v)))
    .refine(v => v >= 0, 'precio_unitario inválido'),
  descuento: z.union([z.number(), z.string(), z.null()])
    .optional()
    .transform(v => (v === undefined || v === null || String(v).trim() === '') ? 0 : parseFloat(String(v)))
    .refine(v => v >= 0 && v <= 100, 'descuento debe estar entre 0 y 100')
})

const bodySchema = z.object({
  id_cliente: z.union([z.number(), z.string()]).transform(v => parseInt(String(v))).refine(v => v > 0, 'id_cliente inválido'),
  id_vehiculo: z.union([z.number(), z.string()]).transform(v => parseInt(String(v))).refine(v => v > 0, 'id_vehiculo inválido'),
  vigencia_dias: z.union([z.number(), z.string()]).optional().transform(v => v === undefined ? 7 : parseInt(String(v))).refine(v => v > 0 && v <= 90, 'vigencia_dias debe estar entre 1 y 90'),
  observaciones: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Debe enviar al menos un item')
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const json = await request.json()
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      console.warn('POST /api/cotizaciones validation error payload:', JSON.stringify(json))
      console.warn('Validation issues:', parsed.error.flatten())
      return NextResponse.json({ error: 'Validación fallida', detalles: parsed.error.flatten() }, { status: 400 })
    }

    const { id_cliente, id_vehiculo, vigencia_dias, items } = parsed.data

    // Verificar cliente activo y cargar persona
    const cliente = await prisma.cliente.findUnique({
      where: { id_cliente },
      include: { persona: true }
    })
    if (!cliente || !cliente.estatus) {
      return NextResponse.json({ error: 'El cliente no existe o está inactivo' }, { status: 400 })
    }

    // Verificar vehículo pertenece al cliente
    const vehiculo = await prisma.vehiculo.findUnique({ where: { id_vehiculo } })
    if (!vehiculo || vehiculo.id_cliente !== id_cliente) {
      return NextResponse.json({ error: 'El vehículo no pertenece al cliente seleccionado' }, { status: 400 })
    }

    // Batch fetch catálogo (productos/servicios) usando id como clave
    const productoIds = [...new Set(items.map(i => i.id_producto))]
    const productos = await prisma.producto.findMany({ where: { id_producto: { in: productoIds } } })
    const servicios = await prisma.servicio.findMany({ where: { id_servicio: { in: productoIds } } })
    const productosMap = new Map(productos.map(p => [p.id_producto, p]))
    const serviciosMap = new Map(servicios.map(s => [s.id_servicio, s]))

    // Validar cada item contra producto
    let subtotal = 0
    const itemsValidados: Array<{
      id_producto?: number | null
      id_servicio?: number | null
      cantidad: number
      precio_unitario: number
      descuento: number
      total: number
    }> = []

    for (const item of items) {
      const prod = productosMap.get(item.id_producto)
      const serv = serviciosMap.get(item.id_producto)
      const entry = prod || serv
      if (!entry || entry.estatus === false) {
        return NextResponse.json({ error: `Item con ID ${item.id_producto} no está disponible` }, { status: 400 })
      }
      const descuentoAplicado = typeof item.descuento === 'number' ? item.descuento : 0
      const totalItem = item.cantidad * item.precio_unitario * (1 - descuentoAplicado / 100)
      subtotal += totalItem
      itemsValidados.push({
        id_producto: prod ? item.id_producto : null,
        id_servicio: serv ? item.id_producto : null,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        descuento: descuentoAplicado,
        total: totalItem
      })
    }

    const impuesto = subtotal * 0.18 // IGV 18%
    const total = subtotal + impuesto

    // Fecha de vigencia
    const vigenciaHasta = new Date()
    vigenciaHasta.setDate(vigenciaHasta.getDate() + vigencia_dias)

    const approvalToken = generateApprovalToken()

    // Retry para colisiones de código (hasta 5 intentos)
    let cotizacionCreada: any = null
    let intentos = 0
    let ultimoError: any = null
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
            await tx.detalleCotizacion.create({
              data: {
                id_cotizacion: cot.id_cotizacion,
                id_producto: it.id_producto ?? null,
                id_servicio: it.id_servicio ?? null,
                cantidad: it.cantidad,
                precio_unitario: it.precio_unitario,
                descuento: it.descuento,
                total: it.total
              }
            })
          }
          return cot
        })
      } catch (error: any) {
        ultimoError = error
        if (error?.code === 'P2002') {
          // Unique constraint failed (posible colisión de código). Reintentar.
          continue
        }
        throw error
      }
    }

    if (!cotizacionCreada) {
      console.error('Falló creación de cotización tras reintentos', ultimoError)
      return NextResponse.json({ error: 'No se pudo generar la cotización, reintente' }, { status: 500 })
    }

    // Bitácora
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
        cliente: { include: { persona: true } },
        vehiculo: { include: { modelo: { include: { marca: true } } } },
        detalle_cotizacion: { include: { producto: true } },
        usuario: { include: { persona: true } }
      }
    })

    return NextResponse.json(cotizacionCompleta, { status: 201 })

  } catch (error) {
    console.error('Error creando cotización:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}