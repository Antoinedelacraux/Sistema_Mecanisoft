import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { ClienteCompleto, VehiculoCompleto, TrabajadorCompleto, ServicioCompleto } from '@/types'
import { ItemOrden } from './types'
import { formatMoney, formatearDuracion, unidadTiempoEnMinutos } from './utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
  clienteSeleccionado: ClienteCompleto | null
  vehiculoSeleccionado: VehiculoCompleto | null
  trabajadorSeleccionado: TrabajadorCompleto | null
  items: ItemOrden[]
  servicios: ServicioCompleto[]
  prioridad: string
  observaciones: string
  estimacion: { inicio: Date; finMin: Date; finMax: Date } | null
  totales: { subtotal: number; impuesto: number; total: number }
}

export function ResumenStep({ clienteSeleccionado, vehiculoSeleccionado, trabajadorSeleccionado, items, servicios, prioridad, observaciones, estimacion, totales }: Props) {
  const totalMin = items.filter(i => i.tipo === 'servicio').reduce((acc, item) => {
    const srv = servicios.find(s => s.id_servicio === item.id_referencia)
    if (!srv) return acc
    return acc + unidadTiempoEnMinutos(srv.unidad_tiempo) * srv.tiempo_minimo * item.cantidad
  }, 0)
  const totalMax = items.filter(i => i.tipo === 'servicio').reduce((acc, item) => {
    const srv = servicios.find(s => s.id_servicio === item.id_referencia)
    if (!srv) return acc
    return acc + unidadTiempoEnMinutos(srv.unidad_tiempo) * srv.tiempo_maximo * item.cantidad
  }, 0)
  const formatRange = (minMin: number, maxMin: number) => {
    if (!minMin || !maxMin) return '—'
    const units = [
      { label: 'min', factor: 1 },
      { label: 'h', factor: 60 },
      { label: 'd', factor: 60 * 24 },
      { label: 'sem', factor: 60 * 24 * 7 }
    ]
    const pick = (val: number) => {
      if (val >= units[3].factor) return units[3]
      if (val >= units[2].factor) return units[2]
      if (val >= units[1].factor) return units[1]
      return units[0]
    }
    const unit = pick(maxMin)
    const f = unit.factor
    const minVal = Math.round((minMin / f) * 10) / 10
    const maxVal = Math.round((maxMin / f) * 10) / 10
    return `${minVal}–${maxVal} ${unit.label}`
  }
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Resumen de la Orden</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Cliente</CardTitle></CardHeader>
            <CardContent>
              {clienteSeleccionado && (
                <div>
                  <p className="font-medium">{clienteSeleccionado.persona.nombre} {clienteSeleccionado.persona.apellido_paterno}</p>
                  <p className="text-sm text-gray-600">{clienteSeleccionado.persona.tipo_documento}: {clienteSeleccionado.persona.numero_documento}</p>
                  {clienteSeleccionado.persona.telefono && <p className="text-sm text-gray-600">📞 {clienteSeleccionado.persona.telefono}</p>}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Vehículo</CardTitle></CardHeader>
            <CardContent>
              {vehiculoSeleccionado && (
                <div>
                  <p className="font-bold text-lg">{vehiculoSeleccionado.placa}</p>
                  <p className="text-sm text-gray-600">{vehiculoSeleccionado.modelo.marca.nombre_marca} {vehiculoSeleccionado.modelo.nombre_modelo}</p>
                  <p className="text-sm text-gray-600">{vehiculoSeleccionado.año} • {vehiculoSeleccionado.tipo}</p>
                </div>
              )}
            </CardContent>
          </Card>
          {trabajadorSeleccionado && (
            <Card>
              <CardHeader><CardTitle className="text-base">Mecánico Asignado</CardTitle></CardHeader>
              <CardContent>
                <div>
                  <p className="font-medium">{trabajadorSeleccionado.usuario.persona.nombre} {trabajadorSeleccionado.usuario.persona.apellido_paterno}</p>
                  <p className="text-sm text-gray-600">{trabajadorSeleccionado.codigo_empleado}</p>
                  <Badge variant="outline">{trabajadorSeleccionado.especialidad}</Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Servicios ({items.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {items.map((item, index) => {
                  const servicio = item.tipo === 'servicio' ? servicios.find(s => s.id_servicio === item.id_referencia) : null
                  const factor = servicio ? unidadTiempoEnMinutos(servicio.unidad_tiempo) : 0
                  const minCalculado = servicio ? servicio.tiempo_minimo * factor * item.cantidad : 0
                  const maxCalculado = servicio ? servicio.tiempo_maximo * factor * item.cantidad : 0
                  return (
                    <div key={`${item.tipo}-${item.id_referencia}-${index}`} className="space-y-1 py-2 border-b border-gray-100 last:border-b-0">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium text-sm">{item.nombre}</div>
                          <div className="text-xs text-gray-500">{item.codigo}</div>
                        </div>
                        <div className="font-semibold text-green-700">{formatMoney(item.total)}</div>
                      </div>
                      {servicio && <div className="text-xs text-blue-600">Duración estimada: {formatearDuracion(minCalculado)} – {formatearDuracion(maxCalculado)}</div>}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Totales</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between"><span>Subtotal:</span><span>{formatMoney(totales.subtotal)}</span></div>
                <div className="flex justify-between"><span>IGV (18%):</span><span>{formatMoney(totales.impuesto)}</span></div>
                <div className="flex justify-between text-sm"><span>Duración estimada (total):</span><span>{formatRange(totalMin, totalMax)}</span></div>
                <Separator />
                <div className="flex justify-between font-bold text-lg"><span>Total:</span><span className="text-green-600">{formatMoney(totales.total)}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Configuración</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <div><span className="font-medium">Prioridad:</span> {prioridad.toUpperCase()}</div>
                {estimacion && (
                  <div className="space-y-1">
                    <div><span className="font-medium">Inicio estimado:</span> {format(estimacion.inicio, 'PPP p', { locale: es })}</div>
                    <div><span className="font-medium">Fin estimado:</span> {format(estimacion.finMax, 'PPP p', { locale: es })}</div>
                  </div>
                )}
                {observaciones && (
                  <div>
                    <span className="font-medium">Observaciones:</span>
                    <p className="text-sm text-gray-600 mt-1">{observaciones}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}