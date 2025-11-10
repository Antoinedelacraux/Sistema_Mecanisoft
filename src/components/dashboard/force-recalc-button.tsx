"use client"

import { RefreshCw } from "lucide-react"
import { useTransition } from "react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"

type ForceRecalcButtonProps = {
  from: string
  to: string
}

export function ForceRecalcButton({ from, to }: ForceRecalcButtonProps) {
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      try {
        const response = await fetch('/api/indicadores/recalcular', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from, to }),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.error ?? 'Error desconocido al recalcular')
        }

        toast({
          title: 'Indicadores recalculados',
          description: 'Los KPIs fueron regenerados con éxito.',
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        toast({
          title: 'No se pudo recalcular',
          description: message,
          variant: 'destructive',
        })
      }
    })
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={pending} className="gap-2">
      <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
      Recalcular KPIs
    </Button>
  )
}
