"use client"

import { Suspense, useState } from "react"
import FacturacionComprobantes from "@/components/facturacion/facturacion-comprobantes"
import FacturacionSettings from "@/components/facturacion/facturacion-settings"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const SettingsFallback = () => (
  <div className="space-y-6">
    <div className="space-y-2">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
    </div>
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <Skeleton className="h-96 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
    <Skeleton className="h-96 w-full" />
  </div>
)

export default function FacturacionDashboard() {
  const [tab, setTab] = useState("comprobantes")

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Facturación</h1>
        <p className="text-muted-foreground">
          Controla tus comprobantes electrónicos y ajusta las preferencias de emisión.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="comprobantes">Comprobantes</TabsTrigger>
          <TabsTrigger value="config">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="comprobantes" className="space-y-4">
          <FacturacionComprobantes />
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Suspense fallback={<SettingsFallback />}>
            <FacturacionSettings />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
