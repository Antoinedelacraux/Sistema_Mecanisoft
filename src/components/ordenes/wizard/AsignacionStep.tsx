import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { TrabajadorCompleto } from '@/types'
// imports deduplicados

interface Props {
  trabajadores: TrabajadorCompleto[]
  trabajadorSeleccionado: TrabajadorCompleto | null
  setTrabajadorSeleccionado: (t: TrabajadorCompleto | null) => void
  prioridad: string
  setPrioridad: (p: string) => void
  observaciones: string
  setObservaciones: (o: string) => void
}

export function AsignacionStep({ trabajadores, trabajadorSeleccionado, setTrabajadorSeleccionado, prioridad, setPrioridad, observaciones, setObservaciones }: Props) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Asignación y Programación</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="font-medium">Mecánico Responsable</h4>
          <div className="space-y-3">
            <div>
              <Button variant="outline" onClick={() => setTrabajadorSeleccionado(null)} className={!trabajadorSeleccionado ? 'ring-2 ring-blue-500' : ''}>Sin asignar (asignar después)</Button>
            </div>
            {trabajadores.map((trabajador) => {
              const persona = trabajador.usuario?.persona ?? trabajador.persona ?? null
              const nombreCompleto = persona ? `${persona.nombre} ${persona.apellido_paterno}`.trim() : 'Sin datos de contacto'
              return (
                <Card
                  key={trabajador.id_trabajador}
                  className={`cursor-pointer transition-colors ${trabajadorSeleccionado?.id_trabajador === trabajador.id_trabajador ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'}`}
                  onClick={() => setTrabajadorSeleccionado(trabajador)}
                >
                  <CardContent className="p-4 space-y-1">
                    <div className="font-medium">{nombreCompleto}</div>
                    <p className="text-sm text-gray-600">{trabajador.codigo_empleado}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{trabajador.especialidad}</Badge>
                      {trabajador.cargo && <span>{trabajador.cargo}</span>}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
        <div className="space-y-4">
          <h4 className="font-medium">Detalles finales</h4>
          <div>
            <Label htmlFor="prioridad">Prioridad</Label>
            <Select value={prioridad} onValueChange={setPrioridad}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="baja">Baja</SelectItem>
                <SelectItem value="media">Media</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea id="observaciones" placeholder="Observaciones adicionales sobre el trabajo..." value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={4} />
          </div>
        </div>
      </div>
    </div>
  )
}