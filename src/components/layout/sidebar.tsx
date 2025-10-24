'use client'

import { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { 
  Home, 
  Users, 
  Car, 
  Package, 
  FileText, 
  Settings, 
  LogOut,
  Menu,
  X,
  Wrench,
  ShoppingCart,
  ClipboardList,
  Clock,
  Receipt,
  Boxes,
  Shield,
  BarChart3
} from "lucide-react"

import { usePermisos } from '@/hooks/use-permisos'

type MenuItem = {
  title: string
  icon: typeof Home
  href: string
  permiso?: string
  permisos?: string[]
}

const menuItems: MenuItem[] = [
  {
    title: "Dashboard",
    icon: Home,
    href: "/dashboard",
    permiso: 'dashboard.ver'
  },
  {
    title: "Indicadores",
    icon: BarChart3,
    href: "/dashboard/indicadores",
    permisos: ['indicadores.ver', 'mantenimientos.ver']
  },
  {
    title: "Clientes",
    icon: Users,
    href: "/dashboard/clientes",
    permiso: 'clientes.listar'
  },
  {
    title: "Vehículos", 
    icon: Car,
    href: "/dashboard/vehiculos",
  },
  {
    title: "Marcas y Modelos", 
    icon: Settings, 
    href: "/dashboard/vehiculos/marcas",
  },
  {
    title: "Productos",
    icon: Package,
    href: "/dashboard/productos",
  },
  {
    title: "Inventario",
    icon: Boxes,
    href: "/dashboard/inventario",
    permiso: 'inventario.ver'
  },
  {
    title: "Servicios",
    icon: Wrench,
    href: "/dashboard/servicios",
    permiso: 'servicios.listar'
  },
  {
    title: "Trabajadores",
    icon: Users,
    href: "/dashboard/trabajadores",
  },
  {
    title: "Usuarios",
    icon: Users,
    href: "/dashboard/usuarios",
    permiso: 'usuarios.administrar'
  },
  {
    title: "Roles",
    icon: Shield,
    href: "/dashboard/roles",
    permisos: ['roles.ver', 'roles.administrar']
  },
  {
    title: "Tareas",
    icon: ClipboardList,
    href: "/dashboard/tareas",
    permiso: 'tareas.ver'
  },
  {
    title: "Mis Tareas",
    icon: Clock,
    href: "/dashboard/mis-tareas",
  },
  {
    title: "Órdenes de Trabajo",
    icon: Wrench,
    href: "/dashboard/ordenes",
  },
  {
    title: "Cotizaciones",
    icon: ClipboardList,
    href: "/dashboard/cotizaciones",
    permiso: 'cotizaciones.listar'
  },
  {
    title: "Facturación",
    icon: Receipt,
    href: "/dashboard/facturacion",
    permiso: 'facturacion.emitir'
  },
  {
    title: "Ventas",
    icon: ShoppingCart,
    href: "/dashboard/ventas",
    permisos: ['facturacion.ver', 'facturacion.emitir']
  },
  {
    title: "Reportes",
    icon: FileText,
    href: "/dashboard/reportes",
    permiso: 'reportes.ver'
  },
  {
    title: "Bitácora",
    icon: FileText,
    href: "/dashboard/bitacora",
    permiso: 'bitacora.ver'
  },
  {
    title: "Configuración",
    icon: Settings,
    href: "/dashboard/configuracion",
  },
]

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()
  const { puede } = usePermisos()
  const [usuarioProfile, setUsuarioProfile] = useState<any | null>(null)
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true)
  const [imageLoaded, setImageLoaded] = useState<boolean>(false)

  const visibleItems = useMemo<MenuItem[]>(() => (
    menuItems.filter((item) => {
      if (Array.isArray(item.permisos)) {
        return item.permisos.some((codigo) => puede(codigo))
      }
      if (item.permiso) {
        return puede(item.permiso)
      }
      return true
    })
  ), [puede])

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" })
  }

  // fetch current usuario profile (includes imagen_usuario and persona/rol)
  useEffect(() => {
    let mounted = true

    async function fetchProfile() {
      setLoadingProfile(true)
      try {
        const res = await fetch('/api/usuarios/me')
        if (!res.ok) return
        const data = await res.json()
        if (mounted && data?.usuario) setUsuarioProfile(data.usuario)
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoadingProfile(false)
      }
    }

    fetchProfile()

    const handler = (e: Event) => {
      const c = e as CustomEvent
      const detail = c?.detail
      if (detail) {
        // if the event includes the full usuario, replace; if it includes only imagen_usuario, patch it
        if (detail.usuario) {
          setUsuarioProfile(detail.usuario)
          setLoadingProfile(false)
          return
        }
        if (detail.imagen_usuario) {
          setUsuarioProfile((prev: any) => ({ ...(prev ?? {}), imagen_usuario: detail.imagen_usuario }))
          // reset imageLoaded so new image fades in
          setImageLoaded(false)
          setLoadingProfile(false)
          return
        }
      }
      // fallback: re-fetch
      void fetchProfile()
    }

  window.addEventListener('user-profile-updated', handler as EventListener)

    return () => {
      mounted = false
      window.removeEventListener('user-profile-updated', handler as EventListener)
    }
  }, [])

  return (
    <>
      {/* Botón mobile */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-blue-600 text-white rounded-md"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Overlay mobile */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out z-40",
        "lg:translate-x-0 lg:static lg:z-auto",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="flex items-center gap-2 p-6 border-b border-gray-200">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg">MecaniSoft</h1>
            <p className="text-xs text-gray-500">v1.0.0</p>
          </div>
        </div>

        {/* User info */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {/** Avatar: prefer profile image from /api/usuarios/me, fallback to session.user.image, then initials */}
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                {loadingProfile ? (
                  <div className="animate-pulse w-full h-full bg-gray-300" data-testid="sidebar-avatar-skeleton" />
                ) : usuarioProfile?.imagen_usuario ? (
                  // imageUrl stored as '/uploads/avatars/...' so can be used directly
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={usuarioProfile.imagen_usuario} alt="Avatar" className={cn('w-full h-full object-cover transition-opacity duration-300', imageLoaded ? 'opacity-100' : 'opacity-0')} onLoad={() => setImageLoaded(true)} />
                ) : session?.user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image as string} alt="Avatar" className={cn('w-full h-full object-cover transition-opacity duration-300', imageLoaded ? 'opacity-100' : 'opacity-0')} onLoad={() => setImageLoaded(true)} />
                ) : (
                  <span className="text-sm font-semibold text-gray-700">
                    {session?.user?.name?.charAt(0) ?? ''}
                  </span>
                )}
            </div>
            <div>
              <p className="font-medium text-sm">{loadingProfile ? <span className="inline-block w-28 h-4 bg-gray-200 animate-pulse" data-testid="sidebar-name-skeleton" /> : (usuarioProfile?.persona ? `${usuarioProfile.persona.nombre} ${usuarioProfile.persona.apellido_paterno ?? ''}` : session?.user?.name)}</p>
              <p className="text-xs text-gray-500">{loadingProfile ? <span className="inline-block w-20 h-3 bg-gray-200 animate-pulse" data-testid="sidebar-role-skeleton" /> : (usuarioProfile?.rol?.nombre ?? session?.user?.role)}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon
              const isActive = !!pathname && (pathname === item.href || pathname.startsWith(item.href + '/'))
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      isActive 
                        ? "bg-blue-50 text-blue-700 border-r-2 border-blue-700" 
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {item.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-200">
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </Button>
        </div>
      </div>
    </>
  )
}