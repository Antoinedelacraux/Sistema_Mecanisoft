"use client"

import { useEffect, useMemo, useState, useTransition } from 'react'
import type { FormEvent } from 'react'
import { subDays, format } from 'date-fns'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const formatDateInput = (date: Date) => format(date, 'yyyy-MM-dd')

const clampWindowDays = (value: number) => Math.min(Math.max(value, 0), 30)

const DEFAULT_WINDOW_DAYS = 2

const QUICK_RANGES = [
  { label: 'Hoy', days: 1 },
  { label: '7 días', days: 7 },
  { label: '14 días', days: 14 },
  { label: '30 días', days: 30 }
]

type IndicadoresFilterBarProps = {
  initialFrom: string
  initialTo: string
  initialWindowDays: number
}

export const IndicadoresFilterBar = ({ initialFrom, initialTo, initialWindowDays }: IndicadoresFilterBarProps) => {
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [windowDays, setWindowDays] = useState(String(initialWindowDays))
  const [isPending, startTransition] = useTransition()

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    setFrom(initialFrom)
  }, [initialFrom])

  useEffect(() => {
    setTo(initialTo)
  }, [initialTo])

  useEffect(() => {
    setWindowDays(String(clampWindowDays(initialWindowDays)))
  }, [initialWindowDays])

  const isRangeInvalid = useMemo(() => {
    if (!from || !to) return false
    return new Date(from) > new Date(to)
  }, [from, to])

  const applyNavigation = (params: URLSearchParams) => {
    const query = params.toString()
    const target = query ? `${pathname}?${query}` : pathname
    startTransition(() => {
      router.push(target)
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!from || !to || isRangeInvalid) {
      return
    }

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set('from', from)
    nextParams.set('to', to)

    const parsedWindow = Number.parseInt(windowDays, 10)
    if (Number.isNaN(parsedWindow)) {
      nextParams.delete('windowDays')
    } else {
      nextParams.set('windowDays', String(clampWindowDays(parsedWindow)))
    }

    applyNavigation(nextParams)
  }

  const handleReset = () => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete('from')
    nextParams.delete('to')
    nextParams.delete('windowDays')

    const now = new Date()
    const defaultTo = formatDateInput(now)
    const defaultFrom = formatDateInput(subDays(now, 29))

    setFrom(defaultFrom)
    setTo(defaultTo)
  setWindowDays(String(DEFAULT_WINDOW_DAYS))

    applyNavigation(nextParams)
  }

  const handleQuickRange = (days: number) => {
    const today = new Date()
    const start = subDays(today, Math.max(days, 1) - 1)
    setFrom(formatDateInput(start))
    setTo(formatDateInput(today))
  }

  const submitDisabled = isPending || !from || !to || isRangeInvalid

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <form className="grid gap-4 md:grid-cols-[repeat(4,minmax(0,1fr))] md:items-end" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="indicadores-from">Desde</Label>
          <Input
            id="indicadores-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            max={to || undefined}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="indicadores-to">Hasta</Label>
          <Input
            id="indicadores-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            min={from || undefined}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="indicadores-window">Ventana on-schedule (días)</Label>
          <Input
            id="indicadores-window"
            type="number"
            min={0}
            max={30}
            value={windowDays}
            onChange={(event) => setWindowDays(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">Compara fecha programada vs. realizada para el KPI de cumplimiento.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={submitDisabled} className="flex-1 md:flex-none">
            Aplicar filtros
          </Button>
          <Button type="button" variant="outline" onClick={handleReset} disabled={isPending}>
            Restablecer
          </Button>
        </div>
      </form>
      {isRangeInvalid ? (
        <p className="mt-2 text-xs text-destructive">El rango seleccionado no es válido: la fecha inicial debe ser menor o igual que la final.</p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Rangos rápidos:</span>
        {QUICK_RANGES.map((range) => (
          <Button
            key={range.label}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleQuickRange(range.days)}
            disabled={isPending}
          >
            {range.label}
          </Button>
        ))}
      </div>
    </section>
  )
}
