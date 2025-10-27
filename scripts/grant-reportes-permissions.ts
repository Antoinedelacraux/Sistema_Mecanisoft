import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const moduloReportes = await prisma.modulo.upsert({
    where: { clave: 'reportes' },
    update: { nombre: 'Reportes', descripcion: 'Reportes analíticos y descargas', activo: true },
    create: { clave: 'reportes', nombre: 'Reportes', descripcion: 'Reportes analíticos y descargas', activo: true },
  })

  const adminRole = await prisma.rol.findFirst({ where: { nombre_rol: 'Administrador' } })
  if (!adminRole) {
    console.warn('No se encontró el rol Administrador; crea el seed principal antes de ejecutar este script.')
    return
  }

  const perms = [
    {
      codigo: 'reportes.ver',
      nombre: 'Ver reportes',
      modulo: moduloReportes.clave,
      descripcion: 'Permite ver el módulo de reportes',
      agrupador: 'analitica',
    },
    {
      codigo: 'reportes.gestionar',
      nombre: 'Gestionar reportes',
      modulo: moduloReportes.clave,
      descripcion: 'Crear/editar/Eliminar plantillas y schedules',
      agrupador: 'analitica',
    },
    {
      codigo: 'reportes.descargar',
      nombre: 'Descargar reportes',
      modulo: moduloReportes.clave,
      descripcion: 'Permite descargar archivos generados',
      agrupador: 'analitica',
    },
  ]

  for (const p of perms) {
    try {
      const existing = await prisma.permiso.findUnique({ where: { codigo: p.codigo } })
      const permiso = existing
        ? await prisma.permiso.update({ where: { codigo: p.codigo }, data: { nombre: p.nombre, descripcion: p.descripcion, modulo: p.modulo, agrupador: p.agrupador } })
        : await prisma.permiso.create({ data: p })

      await prisma.rolPermiso.upsert({
        where: { id_rol_id_permiso: { id_rol: adminRole.id_rol, id_permiso: permiso.id_permiso } },
        update: {},
        create: { id_rol: adminRole.id_rol, id_permiso: permiso.id_permiso },
      })

      console.log(`✓ Permiso ${p.codigo} asignado al rol Administrador`)
    } catch (err) {
      console.error('Error procesando permiso', p.codigo, err)
    }
  }

  console.log('Listo. Verifica que los usuarios administradores hereden los permisos del rol.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
