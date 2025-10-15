import { prisma } from '../src/lib/prisma'

async function main() {
  console.log('Leyendo permisos y roles desde la base de datos...')

  const permisos = await prisma.permiso.findMany({ select: { id_permiso: true, codigo: true } })
  const roles = await prisma.rol.findMany({ select: { id_rol: true, nombre_rol: true } })

  if (permisos.length === 0) {
    console.log('No hay permisos en la base de datos. Ejecuta los scripts de creación de permisos primero.')
    return
  }

  if (roles.length === 0) {
    console.log('No hay roles en la base de datos. Crea roles antes de ejecutar este script.')
    return
  }

  console.log(`Asignando ${permisos.length} permisos a ${roles.length} roles (skipDuplicates)...`)

  const data = [] as { id_rol: number; id_permiso: number }[]

  for (const permiso of permisos) {
    for (const rol of roles) {
      data.push({ id_rol: rol.id_rol, id_permiso: permiso.id_permiso })
    }
  }

  // createMany with skipDuplicates to avoid unique constraint failures
  await prisma.rolPermiso.createMany({ data, skipDuplicates: true })

  console.log('Permisos asignados a roles correctamente.')

  // Opcional: asignar todos los permisos al usuario admin (si existe)
  const admin = await prisma.usuario.findFirst({ where: { nombre_usuario: 'admin' } })
  if (admin) {
    console.log('Asignando permisos al usuario admin...')
    const usuarioPermisosData = permisos.map((p) => ({ id_usuario: admin.id_usuario, id_permiso: p.id_permiso, concedido: true, origen: 'EXTRA' }))
    // Use createMany skipDuplicates if composite primary key prevents duplicates
    try {
      await prisma.usuarioPermiso.createMany({ data: usuarioPermisosData, skipDuplicates: true })
      console.log('Permisos asignados al usuario admin.')
    } catch (e) {
      console.warn('Fallo al asignar permisos a admin (probablemente ya asignados):', e)
    }
  } else {
    console.log('No se encontró usuario admin; omitiendo asignación a usuario.')
  }
}

main()
  .catch((e) => {
    console.error('Error asignando permisos a roles:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
