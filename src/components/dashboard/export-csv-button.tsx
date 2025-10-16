"use client"

import { useMemo } from 'react'
import { Download } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'

type ExportCsvButtonProps = {
  label?: string
}

export function ExportCsvButton({ label = 'Exportar CSV' }: ExportCsvButtonProps) {
  const searchParams = useSearchParams()

  const href = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('format')
    params.set('format', 'csv')
    return `/api/dashboard/ventas-series?${params.toString()}`
  }, [searchParams])

  return (
    <Button asChild variant="outline" size="sm">
      <a href={href} className="flex items-center gap-2">
        <Download className="h-4 w-4" />
        {label}
      </a>
    </Button>
  )
}
