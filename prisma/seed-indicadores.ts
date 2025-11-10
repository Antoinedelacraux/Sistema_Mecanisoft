import { addDays, addHours, subDays } from 'date-fns'
import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const randomItem = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const randomBool = (prob = 0.5) => Math.random() < prob

async function ensureBaseCatalogs() {
  const categoria = await prisma.categoria.findFirst()
  const unidad = await prisma.unidadMedida.findFirst()
  const fabricante = await prisma.fabricante.findFirst()
  const almacen = await prisma.almacen.findFirst()
  const ubicacion = await prisma.almacenUbicacion.findFirst({ where: { id_almacen: almacen?.id_almacen } })
  const modelos = await prisma.modelo.findMany({ take: 20 })
  const admin = await prisma.usuario.findFirst({ where: { nombre_usuario: 'admin' } })

  if (!categoria || !unidad || !fabricante || !almacen || !modelos.length || !admin) {
    throw new Error('Faltan catálogos base para ejecutar el seed de indicadores. Ejecuta prisma/seed.ts primero.')
  }

  return { categoria, unidad, fabricante, almacen, ubicacion, modelos, admin }
}

async function cleanupSamples() {
  // Eliminar datos previamente generados por este script (identificados por prefijos IND)
  await prisma.feedback.deleteMany({ where: { orden: { codigo_transaccion: { startsWith: 'ORD-IND-' } } } })
  await prisma.ordenHistorial.deleteMany({ where: { orden: { codigo_transaccion: { startsWith: 'ORD-IND-' } } } })
  await prisma.mantenimientoHistorial.deleteMany({ where: { mantenimiento: { codigo: { startsWith: 'MNT-IND-' } } } })
  await prisma.mantenimiento.deleteMany({ where: { codigo: { startsWith: 'MNT-IND-' } } })
  await prisma.tarea.deleteMany({ where: { detalle_transaccion: { transaccion: { codigo_transaccion: { startsWith: 'ORD-IND-' } } } } })
  await prisma.detalleTransaccion.deleteMany({ where: { transaccion: { codigo_transaccion: { startsWith: 'ORD-IND-' } } } })
  await prisma.transaccionVehiculo.deleteMany({ where: { transaccion: { codigo_transaccion: { startsWith: 'ORD-IND-' } } } })
  await prisma.transaccionTrabajador.deleteMany({ where: { transaccion: { codigo_transaccion: { startsWith: 'ORD-IND-' } } } })
  await prisma.transaccion.deleteMany({ where: { codigo_transaccion: { startsWith: 'ORD-IND-' } } })
  await prisma.inventarioProducto.deleteMany({ where: { producto: { codigo_producto: { startsWith: 'PRD-IND-' } } } })
  await prisma.producto.deleteMany({ where: { codigo_producto: { startsWith: 'PRD-IND-' } } })
  await prisma.trabajador.deleteMany({ where: { codigo_empleado: { startsWith: 'TEC-IND-' } } })
  await prisma.vehiculo.deleteMany({ where: { placa: { startsWith: 'IND-' } } })
  await prisma.cliente.deleteMany({ where: { persona: { numero_documento: { startsWith: 'IND-CLI-' } } } })
  await prisma.persona.deleteMany({ where: { numero_documento: { startsWith: 'IND-' } } })
}

async function seedTechnicians() {
  const technicians = [] as { id_trabajador: number }[]
  for (let i = 1; i <= 6; i += 1) {
    const persona = await prisma.persona.create({
      data: {
        nombre: `Tecnico ${i}`,
        apellido_paterno: 'Indicadores',
        apellido_materno: `Seed${i}`,
        tipo_documento: 'DNI',
        numero_documento: `IND-TEC-${i.toString().padStart(4, '0')}`,
        sexo: randomBool() ? 'M' : 'F',
        telefono: `900000${i}`,
        correo: `tec${i}@indicadores.dev`
      }
    })

    const trabajador = await prisma.trabajador.create({
      data: {
        id_persona: persona.id_persona,
        codigo_empleado: `TEC-IND-${i.toString().padStart(3, '0')}`,
        cargo: randomBool() ? 'Técnico Senior' : 'Técnico Junior',
        especialidad: randomBool() ? 'Motor' : 'Frenos',
        nivel_experiencia: randomBool() ? 'Senior' : 'Junior',
        tarifa_hora: new Prisma.Decimal(randomInt(40, 80)),
        activo: true
      }
    })

    technicians.push(trabajador)
  }
  return technicians
}

