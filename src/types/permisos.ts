export type PermisoCatalogoDTO = {
  id_permiso: number
  codigo: string
  nombre: string
  descripcion: string | null
  modulo: string
  agrupador: string | null
  activo: boolean
  creado_en: string
  actualizado_en: string
  modulo_nombre?: string | null
  modulo_descripcion?: string | null
}

export type PermisoRolDTO = {
  id_permiso: number
  codigo: string
  nombre: string
  descripcion: string | null
  modulo: string
  agrupador: string | null
  concedido: boolean
  nota?: string | null
  asignado_por_id?: number | null
  asignado_en?: string
}

export type PermisoPersonalizadoDTO = {
  codigo: string
  concedido: boolean
  origen: string
  comentario: string | null
  permiso: PermisoCatalogoDTO
}

export type PermisoResueltoDTO = {
  codigo: string
  concedido: boolean
  fuente: 'ROL' | 'EXTRA' | 'REVOCADO'
  permiso: PermisoCatalogoDTO
  origenPersonalizacion?: string
  comentarioPersonalizacion?: string | null
}

export type PermisosUsuarioResponse = {
  base: PermisoRolDTO[]
  personalizados: PermisoPersonalizadoDTO[]
  resueltos: PermisoResueltoDTO[]
}

export type ModuloPermisosDTO = {
  clave: string
  nombre: string
  descripcion: string | null
  permisos: PermisoCatalogoDTO[]
}
