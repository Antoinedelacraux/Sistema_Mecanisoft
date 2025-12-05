import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { ServicioCompleto, ProductoCompleto } from '@/types'
import { ItemOrden, CatalogoItem } from './types'
import { useToast } from '@/components/ui/use-toast'
import { calcularTotalLinea, formatMoney, unidadTiempoEnMinutos } from './utils'
import { AlmacenSelect, UbicacionSelect } from '@/components/inventario/selectors'

interface Props {
  servicios: ServicioCompleto[]
  productos: ProductoCompleto[]
  modoOrden: 'solo_servicios' | 'servicios_y_productos'
  items: ItemOrden[]
  setItems: (items: ItemOrden[]) => void
  agregarItem: (elemento: CatalogoItem) => void
  actualizarItem: (index: number, campo: keyof ItemOrden, valor: unknown) => void
  eliminarItem: (index: number) => void
}

export function ServiciosStep({ servicios, productos, modoOrden, items, setItems, agregarItem, actualizarItem, eliminarItem }: Props) {
  const { toast } = useToast()
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Servicios y Productos</h3>
      <div>
        <h4 className="font-medium mb-3">Servicios Disponibles</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
          {servicios.map((servicio) => {
            const precioFinal = servicio.descuento > 0 ? servicio.precio_base * (1 - servicio.descuento / 100) : servicio.precio_base
            const tieneProductoAsociado = items.some(i => i.tipo === 'producto' && i.servicio_ref === servicio.id_servicio)
            return (
              <Card key={servicio.id_servicio} className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => agregarItem({ tipo: 'servicio', servicio })}>
                <CardContent className="p-3">
                  <div className="font-medium">{servicio.nombre}</div>
                  <div className="text-xs text-gray-500">{servicio.codigo_servicio}</div>
                  <div className="text-sm">{formatMoney(precioFinal)}</div>
                  {tieneProductoAsociado && (
                    <div className="mt-1">
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">Producto asociado</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
      <div>
        <h4 className="font-medium mb-3">Productos Disponibles</h4>
        {modoOrden === 'solo_servicios' && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2">
            Modo Solo servicios activo: la selección de productos está deshabilitada.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
          {productos.map((producto) => {
            const desc = Number(producto.descuento || 0)
            const pv = Number(producto.precio_venta)
            const precioFinal = desc > 0 ? pv * (1 - desc / 100) : pv
            return (
              <Card
                key={producto.id_producto}
                className={`transition-colors ${modoOrden==='solo_servicios' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}
                onClick={() => {
                  if (modoOrden === 'solo_servicios') {
                    toast({ title: 'Modo solo servicios', description: 'No puedes agregar productos en modo Solo servicios.', variant: 'destructive' })
                    return
                  }
                  agregarItem({ tipo: 'producto', producto })
                }}
              >
                <CardContent className="p-3">
                  <div className="font-medium">{producto.nombre}</div>
                  <div className="text-xs text-gray-500">{producto.codigo_producto}</div>
                  <div className="text-sm">{formatMoney(precioFinal)}</div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
      <Separator />
      <div>
        <h4 className="font-medium mb-3">Items Seleccionados ({items.length})</h4>
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No has agregado servicios aún</div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => {
              const servicio = item.tipo === 'servicio' ? servicios.find(s => s.id_servicio === item.id_referencia) : null
              const factor = servicio ? unidadTiempoEnMinutos(servicio.unidad_tiempo) : 0
              const minCalculado = servicio ? servicio.tiempo_minimo * factor * item.cantidad : 0
              const maxCalculado = servicio ? servicio.tiempo_maximo * factor * item.cantidad : 0
              return (
                <Card key={`${item.tipo}-${item.id_referencia}-${index}`} className="p-4">
                  <CardContent className="p-0 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-sm">{item.nombre}</div>
                        <div className="text-xs text-gray-500">{item.codigo}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-green-700 whitespace-nowrap">{formatMoney(item.total)}</div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => eliminarItem(index)}
                          aria-label={`Eliminar ${item.nombre}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between text-xs text-gray-600 gap-2">
                      <div>
                        {item.cantidad} x {formatMoney(item.precio_unitario)}{item.descuento > 0 && ` (-${item.descuento}%)`}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{item.tipo === 'servicio' ? 'Servicio' : 'Producto'}</Badge>
                        {item.oferta && <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">Oferta</Badge>}
                      </div>
                    </div>
                    {servicio && <div className="text-xs text-blue-600">Duración estimada: {minCalculado}–{maxCalculado} min</div>}
                    {item.tipo === 'producto' && (
                      <div className="space-y-3 text-xs text-gray-700">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <span className="font-medium text-[11px] uppercase tracking-wide text-muted-foreground">Asociación</span>
                          <select
                            className="border rounded px-2 py-1 text-xs"
                            value={item.servicio_ref ?? ''}
                            aria-label="Asociar producto a servicio"
                            onChange={(e) => {
                              const valor = e.target.value
                              const idSrv = valor ? parseInt(valor, 10) : NaN
                              if (!valor) {
                                actualizarItem(index, 'servicio_ref', null)
                                return
                              }
                              if (!Number.isFinite(idSrv)) return
                              const yaAsociado = items.some((i, idx) => i.tipo === 'producto' && idx !== index && i.servicio_ref === idSrv)
                              if (yaAsociado) {
                                toast({ title: 'Regla de asociación', description: 'Cada servicio solo puede tener 0 o 1 producto asociado.', variant: 'destructive' })
                                return
                              }
                              actualizarItem(index, 'servicio_ref', idSrv)
                            }}
                          >
                            <option value="">Sin asociar</option>
                            {items.filter(i => i.tipo === 'servicio').map((srvItem) => {
                              const disabled = items.some(i => i.tipo === 'producto' && i.servicio_ref === srvItem.id_referencia && i !== item)
                              return (
                                <option key={`opt-srv-${srvItem.id_referencia}`} value={srvItem.id_referencia} disabled={disabled}>
                                  {srvItem.nombre}{disabled ? ' (ocupado)' : ''}
                                </option>
                              )
                            })}
                          </select>
                        </div>
                        <div className="grid gap-2 md:grid-cols-2">
                          <AlmacenSelect
                            value={item.almacenId ? String(item.almacenId) : ''}
                            onChange={(valor) => actualizarItem(index, 'almacenId', valor ? Number(valor) : null)}
                            placeholder="Almacén para reservar"
                            emptyLabel="No hay almacenes registrados."
                          />
                          <UbicacionSelect
                            almacenId={item.almacenId ? String(item.almacenId) : null}
                            value={item.ubicacionId ? String(item.ubicacionId) : ''}
                            onChange={(valor) => actualizarItem(index, 'ubicacionId', valor ? Number(valor) : null)}
                            allowSinUbicacion
                            placeholder="Sin ubicación específica"
                            emptyLabel="No hay ubicaciones registradas."
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Selecciona el almacén y la ubicación desde donde se reservará el stock de este producto.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}