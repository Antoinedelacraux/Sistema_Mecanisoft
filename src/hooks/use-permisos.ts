import { useSession } from 'next-auth/react'
import { useCallback, useMemo } from 'react'

export function usePermisos() {
  const { data: session, status } = useSession()

  const permisos = useMemo(() => session?.user?.permisos ?? [], [session?.user?.permisos])

  const puede = useCallback(
    (codigoPermiso: string) => {
      return permisos.includes(codigoPermiso)
    },
    [permisos]
  )

  return {
    session,
    status,
    permisos,
    puede,
    cargando: status === 'loading'
  }
}

export function usePermiso(codigoPermiso: string) {
  const { puede, cargando } = usePermisos()
  return {
    permitido: puede(codigoPermiso),
    cargando
  }
}
