import type { Metadata } from "next"
import VentasDashboard from "@/components/ventas/ventas-dashboard"

export const metadata: Metadata = {
  title: "Ventas | MecaniSoft",
  description: "Analiza el rendimiento de ventas y concilia pagos de comprobantes emitidos."
}

export default function VentasPage() {
  return <VentasDashboard />
}
