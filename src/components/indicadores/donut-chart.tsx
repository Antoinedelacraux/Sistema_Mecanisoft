"use client"

import { useMemo } from 'react'
import 'chart.js/auto'
import type { ChartData, ChartOptions, TooltipItem } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

type DonutSlice = {
  label: string
  value: number
}

type DonutChartProps = {
  slices: DonutSlice[]
  colors?: string[]
  valueFormatter?: (value: number) => string
}

const fallbackColors = ['#2563EB', '#16A34A', '#F59E0B', '#F97316', '#DB2777', '#7C3AED']
const defaultFormatter = (value: number) => `${(value * 100).toFixed(1)}%`

export const IndicatorDonutChart = ({ slices, colors = fallbackColors, valueFormatter = defaultFormatter }: DonutChartProps) => {
  const data = useMemo<ChartData<'doughnut'>>(
    () => ({
      labels: slices.map((item) => item.label),
      datasets: [
        {
          data: slices.map((item) => item.value),
          backgroundColor: slices.map((_, index) => colors[index % colors.length]),
          borderWidth: 1
        }
      ]
    }),
    [slices, colors]
  )

  const total = slices.reduce((acc, item) => acc + item.value, 0)

  const options = useMemo<ChartOptions<'doughnut'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label(context: TooltipItem<'doughnut'>) {
              const raw = context.parsed ?? 0
              const ratio = total > 0 ? raw / total : 0
              return `${context.label}: ${valueFormatter(ratio)}`
            }
          }
        }
      }
    }),
    [total, valueFormatter]
  )

  return <Doughnut data={data} options={options} />
}
