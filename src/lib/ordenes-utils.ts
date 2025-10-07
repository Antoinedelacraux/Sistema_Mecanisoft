
export function getEstadoBadgeData(estado: string) {
  const badges = {
    'por_hacer': { label: 'Por Hacer', className: 'bg-gray-100 text-gray-800' },
    'pendiente': { label: 'Pendiente', className: 'bg-gray-100 text-gray-800' },
    'asignado': { label: 'Asignado', className: 'bg-blue-100 text-blue-800' },
    'en_proceso': { label: 'En Proceso', className: 'bg-yellow-100 text-yellow-800' },
    'completado': { label: 'Completado', className: 'bg-green-100 text-green-800' },
    'entregado': { label: 'Entregado', className: 'bg-purple-100 text-purple-800' },
    'pausado': { label: 'Pausado', className: 'bg-orange-100 text-orange-800' }
  }
  return badges[estado as keyof typeof badges] || { label: estado, className: 'bg-gray-100 text-gray-800' }
}

export function getPrioridadBadgeData(prioridad: string) {
  const badges = {
    'baja': { label: 'Baja', className: 'bg-gray-100 text-gray-800' },
    'media': { label: 'Media', className: 'bg-blue-100 text-blue-800' },
    'alta': { label: 'Alta', className: 'bg-orange-100 text-orange-800' },
    'urgente': { label: 'Urgente', className: 'bg-red-100 text-red-800' }
  }
  return badges[prioridad as keyof typeof badges] || { label: prioridad, className: 'bg-gray-100 text-gray-800' }
}

export function formatPrice(price: number) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN'
  }).format(price)
}

export function formatDurationRange(minMin: number, maxMin: number) {
  if (!Number.isFinite(minMin) || !Number.isFinite(maxMin) || minMin <= 0 || maxMin <= 0) return '—'
  const units = [
    { label: 'min', factor: 1 },
    { label: 'h', factor: 60 },
    { label: 'd', factor: 60 * 24 },
    { label: 'sem', factor: 60 * 24 * 7 }
  ]
  const pick = (val: number) => {
    if (val >= units[3].factor) return units[3]
    if (val >= units[2].factor) return units[2]
    if (val >= units[1].factor) return units[1]
    return units[0]
  }
  const unit = pick(maxMin)
  const f = unit.factor
  const minVal = Math.round((minMin / f) * 10) / 10
  const maxVal = Math.round((maxMin / f) * 10) / 10
  return `${minVal}–${maxVal} ${unit.label}`
}
