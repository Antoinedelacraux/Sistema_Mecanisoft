import { prisma } from '../src/lib/prisma'

async function main() {
  const codigo = 'ventas.conciliar'

  const permiso = await prisma.permiso.findUnique({ where: { codigo } })
  console.log('PERMISO:')
  console.log(JSON.stringify(permiso, null, 2))

  if (!permiso) {
    console.log('Permiso no encontrado, nada más que mostrar.')
    return
  }

  // Buscar asignaciones en la tabla intermedia RolPermiso y traer los roles
  const rolPermisos = await prisma.rolPermiso.findMany({
    where: { id_permiso: permiso.id_permiso },
    include: { rol: { select: { id_rol: true, nombre_rol: true } } }
  })
  const roles = rolPermisos.map(rp => rp.rol)
  console.log('\nROLES CON EL PERMISO:')
  console.log(JSON.stringify(roles, null, 2))

  // Buscar asignaciones en la tabla intermedia UsuarioPermiso y traer los usuarios
  const usuarioPermisos = await prisma.usuarioPermiso.findMany({
    where: { id_permiso: permiso.id_permiso },
    include: { usuario: { select: { id_usuario: true, nombre_usuario: true, estado: true } } }
  })
  const usuarios = usuarioPermisos.map(up => up.usuario)
  console.log('\nUSUARIOS CON EL PERMISO:')
  console.log(JSON.stringify(usuarios, null, 2))

}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
