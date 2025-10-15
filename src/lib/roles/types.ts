import type { Rol } from '@prisma/client'
import type { PermisoRol } from '@/lib/permisos/service'

export type ListRolesOptions = {
  search?: string
  includeInactive?: boolean
  includeStats?: boolean
}

export type CreateRoleInput = {
  nombre: string
  descripcion?: string | null
  activo?: boolean
}

export type UpdateRoleInput = {
  nombre?: string
  descripcion?: string | null
  activo?: boolean
}

export type AssignPermissionsInput = {
  permisos: string[]
  nota?: string | null
}

export type RoleListItem = {
  id_rol: number
  nombre_rol: string
  descripcion: string | null
  estatus: boolean
  fecha_registro: Date
  actualizado_en: Date
  totalPermisos?: number
  totalUsuarios?: number
}

export type RoleDetail = {
  rol: Rol
  permisos: PermisoRol[]
  totalUsuarios: number
}
