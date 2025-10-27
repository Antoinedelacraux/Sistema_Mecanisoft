import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const prismaAny = prisma as any

const decimal = (value: number) => new Prisma.Decimal(value.toFixed(2))
const dayMs = 24 * 60 * 60 * 1000
const hourMs = 60 * 60 * 1000

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

async function ensureReportTemplates(adminId: number) {
  const templateDefs = [
    {
      key: 'ventas_mensuales',
      name: 'Ventas Mensuales',
      description: 'Resumen consolidado de ventas y pagos por mes.',
      defaultParams: { rango: 'mensual', incluirImpuestos: true },
      schedule: { cron: '0 7 1 * *', name: 'Ventas Mensuales Demo', recipients: 'reportes@mecanisoft.pe' }
    },
    {
      key: 'ordenes_taller',
      name: 'Órdenes del Taller',
      description: 'Detalle de las órdenes de trabajo y su estado.',
      defaultParams: { estado: 'todas', incluirRepuestos: true },
      schedule: { cron: '30 6 * * 1', name: 'Órdenes del Taller Semanal', recipients: 'operaciones@mecanisoft.pe' }
    },
    {
      key: 'mantenimientos_programados',
      name: 'Mantenimientos Programados',
      description: 'Listado de mantenimientos próximos y en seguimiento.',
      defaultParams: { ventanaDias: 30, incluirHistorial: true },
      schedule: { cron: '15 8 * * 1,4', name: 'Mantenimientos Programados Demo', recipients: 'soporte@mecanisoft.pe' }
    }
  ]

  const now = new Date()
  const templates: Record<string, number> = {}

  for (const def of templateDefs) {
  const template = await prismaAny.reportTemplate.upsert({
      where: { key: def.key },
      update: {
        description: def.description,
        defaultParams: def.defaultParams
      },
      create: {
        key: def.key,
        name: def.name,
        description: def.description,
        defaultParams: def.defaultParams,
        createdById: adminId
      }
    })

    templates[def.key] = template.id

  const existingSchedule = await prismaAny.reportSchedule.findFirst({
      where: { templateId: template.id, name: def.schedule.name }
    })

    if (!existingSchedule) {
  await prismaAny.reportSchedule.create({
        data: {
          templateId: template.id,
          name: def.schedule.name,
          cron: def.schedule.cron,
          recipients: def.schedule.recipients,
          active: true,
          params: def.defaultParams,
          createdById: adminId,
          lastRunAt: new Date(now.getTime() - randomBetween(15, 90) * dayMs),
          nextRunAt: new Date(now.getTime() + randomBetween(3, 10) * dayMs)
        }
      })
    }
  }

  return templates
}

