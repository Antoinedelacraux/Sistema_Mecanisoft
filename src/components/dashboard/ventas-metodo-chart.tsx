"use client"

import { useMemo } from 'react'
import 'chart.js/auto'
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

import type { VentasMetodoPagoEntry } from '@/types/dashboard'

const colors = ['#2563eb', '#16a34a', '#f97316', '#9333ea', '#facc15', '#ef4444', '#14b8a6']

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  maximumFractionDigits: 2
})

type VentasMetodoChartProps = {
  data: VentasMetodoPagoEntry[]
}

export function VentasMetodoChart({ data }: VentasMetodoChartProps) {
  const total = data.reduce((acc, item) => acc + item.total, 0)

  const chartData = useMemo<ChartData<'doughnut'>>(
    () => ({
      labels: data.map((item) => item.metodo),
      datasets: [
        {
          data: data.map((item) => item.total),
          backgroundColor: data.map((_, index) => colors[index % colors.length]),
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.8)'
        }
      ]
    }),
    [data]
  )

  const options = useMemo<ChartOptions<'doughnut'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label(context: TooltipItem<'doughnut'>) {
              const valor = context.parsed ?? 0
              const porcentaje = total > 0 ? (valor / total) * 100 : 0
              return `${context.label}: ${currencyFormatter.format(valor)} (${porcentaje.toFixed(1)}%)`
            }
          }
        }
      }
    }),
    [total]
  )

  return <Doughnut data={chartData} options={options} />
}
