"use client"

import { useMemo } from 'react'
import 'chart.js/auto'
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js'
import { Line } from 'react-chartjs-2'

export type LineChartPoint = {
  label: string
  value: number
}

type LineChartProps = {
  title?: string
  points: LineChartPoint[]
  color?: string
  valueFormatter?: (value: number) => string
}

const defaultFormatter = (value: number) => `${value.toFixed(1)}%`

const hexToRgba = (hex: string, alpha: number) => {
  const sanitized = hex.replace('#', '')
  if (![3, 6].includes(sanitized.length)) {
    return `rgba(59, 130, 246, ${alpha})`
  }
  const expanded = sanitized.length === 3 ? sanitized.split('').map((char) => char + char).join('') : sanitized
  const bigint = Number.parseInt(expanded, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const IndicatorLineChart = ({ points, color = 'rgb(59, 130, 246)', valueFormatter = defaultFormatter }: LineChartProps) => {
  const data = useMemo<ChartData<'line'>>(() => {
    const backgroundColor = color.startsWith('rgb')
      ? color.replace('rgb', 'rgba').replace(')', ', 0.2)')
      : hexToRgba(color, 0.2)

    return {
      labels: points.map((point) => point.label),
      datasets: [
        {
          label: 'Indicador',
          data: points.map((point) => point.value),
          borderColor: color,
          backgroundColor,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.35
        }
      ]
    }
  }, [points, color])

  const options = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: {
            label(context: TooltipItem<'line'>) {
              const valor = context.parsed.y ?? 0
              return valueFormatter(valor)
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false }
        },
        y: {
          ticks: {
            callback(value: string | number) {
              const numeric = typeof value === 'string' ? Number.parseFloat(value) : value
              return valueFormatter(Number.isNaN(numeric) ? 0 : Number(numeric))
            }
          }
        }
      }
    }),
    [valueFormatter]
  )

  return <Line data={data} options={options} />
}
