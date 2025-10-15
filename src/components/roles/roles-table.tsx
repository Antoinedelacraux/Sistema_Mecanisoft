'use client'

import { Shield, ShieldAlert, ShieldCheck, ShieldPlus, Users, Pencil, Eye, Wrench } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'

export interface RoleTableItem {
  id_rol: number
  nombre_rol: string
  descripcion: string | null
  estatus: boolean
  fecha_registro: string | Date
  actualizado_en: string | Date
  totalPermisos?: number
  totalUsuarios?: number
}

interface RolesTableProps {
  roles: RoleTableItem[]
  loading?: boolean
  onCreate: () => void
  onRefresh: () => void
  onView: (roleId: number) => void
  onEdit: (roleId: number) => void
  onManagePermissions: (roleId: number) => void
  onToggleActive: (role: RoleTableItem, nextStatus: boolean) => void
}

const dateFormatter = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' })

const formatDate = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter.format(date)
}

export function RolesTable({
  roles,
  loading = false,
  onCreate,
  onRefresh,
  onView,
  onEdit,
  onManagePermissions,
  onToggleActive
}: RolesTableProps) {
  const showSkeleton = loading && roles.length === 0

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Roles del sistema
          </CardTitle>
          <CardDescription>Administra las plantillas de permisos que se asignan a usuarios y trabajadores.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onRefresh} disabled={loading}>
            Recargar
          </Button>
          <Button onClick={onCreate}>
            <ShieldPlus className="mr-2 h-4 w-4" /> Nuevo rol
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showSkeleton ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : roles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-white p-8 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-gray-400" />
            <p className="mt-3 text-sm text-gray-600">
              Aún no hay roles registrados. Crea uno para definir los accesos iniciales.
            </p>
            <Button className="mt-4" onClick={onCreate}>
              <ShieldPlus className="mr-2 h-4 w-4" /> Crear rol
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rol</TableHead>
                  <TableHead className="hidden md:table-cell">Descripción</TableHead>
                  <TableHead className="w-[120px] text-center">Estado</TableHead>
                  <TableHead className="hidden lg:table-cell">Permisos</TableHead>
                  <TableHead className="hidden lg:table-cell">Usuarios</TableHead>
                  <TableHead className="hidden xl:table-cell">Actualizado</TableHead>
                  <TableHead className="w-[220px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((rol) => {
                  const estadoBadge = rol.estatus ? (
                    <Badge className="bg-emerald-100 text-emerald-700">
                      Activo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                      Inactivo
                    </Badge>
                  )

                  return (
                    <TableRow key={rol.id_rol}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-gray-900">{rol.nombre_rol}</span>
                          <span className="text-xs text-gray-500 md:hidden">
                            {rol.descripcion ? rol.descripcion : 'Sin descripción'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-gray-600">
                        {rol.descripcion ? rol.descripcion : 'Sin descripción'}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-2">
                          {estadoBadge}
                          <Switch
                            checked={rol.estatus}
                            onCheckedChange={(value) => onToggleActive(rol, value)}
                            aria-label={`Cambiar estado del rol ${rol.nombre_rol}`}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-center text-sm text-gray-600">
                        {rol.totalPermisos ?? '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-center text-sm text-gray-600">
                        {rol.totalUsuarios ?? '—'}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-sm text-gray-500">
                        {formatDate(rol.actualizado_en)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => onView(rol.id_rol)}>
                            <Eye className="mr-2 h-4 w-4" /> Ver
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onEdit(rol.id_rol)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onManagePermissions(rol.id_rol)}>
                            <Wrench className="mr-2 h-4 w-4" /> Permisos
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
