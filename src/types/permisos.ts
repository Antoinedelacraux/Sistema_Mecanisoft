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
}

export type PermisoRolDTO = {
  id_permiso: number
  codigo: string
  nombre: string
  descripcion: string | null
  modulo: string
  agrupador: string | null
  concedido: boolean
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
