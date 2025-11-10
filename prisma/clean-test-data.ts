import { prisma } from '../src/lib/prisma'

async function main() {
  // Permisos y seguridad
  await prisma.usuarioPermiso.deleteMany({})
  await prisma.rolPermiso.deleteMany({})
  await prisma.permiso.deleteMany({})
  await prisma.correlativoCodigo.deleteMany({})

  // Inventario
  await prisma.reservaInventario.deleteMany({})
  await prisma.bitacoraInventario.deleteMany({})
  await prisma.movimientoTransferencia.deleteMany({})
  await prisma.movimientoInventario.deleteMany({})
  await prisma.inventarioProducto.deleteMany({})
  await prisma.almacenUbicacion.deleteMany({})
  await prisma.almacen.deleteMany({})

  // Eliminar tareas
  await prisma.tarea.deleteMany({})

  // Eliminar detalles de transacción y cotización
  await prisma.detalleTransaccion.deleteMany({})
  await prisma.detalleCotizacion.deleteMany({})

  // Eliminar cotizaciones
  await prisma.cotizacion.deleteMany({})

  // Eliminar relaciones de transacciones tipo 'orden'
  await prisma.transaccionVehiculo.deleteMany({
    where: { transaccion: { tipo_transaccion: 'orden' } }
  })
  await prisma.transaccionTrabajador.deleteMany({
    where: { transaccion: { tipo_transaccion: 'orden' } }
  })

  // Eliminar transacciones tipo 'orden'
  await prisma.transaccion.deleteMany({
    where: { tipo_transaccion: 'orden' }
  })

  console.log('Registros de cotizaciones, órdenes de trabajo y tareas eliminados.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
