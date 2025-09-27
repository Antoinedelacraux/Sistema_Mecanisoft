'use client'

import { MarcasModelosManager } from '@/components/vehiculos/marcas-modelos-manager'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function MarcasPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      {/* Header con navegación */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Marcas y Modelos</h1>
          <p className="text-gray-600 mt-2">
            Gestiona las marcas y modelos de vehículos del sistema
          </p>
        </div>
      </div>

      {/* Componente principal */}
      <MarcasModelosManager onClose={() => router.push('/dashboard/vehiculos')} />
    </div>
  )
}