import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ClienteCompleto } from '@/types'

interface ClienteStepProps {
  clientes: ClienteCompleto[]
  clienteSeleccionado: ClienteCompleto | null
  onSelect: (cliente: ClienteCompleto) => void
}

export function ClienteStep({ clientes, clienteSeleccionado, onSelect }: ClienteStepProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Seleccionar Cliente</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clientes.map((cliente) => {
          const isActive = clienteSeleccionado?.id_cliente === cliente.id_cliente
          return (
            <Card
              key={cliente.id_cliente}
              className={`cursor-pointer transition-colors ${isActive ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
              onClick={() => onSelect(cliente)}
            >
              <CardContent className="p-4">
                <div className="font-medium">
                  {cliente.persona.nombre} {cliente.persona.apellido_paterno}
                </div>
                <div className="text-sm text-gray-600">
                  {cliente.persona.tipo_documento}: {cliente.persona.numero_documento}
                </div>
                {cliente.persona.telefono && (
                  <div className="text-sm text-gray-600">📞 {cliente.persona.telefono}</div>
                )}
                <div className="mt-2">
                  <Badge variant="outline">
                    {cliente._count.vehiculos} vehículo{cliente._count.vehiculos !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
