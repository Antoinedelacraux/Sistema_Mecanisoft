import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Asegura evaluación de cookies/sesión en cada request (evita cache estática accidental)
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const unidadFactor: Record<string, number> = {
  minutos: 1,
  horas: 60,
  dias: 60 * 24,
  semanas: 60 * 24 * 7
}

function convertirATotalMinutos(valor: number, unidad: string) {
  const factor = unidadFactor[unidad as keyof typeof unidadFactor] ?? 1
  return Math.round(valor * factor)
}

// Helper para progreso de tareas
async function calcularProgresoOrden(id_transaccion: number) {
  try {
    const detalles = await prisma.detalleTransaccion.findMany({
      where: { id_transaccion },
      include: { tareas: true }
    })
    const totalTareas = detalles.reduce((acc, d) => acc + d.tareas.length, 0)
    if (totalTareas === 0) return { total: 0, pendientes: 0, en_proceso: 0, completadas: 0, verificadas: 0, porcentaje: 0 }
    let pendientes=0,en_proceso=0,completadas=0,verificadas=0
    for (const d of detalles) {
      for (const t of d.tareas) {
        switch (t.estado) {
          case 'pendiente': pendientes++; break
          case 'en_proceso': en_proceso++; break
          case 'completado': completadas++; break
          case 'verificado': verificadas++; break
        }
      }
    }
    const porcentaje = Math.round(((completadas + verificadas) / totalTareas) * 100)
    return { total: totalTareas, pendientes, en_proceso, completadas, verificadas, porcentaje }
  } catch (e) {
    console.warn('No se pudo calcular progreso', e)
    return { total: 0, pendientes: 0, en_proceso: 0, completadas: 0, verificadas: 0, porcentaje: 0 }
  }
}

// Función para generar código de orden (no transaccional). Se usa dentro de un retry.
async function generateCodigoOrden() {
  const year = new Date().getFullYear()
  const lastOrder = await prisma.transaccion.findFirst({
    where: {
      tipo_transaccion: 'orden',
      codigo_transaccion: { startsWith: `ORD-${year}-` }
    },
    select: { codigo_transaccion: true },
    orderBy: { id_transaccion: 'desc' }
  })
  const nextNumber = lastOrder ? parseInt(lastOrder.codigo_transaccion.split('-')[2]) + 1 : 1
  return `ORD-${year}-${nextNumber.toString().padStart(3, '0')}`
}

// Validación con Zod del cuerpo del POST
const itemSchema = z.object({
  id_producto: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
  cantidad: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
  precio_unitario: z.union([z.number().positive(), z.string().regex(/^\d+(\.\d+)?$/)]),
  descuento: z.union([z.number(), z.string().regex(/^\d+(\.\d+)?$/)]).optional(),
  tipo: z.enum(['producto', 'servicio']).optional(),
  // Si el item es un producto, puede asociarse opcionalmente a un servicio específico de la misma orden
  servicio_ref: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional()
})

const bodySchema = z.object({
  id_cliente: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
  id_vehiculo: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
  id_trabajador_principal: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional(),
  prioridad: z.enum(['baja','media','alta','urgente']).optional(),
  fecha_fin_estimada: z.union([z.coerce.date(), z.string().regex(/^[0-9T:.-]+Z?$/)]).optional(),
  observaciones: z.string().max(1000).optional(),
  modo_orden: z.enum(['solo_servicios','servicios_y_productos']).optional(),
  items: z.array(itemSchema).min(1),
  trabajadores_secundarios: z.array(z.union([z.number().int().positive(), z.string().regex(/^\d+$/)])).optional()
})

function toInt(val: unknown): number | undefined {
  if (val === undefined || val === null || val === '') return undefined
  const n = typeof val === 'string' ? parseInt(val, 10) : (val as number)
  return Number.isFinite(n) ? n : undefined
}

