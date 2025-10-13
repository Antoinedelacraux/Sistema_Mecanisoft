'use client'

import type { ReactNode } from 'react'

import { usePermiso } from '@/hooks/use-permisos'

type PermisoGateProps = {
  permiso: string
  children: ReactNode
  fallback?: ReactNode
  loadingFallback?: ReactNode
}

export function PermisoGate({ permiso, children, fallback = null, loadingFallback = null }: PermisoGateProps) {
  const { permitido, cargando } = usePermiso(permiso)

  if (cargando) {
    return loadingFallback
  }

  if (!permitido) {
    return fallback
  }

  return <>{children}</>
}
