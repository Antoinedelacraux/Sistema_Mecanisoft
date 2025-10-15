import { prisma } from '../src/lib/prisma'

const permisos = [
  {
    codigo: 'inventario.ver',
    nombre: 'Ver inventario',
    descripcion: 'Consulta stock y movimientos del inventario basico',
    modulo: 'inventario',
    agrupador: 'gestion_inventario',
    roles: ['Administrador', 'Recepcionista', 'Mecánico'],
  },
  {
    codigo: 'inventario.movimientos',
    nombre: 'Registrar movimientos de inventario',
    descripcion: 'Autoriza registrar salidas y ajustes en el inventario basico',
    modulo: 'inventario',
    agrupador: 'gestion_inventario',
    roles: ['Administrador', 'Mecánico'],
  },
  {
    codigo: 'inventario.compras',
    nombre: 'Registrar compras de inventario',
    descripcion: 'Permite registrar compras rapidas que actualizan el inventario basico',
    modulo: 'inventario',
    agrupador: 'gestion_inventario',
    roles: ['Administrador', 'Recepcionista'],
  },
] as const

type PermisoConfig = (typeof permisos)[number]

type RolRecord = {
  id_rol: number
  nombre_rol: string
}

async function asegurarPermiso(config: PermisoConfig) {
  const permiso = await prisma.permiso.upsert({
    where: { codigo: config.codigo },
    update: {
      nombre: config.nombre,
      descripcion: config.descripcion,
      modulo: config.modulo,
      agrupador: config.agrupador,
      activo: true,
    },
    create: {
      codigo: config.codigo,
      nombre: config.nombre,
      descripcion: config.descripcion,
      modulo: config.modulo,
      agrupador: config.agrupador,
      activo: true,
    },
  })

  console.log(`Permiso asegurado: ${permiso.codigo}`)
  return permiso
}

async function asignarPermisosARoles(
  permisoId: number,
  config: PermisoConfig,
  rolesPorNombre: Map<string, RolRecord>,
) {
  const rolesEncontrados = config.roles
    .map((nombre) => rolesPorNombre.get(nombre))
    .filter((rol): rol is RolRecord => Boolean(rol))

  if (rolesEncontrados.length === 0) {
    console.warn(`  Advertencia: no se encontraron roles para ${config.codigo}`)
    return
  }

  const data = rolesEncontrados.map((rol) => ({
    id_rol: rol.id_rol,
    id_permiso: permisoId,
  }))

  await prisma.rolPermiso.createMany({ data, skipDuplicates: true })

  const nombres = rolesEncontrados.map((rol) => rol.nombre_rol).join(', ')
  console.log(`  Asignado a roles: ${nombres}`)
}

async function main() {
  console.log('Aplicando permisos del modulo de inventario basico...')

  const nombresRoles = Array.from(new Set(permisos.flatMap((item) => item.roles)))
  const roles = await prisma.rol.findMany({
    where: { nombre_rol: { in: nombresRoles } },
    select: { id_rol: true, nombre_rol: true },
  })

  const rolesPorNombre = new Map(roles.map((rol) => [rol.nombre_rol, rol]))

  const rolesPerdidos = nombresRoles.filter((nombre) => !rolesPorNombre.has(nombre))
  if (rolesPerdidos.length > 0) {
    console.warn(`Roles no encontrados en base de datos: ${rolesPerdidos.join(', ')}`)
  }

  for (const config of permisos) {
    const permiso = await asegurarPermiso(config)
    await asignarPermisosARoles(permiso.id_permiso, config, rolesPorNombre)
  }

  console.log('Permisos de inventario aplicados correctamente.')
}

main()
  .catch((error) => {
    console.error('Error aplicando permisos de inventario:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