async function seedClients(modelos: { id_modelo: number }[]) {
  const clients: {
    clienteId: number
    personaId: number
    vehiculoId: number
  }[] = []

  for (let i = 1; i <= 12; i += 1) {
    const persona = await prisma.persona.create({
      data: {
        nombre: `Cliente ${i}`,
        apellido_paterno: 'Indicadores',
        apellido_materno: `Demo${i}`,
        tipo_documento: 'DNI',
        numero_documento: `IND-CLI-${i.toString().padStart(4, '0')}`,
        telefono: `91000${i.toString().padStart(3, '0')}`,
        correo: `cliente${i}@indicadores.dev`
      }
    })

    const cliente = await prisma.cliente.create({
      data: {
        id_persona: persona.id_persona
      }
    })

    const vehiculo = await prisma.vehiculo.create({
      data: {
        id_cliente: cliente.id_cliente,
        id_modelo: randomItem(modelos).id_modelo,
        placa: `IND-${i.toString().padStart(3, '0')}`,
        tipo: randomBool() ? 'Automóvil' : 'Camioneta',
        año: 2015 + (i % 10),
        tipo_combustible: randomBool() ? 'Gasolina' : 'Diesel',
        transmision: randomBool() ? 'Manual' : 'Automática',
        estado: true
      }
    })

    clients.push({ clienteId: cliente.id_cliente, personaId: persona.id_persona, vehiculoId: vehiculo.id_vehiculo })
  }

  return clients
}

async function seedProducts(base: { categoria: { id_categoria: number }; unidad: { id_unidad: number }; fabricante: { id_fabricante: number }; almacen: { id_almacen: number }; ubicacion: { id_almacen_ubicacion: number | null } }) {
  const produtos = [] as { id_producto: number }[]
  for (let i = 1; i <= 8; i += 1) {
    const producto = await prisma.producto.create({
      data: {
        id_categoria: base.categoria.id_categoria,
        id_fabricante: base.fabricante.id_fabricante,
        id_unidad: base.unidad.id_unidad,
        tipo: 'producto',
        codigo_producto: `PRD-IND-${i.toString().padStart(3, '0')}`,
        nombre: `Repuesto Indicador ${i}`,
        descripcion: 'Repuesto creado para dataset de indicadores',
        stock: 0,
        stock_minimo: 5,
        precio_compra: new Prisma.Decimal(randomInt(50, 200)),
        precio_venta: new Prisma.Decimal(randomInt(120, 350))
      }
    })

    await prisma.inventarioProducto.create({
      data: {
        id_producto: producto.id_producto,
        id_almacen: base.almacen.id_almacen,
        id_almacen_ubicacion: base.ubicacion?.id_almacen_ubicacion ?? null,
        stock_disponible: new Prisma.Decimal(randomInt(0, 15)),
        stock_comprometido: new Prisma.Decimal(randomInt(0, 4)),
        stock_minimo: new Prisma.Decimal(5),
        costo_promedio: producto.precio_compra,
        es_critico: i <= 4
      }
    })

    produtos.push(producto)
  }
  return produtos
}

