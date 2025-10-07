import { format, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ClienteCompleto, ServicioCompleto, VehiculoCompleto } from '@/types'
import type { ItemCotizacion } from './types'
import { formatMoney, formatearDuracion } from './utils'

interface Totales {
  subtotal: number
  impuesto: number
  total: number
}

interface ResumenTiempo {
  cantidadServicios: number
  totalMin: number
  totalMax: number
  detalles: Array<{
    id: number
    nombre: string
    cantidad: number
    min: number
    max: number
  }>
}

interface EstimacionFechas {
  inicio: Date
  finMin: Date
  finMax: Date
}

interface ResumenStepProps {
  clienteSeleccionado: ClienteCompleto | null
  vehiculoSeleccionado: VehiculoCompleto | null
  items: ItemCotizacion[]
  servicios: ServicioCompleto[]
  vigenciaDias: number
  onChangeVigencia: (value: number) => void
  totales: Totales
  resumenTiempo: ResumenTiempo
  estimacionFechas: EstimacionFechas | null
}

export function ResumenStep({
  clienteSeleccionado,
  vehiculoSeleccionado,
  items,
  servicios,
  vigenciaDias,
  onChangeVigencia,
  totales,
  resumenTiempo,
  estimacionFechas
}: ResumenStepProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Resumen de la Cotización</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              {clienteSeleccionado && (
                <div>
                  <p className="font-medium">
                    {clienteSeleccionado.persona.nombre} {clienteSeleccionado.persona.apellido_paterno}
                  </p>
                  <p className="text-sm text-gray-600">{clienteSeleccionado.persona.numero_documento}</p>
                  {clienteSeleccionado.persona.telefono && (
                    <p className="text-sm text-gray-600">📞 {clienteSeleccionado.persona.telefono}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vehículo</CardTitle>
            </CardHeader>
            <CardContent>
              {vehiculoSeleccionado && (
                <div>
                  <p className="font-bold text-lg">{vehiculoSeleccionado.placa}</p>
                  <p className="text-sm text-gray-600">
                    {vehiculoSeleccionado.modelo.marca.nombre_marca} {vehiculoSeleccionado.modelo.nombre_modelo}
                  </p>
                  <p className="text-sm text-gray-600">
                    {vehiculoSeleccionado.año} • {vehiculoSeleccionado.tipo}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuración</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label>Vigencia (días)</Label>
                <Select value={vigenciaDias.toString()} onValueChange={(value) => onChangeVigencia(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 días</SelectItem>
                    <SelectItem value="7">7 días</SelectItem>
                    <SelectItem value="15">15 días</SelectItem>
                    <SelectItem value="30">30 días</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-600 mt-1">
                  Válida hasta: {format(addDays(new Date(), vigenciaDias), 'PPP', { locale: es })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Items ({items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {items.map((item, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                    <div>
                      <div className="font-medium text-sm flex items-center gap-2">
                        <span>{item.nombre}</span>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {item.tipo === 'producto' ? 'Producto' : 'Servicio'}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-600">
                        {item.cantidad} x {formatMoney(item.precio_unitario)}
                        {item.descuento > 0 && ` (-${item.descuento}%)`}
                      </div>
                      {item.tipo === 'servicio' && (() => {
                        const servicio = servicios.find((s) => s.id_servicio === item.id_referencia)
                        if (!servicio) return null
                        return (
                          <div className="text-[11px] text-blue-600 mt-1">
                            Tiempo estimado: {servicio.tiempo_minimo === servicio.tiempo_maximo ? servicio.tiempo_minimo : `${servicio.tiempo_minimo}-${servicio.tiempo_maximo}`} {servicio.unidad_tiempo}
                          </div>
                        )
                      })()}
                      {item.tipo === 'producto' && item.servicio_ref && (
                        <div className="text-[11px] text-blue-600 mt-1">
                          Asociado a servicio:{' '}
                          {servicios.find((s) => s.id_servicio === item.servicio_ref)?.nombre ?? '—'}
                        </div>
                      )}
                    </div>
                    <div className="font-semibold">{formatMoney(item.total)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Totales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{formatMoney(totales.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IGV (18%):</span>
                  <span>{formatMoney(totales.impuesto)}</span>
                </div>
                <div className="flex justify-between font-bold text-xl">
                  <span>Total:</span>
                  <span className="text-green-600">{formatMoney(totales.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {resumenTiempo.cantidadServicios > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Duración estimada</CardTitle>
                <CardDescription>Calculada a partir de los servicios seleccionados</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-1 text-sm">
                  <div className="flex justify-between">
                    <span>Servicios:</span>
                    <span>{resumenTiempo.cantidadServicios}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duración mínima:</span>
                    <span>{formatearDuracion(resumenTiempo.totalMin)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duración máxima:</span>
                    <span>{formatearDuracion(resumenTiempo.totalMax)}</span>
                  </div>
                </div>

                {estimacionFechas && (
                  <div className="space-y-1 rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
                    <div className="flex justify-between">
                      <span>Inicio estimado:</span>
                      <span>{format(estimacionFechas.inicio, 'PPpp', { locale: es })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fin mínimo:</span>
                      <span>{format(estimacionFechas.finMin, 'PPpp', { locale: es })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Fin máximo:</span>
                      <span>{format(estimacionFechas.finMax, 'PPpp', { locale: es })}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {resumenTiempo.detalles.map((detalle) => (
                    <div
                      key={detalle.id}
                      className="border border-dashed border-blue-100 rounded-md p-2 text-[12px] text-blue-800 bg-blue-50/40"
                    >
                      <div className="font-medium truncate">{detalle.nombre}</div>
                      <div className="flex justify-between">
                        <span>
                          {detalle.cantidad} servicio{detalle.cantidad !== 1 ? 's' : ''}
                        </span>
                        <span>Mín: {formatearDuracion(detalle.min)}</span>
                      </div>
                      {detalle.min !== detalle.max && <div className="text-right">Máx: {formatearDuracion(detalle.max)}</div>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