async function seedHistoricalOrders(adminId: number) {
  const trabajadores = await prisma.trabajador.findMany({ where: { eliminado: false }, take: 10 })
  if (trabajadores.length === 0) throw new Error('No hay trabajadores para asignar a las órdenes.')

  const clientes = await prisma.cliente.findMany({
    include: { persona: true, vehiculos: true },
    take: 20
  })
  const clientesConVehiculo = clientes.filter((cliente) => cliente.vehiculos.length > 0)
  if (clientesConVehiculo.length === 0) throw new Error('No existen clientes con vehículos registrados.')

  const servicios = await prisma.servicio.findMany({ where: { estatus: true }, take: 10 })
  if (servicios.length === 0) throw new Error('No existen servicios activos.')

  const productos = await prisma.producto.findMany({ where: { estatus: true }, take: 20 })
  if (productos.length === 0) throw new Error('No existen productos activos.')

  const now = new Date()
  const start = new Date(now.getTime())
  start.setMonth(start.getMonth() - 18)
  start.setDate(5)

  let ordersCreated = 0
  let paymentsCreated = 0
  let maintenanceCreated = 0
  let historiesCreated = 0
  let feedbackCreated = 0

  for (let index = 0; index < 24; index++) {
    const offsetDays = index * 18 + randomBetween(-5, 10)
    let orderDate = new Date(start.getTime() + offsetDays * dayMs)
    if (orderDate > now) {
      orderDate = new Date(now.getTime() - randomBetween(10, 40) * dayMs)
    }

    const code = `OT-HIST-${orderDate.getFullYear()}${String(orderDate.getMonth() + 1).padStart(2, '0')}-${String(index + 1).padStart(3, '0')}`
    const existing = await prisma.transaccion.findUnique({ where: { codigo_transaccion: code } })
    if (existing) continue

    const cliente = randomItem(clientesConVehiculo)
    const vehiculo = randomItem(cliente.vehiculos)
    const servicio = randomItem(servicios)
    const productoPrincipal = randomItem(productos)
    const productoSecundario = Math.random() < 0.45 ? randomItem(productos) : null
    const trabajadorPrincipal = randomItem(trabajadores)

    const servicePrice = parseFloat(servicio.precio_base?.toString() ?? '180')
    const productMainPrice = parseFloat(productoPrincipal.precio_venta?.toString() ?? '95')
    const secondPrice = productoSecundario ? parseFloat(productoSecundario.precio_venta?.toString() ?? '55') : 0

    const subtotal = servicePrice + productMainPrice + secondPrice
    const discountPercent = Math.random() < 0.4 ? Math.random() * 0.1 : 0
    const discount = parseFloat((subtotal * discountPercent).toFixed(2))
    const taxable = subtotal - discount
    const igv = parseFloat((taxable * 0.18).toFixed(2))
    const total = parseFloat((taxable + igv).toFixed(2))

    const isClosed = Math.random() < 0.65
    const estadoOrden = isClosed
      ? Math.random() < 0.5
        ? 'finalizada'
        : 'cerrada'
      : Math.random() < 0.6
        ? 'en_proceso'
        : 'pendiente'
    const prioridad = Math.random() < 0.25 ? 'alta' : Math.random() < 0.55 ? 'media' : 'baja'

    const estimatedFinish = new Date(orderDate.getTime() + (2 + randomBetween(1, 4)) * hourMs)
    const closeDate = isClosed ? new Date(orderDate.getTime() + randomBetween(1, 7) * dayMs) : null

    const pagoEstado = isClosed && Math.random() < 0.8 ? 'pagado' : Math.random() < 0.4 ? 'parcial' : 'pendiente'
    const pagos: Array<{ amount: number; daysAfter: number; method: string }> = []
    let pagoTotal = 0

    if (pagoEstado === 'pagado') {
      const firstPayment = parseFloat((total * (0.4 + Math.random() * 0.2)).toFixed(2))
      const secondPayment = parseFloat((total - firstPayment).toFixed(2))
      pagos.push({ amount: firstPayment, daysAfter: randomBetween(0, 2), method: randomItem(['efectivo', 'tarjeta', 'transferencia']) })
      pagos.push({ amount: secondPayment, daysAfter: randomBetween(2, 5), method: randomItem(['tarjeta', 'transferencia']) })
      pagoTotal = parseFloat((firstPayment + secondPayment).toFixed(2))
    } else if (pagoEstado === 'parcial') {
      const partial = parseFloat((total * 0.45).toFixed(2))
      pagos.push({ amount: partial, daysAfter: randomBetween(1, 3), method: randomItem(['efectivo', 'transferencia']) })
      pagoTotal = partial
    } else if (Math.random() < 0.25) {
      const reserva = parseFloat((total * 0.2).toFixed(2))
      pagos.push({ amount: reserva, daysAfter: 0, method: 'efectivo' })
      pagoTotal = reserva
    }

    const historialFechas: Array<{ oldStatus: string | null; newStatus: string; at: Date; note: string }> = [
      { oldStatus: null, newStatus: 'creada', at: orderDate, note: 'Orden creada automáticamente desde el seed histórico.' }
    ]

    historialFechas.push({
      oldStatus: 'creada',
      newStatus: 'en_proceso',
      at: new Date(orderDate.getTime() + 2 * hourMs),
      note: 'Diagnóstico inicial completado.'
    })

    historialFechas.push({
      oldStatus: 'en_proceso',
      newStatus: estadoOrden,
      at: closeDate ?? new Date(orderDate.getTime() + 5 * hourMs),
      note: closeDate ? 'Orden cerrada con entrega al cliente.' : 'Orden permanece abierta para seguimiento.'
    })

    const extraTrabajadoresPool = trabajadores.filter((t) => t.id_trabajador !== trabajadorPrincipal.id_trabajador)
    const extraTrabajadores = extraTrabajadoresPool.sort(() => Math.random() - 0.5).slice(0, Math.random() < 0.6 ? 2 : 1)

    let feedbackRegistered = false

    try {
      await prisma.$transaction(async (tx) => {
        const transaccion = await tx.transaccion.create({
          data: {
            id_persona: cliente.persona.id_persona,
            id_usuario: adminId,
            id_trabajador_principal: trabajadorPrincipal.id_trabajador,
            tipo_transaccion: 'orden',
            tipo_comprobante: 'OT',
            codigo_transaccion: code,
            fecha: orderDate,
            created_at: orderDate,
            descuento: decimal(discount),
            impuesto: decimal(igv),
            porcentaje: decimal(discountPercent * 100),
            total: decimal(total),
            cantidad_pago: decimal(pagoTotal),
            observaciones: 'Registro histórico generado para enriquecer reportes.',
            estatus: 'activo',
            estado_orden: estadoOrden,
            prioridad,
            entregado_por: adminId,
            estado_pago: pagoEstado,
            fecha_entrega: closeDate ?? undefined,
            fecha_fin_estimada: estimatedFinish,
            fecha_fin_real: closeDate ?? undefined,
            fecha_inicio: orderDate,
            fecha_cierre: closeDate ?? undefined,
            duracion_max: randomBetween(180, 420),
            duracion_min: randomBetween(90, 180),
            unidad_tiempo: 'minutos'
          }
        })

        await tx.transaccionVehiculo.create({
          data: {
            id_transaccion: transaccion.id_transaccion,
            id_vehiculo: vehiculo.id_vehiculo,
            id_usuario: adminId,
            nivel_combustible: randomItem(['1/4', '1/2', '3/4', 'lleno']),
            kilometraje_millas: 25000 + randomBetween(1000, 18000),
            descripcion: 'Ingreso registrado por el seed histórico.'
          }
        })

        const servicioDetalle = await tx.detalleTransaccion.create({
          data: {
            id_transaccion: transaccion.id_transaccion,
            id_servicio: servicio.id_servicio,
            cantidad: 1,
            precio: decimal(servicePrice),
            total: decimal(servicePrice),
            descuento: decimal(0)
          }
        })

        await tx.detalleTransaccion.create({
          data: {
            id_transaccion: transaccion.id_transaccion,
            id_producto: productoPrincipal.id_producto,
            cantidad: 1,
            precio: decimal(productMainPrice),
            total: decimal(productMainPrice),
            descuento: decimal(0),
            id_detalle_servicio_asociado: servicioDetalle.id_detalle_transaccion
          }
        })

        if (productoSecundario) {
          await tx.detalleTransaccion.create({
            data: {
              id_transaccion: transaccion.id_transaccion,
              id_producto: productoSecundario.id_producto,
              cantidad: 1,
              precio: decimal(secondPrice),
              total: decimal(secondPrice),
              descuento: decimal(0)
            }
          })
        }

        await tx.tarea.create({
          data: {
            id_detalle_transaccion: servicioDetalle.id_detalle_transaccion,
            estado: isClosed ? 'finalizada' : 'en_proceso',
            fecha_inicio: orderDate,
            fecha_fin: closeDate ?? undefined,
            tiempo_estimado: randomBetween(90, 180),
            tiempo_real: closeDate ? randomBetween(110, 220) : null,
            id_trabajador: trabajadorPrincipal.id_trabajador,
            notas_trabajador: 'Seguimiento automático agregado por el script histórico.'
          }
        })

        for (const trabajador of extraTrabajadores) {
          await tx.transaccionTrabajador.create({
            data: {
              id_transaccion: transaccion.id_transaccion,
              id_trabajador: trabajador.id_trabajador,
              rol: randomItem(['Apoyo', 'Especialista', 'Supervisor'])
            }
          })
        }

        for (const pago of pagos) {
          await tx.pago.create({
            data: {
              id_transaccion: transaccion.id_transaccion,
              tipo_pago: pago.method,
              monto: decimal(pago.amount),
              fecha_pago: new Date(orderDate.getTime() + pago.daysAfter * dayMs),
              registrado_por: adminId,
              observaciones: 'Pago histórico generado para alimentar reportes.'
            }
          })
        }

        for (const historial of historialFechas) {
          await tx.ordenHistorial.create({
            data: {
              orden_id: transaccion.id_transaccion,
              old_status: historial.oldStatus ?? undefined,
              new_status: historial.newStatus,
              nota: historial.note,
              changed_by: adminId,
              created_at: historial.at
            }
          })
        }

        await tx.mantenimiento.upsert({
          where: { codigo: `MT-${code}` },
          update: {
            estado: isClosed ? 'completado' : 'en_proceso',
            prioridad,
            fecha_realizada: closeDate ?? undefined,
            descripcion: 'Seguimiento del plan de mantenimiento histórico.'
          },
          create: {
            codigo: `MT-${code}`.slice(0, 45),
            id_vehiculo: vehiculo.id_vehiculo,
            id_cliente: cliente.id_cliente,
            id_transaccion: transaccion.id_transaccion,
            titulo: `Mantenimiento ${servicio.nombre}`.slice(0, 140),
            descripcion: 'Plan generado para dar contexto histórico a los dashboards.',
            estado: isClosed ? 'completado' : 'en_proceso',
            prioridad,
            fecha_programada: orderDate,
            fecha_inicio: orderDate,
            fecha_realizada: closeDate ?? undefined
          }
        })

        if (isClosed && Math.random() < 0.55) {
          await tx.feedback.create({
            data: {
              orden_id: transaccion.id_transaccion,
              score: randomBetween(3, 5),
              comentario: randomItem([
                'Excelente atención y seguimiento.',
                'El cliente resaltó la rapidez del servicio.',
                'Se completó el trabajo sin observaciones adicionales.',
                'Se registró satisfacción general con el resultado.'
              ]),
              creado_en: closeDate ?? new Date()
            }
          })
          feedbackRegistered = true
        }
      })

      ordersCreated += 1
      paymentsCreated += pagos.length
      maintenanceCreated += 1
      historiesCreated += historialFechas.length
      if (feedbackRegistered) {
        feedbackCreated += 1
      }
    } catch (error) {
      console.error(`⚠️  No se pudo registrar la orden ${code}:`, error)
    }
  }

  return { ordersCreated, paymentsCreated, maintenanceCreated, historiesCreated, feedbackCreated }
}

