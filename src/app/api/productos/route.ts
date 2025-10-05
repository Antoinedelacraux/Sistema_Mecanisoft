import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

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
  const tipo = searchParams.get('tipo') // 'producto'
    const stockBajo = searchParams.get('stock_bajo') === 'true'
  const includeInactive = searchParams.get('include_inactive') === 'true' // conservado por compatibilidad (ya no necesario)

    const skip = (page - 1) * limit

    // Siempre mostraremos productos independientemente de su estatus.
    // Si en el futuro se requiere filtrar solo activos, se podría añadir un query param ?only_active=true
    // De momento ignoramos includeInactive y no filtramos por estatus.
    let whereCondition: Prisma.ProductoWhereInput = {}

    // Siempre devolver solo productos en este módulo
    whereCondition = { ...whereCondition, tipo: 'producto' }

    // Filtro por categoría
    if (categoria) {
      const idCat = parseInt(categoria)
      if (!isNaN(idCat)) {
        whereCondition = { ...whereCondition, id_categoria: idCat }
      }
    }

    // Nota: Prisma (PostgreSQL) no soporta comparación directa entre dos columnas en where.
    // Implementaremos el filtro de stock bajo (stock <= stock_minimo) después de la consulta
    // aplicando los demás filtros en la base de datos para minimizar resultados.
    const aplicarFiltroStockBajo = stockBajo

    // Filtro de búsqueda
    if (search) {
      whereCondition = {
        ...whereCondition,
        OR: [
        { nombre: { contains: search, mode: 'insensitive' as const } },
        { codigo_producto: { contains: search, mode: 'insensitive' as const } },
        { descripcion: { contains: search, mode: 'insensitive' as const } },
        { categoria: { nombre: { contains: search, mode: 'insensitive' as const } } },
        { fabricante: { nombre_fabricante: { contains: search, mode: 'insensitive' as const } } }
        ]
      }
    }

    // Recuperamos la lista base (sin paginar aún si aplicaremos el filtro de stock bajo)
    let productosBase = await prisma.producto.findMany({
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
      // Si no se aplicará filtro de stock bajo podemos paginar directamente en la BD
      skip: aplicarFiltroStockBajo ? undefined : skip,
      take: aplicarFiltroStockBajo ? undefined : limit
    })

    if (aplicarFiltroStockBajo) {
      productosBase = productosBase.filter(p => p.stock <= p.stock_minimo)
    }

    const total = aplicarFiltroStockBajo
      ? productosBase.length
      : await prisma.producto.count({ where: whereCondition })

    // Si aplicamos filtro en memoria, ahora sí paginamos
    const productos = aplicarFiltroStockBajo
      ? productosBase.slice(skip, skip + limit)
      : productosBase

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
      oferta,
      foto
    } = data

    // Validar campos requeridos
    if (id_categoria === undefined || id_categoria === null ||
        id_fabricante === undefined || id_fabricante === null ||
        id_unidad === undefined || id_unidad === null ||
        !tipo || !codigo_producto || !nombre ||
        precio_compra === undefined || precio_compra === null ||
        precio_venta === undefined || precio_venta === null) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    const precioCompraNum = parseFloat(precio_compra)
    const precioVentaNum = parseFloat(precio_venta)

    if (isNaN(precioCompraNum) || isNaN(precioVentaNum) || precioCompraNum < 0 || precioVentaNum < 0) {
      return NextResponse.json(
        { error: 'Los precios deben ser números válidos y no negativos' },
        { status: 400 }
      )
    }
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
    const idCategoriaNum = parseInt(id_categoria)
    const idFabricanteNum = parseInt(id_fabricante)
    const idUnidadNum = parseInt(id_unidad)

    if (isNaN(idCategoriaNum) || isNaN(idFabricanteNum) || isNaN(idUnidadNum)) {
      return NextResponse.json(
        { error: 'Los IDs de categoría, fabricante y unidad deben ser números válidos' },
        { status: 400 }
      )
    }

    const [categoria, fabricante, unidad] = await Promise.all([
      prisma.categoria.findUnique({ where: { id_categoria: idCategoriaNum } }),
      prisma.fabricante.findUnique({ where: { id_fabricante: idFabricanteNum } }),
      prisma.unidadMedida.findUnique({ where: { id_unidad: idUnidadNum } })
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
        id_categoria: idCategoriaNum,
        id_fabricante: idFabricanteNum,
        id_unidad: idUnidadNum,
        tipo,
        codigo_producto,
        nombre,
        descripcion,
        stock: parseInt(stock) || 0,
        stock_minimo: parseInt(stock_minimo) || 0,
        precio_compra: precioCompraNum,
        precio_venta: precioVentaNum,
        descuento: parseFloat(descuento) || 0,
        oferta: Boolean(oferta),
        foto
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