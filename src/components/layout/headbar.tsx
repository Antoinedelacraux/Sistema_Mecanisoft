'use client'

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  Bell,
  ClipboardList,
  Loader2,
  PackageMinus,
  RefreshCw,
  ShoppingCart,
  Wrench
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { DashboardAlert, DashboardSummary } from "@/types/dashboard"

const numberFormatter = new Intl.NumberFormat("es-PE")

const quickActions = [
  {
    label: "Nueva orden",
    description: "Abre el centro de órdenes de trabajo",
    href: "/dashboard/ordenes",
    icon: Wrench
  },
  {
    label: "Registrar venta",
    description: "Gestiona los comprobantes y pagos",
    href: "/dashboard/ventas",
    icon: ShoppingCart
  },
  {
    label: "Inventario",
    description: "Controla productos y existencias",
    href: "/dashboard/inventario",
    icon: PackageMinus
  }
]

const severityStyles: Record<DashboardAlert["severity"], string> = {
  info: "border-sky-500/30 bg-sky-500/15 text-sky-900 dark:text-sky-50 dark:border-sky-300/30 dark:bg-sky-500/25",
  warning: "border-amber-500/30 bg-amber-500/15 text-amber-900 dark:text-amber-50 dark:border-amber-300/30 dark:bg-amber-500/25",
  critical: "border-rose-500/30 bg-rose-500/18 text-rose-900 dark:text-rose-50 dark:border-rose-300/30 dark:bg-rose-500/30"
}

const cardBase = "rounded-2xl border border-white/40 bg-gradient-to-br from-white/90 via-white/65 to-white/45 px-5 py-4 shadow-[0_15px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:from-white/10 dark:via-white/5 dark:to-white/0"

type QuickStatsState = {
  summary: DashboardSummary | null
  loading: boolean
  refreshing: boolean
  error: string | null
}

