import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { ClienteCompleto, VehiculoCompleto } from '@/types'

interface Props {
  clienteSeleccionado: ClienteCompleto | null
  vehiculos: VehiculoCompleto[]
  vehiculoSeleccionado: VehiculoCompleto | null
  setVehiculoSeleccionado: (v: VehiculoCompleto) => void
}

export function VehiculoStep({ clienteSeleccionado, vehiculos, vehiculoSeleccionado, setVehiculoSeleccionado }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Seleccionar Vehículo</h3>
      {clienteSeleccionado && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Cliente seleccionado:</strong> {clienteSeleccionado.persona.nombre} {clienteSeleccionado.persona.apellido_paterno}
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vehiculos.map((vehiculo) => (
          <Card
            key={vehiculo.id_vehiculo}
            className={`cursor-pointer transition-colors ${
              vehiculoSeleccionado?.id_vehiculo === vehiculo.id_vehiculo ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
            }`}
            onClick={() => setVehiculoSeleccionado(vehiculo)}
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
        ))}
      </div>
      {vehiculos.length === 0 && clienteSeleccionado && (
        <div className="text-center py-8 text-gray-500">Este cliente no tiene vehículos registrados</div>
      )}
    </div>
  )
}