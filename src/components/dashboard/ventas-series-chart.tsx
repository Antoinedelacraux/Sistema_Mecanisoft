"use client"

import { useMemo } from 'react'
import 'chart.js/auto'
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js'
import { Line } from 'react-chartjs-2'

import type { VentasSeriesPoint } from '@/types/dashboard'

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  maximumFractionDigits: 2
})

type VentasSeriesChartProps = {
  series: VentasSeriesPoint[]
}

export function VentasSeriesChart({ series }: VentasSeriesChartProps) {
  const data = useMemo<ChartData<'line'>>(
    () => ({
      labels: series.map((point) => point.label),
      datasets: [
        {
          label: 'Ventas',
          data: series.map((point) => point.total),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 3,
          pointHoverRadius: 5
        }
      ]
    }),
    [series]
  )

  const options = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context: TooltipItem<'line'>) {
              const valor = context.parsed.y ?? 0
              return currencyFormatter.format(valor)
            }
          },
          displayColors: false
        }
      },
      scales: {
        x: {
          grid: { display: false }
        },
        y: {
          ticks: {
            callback(value: string | number) {
              if (typeof value === 'string') {
                return value
              }
              return currencyFormatter.format(Number(value))
            }
          }
        }
      }
    }),
    []
  )

  return <Line data={data} options={options} />
}
