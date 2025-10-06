import { Card, CardContent } from '@/components/ui/card'
import { ClienteCompleto } from '@/types'

interface Props {
  clientes: ClienteCompleto[]
  clienteSeleccionado: ClienteCompleto | null
  setClienteSeleccionado: (c: ClienteCompleto) => void
}

export function ClienteStep({ clientes, clienteSeleccionado, setClienteSeleccionado }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Seleccionar Cliente</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clientes.map((cliente) => (
          <Card
            key={cliente.id_cliente}
            className={`cursor-pointer transition-colors ${
              clienteSeleccionado?.id_cliente === cliente.id_cliente ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
            }`}
            onClick={() => setClienteSeleccionado(cliente)}
          >
            <CardContent className="p-4">
              <div className="font-medium">
                {cliente.persona.nombre} {cliente.persona.apellido_paterno}
              </div>
              <div className="text-sm text-gray-600">
                {cliente.persona.tipo_documento}: {cliente.persona.numero_documento}
              </div>
              {cliente.persona.telefono && (
                <div className="text-sm text-gray-600 mt-1">📞 {cliente.persona.telefono}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {clientes.length === 0 && <div className="text-center py-8 text-gray-500">No hay clientes activos disponibles</div>}
    </div>
  )
}