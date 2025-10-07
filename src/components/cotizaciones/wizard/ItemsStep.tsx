import { ChangeEvent } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Minus, Plus, X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import type { ProductoCompleto, ServicioCompleto } from '@/types'
import type { CatalogoItem, CotizacionModo, ItemCotizacion } from './types'
import { formatMoney, toNumber } from './utils'

interface Totales {
  subtotal: number
  impuesto: number
  total: number
}

const SIN_SERVICIO = 'none'

interface ItemsStepProps {
  modo: CotizacionModo
  servicios: ServicioCompleto[]
  productos: ProductoCompleto[]
  items: ItemCotizacion[]
  totales: Totales
  onAgregar: (item: CatalogoItem) => void
  onActualizar: (
    index: number,
    campo: keyof Pick<ItemCotizacion, 'cantidad' | 'precio_unitario' | 'descuento' | 'servicio_ref'>,
    valor: unknown
  ) => void
  onEliminar: (index: number) => void
}

export function ItemsStep({ modo, servicios, productos, items, totales, onAgregar, onActualizar, onEliminar }: ItemsStepProps) {
  const { toast } = useToast()
  const servicioCards = servicios.map((servicio) => {
    const precioFinal = servicio.descuento > 0 ? Number(servicio.precio_base) * (1 - Number(servicio.descuento) / 100) : Number(servicio.precio_base)
    const tieneProductoAsociado = items.some((i) => i.tipo === 'producto' && i.servicio_ref === servicio.id_servicio)
    return {
      id: servicio.id_servicio,
      servicio,
      precioFinal,
      tieneProductoAsociado
    }
  })

  const productoCards = productos.map((producto) => {
    const descuento = toNumber(producto.descuento)
    const precioBase = toNumber(producto.precio_venta)
    const precioFinal = descuento > 0 ? precioBase * (1 - descuento / 100) : precioBase
    return {
      id: producto.id_producto,
      producto,
      precioFinal,
      descuento
    }
  })

  const servicioItems = items.filter((item) => item.tipo === 'servicio')

  const productosAsociados = (servicioId: number, excludeIndex: number) =>
    items.some((item, idx) => item.tipo === 'producto' && idx !== excludeIndex && item.servicio_ref === servicioId)

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Servicios y Productos</h3>

      <div className="space-y-6">
        {modo !== 'solo_productos' && (
          <div>
            <h4 className="font-medium mb-3">Servicios Disponibles</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
              {servicioCards.map(({ id, servicio, precioFinal, tieneProductoAsociado }) => (
                <Card
                  key={id}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => onAgregar({ tipo: 'servicio', servicio })}
                >
                  <CardContent className="p-3 space-y-1">
                    <div className="font-medium text-sm flex items-center gap-2">
                      <span>{servicio.nombre}</span>
                      {Boolean(servicio.oferta) && (
                        <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                          Oferta
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-600">{servicio.codigo_servicio}</div>
                    <div className="text-sm mt-1 flex items-center gap-2">
                      {toNumber(servicio.descuento) > 0 && (
                        <span className="text-xs line-through text-gray-400">{formatMoney(servicio.precio_base)}</span>
                      )}
                      <span className="font-semibold text-green-600">{formatMoney(precioFinal)}</span>
                    </div>
                    <div className="text-xs text-blue-600">
                      Tiempo estimado: {servicio.tiempo_minimo === servicio.tiempo_maximo ? servicio.tiempo_minimo : `${servicio.tiempo_minimo}-${servicio.tiempo_maximo}`} {servicio.unidad_tiempo}
                    </div>
                    {tieneProductoAsociado && (
                      <div className="mt-1">
                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                          Producto asociado
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="font-medium mb-3">Productos Disponibles</h4>
          {modo === 'solo_servicios' && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2">
              Modo Solo servicios activo: la selección de productos está deshabilitada.
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
            {productoCards.map(({ id, producto, precioFinal, descuento }) => (
              <Card
                key={id}
                className={`transition-colors ${modo === 'solo_servicios' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}
                onClick={() => {
                  if (modo === 'solo_servicios') {
                    toast({
                      title: 'Modo solo servicios',
                      description: 'No puedes agregar productos en modo Solo servicios.',
                      variant: 'destructive'
                    })
                    return
                  }
                  onAgregar({ tipo: 'producto', producto })
                }}
              >
                <CardContent className="p-3 space-y-1">
                  <div className="font-medium text-sm flex items-center gap-2">
                    <span>{producto.nombre}</span>
                    {Boolean(producto.oferta) && (
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                        Oferta
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-600">{producto.codigo_producto}</div>
                  <div className="text-sm mt-1 flex items-center gap-2">
                    {descuento > 0 && <span className="text-xs line-through text-gray-400">{formatMoney(producto.precio_venta)}</span>}
                    <span className="font-semibold text-green-600">{formatMoney(precioFinal)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-medium mb-3">Items Seleccionados ({items.length})</h4>
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">Aún no has agregado servicios o productos.</div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => {
              const servicio = item.tipo === 'servicio' ? servicios.find((s) => s.id_servicio === item.id_referencia) : null
              return (
                <Card key={`${item.tipo}-${item.id_referencia}-${index}`} className="p-4">
                  <CardContent className="p-0 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <div className="font-medium text-sm flex items-center gap-2">
                          <span>{item.nombre}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {item.tipo === 'servicio' ? 'Servicio' : 'Producto'}
                          </Badge>
                          {item.oferta && (
                            <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                              Oferta
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-600">{item.codigo}</div>
                        {servicio && (
                          <div className="text-xs text-blue-600 mt-1">
                            Tiempo estimado: {servicio.tiempo_minimo === servicio.tiempo_maximo ? servicio.tiempo_minimo : `${servicio.tiempo_minimo}-${servicio.tiempo_maximo}`} {servicio.unidad_tiempo}
                          </div>
                        )}
                        {item.tipo === 'producto' && modo === 'servicios_y_productos' && servicioItems.length > 0 && (
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2 text-xs text-gray-700">
                            <span>Asociar a servicio:</span>
                            <Select
                              value={item.servicio_ref ? String(item.servicio_ref) : SIN_SERVICIO}
                              onValueChange={(value) => {
                                if (value === SIN_SERVICIO) {
                                  onActualizar(index, 'servicio_ref', null)
                                  return
                                }
                                const idServicio = parseInt(value, 10)
                                if (!Number.isFinite(idServicio)) return
                                if (productosAsociados(idServicio, index)) {
                                  toast({
                                    title: 'Regla de asociación',
                                    description: 'Cada servicio solo puede tener un producto asociado.',
                                    variant: 'destructive'
                                  })
                                  return
                                }
                                onActualizar(index, 'servicio_ref', idServicio)
                              }}
                            >
                              <SelectTrigger className="w-56">
                                <SelectValue placeholder="Sin asociar" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={SIN_SERVICIO}>Sin asociar</SelectItem>
                                {items
                                  .filter((it) => it.tipo === 'servicio')
                                  .map((srvItem) => {
                                    const disabled = productosAsociados(srvItem.id_referencia, index)
                                    return (
                                      <SelectItem
                                        key={`srv-option-${srvItem.id_referencia}`}
                                        value={String(srvItem.id_referencia)}
                                        disabled={disabled}
                                      >
                                        {srvItem.nombre}{disabled ? ' (ocupado)' : ''}
                                      </SelectItem>
                                    )
                                  })}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {item.tipo === 'producto' && modo !== 'servicios_y_productos' && (
                          <div className="text-[11px] text-gray-500 mt-1">
                            Modo actual: {modo === 'solo_productos' ? 'solo productos' : 'solo servicios'}
                          </div>
                        )}
                        {item.tipo === 'producto' && item.servicio_ref && modo === 'servicios_y_productos' && (
                          <div className="text-[11px] text-blue-600 mt-1">
                            Asociado a servicio: {servicios.find((s) => s.id_servicio === item.servicio_ref)?.nombre ?? '—'}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-4 items-center justify-between md:justify-end">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Cant:</Label>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onActualizar(index, 'cantidad', Math.max(1, item.cantidad - 1))}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center">{item.cantidad}</span>
                            <Button size="sm" variant="outline" onClick={() => onActualizar(index, 'cantidad', item.cantidad + 1)}>
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Precio:</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.precio_unitario}
                            onChange={(event: ChangeEvent<HTMLInputElement>) => onActualizar(index, 'precio_unitario', event.target.value)}
                            className="w-24"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Label className="text-sm">Desc:</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.descuento}
                            disabled={!item.permiteEditarDescuento}
                            onChange={(event: ChangeEvent<HTMLInputElement>) => onActualizar(index, 'descuento', event.target.value)}
                            className="w-20"
                          />
                          <span className="text-sm">%</span>
                        </div>

                        <div className="font-semibold text-green-600 min-w-[80px] text-right">{formatMoney(item.total)}</div>

                        <Button size="sm" variant="ghost" onClick={() => onEliminar(index)} className="text-red-600">
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            <Card className="bg-gray-50">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatMoney(totales.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>IGV (18%):</span>
                    <span>{formatMoney(totales.impuesto)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span className="text-green-600">{formatMoney(totales.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
