"use client"

import React, { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'

type Evento = {
  id_bitacora: number
  id_usuario: number
  accion: string
  descripcion?: string
  fecha_hora: string
  tabla?: string
  ip_publica?: string
}

export default function BitacoraPanel() {
  const [eventos, setEventos] = useState<Evento[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage] = useState(25)
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState('')
  const [usuarioId, setUsuarioId] = useState<string>('')
  const [suggestions, setSuggestions] = useState<Array<{ id: string; label: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [selected, setSelected] = useState<Evento | null>(null)
  const { toast } = useToast()
  const debounceRef = useRef<number | null>(null)

  async function load(p = 1, opts?: { exportCsv?: boolean }) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), perPage: String(perPage) })
      if (query) params.set('accion', query)
      if (usuarioId) params.set('usuarioId', usuarioId)
      if (desde) params.set('desde', desde)
      if (hasta) params.set('hasta', hasta)
      if (opts?.exportCsv) params.set('export', 'csv')

      const res = await fetch(`/api/bitacora?${params.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast({ title: 'Error cargando bitácora', description: err.error || 'Error desconocido', variant: 'destructive' })
        return
      }
      // if export csv, response will be text/csv
      const contentType = res.headers.get('content-type') || ''
      if (contentType.includes('text/csv')) {
        const csvText = await res.text()
        const blob = new Blob([csvText], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `bitacora_export_${Date.now()}.csv`
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        toast({ title: 'Exportado', description: 'CSV descargado', variant: 'default' })
      } else {
        const data = await res.json()
        setEventos(data.eventos ?? [])
        setTotal(data.total ?? 0)
        setPage(data.page ?? p)
      }
    } catch (e) {
      console.error('Error cargando bitacora', e)
      toast({ title: 'Error', description: 'No se pudo cargar la bitácora', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // debounce filters (accion/usuarioId/fechas)
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => load(1), 400)
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, usuarioId, desde, hasta])

  // fetch suggestions for usuario autocomplete
  useEffect(() => {
    if (!usuarioId || usuarioId.length < 2) {
      setSuggestions([])
      return
    }
    let active = true
    const id = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: usuarioId, take: '10' })
        const res = await fetch(`/api/usuarios/buscar?${params.toString()}`)
        if (!res.ok) return
        const data = await res.json()
        if (active) setSuggestions(data.usuarios ?? [])
      } catch (e) {
        /* ignore */
      }
    }, 250)
    return () => { active = false; window.clearTimeout(id) }
  }, [usuarioId])

  return (
    <div className="bg-white border rounded p-4">
      <div className="mb-4 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div className="flex gap-2 items-center">
          <label htmlFor="accion" className="text-sm font-medium mr-2">Acción</label>
          <Input id="accion" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ej. ACTUALIZAR_PERFIL" />
          <label htmlFor="usuarioId" className="text-sm font-medium ml-2 mr-2">Usuario</label>
          <div className="relative">
            <Input id="usuarioId" value={usuarioId} onChange={(e) => { setUsuarioId(e.target.value); setShowSuggestions(true) }} placeholder="Buscar usuario por nombre o id" />
            {showSuggestions && suggestions.length > 0 && (
              <ul role="listbox" aria-label="Sugerencias de usuarios" className="absolute z-20 bg-white border mt-1 max-h-40 overflow-auto w-full">
                {suggestions.map(s => (
                  <li key={s.id} role="option" className="px-2 py-1 hover:bg-gray-100 cursor-pointer" onClick={() => { setUsuarioId(s.id); setShowSuggestions(false) }}>{s.label} ({s.id})</li>
                ))}
              </ul>
            )}
          </div>
          <label htmlFor="desde" className="sr-only">Desde</label>
          <Input id="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="ml-2" />
          <label htmlFor="hasta" className="sr-only">Hasta</label>
          <Input id="hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="ml-2" />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => load(1)}>{loading ? 'Cargando...' : 'Buscar'}</Button>
          <Button variant="outline" onClick={() => { setQuery(''); setDesde(''); setHasta(''); load(1) }}>Limpiar</Button>
          <Button variant="ghost" onClick={() => load(1, { exportCsv: true })}>Exportar CSV</Button>
        </div>
      </div>

      <div aria-live="polite" className="mb-2 text-sm text-gray-600">{total} resultados</div>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="py-2">Fecha</th>
              <th className="py-2">Usuario</th>
              <th className="py-2">Acción</th>
              <th className="py-2">Tabla</th>
              <th className="py-2">Descripción</th>
              <th className="py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((e) => (
              <tr key={e.id_bitacora} className="border-b hover:bg-gray-50">
                <td className="py-2 align-top">{new Date(e.fecha_hora).toLocaleString()}</td>
                <td className="py-2 align-top">{e.id_usuario}</td>
                <td className="py-2 align-top">{e.accion}</td>
                <td className="py-2 align-top">{e.tabla ?? '-'}</td>
                <td className="py-2 align-top">{e.descripcion ? (e.descripcion.length > 80 ? e.descripcion.slice(0, 80) + '…' : e.descripcion) : '-'}</td>
                <td className="py-2 align-top">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(e)}>Ver</Button>
                    <Button size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(e.descripcion ?? '') ; toast({ title: 'Copiado', description: 'Descripción copiada al portapapeles' }) } catch (err) { toast({ title: 'Error', description: 'No se pudo copiar', variant: 'destructive' }) } }}>Copiar</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-sm text-gray-600">Página {page}</div>
        <div className="flex gap-2">
          <Button disabled={page <= 1} onClick={() => load(page - 1)}>Anterior</Button>
          <Button disabled={page * perPage >= total} onClick={() => load(page + 1)}>Siguiente</Button>
        </div>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle evento</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-2">
              <div><strong>Fecha:</strong> {new Date(selected.fecha_hora).toLocaleString()}</div>
              <div><strong>Usuario:</strong> {selected.id_usuario}</div>
              <div><strong>Acción:</strong> {selected.accion}</div>
              <div><strong>Tabla:</strong> {selected.tabla ?? '-'}</div>
              <div><strong>IP:</strong> {selected.ip_publica ?? '-'}</div>
              <div><strong>Descripción:</strong></div>
              <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto">{selected.descripcion ?? '-'}</pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
