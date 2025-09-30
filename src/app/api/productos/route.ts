import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    const categoria = searchParams.get('categoria')
    const tipo = searchParams.get('tipo') // 'producto' o 'servicio'
    const stockBajo = searchParams.get('stock_bajo') === 'true'

    const skip = (page - 1) * limit

    // Construir filtro de búsqueda
    let whereCondition: any = {
      estatus: true
    }

    // Filtro por tipo
    if (tipo) {
      whereCondition.tipo = tipo
    }

    // Filtro por categoría
    if (categoria) {
      whereCondition.id_categoria = parseInt(categoria)
    }

    // Filtro de stock bajo
    if (stockBajo) {
      whereCondition.stock = {
        lte: prisma.producto.fields.stock_minimo
      }
    }

    // Filtro de búsqueda
    if (search) {
      whereCondition.OR = [
        { nombre: { contains: search, mode: 'insensitive' as const } },
        { codigo_producto: { contains: search, mode: 'insensitive' as const } },
        { descripcion: { contains: search, mode: 'insensitive' as const } },
        { categoria: { nombre: { contains: search, mode: 'insensitive' as const } } },
        { fabricante: { nombre_fabricante: { contains: search, mode: 'insensitive' as const } } }
      ]
    }

    // Obtener productos con paginación
    const [productos, total] = await Promise.all([
      prisma.producto.findMany({
        where: whereCondition,
        include: {
          categoria: true,
          fabricante: true,
          unidad_medida: true
        },
        orderBy: [
          { stock: 'asc' }, // Stock bajo primero
          { nombre: 'asc' }
        ],
        skip,
        take: limit
      }),
      prisma.producto.count({
        where: whereCondition
      })
    ])

    return NextResponse.json({
      productos,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        current: page,
        limit
      }
    })

  } catch (error) {
    console.error('Error obteniendo productos:', error)
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

    const data = await request.json()
    
    const {
      id_categoria,
      id_fabricante,
      id_unidad,
      tipo,
      codigo_producto,
      nombre,
      descripcion,
      stock,
      stock_minimo,
      precio_compra,
      precio_venta,
      descuento,
      oferta
    } = data

    // Validar campos requeridos
    if (!id_categoria || !id_fabricante || !id_unidad || !tipo || !codigo_producto || !nombre || precio_compra === undefined || precio_venta === undefined) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' }, 
        { status: 400 }
      )
    }

    // Verificar que el código del producto no existe
    const existeCodigo = await prisma.producto.findUnique({
      where: { codigo_producto }
    })

    if (existeCodigo) {
      return NextResponse.json(
        { error: 'Ya existe un producto con este código' }, 
        { status: 400 }
      )
    }

    // Verificar que las relaciones existen
    const [categoria, fabricante, unidad] = await Promise.all([
      prisma.categoria.findUnique({ where: { id_categoria: parseInt(id_categoria) } }),
      prisma.fabricante.findUnique({ where: { id_fabricante: parseInt(id_fabricante) } }),
      prisma.unidadMedida.findUnique({ where: { id_unidad: parseInt(id_unidad) } })
    ])

    if (!categoria || !fabricante || !unidad) {
      return NextResponse.json(
        { error: 'Categoría, fabricante o unidad de medida no válidos' }, 
        { status: 400 }
      )
    }

    // Crear producto
    const producto = await prisma.producto.create({
      data: {
        id_categoria: parseInt(id_categoria),
        id_fabricante: parseInt(id_fabricante),
        id_unidad: parseInt(id_unidad),
        tipo,
        codigo_producto,
        nombre,
        descripcion,
        stock: parseInt(stock) || 0,
        stock_minimo: parseInt(stock_minimo) || 0,
        precio_compra: parseFloat(precio_compra),
        precio_venta: parseFloat(precio_venta),
        descuento: parseFloat(descuento) || 0,
        oferta: Boolean(oferta)
      },
      include: {
        categoria: true,
        fabricante: true,
        unidad_medida: true
      }
    })

    // Registrar en bitácora
    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id),
        accion: 'CREATE_PRODUCTO',
        descripcion: `Producto creado: ${codigo_producto} - ${nombre}`,
        tabla: 'producto'
      }
    })

    return NextResponse.json(producto, { status: 201 })

  } catch (error) {
    console.error('Error creando producto:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' }, 
      { status: 500 }
    )
  }
}