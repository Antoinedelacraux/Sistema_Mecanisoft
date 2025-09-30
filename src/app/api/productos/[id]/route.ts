import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type ParamsInput = { params: { id: string } } | { params: Promise<{ id: string }> }
function isPromise<T>(v: T | Promise<T>): v is Promise<T> {
  return typeof (v as unknown as { then?: unknown }).then === 'function'
}
async function resolveParams(ctx: ParamsInput): Promise<{ id: string }> {
  const raw = (ctx as { params: { id: string } | Promise<{ id: string }> }).params
  return isPromise(raw) ? await raw : raw
}

export async function GET(
  request: NextRequest,
  ctx: ParamsInput
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

  const { id: rawId } = await resolveParams(ctx)
  const id = parseInt(rawId)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const producto = await prisma.producto.findUnique({
      where: { id_producto: id },
      include: {
        categoria: true,
        fabricante: true,
        unidad_medida: true
      }
    })

    if (!producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    return NextResponse.json(producto)

  } catch (error) {
    console.error('Error obteniendo producto:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  ctx: ParamsInput
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

  const { id: rawId } = await resolveParams(ctx)
  const id = parseInt(rawId)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const data = await request.json()

    // Verificar que el producto existe
    const productoExistente = await prisma.producto.findUnique({
      where: { id_producto: id }
    })

    if (!productoExistente) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    // Verificar código duplicado (si se cambió)
    if (data.codigo_producto !== productoExistente.codigo_producto) {
      const existeCodigo = await prisma.producto.findUnique({
        where: { codigo_producto: data.codigo_producto }
      })

      if (existeCodigo) {
        return NextResponse.json(
          { error: 'Ya existe un producto con este código' },
          { status: 400 }
        )
      }
    }

    // Actualizar producto
    const productoActualizado = await prisma.producto.update({
      where: { id_producto: id },
      data: {
        id_categoria: parseInt(data.id_categoria),
        id_fabricante: parseInt(data.id_fabricante),
        id_unidad: parseInt(data.id_unidad),
        tipo: data.tipo,
        codigo_producto: data.codigo_producto,
        nombre: data.nombre,
        descripcion: data.descripcion,
        stock: parseInt(data.stock) || 0,
        stock_minimo: parseInt(data.stock_minimo) || 0,
        precio_compra: parseFloat(data.precio_compra),
        precio_venta: parseFloat(data.precio_venta),
        descuento: parseFloat(data.descuento) || 0,
        oferta: Boolean(data.oferta),
        foto: data.foto // ✅ Actualizar imagen
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
        accion: 'UPDATE_PRODUCTO',
        descripcion: `Producto actualizado: ${data.codigo_producto} - ${data.nombre}`,
        tabla: 'producto'
      }
    })

    return NextResponse.json(productoActualizado)

  } catch (error) {
    console.error('Error actualizando producto:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  ctx: ParamsInput
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

  const { id: rawId } = await resolveParams(ctx)
  const id = parseInt(rawId)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const producto = await prisma.producto.findUnique({
      where: { id_producto: id },
      include: {
        categoria: true,
        fabricante: true
      }
    })

    if (!producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }


    // Soft delete - cambiar estatus a false
    await prisma.producto.update({
      where: { id_producto: id },
      data: { estatus: false }
    })

    // Registrar en bitácora
    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id),
        accion: 'DELETE_PRODUCTO',
        descripcion: `Producto eliminado: ${producto.codigo_producto} - ${producto.nombre}`,
        tabla: 'producto'
      }
    })

    return NextResponse.json({ message: 'Producto eliminado correctamente' })

  } catch (error) {
    console.error('Error eliminando producto:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: ParamsInput
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

  const { id: rawId } = await resolveParams(ctx)
  const id = parseInt(rawId)
    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
    }

    const { action, estatus } = await request.json()

    if (action === 'toggle_status') {
      const producto = await prisma.producto.findUnique({
        where: { id_producto: id }
      })

      if (!producto) {
        return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
      }

      const productoActualizado = await prisma.producto.update({
        where: { id_producto: id },
        data: { estatus: estatus },
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
          accion: 'TOGGLE_STATUS_PRODUCTO',
          descripcion: `Producto ${estatus ? 'activado' : 'desactivado'}: ${producto.nombre}`,
          tabla: 'producto'
        }
      })

      return NextResponse.json(productoActualizado)
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 })

  } catch (error) {
    console.error('Error en PATCH producto:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
