"use client"

import { useEffect, useMemo, useState } from 'react'
import { format, endOfDay, endOfToday, endOfMonth, startOfDay, startOfMonth, startOfToday, subDays } from 'date-fns'
import { Calendar as CalendarIcon, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { DateRange } from 'react-day-picker'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const toQueryDate = (value: Date) => format(value, 'yyyy-MM-dd')

const buildLabel = (range: DateRange | undefined) => {
  if (!range?.from || !range?.to) {
    return 'Seleccionar rango'
  }

  const fromLabel = format(range.from, 'd MMM yyyy')
  const toLabel = format(range.to, 'd MMM yyyy')

  if (fromLabel === toLabel) {
    return fromLabel
  }

  return `${fromLabel} — ${toLabel}`
}

type DashboardFiltersProps = {
  from: string
  to: string
  granularity: string
}

const presetRanges = [
  {
    key: 'today',
    label: 'Hoy',
    getRange: () => ({ from: startOfToday(), to: endOfToday() })
  },
  {
    key: 'last7',
    label: 'Últimos 7 días',
    getRange: () => {
      const to = endOfToday()
      return { from: startOfDay(subDays(to, 6)), to }
    }
  },
  {
    key: 'last30',
    label: 'Últimos 30 días',
    getRange: () => {
      const to = endOfToday()
      return { from: startOfDay(subDays(to, 29)), to }
    }
  },
  {
    key: 'month',
    label: 'Mes actual',
    getRange: () => {
      const today = new Date()
      return { from: startOfMonth(today), to: endOfMonth(today) }
    }
  }
] as const

const granularityOptions = [
  { key: 'day', label: 'Diario' },
  { key: 'week', label: 'Semanal' },
  { key: 'month', label: 'Mensual' }
] as const

export function DashboardFilters({ from, to, granularity }: DashboardFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)

  const currentRange = useMemo<DateRange | undefined>(() => {
    try {
      return { from: new Date(from), to: new Date(to) }
    } catch (error) {
      console.warn('Rango de fechas inválido en query string', error)
      return undefined
    }
  }, [from, to])

  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>(currentRange)

  useEffect(() => {
    setCalendarRange(currentRange)
  }, [from, to])

  const applyRange = (range: DateRange | undefined) => {
    if (!range?.from || !range?.to) {
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    params.set('from', toQueryDate(range.from))
    params.set('to', toQueryDate(range.to))

    router.push(`${pathname}?${params.toString()}`, { scroll: false })
    setCalendarRange(range)
    setOpen(false)
  }

  const resetFilters = () => {
    const { getRange } = presetRanges.find((preset) => preset.key === 'last30')!
    const defaultRange = getRange()
    const params = new URLSearchParams(searchParams.toString())
    params.set('from', toQueryDate(defaultRange.from))
    params.set('to', toQueryDate(defaultRange.to))
    params.delete('almacenId')
    params.delete('usuarioId')
    params.delete('granularity')
    params.delete('topLimit')
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
    setCalendarRange(defaultRange)
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <SlidersHorizontal className="h-4 w-4" />
          <span>Rango:</span>
        </div>
        {presetRanges.map((preset) => {
          const presetRange = preset.getRange()
          const isActive =
            currentRange?.from?.toDateString() === presetRange.from.toDateString() &&
            currentRange?.to?.toDateString() === presetRange.to.toDateString()

          return (
            <Button
              key={preset.key}
              type="button"
              variant={isActive ? 'default' : 'outline'}
              onClick={() => applyRange(presetRange)}
              size="sm"
            >
              {preset.label}
            </Button>
          )
        })}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              {buildLabel(calendarRange)}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={calendarRange}
              defaultMonth={calendarRange?.from}
              onSelect={(range) => {
                setCalendarRange(range ?? undefined)
                if (range?.from && range?.to) {
                  applyRange({ from: startOfDay(range.from), to: endOfDay(range.to) })
                }
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center gap-2 self-start md:self-auto">
        <div className="flex items-center gap-1 rounded-md border border-border bg-background p-1 text-xs">
          {granularityOptions.map((option) => {
            const isActive = (granularity || 'day') === option.key
            return (
              <Button
                key={option.key}
                type="button"
                variant={isActive ? 'default' : 'ghost'}
                size="sm"
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString())
                  params.set('granularity', option.key)
                  router.push(`${pathname}?${params.toString()}`, { scroll: false })
                }}
              >
                {option.label}
              </Button>
            )
          })}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
          <RotateCcw className="mr-2 h-4 w-4" />Restablecer
        </Button>
      </div>
    </div>
  )
}
