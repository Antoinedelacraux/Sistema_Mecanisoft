import { prisma } from '../src/lib/prisma'

async function main() {
  // 1) Upsert permiso
  const permisoCodigo = 'ventas.conciliar'
  const permisoNombre = 'Conciliar ventas'

  const permiso = await prisma.permiso.upsert({
    where: { codigo: permisoCodigo },
    update: { nombre: permisoNombre, modulo: 'ventas', activo: true },
    create: { codigo: permisoCodigo, nombre: permisoNombre, modulo: 'ventas', activo: true }
  })

  console.log('Permiso asegurado:', permiso.codigo)

  // 2) Encontrar roles candidatos
  const roles = await prisma.rol.findMany({ where: { nombre_rol: { in: ['Administrador', 'Cajero', 'Recepcionista', 'Facturacion'] } } })
  if (roles.length === 0) {
    console.log('No se encontraron roles candidatos automáticamente. Revisa la tabla rol y asigna manualmente.')
    return
  }

  for (const rol of roles) {
    try {
      await prisma.rolPermiso.create({ data: { id_rol: rol.id_rol, id_permiso: permiso.id_permiso } })
      console.log(`Permiso asignado a rol: ${rol.nombre_rol}`)
    } catch (e) {
      // ignorar duplicados
      console.log(`Rol ${rol.nombre_rol} ya tenía permiso o fallo al asignar`) 
    }
  }

  // 3) opcional: asignar a usuario admin si existe
  const adminUser = await prisma.usuario.findFirst({ where: { nombre_usuario: 'admin' } })
  if (adminUser) {
    try {
      await prisma.usuarioPermiso.create({ data: { id_usuario: adminUser.id_usuario, id_permiso: permiso.id_permiso, concedido: true, origen: 'EXTRA' } })
      console.log('Permiso asignado al usuario admin')
    } catch (e) {
      console.log('Usuario admin ya tenía permiso o fallo al asignar')
    }
  }

  console.log('Proceso finalizado')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