function isUniqueConstraintError(e: unknown): boolean {
  return !!(typeof e === 'object' && e && (e as any).code === 'P2002')
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
  const prioridad = searchParams.get('prioridad')
  const estadoPago = searchParams.get('estado_pago')
  const fechaDesdeRaw = searchParams.get('fecha_desde') // ISO date
  const fechaHastaRaw = searchParams.get('fecha_hasta')
  const modo = (searchParams.get('modo') || 'full').toLowerCase() // 'light' | 'full'
  const includeTareas = searchParams.get('include_tareas') === 'true'
  const includeProgreso = searchParams.get('include_progreso') === 'true'
  const trabajadorIdParam = searchParams.get('trabajador_id')
  const trabajadorId = trabajadorIdParam && /^\d+$/.test(trabajadorIdParam) ? parseInt(trabajadorIdParam, 10) : undefined

    const skip = (page - 1) * limit

    // Construir filtro
    let whereCondition: any = {
      tipo_transaccion: 'orden',
      estatus: 'activo'
    }

    // Filtro por estado
    if (estado) {
      whereCondition.estado_orden = estado
    }

    // Filtro por prioridad
    if (prioridad) {
      whereCondition.prioridad = prioridad
    }

    // Filtro por trabajador
    if (trabajadorId !== undefined) {
      whereCondition.id_trabajador_principal = trabajadorId
    }

    // Filtro por estado de pago
    if (estadoPago) {
      whereCondition.estado_pago = estadoPago
    }

    // Filtro por rango de fechas
    const fechaFilter: any = {}
    if (fechaDesdeRaw) {
      const d = new Date(fechaDesdeRaw)
      if (!isNaN(d.getTime())) fechaFilter.gte = d
    }
    if (fechaHastaRaw) {
      const h = new Date(fechaHastaRaw)
      if (!isNaN(h.getTime())) {
        // Ajustar a final del día si viene sin hora
        h.setHours(23,59,59,999)
        fechaFilter.lte = h
      }
    }
    if (Object.keys(fechaFilter).length) {
      whereCondition.fecha = fechaFilter
    }

    // Filtro de búsqueda
    if (search) {
      whereCondition.OR = [
        { codigo_transaccion: { contains: search, mode: 'insensitive' as const } },
        { persona: { nombre: { contains: search, mode: 'insensitive' as const } } },
        { persona: { apellido_paterno: { contains: search, mode: 'insensitive' as const } } },
        { persona: { numero_documento: { contains: search, mode: 'insensitive' as const } } },
        { transaccion_vehiculos: { 
          some: { 
            vehiculo: { 
              placa: { contains: search, mode: 'insensitive' as const } 
            } 
          } 
        }}
      ]
    }

    // Definir includes según modo
    const includeFull: any = {
      persona: true,
      usuario: { include: { persona: true } },
      trabajador_principal: { include: { usuario: { include: { persona: true } } } },
      transaccion_vehiculos: { include: { vehiculo: { include: { modelo: { include: { marca: true } }, cliente: { include: { persona: true } } } } } },
      detalles_transaccion: { include: { producto: true, servicio: true, ...(includeTareas ? { tareas: true } : {}), servicio_asociado: { include: { servicio: true, producto: true } }, productos_asociados: { include: { producto: true } } } },
      _count: { select: { detalles_transaccion: true } }
    }
    const includeLight: any = {
      persona: { select: { nombre: true, apellido_paterno: true } },
      trabajador_principal: { select: { id_trabajador: true } },
      transaccion_vehiculos: { include: { vehiculo: { select: { placa: true } } } },
      _count: { select: { detalles_transaccion: true } }
    }
    const includeObject = modo === 'light' ? includeLight : includeFull

    const [ordenesBase, total] = await Promise.all([
      prisma.transaccion.findMany({
        where: whereCondition,
        include: includeObject,
        orderBy: [ { prioridad: 'desc' }, { fecha: 'desc' } ],
        skip,
        take: limit
      }),
      prisma.transaccion.count({ where: whereCondition })
    ])

    let ordenes = ordenesBase
    if (includeProgreso) {
      // Calcular progreso por cada orden (naive N consultas)
      const enriquecidas = [] as any[]
      for (const o of ordenesBase) {
        const progreso = await calcularProgresoOrden(o.id_transaccion)
        enriquecidas.push({ ...o, progreso })
      }
      ordenes = enriquecidas
    }

    return NextResponse.json({
      ordenes,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        current: page,
        limit
      }
    })

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
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const json = await request.json().catch(() => null)
    if (!json) {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', detalles: parsed.error.format() }, { status: 400 })
    }

    const {
      id_cliente: rawCliente,
      id_vehiculo: rawVehiculo,
      id_trabajador_principal: rawTrabajador,
      prioridad,
      fecha_fin_estimada,
      observaciones,
      modo_orden,
      items,
      trabajadores_secundarios
    } = parsed.data

    const id_cliente = toInt(rawCliente)!
    const id_vehiculo = toInt(rawVehiculo)!
  const id_trabajador_principal = toInt(rawTrabajador)
  const trabajadoresSecundarios = (parsed.data.trabajadores_secundarios || []).map(t => toInt(t)!).filter(Boolean)

    // Verificar cliente
    const cliente = await prisma.cliente.findUnique({
      where: { id_cliente },
      include: { persona: true }
    })
    if (!cliente || !cliente.estatus) {
      return NextResponse.json({ error: 'El cliente no existe o está inactivo' }, { status: 400 })
    }

    // Verificar vehículo del cliente
    const vehiculo = await prisma.vehiculo.findUnique({
      where: { id_vehiculo },
      include: { modelo: { include: { marca: true } } }
    })
    if (!vehiculo || vehiculo.id_cliente !== id_cliente) {
      return NextResponse.json({ error: 'El vehículo no pertenece al cliente seleccionado' }, { status: 400 })
    }

    // Verificar trabajador (si se especifica)
    let trabajador = null as null | { id_trabajador: number; activo: boolean }
    if (id_trabajador_principal) {
      const t = await prisma.trabajador.findUnique({
        where: { id_trabajador: id_trabajador_principal },
        select: { id_trabajador: true, activo: true }
      })
      if (!t || !t.activo) {
        return NextResponse.json({ error: 'El trabajador seleccionado no está disponible' }, { status: 400 })
      }
      trabajador = t
    }

  // Batch fetch catalog entries (productos y servicios). Por compatibilidad actual usamos id_producto y su tipo.
  const productoIds = [...new Set(items.map(i => toInt(i.id_producto as any)!))]
  const productos = await prisma.producto.findMany({ where: { id_producto: { in: productoIds } } })
  const servicios = await prisma.servicio.findMany({ where: { id_servicio: { in: productoIds } } })
  const productosMap = new Map(productos.map(p => [p.id_producto, p]))
  const serviciosMap = new Map(servicios.map(s => [s.id_servicio, s]))

    // Validar existencia / estado con preferencia por el tipo solicitado

    let subtotal = 0
    let totalMinutosMin = 0
    let totalMinutosMax = 0

    const itemsValidados: Array<{
      id_producto?: number
      id_servicio?: number
      cantidad: number
      precio: number
      descuento: number
      total: number
      tipo: 'producto' | 'servicio'
      servicio_ref?: number
      tiempo_servicio?: {
        minimo: number
        maximo: number
        unidad: string
        minimoMinutos: number
        maximoMinutos: number
      }
    }> = []

    // Enforce modo_orden: si es 'solo_servicios', rechazar cualquier item de tipo producto
    const modoSoloServicios = (modo_orden || 'servicios_y_productos') === 'solo_servicios'
    for (const raw of items) {
      if (modoSoloServicios && raw.tipo === 'producto') {
        return NextResponse.json({ error: 'Modo Solo servicios activo: no se permiten productos en la orden.' }, { status: 400 })
      }
      const id_producto = toInt(raw.id_producto as any)!
      const tipoSolicitado = raw.tipo
      const producto = productosMap.get(id_producto)
      const servicio = serviciosMap.get(id_producto)

      let tipo: 'producto' | 'servicio'
      if (tipoSolicitado === 'producto') {
        if (!producto || producto.estatus === false) {
          return NextResponse.json({ error: `Producto con ID ${id_producto} no está disponible` }, { status: 400 })
        }
        tipo = 'producto'
      } else if (tipoSolicitado === 'servicio') {
        if (!servicio || servicio.estatus === false) {
          return NextResponse.json({ error: `Servicio con ID ${id_producto} no está disponible` }, { status: 400 })
        }
        tipo = 'servicio'
      } else if (servicio && servicio.estatus !== false) {
        tipo = 'servicio'
      } else if (producto && producto.estatus !== false) {
        tipo = 'producto'
      } else {
        return NextResponse.json({ error: `Item con ID ${id_producto} no está disponible` }, { status: 400 })
      }

      const entry = tipo === 'producto' ? producto! : servicio!
      const cantidad = toInt(raw.cantidad as any)!
      const precio = typeof raw.precio_unitario === 'string' ? parseFloat(raw.precio_unitario) : raw.precio_unitario as number
      const descuento = raw.descuento ? (typeof raw.descuento === 'string' ? parseFloat(raw.descuento) : raw.descuento) : 0
      if (descuento < 0 || descuento > 100) {
        return NextResponse.json({ error: `Descuento inválido para item ${entry.nombre}` }, { status: 400 })
      }
      if (tipo === 'producto' && (producto!.stock < cantidad)) {
        return NextResponse.json({ error: `Stock insuficiente para ${producto!.nombre}. Disponible: ${producto!.stock}` }, { status: 400 })
      }
      const totalItem = cantidad * precio * (1 - descuento / 100)
      subtotal += totalItem
      const servicioInfo = serviciosMap.get(id_producto)
      const tiempoServicio = tipo === 'servicio' && servicioInfo
        ? {
            minimo: servicioInfo.tiempo_minimo,
            maximo: servicioInfo.tiempo_maximo,
            unidad: servicioInfo.unidad_tiempo,
            minimoMinutos: convertirATotalMinutos(servicioInfo.tiempo_minimo, servicioInfo.unidad_tiempo) * cantidad,
            maximoMinutos: convertirATotalMinutos(servicioInfo.tiempo_maximo, servicioInfo.unidad_tiempo) * cantidad
          }
        : undefined

      if (tiempoServicio) {
        totalMinutosMin += tiempoServicio.minimoMinutos
        totalMinutosMax += tiempoServicio.maximoMinutos
      }

      itemsValidados.push({
        ...(tipo === 'producto' ? { id_producto } : { id_servicio: id_producto }),
        cantidad,
        precio,
        descuento,
        total: totalItem,
        tipo,
        ...(tipo === 'producto' && raw.servicio_ref ? { servicio_ref: toInt(raw.servicio_ref as any) } : {}),
        ...(tiempoServicio ? { tiempo_servicio: tiempoServicio } : {})
      })
    }

    const impuesto = subtotal * 0.18
    const total = subtotal + impuesto

    const fechaReferencia = new Date()
    const fechaFinCalculada = fecha_fin_estimada
      ? (fecha_fin_estimada instanceof Date ? fecha_fin_estimada : new Date(fecha_fin_estimada))
      : totalMinutosMax > 0
        ? new Date(fechaReferencia.getTime() + totalMinutosMax * 60_000)
        : null

    // Retry para crear con código único (hasta 3 intentos)
    let transaccionCreada: any = null
    let codigoFinal = ''
    for (let intento = 0; intento < 3; intento++) {
      const codigoOrden = await generateCodigoOrden()
      try {
        transaccionCreada = await prisma.$transaction(async (tx) => {
              const transaccion = await tx.transaccion.create({
            data: {
              persona: { connect: { id_persona: cliente.id_persona } },
              usuario: { connect: { id_usuario: parseInt(session.user.id) } },
              ...(id_trabajador_principal && { trabajador_principal: { connect: { id_trabajador: id_trabajador_principal } } }),
              tipo_transaccion: 'orden',
              tipo_comprobante: 'orden_trabajo',
              codigo_transaccion: codigoOrden,
              fecha: new Date(),
              descuento: 0,
              impuesto: impuesto,
              porcentaje: 18,
              total: total,
              observaciones: observaciones,
                  // Estado inicial siempre 'pendiente' (no enviada al Kanban)
                  estado_orden: 'pendiente',
              prioridad: prioridad || 'media',
                  ...(fechaFinCalculada ? { fecha_fin_estimada: fechaFinCalculada } : {}),
                  // Persistir duración total estimada en minutos
                  duracion_min: totalMinutosMin > 0 ? totalMinutosMin : null,
                  duracion_max: totalMinutosMax > 0 ? totalMinutosMax : null,
                  unidad_tiempo: (totalMinutosMin > 0 || totalMinutosMax > 0) ? 'minutos' : null
            }
          })

          await tx.transaccionVehiculo.create({
            data: {
              id_transaccion: transaccion.id_transaccion,
              id_vehiculo,
              id_usuario: parseInt(session.user.id),
              descripcion: `Orden de trabajo: ${codigoOrden}`
            }
          })

          // Registrar trabajadores secundarios en pivot
          for (const idTrabSec of trabajadoresSecundarios) {
            if (id_trabajador_principal && idTrabSec === id_trabajador_principal) continue
            try {
              await tx.transaccionTrabajador.create({
                data: { id_transaccion: transaccion.id_transaccion, id_trabajador: idTrabSec, rol: 'apoyo' }
              })
            } catch (e:any) {
              if (e.code !== 'P2002') console.warn('Pivot trabajador duplicado u error', e)
            }
          }

          // Primero crear detalles para servicios y mapear id_servicio -> id_detalle_transaccion
          const mapaDetalleServicio = new Map<number, number>()
          for (const item of itemsValidados.filter(i => i.tipo === 'servicio')) {
            const detalle = await tx.detalleTransaccion.create({
              data: {
                id_transaccion: transaccion.id_transaccion,
                id_servicio: item.id_servicio ?? null,
                cantidad: item.cantidad,
                precio: item.precio,
                descuento: item.descuento,
                total: item.total
              }
            })
            mapaDetalleServicio.set(item.id_servicio!, detalle.id_detalle_transaccion)
            const estimado = item.tiempo_servicio ? item.tiempo_servicio.maximoMinutos : 60
            try {
              await tx.tarea.create({
                data: {
                  id_detalle_transaccion: detalle.id_detalle_transaccion,
                  id_trabajador: id_trabajador_principal ?? trabajadoresSecundarios[0] ?? null,
                  estado: 'pendiente',
                  tiempo_estimado: estimado
                }
              })
            } catch (e) {
              console.warn('Fallo creación de tarea automática', e)
            }
          }

          // Validación: 0 o 1 producto por servicio
          const cuentaProductosPorServicio = new Map<number, number>()
          for (const item of itemsValidados.filter(i => i.tipo === 'producto' && i.servicio_ref)) {
            const srvId = item.servicio_ref!
            const count = cuentaProductosPorServicio.get(srvId) || 0
            if (count >= 1) {
              throw new Error(`Cada servicio solo puede tener 0 o 1 producto asociado (servicio ${srvId})`)
            }
            cuentaProductosPorServicio.set(srvId, count + 1)
          }

          // Luego crear detalles para productos, vinculando opcionalmente al detalle de servicio
          for (const item of itemsValidados.filter(i => i.tipo === 'producto')) {
            const detalleProducto = await tx.detalleTransaccion.create({
              data: {
                id_transaccion: transaccion.id_transaccion,
                id_producto: item.id_producto ?? null,
                cantidad: item.cantidad,
                precio: item.precio,
                descuento: item.descuento,
                total: item.total,
                id_detalle_servicio_asociado: item.servicio_ref ? mapaDetalleServicio.get(item.servicio_ref) ?? null : null
              }
            })
            await tx.producto.update({
              where: { id_producto: item.id_producto! },
              data: { stock: { decrement: item.cantidad } }
            })
          }

          return transaccion
        })
        codigoFinal = codigoOrden
        break
      } catch (e) {
        if (isUniqueConstraintError(e) && intento < 2) {
          continue
        }
        throw e
      }
    }

    if (!transaccionCreada) {
      return NextResponse.json({ error: 'No se pudo generar código de orden único' }, { status: 500 })
    }

    await prisma.bitacora.create({
      data: {
        id_usuario: parseInt(session.user.id),
        accion: 'CREATE_ORDEN',
        descripcion: `Orden creada: ${codigoFinal} - Cliente: ${cliente.persona.nombre} ${cliente.persona.apellido_paterno}`,
        tabla: 'transaccion'
      }
    })

    const ordenCompleta = await prisma.transaccion.findUnique({
      where: { id_transaccion: transaccionCreada.id_transaccion },
      include: {
        persona: true,
        trabajador_principal: { include: { usuario: { include: { persona: true } } } },
        transaccion_vehiculos: { include: { vehiculo: { include: { modelo: { include: { marca: true } } } } } },
        detalles_transaccion: { include: { producto: true, servicio: true, tareas: true, servicio_asociado: { include: { servicio: true, producto: true } }, productos_asociados: { include: { producto: true } } } },
        _count: { select: { detalles_transaccion: true } }
      }
    })

    const progreso = await calcularProgresoOrden(ordenCompleta!.id_transaccion)
    return NextResponse.json({
      ...ordenCompleta,
      resumen: {
        subtotal: Number(subtotal.toFixed(2)),
        impuesto: Number(impuesto.toFixed(2)),
        total: Number(total.toFixed(2)),
        tareas_pendientes_generar: itemsValidados.filter(i => i.tipo === 'servicio' && !(id_trabajador_principal ?? trabajadoresSecundarios[0])).length,
        tiempo_estimado_min: totalMinutosMin,
        tiempo_estimado_max: totalMinutosMax,
        fecha_fin_estimada: transaccionCreada?.fecha_fin_estimada ?? fechaFinCalculada ?? null,
        progreso
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error creando orden:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// PATCH: actualizar estado / prioridad / fechas de una orden
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })

  const { id_transaccion, nuevo_estado, prioridad, asignar_trabajador, fecha_fin_estimada, agregar_trabajadores, remover_trabajadores, generar_tareas_faltantes, registrar_pago, observaciones, id_vehiculo: idVehiculoNuevo, items: itemsPatch } = body || {}
    if (!id_transaccion) return NextResponse.json({ error: 'id_transaccion requerido' }, { status: 400 })

  const orden: any = await prisma.transaccion.findUnique({ where: { id_transaccion: Number(id_transaccion) } })
    if (!orden || orden.tipo_transaccion !== 'orden') {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    const validEstados = ['pendiente','por_hacer','en_proceso','pausado','completado','entregado'] as const
    if (nuevo_estado && !validEstados.includes(nuevo_estado)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
    }

    // Validar transición
    const transiciones: Record<string,string[]> = {
      pendiente: ['por_hacer'],
      por_hacer: ['en_proceso','pausado'],
      en_proceso: ['pausado','completado'],
      pausado: ['en_proceso','completado'],
      completado: ['entregado'],
      entregado: []
    }
    if (nuevo_estado && orden?.estado_orden && !transiciones[orden.estado_orden]?.includes(nuevo_estado)) {
      return NextResponse.json({ error: `Transición no permitida (${orden.estado_orden} -> ${nuevo_estado})` }, { status: 400 })
    }

    // Solo permitir edición si está pendiente (excepto transición a 'por_hacer')
    if (orden.estado_orden !== 'pendiente' && (!nuevo_estado || nuevo_estado !== 'por_hacer')) {
      return NextResponse.json({ error: 'Solo se puede editar órdenes en estado pendiente.' }, { status: 403 })
    }

    // Validar transición a 'por_hacer'
    if (nuevo_estado === 'por_hacer') {
      // Debe tener al menos un servicio y un mecánico
      const detalles = await prisma.detalleTransaccion.findMany({ where: { id_transaccion: orden.id_transaccion }, include: { producto: true, servicio: true } })
      const tieneServicio = detalles.some(d => d.servicio != null)
      if (!tieneServicio) {
        return NextResponse.json({ error: 'La orden debe tener al menos un servicio registrado.' }, { status: 400 })
      }
      if (!orden.id_trabajador_principal) {
        return NextResponse.json({ error: 'La orden debe tener un mecánico principal asignado.' }, { status: 400 })
      }
    }

    // Preparar data de actualización
  const dataUpdate: any = {}
    if (prioridad) dataUpdate.prioridad = prioridad
    if (fecha_fin_estimada) dataUpdate.fecha_fin_estimada = new Date(fecha_fin_estimada)
    if (typeof observaciones === 'string') dataUpdate.observaciones = observaciones
    if (nuevo_estado) {
      dataUpdate.estado_orden = nuevo_estado
      if (nuevo_estado === 'en_proceso' && !orden.fecha_inicio) dataUpdate.fecha_inicio = new Date()
      if (nuevo_estado === 'completado' && !orden.fecha_fin_real) dataUpdate.fecha_fin_real = new Date()
      if (nuevo_estado === 'entregado' && !orden.fecha_entrega) {
        dataUpdate.fecha_entrega = new Date()
        dataUpdate.entregado_por = Number(session.user.id)
      }
    }
    let asignadoPrincipalAhora = false
    if (asignar_trabajador) {
      // Validar trabajador
      const trab = await prisma.trabajador.findUnique({ where: { id_trabajador: Number(asignar_trabajador) }, select: { id_trabajador: true, activo: true } })
      if (!trab || !trab.activo) return NextResponse.json({ error: 'Trabajador no disponible' }, { status: 400 })
      dataUpdate.trabajador_principal = { connect: { id_trabajador: trab.id_trabajador } }
      // Si estaba pendiente y asignamos directamente, pasamos a asignado
      if (orden.estado_orden === 'pendiente' && !nuevo_estado) dataUpdate.estado_orden = 'asignado'
      asignadoPrincipalAhora = true
    }

    // Agregar trabajadores secundarios
    if (Array.isArray(agregar_trabajadores)) {
      for (const tRaw of agregar_trabajadores) {
        const idT = Number(tRaw)
        if (!Number.isFinite(idT)) continue
        try {
          await prisma.transaccionTrabajador.create({ data: { id_transaccion: Number(id_transaccion), id_trabajador: idT, rol: 'apoyo' } })
        } catch (e:any) { if (e.code !== 'P2002') console.warn('Error agregando trabajador apoyo', e) }
      }
    }
    // Remover trabajadores secundarios
    if (Array.isArray(remover_trabajadores)) {
      for (const tRaw of remover_trabajadores) {
        const idT = Number(tRaw)
        if (!Number.isFinite(idT)) continue
        try {
          await prisma.transaccionTrabajador.delete({ where: { id_transaccion_id_trabajador: { id_transaccion: Number(id_transaccion), id_trabajador: idT } } })
        } catch {/* ignorar */}
      }
    }

    const updated: any = await prisma.transaccion.update({
      where: { id_transaccion: Number(id_transaccion) },
      data: dataUpdate,
      include: { persona: true }
    })

    // Si se solicita cambio de vehículo y está pendiente, actualizar el pivot
    if (orden.estado_orden === 'pendiente' && idVehiculoNuevo && Number.isFinite(Number(idVehiculoNuevo))) {
      try {
        const pivots = await prisma.transaccionVehiculo.findMany({ where: { id_transaccion: Number(id_transaccion) } })
        for (const p of pivots) {
          await prisma.transaccionVehiculo.delete({ where: { id_transaccion_id_vehiculo: { id_transaccion: p.id_transaccion, id_vehiculo: p.id_vehiculo } } })
        }
        await prisma.transaccionVehiculo.create({
          data: {
            id_transaccion: Number(id_transaccion),
            id_vehiculo: Number(idVehiculoNuevo),
            id_usuario: Number(session.user.id),
            descripcion: `Cambio de vehículo en edición de orden ${updated.codigo_transaccion}`
          }
        })
      } catch (e) {
        console.warn('No se pudo actualizar el vehículo de la orden', e)
      }
    }

    // Si vienen items para reemplazar y está pendiente: rehacer detalles
    if (orden.estado_orden === 'pendiente' && Array.isArray(itemsPatch) && itemsPatch.length > 0) {
      // Validación básica de estructura y conversión
      const parsedItems = itemsPatch as Array<{ id_producto: any; cantidad: any; precio_unitario: any; descuento?: any; tipo?: 'producto'|'servicio'; servicio_ref?: any }>
      const productoIds = [...new Set(parsedItems.map(i => toInt(i.id_producto as any)!).filter(Boolean))]
      const [productos, servicios] = await Promise.all([
        prisma.producto.findMany({ where: { id_producto: { in: productoIds } } }),
        prisma.servicio.findMany({ where: { id_servicio: { in: productoIds } } })
      ])
      const productosMap = new Map(productos.map(p => [p.id_producto, p]))
      const serviciosMap = new Map(servicios.map(s => [s.id_servicio, s]))

      let subtotal = 0
      let totalMinutosMin = 0
      let totalMinutosMax = 0

      const itemsValidados: Array<{ id_producto?: number; id_servicio?: number; cantidad: number; precio: number; descuento: number; total: number; tipo: 'producto'|'servicio'; servicio_ref?: number; tiempo_servicio?: { minimo: number; maximo: number; unidad: string; minimoMinutos: number; maximoMinutos: number } }> = []

      for (const raw of parsedItems) {
        const id_producto = toInt(raw.id_producto as any)!
        const tipoSolicitado = raw.tipo
        const producto = productosMap.get(id_producto)
        const servicio = serviciosMap.get(id_producto)
        let tipo: 'producto'|'servicio'
        if (tipoSolicitado === 'producto') {
          if (!producto || producto.estatus === false) return NextResponse.json({ error: `Producto con ID ${id_producto} no está disponible` }, { status: 400 })
          tipo = 'producto'
        } else if (tipoSolicitado === 'servicio') {
          if (!servicio || servicio.estatus === false) return NextResponse.json({ error: `Servicio con ID ${id_producto} no está disponible` }, { status: 400 })
          tipo = 'servicio'
        } else if (servicio && servicio.estatus !== false) {
          tipo = 'servicio'
        } else if (producto && producto.estatus !== false) {
          tipo = 'producto'
        } else {
          return NextResponse.json({ error: `Item con ID ${id_producto} no está disponible` }, { status: 400 })
        }
        const cantidad = toInt(raw.cantidad as any)!
        const precio = typeof raw.precio_unitario === 'string' ? parseFloat(raw.precio_unitario) : raw.precio_unitario as number
        const descuento = raw.descuento ? (typeof raw.descuento === 'string' ? parseFloat(raw.descuento) : raw.descuento) : 0
        if (descuento < 0 || descuento > 100) return NextResponse.json({ error: `Descuento inválido para item ${id_producto}` }, { status: 400 })
        if (tipo === 'producto' && producto!.stock < cantidad) return NextResponse.json({ error: `Stock insuficiente para ${producto!.nombre}. Disponible: ${producto!.stock}` }, { status: 400 })
        const totalItem = cantidad * precio * (1 - descuento / 100)
        subtotal += totalItem
        const servicioInfo = serviciosMap.get(id_producto)
        const tiempoServicio = tipo === 'servicio' && servicioInfo ? {
          minimo: servicioInfo.tiempo_minimo,
          maximo: servicioInfo.tiempo_maximo,
          unidad: servicioInfo.unidad_tiempo,
          minimoMinutos: convertirATotalMinutos(servicioInfo.tiempo_minimo, servicioInfo.unidad_tiempo) * cantidad,
          maximoMinutos: convertirATotalMinutos(servicioInfo.tiempo_maximo, servicioInfo.unidad_tiempo) * cantidad
        } : undefined
        if (tiempoServicio) { totalMinutosMin += tiempoServicio.minimoMinutos; totalMinutosMax += tiempoServicio.maximoMinutos }
        itemsValidados.push({ ...(tipo === 'producto' ? { id_producto } : { id_servicio: id_producto }), cantidad, precio, descuento, total: totalItem, tipo, ...(tipo === 'producto' && raw.servicio_ref ? { servicio_ref: toInt(raw.servicio_ref as any) } : {}), ...(tiempoServicio ? { tiempo_servicio: tiempoServicio } : {}) })
      }
      // Validación 0–1 producto por servicio
      const cuentaProductosPorServicio = new Map<number, number>()
      for (const item of itemsValidados.filter(i => i.tipo === 'producto' && i.servicio_ref)) {
        const srvId = item.servicio_ref!
        const count = cuentaProductosPorServicio.get(srvId) || 0
        if (count >= 1) return NextResponse.json({ error: `Cada servicio solo puede tener 0 o 1 producto asociado (servicio ${srvId})` }, { status: 400 })
        cuentaProductosPorServicio.set(srvId, count + 1)
      }

      const impuesto = subtotal * 0.18
      const total = subtotal + impuesto

      await prisma.$transaction(async (tx) => {
        // revertir stock y eliminar tareas + detalles existentes
        const detallesExistentes = await tx.detalleTransaccion.findMany({ where: { id_transaccion: Number(id_transaccion) } })
        const idsExistentes = detallesExistentes.map(d => d.id_detalle_transaccion)
        if (idsExistentes.length) {
          await tx.tarea.deleteMany({ where: { id_detalle_transaccion: { in: idsExistentes } } })
        }
        for (const d of detallesExistentes) {
          if (d.id_producto) {
            await tx.producto.update({ where: { id_producto: d.id_producto }, data: { stock: { increment: d.cantidad } } })
          }
        }
        await tx.detalleTransaccion.deleteMany({ where: { id_transaccion: Number(id_transaccion) } })

        // crear servicios
        const mapaDetalleServicio = new Map<number, number>()
        for (const item of itemsValidados.filter(i => i.tipo === 'servicio')) {
          const detalle = await tx.detalleTransaccion.create({ data: { id_transaccion: Number(id_transaccion), id_servicio: item.id_servicio ?? null, cantidad: item.cantidad, precio: item.precio, descuento: item.descuento, total: item.total } })
          mapaDetalleServicio.set(item.id_servicio!, detalle.id_detalle_transaccion)
          const estimado = item.tiempo_servicio ? item.tiempo_servicio.maximoMinutos : 60
          await tx.tarea.create({ data: { id_detalle_transaccion: detalle.id_detalle_transaccion, id_trabajador: updated.id_trabajador_principal ?? null, estado: 'pendiente', tiempo_estimado: estimado } })
        }
        // crear productos
        for (const item of itemsValidados.filter(i => i.tipo === 'producto')) {
          await tx.detalleTransaccion.create({ data: { id_transaccion: Number(id_transaccion), id_producto: item.id_producto ?? null, cantidad: item.cantidad, precio: item.precio, descuento: item.descuento, total: item.total, id_detalle_servicio_asociado: item.servicio_ref ? mapaDetalleServicio.get(item.servicio_ref) ?? null : null } })
          await tx.producto.update({ where: { id_producto: item.id_producto! }, data: { stock: { decrement: item.cantidad } } })
        }
        // actualizar totales y duración
        await tx.transaccion.update({ where: { id_transaccion: Number(id_transaccion) }, data: { impuesto, total, duracion_min: totalMinutosMin || null, duracion_max: totalMinutosMax || null, unidad_tiempo: (totalMinutosMin > 0 || totalMinutosMax > 0) ? 'minutos' : null } })
      })
    }

    // Si se envía al Kanban (por_hacer), mover tareas existentes a 'por_hacer'
    if (nuevo_estado === 'por_hacer') {
      try {
        const detallesIds = await prisma.detalleTransaccion.findMany({
          where: { id_transaccion: Number(id_transaccion) },
          select: { id_detalle_transaccion: true }
        })
        const ids = detallesIds.map(d => d.id_detalle_transaccion)
        if (ids.length) {
          await prisma.tarea.updateMany({
            where: { id_detalle_transaccion: { in: ids }, estado: 'pendiente' },
            data: { estado: 'por_hacer' }
          })
        }
      } catch (e) { console.warn('No se pudieron actualizar tareas a por_hacer', e) }
    }

    // Generar tareas faltantes si se solicitó o se asignó trabajador principal ahora
    if (generar_tareas_faltantes === true || asignadoPrincipalAhora) {
      try {
        const detallesServicios = await prisma.detalleTransaccion.findMany({
          where: { id_transaccion: Number(id_transaccion) },
          include: { producto: true, servicio: true, tareas: true }
        })
        for (const d of detallesServicios) {
          const esServicio = d.servicio != null || (d.producto && d.producto.tipo === 'servicio')
          if (esServicio && d.tareas.length === 0 && (asignar_trabajador || updated.id_trabajador_principal)) {
            const unidad = d.servicio?.unidad_tiempo || 'minutos'
            const minutosMaximos = d.servicio ? convertirATotalMinutos(d.servicio.tiempo_maximo, unidad) : 60
            const tiempoEstimado = minutosMaximos * d.cantidad
            try {
              await prisma.tarea.create({
                data: {
                  id_detalle_transaccion: d.id_detalle_transaccion,
                  id_trabajador: asignar_trabajador ? Number(asignar_trabajador) : updated.id_trabajador_principal,
                  estado: 'por_hacer',
                  tiempo_estimado: tiempoEstimado
                }
              })
            } catch (e) { console.warn('Error creando tarea faltante', e) }
          }
        }
      } catch (e) { console.warn('No se pudieron generar tareas faltantes', e) }
    }

    // Registrar pago rápido si viene registrar_pago { monto, tipo_pago, numero_operacion, observaciones }
    let pagoRegistrado = null as any
    if (registrar_pago && registrar_pago.monto) {
      try {
        const monto = Number(registrar_pago.monto)
        if (Number.isFinite(monto) && monto > 0) {
          pagoRegistrado = await prisma.$transaction(async (tx) => {
            const pago = await tx.pago.create({
              data: {
                id_transaccion: updated.id_transaccion,
                tipo_pago: registrar_pago.tipo_pago || 'efectivo',
                monto,
                numero_operacion: registrar_pago.numero_operacion || null,
                registrado_por: Number(session.user.id),
                observaciones: registrar_pago.observaciones || null
              }
            })
            // Recalcular suma pagos
            const suma = await tx.pago.aggregate({ _sum: { monto: true }, where: { id_transaccion: updated.id_transaccion } })
            const pagado = Number(suma._sum.monto || 0)
            let estado_pago = 'pendiente'
            if (pagado > 0 && pagado < Number(updated.total)) estado_pago = 'parcial'
            if (pagado >= Number(updated.total)) estado_pago = 'pagado'
            await tx.transaccion.update({ where: { id_transaccion: updated.id_transaccion }, data: { cantidad_pago: pagado, estado_pago } })
            return { pago, pagado, estado_pago }
          })
        }
      } catch (e) { console.warn('Error registrando pago rápido', e) }
    }

    const progreso = await calcularProgresoOrden(updated.id_transaccion)

    await prisma.bitacora.create({
      data: {
        id_usuario: Number(session.user.id),
        accion: 'UPDATE_ORDEN',
        descripcion: `Actualización orden ${updated.codigo_transaccion}: ${JSON.stringify(Object.keys(dataUpdate))}`,
        tabla: 'transaccion'
      }
    })

  return NextResponse.json({ orden: updated, progreso, pago: pagoRegistrado })
  } catch (error) {
    console.error('Error actualizando orden:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}