export function Headbar() {
  const [{ summary, loading, refreshing, error }, setState] = useState<QuickStatsState>({
    summary: null,
    loading: true,
    refreshing: false,
    error: null
  })

  const fetchSummary = useCallback(async (showSpinner = false) => {
    setState((prev) => ({ ...prev, error: null, loading: prev.summary ? prev.loading : true, refreshing: showSpinner }))
    try {
      const res = await fetch("/api/dashboard/kpis?topLimit=6", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store"
      })

      if (!res.ok) {
        throw new Error("No se pudo cargar el resumen rápido")
      }

      const data = await res.json()
      setState({ summary: data.summary ?? null, loading: false, refreshing: false, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error inesperado"
      setState((prev) => ({ ...prev, loading: false, refreshing: false, error: message }))
    }
  }, [])

  useEffect(() => {
    void fetchSummary()
  }, [fetchSummary])

  const lowStockItems = summary?.stockBajo.items.slice(0, 3) ?? []
  const lowStockTotal = summary?.stockBajo.total ?? 0

  const metrics = useMemo(() => {
    if (!summary) return []
    return [
      {
        label: "Órdenes pendientes",
        value: summary.ordenesPendientes.total,
        href: "/dashboard/ordenes"
      },
      {
        label: "Pagos pendientes",
        value: summary.pagosPendientes.total,
        href: "/dashboard/ventas"
      },
      {
        label: "Cotizaciones vencidas",
        value: summary.cotizacionesVencidas.total,
        href: "/dashboard/cotizaciones"
      }
    ]
  }, [summary])

  const additionalAlerts = useMemo(() => {
    if (!summary) return []
    return summary.alerts.filter((alert) => alert.type !== "LOW_STOCK")
  }, [summary])

  const renderAlertItems = (alert: DashboardAlert) => {
    if (!alert.items || alert.items.length === 0) {
      return (
        <p className="text-xs text-[var(--muted-foreground)] dark:text-white/80">{alert.description}</p>
      )
    }

    return (
      <ul className="mt-3 space-y-2">
        {alert.items.slice(0, 3).map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-white/30 bg-white/50 px-3 py-2 text-sm shadow-sm dark:border-white/15 dark:bg-white/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--foreground)] dark:text-white">{item.title}</p>
                {item.subtitle && (
                  <p className="mt-1 text-xs text-[var(--muted-foreground)] dark:text-white/80">{item.subtitle}</p>
                )}
              </div>
              {item.href && (
                <Link
                  href={item.href}
                  className="text-xs font-semibold text-[var(--primary)] hover:underline dark:text-[var(--accent-foreground)]"
                >
                  Ver
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="rounded-3xl border border-white/40 bg-gradient-to-r from-white/95 via-white/70 to-white/55 px-6 py-6 shadow-[0_25px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-white/10 dark:from-white/10 dark:via-white/5 dark:to-white/0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/50 bg-white/60 text-[var(--primary)] shadow-inner backdrop-blur dark:border-white/20 dark:bg-white/10">
            <Bell className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Centro rápido
            </h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Accede a las acciones frecuentes y monitorea alertas críticas.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.label}
                asChild
                size="sm"
                variant="outline"
                className="rounded-full border-white/40 bg-white/70 text-[var(--primary)] shadow-[0_8px_20px_rgba(15,23,42,0.08)] backdrop-blur transition hover:-translate-y-0.5 hover:border-white/60 hover:bg-white/80 dark:border-white/20 dark:bg-white/15 dark:text-[var(--primary-foreground)]"
              >
                <Link href={action.href} title={action.description} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span>{action.label}</span>
                </Link>
              </Button>
            )
          })}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fetchSummary(true)}
            disabled={loading || refreshing}
            className="gap-2 rounded-full text-[var(--primary)] hover:bg-white/40 disabled:opacity-60 dark:text-[var(--primary-foreground)]"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualizar
          </Button>
        </div>
      </div>

      {error && (
  <div className="mt-4 flex items-center gap-3 rounded-xl border border-rose-200/60 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm dark:border-rose-300/40 dark:bg-rose-500/20 dark:text-rose-50">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className={cardBase}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-200/40 text-amber-700 dark:border-amber-300/30 dark:bg-amber-500/25 dark:text-amber-50">
                <PackageMinus className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">Productos con stock bajo</p>
                <p className="text-xs text-[var(--muted-foreground)]">{lowStockTotal > 0 ? `Hay ${lowStockTotal} productos críticos` : "Inventario saludable"}</p>
              </div>
            </div>
            <Badge variant="secondary" className="border-amber-400/50 bg-amber-100/80 text-amber-700 shadow-sm dark:border-amber-300/40 dark:bg-amber-500/30 dark:text-amber-50">
              {numberFormatter.format(lowStockTotal)}
            </Badge>
          </div>
          <ul className="mt-3 space-y-2">
            {loading && !summary && (
              <li className="animate-pulse rounded-xl border border-white/30 bg-white/40 px-3 py-3" />
            )}
            {!loading && lowStockItems.length === 0 && (
              <li className="rounded-xl border border-white/30 bg-white/50 px-3 py-3 text-xs text-[var(--muted-foreground)]">
                No hay alertas de stock por ahora.
              </li>
            )}
            {lowStockItems.map((item) => (
              <li
                key={item.inventarioId}
                className="rounded-xl border border-white/30 bg-white/50 px-3 py-2 shadow-sm dark:border-white/15 dark:bg-white/10"
              >
                <div className="flex items-center justify-between text-sm text-[var(--foreground)]">
                  <span className="truncate font-medium">{item.nombreProducto}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {item.stockDisponible} / {item.stockMinimo}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">{item.almacen}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className={cardBase}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/40 bg-white/55 text-[var(--primary)] shadow-inner dark:border-white/15 dark:bg-white/10 dark:text-[var(--primary-foreground)]">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Resumen operativo</p>
              <p className="text-xs text-[var(--muted-foreground)]">Seguimiento de pendientes clave del negocio.</p>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            {metrics.length === 0 && (
              <div className="rounded-xl border border-white/30 bg-white/50 px-3 py-3 text-xs text-[var(--muted-foreground)]">
                Los indicadores se mostrarán cuando se cargue el resumen.
              </div>
            )}
            {metrics.map((metric) => (
              <Link
                key={metric.label}
                href={metric.href}
                className="flex items-center justify-between rounded-xl border border-white/30 bg-white/50 px-3 py-2 text-sm text-[var(--foreground)] transition hover:-translate-y-0.5 hover:border-white/50 hover:bg-white/60 dark:border-white/15 dark:bg-white/10 dark:text-[var(--primary-foreground)]"
              >
                <span>{metric.label}</span>
                <Badge variant="outline" className="border-white/40 bg-white/60 text-[var(--primary)] shadow-sm dark:border-white/20 dark:bg-white/10 dark:text-[var(--primary-foreground)]">
                  {numberFormatter.format(metric.value)}
                </Badge>
              </Link>
            ))}
          </div>
        </div>

        <div className={cardBase}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/40 bg-white/55 text-[var(--primary)] shadow-inner dark:border-white/15 dark:bg-white/10 dark:text-[var(--primary-foreground)]">
              <AlertCircle className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">Alertas adicionales</p>
              <p className="text-xs text-[var(--muted-foreground)]">Prioriza acciones según estado y vencimientos.</p>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            {loading && !summary && (
              <div className="h-24 animate-pulse rounded-xl border border-white/30 bg-white/40" />
            )}
            {!loading && additionalAlerts.length === 0 && (
              <div className="rounded-xl border border-white/30 bg-white/50 px-3 py-3 text-xs text-[var(--muted-foreground)]">
                No hay alertas pendientes en este momento.
              </div>
            )}
            {additionalAlerts.slice(0, 2).map((alert) => (
              <div
                key={alert.title}
                className={cn(
                  "rounded-2xl border px-3 py-3 shadow-sm",
                  severityStyles[alert.severity]
                )}
              >
                <p className="text-sm font-semibold">{alert.title}</p>
                {renderAlertItems(alert)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
