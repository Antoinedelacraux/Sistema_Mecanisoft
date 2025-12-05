import { prisma } from '../src/lib/prisma'

const permisos = [
  {
    codigo: 'tareas.ver',
    nombre: 'Ver tablero de tareas',
    descripcion: 'Permite acceder al tablero general de tareas del taller',
    modulo: 'tareas',
    agrupador: 'gestion_tareas',
    roles: ['Administrador', 'Mecánico', 'Recepcionista'],
  },
  {
    codigo: 'tareas.gestionar',
    nombre: 'Gestionar tareas',
    descripcion: 'Autoriza actualizar estados y asignaciones de tareas',
    modulo: 'tareas',
    agrupador: 'gestion_tareas',
    roles: ['Administrador', 'Mecánico'],
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
  console.log('Aplicando permisos del módulo de tareas...')

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

  console.log('✅ Permisos de tareas aplicados correctamente.')
}

main()
  .catch((error) => {
    console.error('Error aplicando permisos de tareas:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