async function seedOrders(options: {
  adminId: number
  clients: { clienteId: number; personaId: number; vehiculoId: number }[]
  technicians: { id_trabajador: number }[]
  productos: { id_producto: number }[]
}) {
  const states = ['pendiente', 'por_hacer', 'en_proceso', 'pausado', 'completado'] as const
  const priorities = ['baja', 'media', 'alta', 'urgente'] as const
  const orders: { id_transaccion: number; codigo_transaccion: string; vehiculoId: number; personaId: number; estado: string }[] = []

  for (let i = 1; i <= 24; i += 1) {
    const client = randomItem(options.clients)
    const tecnico = randomItem(options.technicians)
    const estado = randomItem(states)
    const prioridad = randomItem(priorities)
    const fechaOrden = subDays(new Date(), randomInt(0, 45))
    const duracionHoras = randomInt(4, 48)
    const fechaEstimada = addHours(fechaOrden, duracionHoras)
    const fueCompletada = estado === 'completado'
    const fechaFinReal = fueCompletada ? addHours(fechaOrden, duracionHoras + randomInt(-4, 6)) : null

    const transaccion = await prisma.transaccion.create({
      data: {
        id_persona: client.personaId,
        id_usuario: options.adminId,
        id_trabajador_principal: tecnico.id_trabajador,
        tipo_transaccion: 'orden',
        tipo_comprobante: 'orden_trabajo',
        codigo_transaccion: `ORD-IND-${i.toString().padStart(4, '0')}`,
        fecha: fechaOrden,
        descuento: new Prisma.Decimal(0),
        impuesto: new Prisma.Decimal(0),
        porcentaje: new Prisma.Decimal(0),
        total: new Prisma.Decimal(randomInt(500, 4500)),
        cantidad_pago: new Prisma.Decimal(0),
        estado_orden: estado,
        prioridad,
        fecha_fin_estimada: fechaEstimada,
        fecha_fin_real: fechaFinReal,
        fecha_cierre: fechaFinReal,
        estado_pago: fueCompletada && randomBool(0.3) ? 'pagado' : 'pendiente'
      }
    })

    orders.push({
      id_transaccion: transaccion.id_transaccion,
      codigo_transaccion: transaccion.codigo_transaccion,
      vehiculoId: client.vehiculoId,
      personaId: client.personaId,
      estado
    })

    await prisma.transaccionVehiculo.create({
      data: {
        id_transaccion: transaccion.id_transaccion,
        id_vehiculo: client.vehiculoId,
        id_usuario: options.adminId,
        descripcion: `Orden de trabajo demo ${transaccion.codigo_transaccion}`
      }
    })

    await prisma.transaccionTrabajador.create({
      data: {
        id_transaccion: transaccion.id_transaccion,
        id_trabajador: tecnico.id_trabajador,
        rol: 'principal'
      }
    }).catch(() => undefined)

    const detalles = randomInt(1, 3)
    for (let j = 0; j < detalles; j += 1) {
      const producto = randomItem(options.productos)
      const horasTrabajo = randomInt(1, 6)
      const fechaInicio = addHours(fechaOrden, randomInt(0, duracionHoras))
      const fechaFin = addHours(fechaInicio, horasTrabajo)

      const detalle = await prisma.detalleTransaccion.create({
        data: {
          id_transaccion: transaccion.id_transaccion,
          id_producto: producto.id_producto,
          cantidad: randomInt(1, 3),
          precio: new Prisma.Decimal(randomInt(150, 480)),
          descuento: new Prisma.Decimal(0),
          total: new Prisma.Decimal(randomInt(150, 680))
        }
      })

      await prisma.tarea.create({
        data: {
          id_detalle_transaccion: detalle.id_detalle_transaccion,
          id_trabajador: tecnico.id_trabajador,
          estado: fueCompletada ? 'completado' : randomBool() ? 'en_proceso' : 'pendiente',
          fecha_inicio: fechaInicio,
          fecha_fin: fueCompletada ? fechaFin : null,
          tiempo_estimado: horasTrabajo * 60,
          tiempo_real: fueCompletada ? horasTrabajo * 60 + randomInt(-30, 60) : null
        }
      })
    }

    await prisma.ordenHistorial.create({
      data: {
        orden_id: transaccion.id_transaccion,
        new_status: estado,
        nota: 'Estado generado por seed de indicadores'
      }
    })

    if (estado === 'completado') {
      await prisma.feedback.create({
        data: {
          orden_id: transaccion.id_transaccion,
          score: randomInt(3, 5),
          comentario: randomBool(0.6) ? 'Servicio satisfactorio según dataset demo.' : null
        }
      })
    }
  }

  return orders
}