async function seedReportArtifacts(adminId: number, templatesMap: Record<string, number>) {
  const templateKeys = Object.keys(templatesMap)
  if (templateKeys.length === 0) return { files: 0, audits: 0 }

  const now = new Date()
  let filesCreated = 0
  let auditsCreated = 0

  for (let monthOffset = 0; monthOffset < 12; monthOffset++) {
    const date = new Date(now.getFullYear(), now.getMonth() - monthOffset, randomBetween(10, 25))
    const templateKey = templateKeys[monthOffset % templateKeys.length]
    const filename = `${templateKey}-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}.pdf`

  const existingFile = await prismaAny.reportFile.findFirst({ where: { filename } })
    if (existingFile) continue

  await prismaAny.reportFile.create({
      data: {
        templateKey,
        path: `/exports/${filename}`,
        filename,
        mime: 'application/pdf',
        size: randomBetween(150_000, 380_000),
        createdAt: date,
        createdBy: adminId
      }
    })
    filesCreated += 1

  await prismaAny.reportAudit.create({
      data: {
        usuarioId: adminId,
        action: 'GENERATED',
        templateKey,
        params: { periodo: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` },
        ip: '127.0.0.1',
        userAgent: 'seed-historical-activity',
        createdAt: new Date(date.getTime() + 15 * 60 * 1000)
      }
    })
    auditsCreated += 1
  }

  return { filesCreated, auditsCreated }
}

async function main() {
  console.log('📊 Generando actividad histórica para alimentar reportes...')

  const adminUser = await prisma.usuario.findFirst({
    where: { estado: true },
    orderBy: { id_usuario: 'asc' }
  })

  if (!adminUser) {
    throw new Error('No se encontró un usuario activo para asociar la data histórica.')
  }

  const templatesMap = await ensureReportTemplates(adminUser.id_usuario)
  const { ordersCreated, paymentsCreated, maintenanceCreated, historiesCreated, feedbackCreated } = await seedHistoricalOrders(adminUser.id_usuario)
  const { filesCreated, auditsCreated } = await seedReportArtifacts(adminUser.id_usuario, templatesMap)

  console.log('✅ Actividad histórica generada exitosamente:')
  console.log(`   • Órdenes creadas: ${ordersCreated}`)
  console.log(`   • Pagos registrados: ${paymentsCreated}`)
  console.log(`   • Mantenimientos generados: ${maintenanceCreated}`)
  console.log(`   • Movimientos de historial agregados: ${historiesCreated}`)
  console.log(`   • Retroalimentaciones registradas: ${feedbackCreated}`)
  console.log(`   • Archivos de reporte generados: ${filesCreated}`)
  console.log(`   • Auditorías de reportes: ${auditsCreated}`)
}

main()
  .catch((error) => {
    console.error('❌ Error generando datos históricos:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
