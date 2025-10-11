import type { Metadata } from "next"
import FacturacionDashboard from "@/components/facturacion/facturacion-dashboard"

export const metadata: Metadata = {
  title: "Facturación | MecaniSoft",
  description: "Configura parámetros de facturación electrónica y gestiona comprobantes emitidos.",
}

export default function FacturacionPage() {
  return <FacturacionDashboard />
}