async function seedMaintenances(options: {
  orders: { id_transaccion: number; codigo_transaccion: string; vehiculoId: number; personaId: number; estado: string }[]
  clients: { clienteId: number; personaId: number; vehiculoId: number }[]
  adminId: number
}) {
  const estados = ['planificado', 'en_proceso', 'completado', 'cancelado'] as const
  const availableOrders = [...options.orders]

  for (let i = 1; i <= 36; i += 1) {
    const client = randomItem(options.clients)
    let order: (typeof options.orders)[number] | null = null
    if (availableOrders.length > 0 && randomBool(0.5)) {
      const orderIndex = randomInt(0, availableOrders.length - 1)
      order = availableOrders.splice(orderIndex, 1)[0]
    }
    const estado = order ? 'completado' : randomItem(estados)
    const diasOffset = randomInt(-30, 30)
    const fechaProgramada = addDays(new Date(), diasOffset)
    const fechaInicio = randomBool(0.7) ? addHours(fechaProgramada, randomInt(-4, 4)) : null
    const fechaRealizada = estado === 'completado' ? addHours(fechaProgramada, randomInt(-2, 6)) : null

    const mantenimiento = await prisma.mantenimiento.create({
      data: {
        codigo: `MNT-IND-${i.toString().padStart(4, '0')}`,
        id_vehiculo: client.vehiculoId,
        id_cliente: client.clienteId,
        id_transaccion: order ? order.id_transaccion : null,
        titulo: 'Mantenimiento preventivo demo',
        descripcion: 'Registro generado para pruebas de indicadores',
        estado,
        prioridad: randomBool() ? 'alta' : 'media',
        fecha_programada: fechaProgramada,
        fecha_inicio: fechaInicio,
        fecha_realizada: fechaRealizada,
        motivo_cancelacion: estado === 'cancelado' ? 'Cancelado por el cliente (dataset demo).' : null
      }
    })

    if (randomBool(0.4)) {
      const newDate = addDays(mantenimiento.fecha_programada, randomInt(1, 5))
      await prisma.mantenimientoHistorial.create({
        data: {
          mantenimiento_id: mantenimiento.id_mantenimiento,
          old_fecha: mantenimiento.fecha_programada,
          new_fecha: newDate,
          reason: 'Reprogramación automática del dataset',
          changed_by: options.adminId
        }
      })

      await prisma.mantenimiento.update({
        where: { id_mantenimiento: mantenimiento.id_mantenimiento },
        data: { fecha_programada: newDate }
      })
    }
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('No ejecutar prisma/seed-indicadores.ts en entornos de producción.')
  }

  const base = await ensureBaseCatalogs()
  await cleanupSamples()
  console.log('🧹 Datos previos del dataset de indicadores eliminados')

  const technicians = await seedTechnicians()
  console.log(`👷 Técnicos creados: ${technicians.length}`)

  const clients = await seedClients(base.modelos)
  console.log(`👥 Clientes y vehículos creados: ${clients.length}`)

  const productos = await seedProducts({
    categoria: base.categoria,
    unidad: base.unidad,
    fabricante: base.fabricante,
    almacen: base.almacen,
    ubicacion: base.ubicacion ?? (await prisma.almacenUbicacion.findFirst({ where: { id_almacen: base.almacen.id_almacen } })) ?? null
  })
  console.log(`🧩 Productos demo creados: ${productos.length}`)

  const orders = await seedOrders({
    adminId: base.admin.id_usuario,
    clients,
    technicians,
    productos
  })
  console.log(`📄 Órdenes demo generadas: ${orders.length}`)

  await seedMaintenances({ orders, clients, adminId: base.admin.id_usuario })
  console.log('🛠️ Mantenimientos demo generados')

  console.log('✅ Dataset de indicadores listo. Registros generados:')
  const [mantenimientos, ordenes, tareas, feedback] = await Promise.all([
    prisma.mantenimiento.count({ where: { codigo: { startsWith: 'MNT-IND-' } } }),
    prisma.transaccion.count({ where: { codigo_transaccion: { startsWith: 'ORD-IND-' } } }),
    prisma.tarea.count({ where: { detalle_transaccion: { transaccion: { codigo_transaccion: { startsWith: 'ORD-IND-' } } } } }),
    prisma.feedback.count({ where: { orden: { codigo_transaccion: { startsWith: 'ORD-IND-' } } } })
  ])

  console.table({ mantenimientos, ordenes, tareas, feedback })
}

main()
  .catch((error) => {
    console.error('❌ Error ejecutando seed de indicadores', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
