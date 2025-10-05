'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ServicioCompleto, MarcaCompleta, ModeloCompleto } from '@/types'
import { useToast } from '@/components/ui/use-toast'

interface ServiciosTableProps {
  onCreate?: () => void
  onEdit?: (servicio: ServicioCompleto) => void
  refreshKey?: number
}

export function ServiciosTable({ onCreate, onEdit, refreshKey }: ServiciosTableProps) {
  const [servicios, setServicios] = useState<ServicioCompleto[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState<'todos'|'activos'|'inactivos'>('todos')
  const [marcas, setMarcas] = useState<MarcaCompleta[]>([])
  const [modelos, setModelos] = useState<ModeloCompleto[]>([])
  const [marcaId, setMarcaId] = useState<number | null>(null)
  const [modeloId, setModeloId] = useState<number | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [mRes] = await Promise.all([
          fetch('/api/marcas')
        ])
        const mData = await mRes.json()
        setMarcas(mData.marcas || [])
      } catch (e) { console.error('Error filtros', e) }
    }
    fetchFilters()
  }, [])

  useEffect(() => {
    const fetchModelos = async () => {
      if (!marcaId) { setModelos([]); setModeloId(null); return }
      try {
        const res = await fetch(`/api/modelos?id_marca=${marcaId}`)
        const data = await res.json()
        setModelos(data.modelos || [])
      } catch (e) { console.error('Error modelos', e) }
    }
    fetchModelos()
  }, [marcaId])

  const loadServicios = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '50')
      if (search) params.set('search', search)
      if (estado) params.set('estado', estado)
      if (marcaId) params.set('id_marca', String(marcaId))
      if (modeloId) params.set('id_modelo', String(modeloId))
      const res = await fetch(`/api/servicios?${params.toString()}`)
      const data = await res.json()
      setServicios(data.servicios || [])
    } catch (e:any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally { setLoading(false) }
  }

  useEffect(() => { loadServicios() }, [])

  useEffect(() => { loadServicios() }, [refreshKey, estado, marcaId, modeloId])

  useEffect(() => {
    const handler = setTimeout(() => {
      loadServicios()
    }, 400)
    return () => clearTimeout(handler)
  }, [search])

  const toggleStatus = async (s: ServicioCompleto) => {
    try {
      const res = await fetch(`/api/servicios/${s.id_servicio}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_status', estatus: !s.estatus })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error alternando estado')
      }
      await loadServicios()
    } catch (e:any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  }

  const clearFilters = () => {
    setSearch('')
    setEstado('todos')
    setMarcaId(null)
    setModeloId(null)
    loadServicios()
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Servicios</CardTitle>
        <div className="flex gap-2">
          <Input placeholder="Buscar..." value={search} onChange={(e)=>setSearch(e.target.value)} className="w-48" />
          <Select value={estado} onValueChange={(v)=>setEstado(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="activos">Activos</SelectItem>
              <SelectItem value="inactivos">Inactivos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={marcaId?.toString() || ''} onValueChange={(v)=>setMarcaId(parseInt(v))}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Marca" /></SelectTrigger>
            <SelectContent>
              {marcas.map(m=> <SelectItem key={m.id_marca} value={m.id_marca.toString()}>{m.nombre_marca}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={modeloId?.toString() || ''} onValueChange={(v)=>setModeloId(parseInt(v))} disabled={!marcaId}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Modelo" /></SelectTrigger>
            <SelectContent>
              {modelos.map(md=> <SelectItem key={md.id_modelo} value={md.id_modelo.toString()}>{md.nombre_modelo}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={clearFilters} variant="secondary" disabled={loading}>Limpiar</Button>
          <Button onClick={loadServicios} disabled={loading}>Actualizar</Button>
          {onCreate && <Button variant="outline" onClick={onCreate}>Nuevo</Button>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {servicios.map(s => (
            <div key={s.id_servicio} className={`border rounded p-3 ${s.estatus ? '' : 'opacity-70'}`}>
              <div className="flex justify-between items-center">
                <div className="font-medium">{s.nombre}</div>
                <Badge variant="outline">{s.es_general ? 'General' : (s.modelo ? `${s.modelo.nombre_modelo}` : (s.marca ? s.marca.nombre_marca : 'Específico'))}</Badge>
              </div>
              <div className="text-xs text-gray-600">{s.codigo_servicio}</div>
              <div className="mt-1 text-sm space-y-1">
                <div>
                  Precio base: S/ {Number(s.precio_base).toFixed(2)}
                  {s.oferta && s.descuento > 0 && (
                    <span className="ml-2 text-xs text-green-600 font-medium">
                      Oferta: -{s.descuento}% (S/ {(Number(s.precio_base) * (1 - (Number(s.descuento)/100))).toFixed(2)})
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-600">
                  Tiempo estimado: {s.tiempo_minimo} - {s.tiempo_maximo} {s.unidad_tiempo}
                </div>
              </div>
              <div className="text-xs text-gray-500">Estado: {s.estatus ? 'Activo' : 'Inactivo'}</div>
              <div className="flex gap-2 mt-2">
                {onEdit && <Button size="sm" variant="outline" onClick={()=>onEdit(s)}>Editar</Button>}
                <Button size="sm" variant="ghost" onClick={()=>toggleStatus(s)}>{s.estatus ? 'Desactivar' : 'Activar'}</Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
