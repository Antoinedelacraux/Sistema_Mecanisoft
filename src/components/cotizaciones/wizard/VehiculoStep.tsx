import { Card, CardContent } from '@/components/ui/card'
import type { ClienteCompleto, VehiculoCompleto } from '@/types'

interface VehiculoStepProps {
  clienteSeleccionado: ClienteCompleto | null
  vehiculos: VehiculoCompleto[]
  vehiculoSeleccionado: VehiculoCompleto | null
  onSelect: (vehiculo: VehiculoCompleto) => void
}

export function VehiculoStep({ clienteSeleccionado, vehiculos, vehiculoSeleccionado, onSelect }: VehiculoStepProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Seleccionar Vehículo</h3>

      {clienteSeleccionado && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Cliente:</strong> {clienteSeleccionado.persona.nombre} {clienteSeleccionado.persona.apellido_paterno}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vehiculos.map((vehiculo) => {
          const isActive = vehiculoSeleccionado?.id_vehiculo === vehiculo.id_vehiculo
          return (
            <Card
              key={vehiculo.id_vehiculo}
              className={`cursor-pointer transition-colors ${isActive ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
              onClick={() => onSelect(vehiculo)}
            >
              <CardContent className="p-4">
                <div className="font-bold text-lg">{vehiculo.placa}</div>
                <div className="text-sm text-gray-600">
                  {vehiculo.modelo.marca.nombre_marca} {vehiculo.modelo.nombre_modelo}
                </div>
                <div className="text-sm text-gray-600">
                  {vehiculo.año} • {vehiculo.tipo}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
