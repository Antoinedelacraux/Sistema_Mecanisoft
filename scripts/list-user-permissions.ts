import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const username = process.argv[2]
  if (!username) {
    console.error('Usage: tsx scripts/list-user-permissions.ts <nombre_usuario>')
    process.exit(1)
  }

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { nombre_usuario: username },
      include: { rol: true }
    })
    if (!usuario) {
      console.log('Usuario no encontrado')
      process.exit(0)
    }

    const rolId = usuario.id_rol

    // permisos del rol
    const rolPermisos = await prisma.rolPermiso.findMany({
      where: { id_rol: rolId },
      include: { permiso: true }
    })

    const permisosRol = rolPermisos.map(rp => rp.permiso.codigo)

    // permisos asignados directamente al usuario (si existe la tabla usuarioPermiso)
    let permisosUsuario: string[] = []
    try {
      const up = await (prisma as any).usuarioPermiso.findMany({
        where: { id_usuario: usuario.id_usuario },
        include: { permiso: true }
      })
      permisosUsuario = up.map((u: any) => u.permiso.codigo)
    } catch (e) {
      // tabla no existe o no usada
    }

    const all = Array.from(new Set([...permisosRol, ...permisosUsuario]))
    console.log(`Permisos efectivos para ${username}:`, all)
  } catch (error) {
    console.error('Error comprobando permisos:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
