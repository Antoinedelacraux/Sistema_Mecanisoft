"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useMemo } from "react"
import {
  BarChart3,
  CalendarDays,
  FileText,
  Layers,
  Trash2,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { usePermisos } from "@/hooks/use-permisos"

type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  permiso?: string
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Resumen",
    href: "/dashboard/reportes",
    icon: FileText,
    permiso: "reportes.ver",
  },
  {
    label: "Plantillas",
    href: "/dashboard/reportes/templates",
    icon: Layers,
    permiso: "reportes.ver",
  },
  {
    label: "Programaciones",
    href: "/dashboard/reportes/schedules",
    icon: CalendarDays,
    permiso: "reportes.ver",
  },
  {
    label: "Ventas resumen",
    href: "/dashboard/reportes/ventas-resumen",
    icon: BarChart3,
    permiso: "reportes.ver",
  },
  {
    label: "Purgar archivos",
    href: "/dashboard/reportes/purge",
    icon: Trash2,
    permiso: "reportes.gestionar",
  },
]

export function ReportesLayoutShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { puede } = usePermisos()

  const items = useMemo(() => {
    return NAV_ITEMS.filter((item) => (item.permiso ? puede(item.permiso) : true))
  }, [puede])

  return (
    <div className="space-y-8">
      <nav className="flex flex-wrap gap-2">
        {items.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div>{children}</div>
    </div>
  )
}
