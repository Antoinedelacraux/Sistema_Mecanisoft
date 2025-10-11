'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { UsuarioCompleto } from '@/types'

const dateFormatter = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium',
  timeStyle: 'short'
})

const formatDate = (value?: Date | string | null) => {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return dateFormatter.format(date)
}

interface UsuarioDetalleProps {
  usuario: UsuarioCompleto
}

export function UsuarioDetalle({ usuario }: UsuarioDetalleProps) {
  const persona = usuario.persona

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-lg font-semibold mb-2">Información personal</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4 space-y-2">
              <div>
                <p className="text-sm text-gray-500">Nombre completo</p>
                <p className="text-base font-medium">{persona.nombre} {persona.apellido_paterno ?? ''} {persona.apellido_materno ?? ''}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Documento</p>
                <p className="text-base font-medium">{persona.tipo_documento}: {persona.numero_documento}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Correo</p>
                <p className="text-base font-medium">{persona.correo ?? '—'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Teléfono</p>
                <p className="text-base font-medium">{persona.telefono ?? '—'}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 space-y-2">
              <div>
                <p className="text-sm text-gray-500">Trabajador asociado</p>
                {usuario.trabajador ? (
                  <div className="space-y-1">
                    <p className="font-medium">Código: {usuario.trabajador.codigo_empleado}</p>
                    <Badge variant="outline">{usuario.trabajador.cargo}</Badge>
                    <p className="text-sm text-gray-500">
                      Estado: {usuario.trabajador.eliminado ? 'Dado de baja' : usuario.trabajador.activo ? 'Activo' : 'Inactivo'}
                    </p>
                  </div>
                ) : (
                  <p className="text-base font-medium">—</p>
                )}
              </div>
              <div>
                <p className="text-sm text-gray-500">Rol</p>
                <Badge className="bg-blue-100 text-blue-800" variant="secondary">{usuario.rol.nombre_rol}</Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Estado</p>
                <Badge className={usuario.estado ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                  {usuario.estado ? 'Activo' : 'Bloqueado'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Fecha de creación</p>
                <p className="text-base font-medium">{formatDate(usuario.fecha_creacion)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-2">Seguridad y credenciales</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4 space-y-2">
              <div>
                <p className="text-sm text-gray-500">Requiere cambio de contraseña</p>
                <p className="text-base font-medium">{usuario.requiere_cambio_password ? 'Sí' : 'No'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Contraseña temporal expira</p>
                <p className="text-base font-medium">{formatDate(usuario.password_temporal_expira)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Último cambio de contraseña</p>
                <p className="text-base font-medium">{formatDate(usuario.ultimo_cambio_password)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Bloqueado en</p>
                <p className="text-base font-medium">{formatDate(usuario.bloqueado_en)}</p>
                {usuario.motivo_bloqueo && (
                  <p className="text-sm text-gray-500">Motivo: {usuario.motivo_bloqueo}</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 space-y-2">
              <div>
                <p className="text-sm text-gray-500">Envio de credenciales pendiente</p>
                <p className="text-base font-medium">{usuario.envio_credenciales_pendiente ? 'Sí' : 'No'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Último envío de credenciales</p>
                <p className="text-base font-medium">{formatDate(usuario.ultimo_envio_credenciales)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Último error de envío</p>
                <p className="text-base font-medium">{usuario.ultimo_error_envio ?? '—'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
