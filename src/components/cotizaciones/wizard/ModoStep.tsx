import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Package } from 'lucide-react'
import type { CotizacionModo } from './types'

interface ModoStepProps {
  modoActual: CotizacionModo | null
  onChange: (modo: CotizacionModo) => void
}

const opciones: Array<{ value: CotizacionModo; title: string; description: string }> = [
  {
    value: 'solo_servicios',
    title: 'Solo servicios',
    description: 'Cotiza únicamente mano de obra y servicios especializados.'
  },
  {
    value: 'solo_productos',
    title: 'Solo productos',
    description: 'Cotiza repuestos o insumos sin asociar servicios.'
  },
  {
    value: 'servicios_y_productos',
    title: 'Servicios + productos',
    description: 'Cotiza servicios junto con los productos necesarios.'
  }
]

export function ModoStep({ modoActual, onChange }: ModoStepProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">¿Qué tipo de cotización necesitas generar?</h3>
      <p className="text-sm text-gray-600">
        Selecciona si esta cotización incluirá solo servicios, solo productos o la combinación de ambos. Puedes modificar esta opción más
        adelante, pero los ítems que no coincidan se eliminarán automáticamente.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {opciones.map((option) => {
          const isActive = modoActual === option.value
          return (
            <Card
              key={option.value}
              className={`cursor-pointer transition ${isActive ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/40'}`}
              onClick={() => onChange(option.value)}
            >
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {option.title}
                </CardTitle>
                <CardDescription>{option.description}</CardDescription>
              </CardHeader>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
