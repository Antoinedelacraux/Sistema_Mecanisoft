import type { ReactNode } from 'react'

type HeatmapValue = {
  label: string
  value: number
  helper?: ReactNode
}

type HeatmapRow = {
  label: string
  values: HeatmapValue[]
}

type HeatmapProps = {
  rows: HeatmapRow[]
  valueFormatter?: (value: number) => string
}

const defaultFormatter = (value: number) => `${(value * 100).toFixed(0)}%`

const getIntensityClass = (ratio: number) => {
  if (ratio >= 0.9) return 'bg-emerald-600 text-white'
  if (ratio >= 0.7) return 'bg-emerald-500 text-white'
  if (ratio >= 0.5) return 'bg-emerald-400 text-white'
  if (ratio >= 0.3) return 'bg-amber-400 text-amber-900'
  if (ratio > 0) return 'bg-rose-300 text-rose-900'
  return 'bg-muted text-muted-foreground'
}

export const IndicatorHeatmap = ({ rows, valueFormatter = defaultFormatter }: HeatmapProps) => {
  if (!rows.length) {
    return <div className="text-sm text-muted-foreground">Sin datos para el período seleccionado.</div>
  }

  const allValues = rows.flatMap((row) => row.values.map((item) => item.value))
  const maxValue = Math.max(...allValues, 0) || 1

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-36 px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Recurso</th>
            {rows[0]?.values.map((value) => (
              <th key={value.label} className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {value.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-border">
              <th scope="row" className="px-3 py-2 text-left font-medium text-muted-foreground">
                {row.label}
              </th>
              {row.values.map((value) => {
                const intensity = Math.min(value.value / maxValue, 1)
                const formatted = valueFormatter(value.value)
                const helper = value.helper ? <div className="text-[11px] text-muted-foreground">{value.helper}</div> : null
                return (
                  <td key={`${row.label}-${value.label}`} className="px-2 py-2 text-center align-middle">
                    <div className={`rounded-md px-2 py-2 text-xs font-semibold transition-colors ${getIntensityClass(intensity)}`}>
                      <div>{formatted}</div>
                      {helper}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
