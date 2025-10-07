import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye, Edit, FileText, LayoutGrid, Trash2, User, Car, AlertCircle } from 'lucide-react'
import { OrdenCompleta } from '../ordenes-table'
import { getEstadoBadgeData, getPrioridadBadgeData, formatPrice, formatDurationRange } from '../../../lib/ordenes-utils'

interface OrdenesTableRowProps {
  orden: OrdenCompleta
  onView: (orden: OrdenCompleta) => void
  onEdit: (orden: OrdenCompleta) => void
  onKanban: (orden: OrdenCompleta) => void
  onFacturar: (orden: OrdenCompleta) => void
  onDelete: (orden: OrdenCompleta) => void
}

export function OrdenesTableRow({ orden, onView, onEdit, onKanban, onFacturar, onDelete }: OrdenesTableRowProps) {
  const vehiculo = orden.transaccion_vehiculos[0]?.vehiculo
  const detallesCount = orden._count?.detalles_transaccion ?? orden.detalles_transaccion.length
  const progreso = orden.progreso?.porcentaje ?? 0

  const estadoBadge = getEstadoBadgeData(orden.estado_orden)
  const prioridadBadge = getPrioridadBadgeData(orden.prioridad)
  return (
    <tr className="text-center">
      <td className="align-middle">
        <div className="space-y-1">
          <div className="font-semibold">{orden.codigo_transaccion}</div>
          <div className="text-xs text-muted-foreground">{new Date(orden.fecha).toLocaleDateString('es-PE')}</div>
        </div>
      </td>
      <td className="align-middle">
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            <span className="font-medium">{orden.persona.nombre} {orden.persona.apellido_paterno}</span>
          </div>
          <div className="text-xs text-muted-foreground">{orden.persona.numero_documento}</div>
          {vehiculo && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Car className="w-4 h-4 text-gray-400" />
              <span>{vehiculo.placa} - {vehiculo.modelo.marca.nombre_marca} {vehiculo.modelo.nombre_modelo}</span>
            </div>
          )}
        </div>
      </td>
      <td className="align-middle">
        {orden.trabajador_principal ? (
          <div className="space-y-1">
            <div className="font-medium text-sm">{orden.trabajador_principal.usuario.persona.nombre} {orden.trabajador_principal.usuario.persona.apellido_paterno}</div>
            <Badge variant="outline" className="text-xs">{orden.trabajador_principal.codigo_empleado}</Badge>
          </div>
        ) : (
          <Badge variant="secondary" className="text-xs">Sin asignar</Badge>
        )}
      </td>
      <td className="align-middle">
        <div className="space-y-2">
          <div className="text-sm font-medium">{progreso}%</div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${progreso === 100 ? 'bg-green-500' : progreso > 50 ? 'bg-blue-500' : 'bg-gray-400'}`}
              style={{ width: `${progreso}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground">{detallesCount} item{detallesCount !== 1 ? 's' : ''}</div>
        </div>
      </td>
      <td className="align-middle">
        {typeof (orden as any).duracion_min === 'number' && typeof (orden as any).duracion_max === 'number' ? (
          <div className="text-sm font-medium">{formatDurationRange((orden as any).duracion_min, (orden as any).duracion_max)}</div>
        ) : (
          <div className="text-xs text-muted-foreground">—</div>
        )}
      </td>
      <td className="align-middle">
        <div className="space-y-1">
          <div className="font-semibold">{formatPrice(orden.total)}</div>
          <div className="text-xs text-muted-foreground">Incluye IGV</div>
        </div>
      </td>
      <td className="align-middle">
        <div className="space-y-1">
          <Badge className={estadoBadge.className} variant="secondary">{estadoBadge.label}</Badge>
          {orden.prioridad === 'urgente' && (
            <div>
              <AlertCircle className="w-4 h-4 text-red-500 inline" />
            </div>
          )}
        </div>
      </td>
      <td className="align-middle">
        <div className="flex items-center justify-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onView(orden)} title="Ver resumen">
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(orden)}
            disabled={orden.estado_orden !== 'pendiente'}
            title="Editar orden"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onKanban(orden)}
            className="text-blue-600 hover:text-blue-700"
            title="Enviar al Kanban"
            disabled={!['pendiente', 'asignado'].includes(orden.estado_orden) || !orden.trabajador_principal}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFacturar(orden)}
            className="text-purple-600 hover:text-purple-700"
            title="Enviar a facturación"
            disabled={orden.estado_orden !== 'completado'}
          >
            <FileText className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(orden)}
            disabled={orden.estado_orden === 'entregado'}
            className="text-red-600 hover:text-red-700"
            title="Eliminar orden"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
