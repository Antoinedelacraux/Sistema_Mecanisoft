'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const DEFAULT_ROUTES = [
  '/dashboard/reportes',
  '/dashboard/reportes/ventas-resumen',
  '/dashboard/indicadores',
  '/dashboard/ordenes',
  '/dashboard/inventario'
]

export function DashboardPrefetcher({ routes = DEFAULT_ROUTES }: { routes?: string[] }) {
  const router = useRouter()

  useEffect(() => {
    routes.forEach((route) => {
      if (route) {
        router.prefetch(route)
      }
    })
  }, [router, routes])

  return null
}
