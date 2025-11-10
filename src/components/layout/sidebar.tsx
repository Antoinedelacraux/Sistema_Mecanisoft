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
  BarChart3,
  ChevronLeft,
  ChevronRight
} from "lucide-react"

import { usePermisos } from '@/hooks/use-permisos'

type MenuItem = {
  title: string
  icon: typeof Home
  href: string
  permiso?: string
  permisos?: string[]
}

type MenuGroup = {
  label: string
  items: MenuItem[]
}

const menuGroups: MenuGroup[] = [
  {
    label: "Inicio",
    items: [
      { title: "Dashboard", icon: Home, href: "/dashboard", permiso: 'dashboard.ver' },
      { title: "Indicadores", icon: BarChart3, href: "/dashboard/indicadores", permisos: ['indicadores.ver', 'mantenimientos.ver'] },
    ],
  },
  {
    label: "Clientes y Vehículos",
    items: [
      { title: "Clientes", icon: Users, href: "/dashboard/clientes", permiso: 'clientes.listar' },
      { title: "Vehículos", icon: Car, href: "/dashboard/vehiculos" },
      { title: "Marcas y Modelos", icon: Settings, href: "/dashboard/vehiculos/marcas" },
    ],
  },
  {
    label: "Operación",
    items: [
      { title: "Órdenes de Trabajo", icon: Wrench, href: "/dashboard/ordenes" },
      { title: "Tareas", icon: ClipboardList, href: "/dashboard/tareas", permiso: 'tareas.ver' },
      { title: "Mis Tareas", icon: Clock, href: "/dashboard/mis-tareas" },
      { title: "Cotizaciones", icon: ClipboardList, href: "/dashboard/cotizaciones", permiso: 'cotizaciones.listar' },
      { title: "Servicios", icon: Wrench, href: "/dashboard/servicios", permiso: 'servicios.listar' },
    ],
  },
  {
    label: "Inventario y Productos",
    items: [
      { title: "Productos", icon: Package, href: "/dashboard/productos" },
      { title: "Inventario", icon: Boxes, href: "/dashboard/inventario", permiso: 'inventario.ver' },
    ],
  },
  {
    label: "Ventas y Finanzas",
    items: [
      { title: "Facturación", icon: Receipt, href: "/dashboard/facturacion", permiso: 'facturacion.emitir' },
      { title: "Ventas", icon: ShoppingCart, href: "/dashboard/ventas", permisos: ['facturacion.ver', 'facturacion.emitir'] },
      { title: "Reportes", icon: FileText, href: "/dashboard/reportes", permiso: 'reportes.ver' },
    ],
  },
  {
    label: "Administración",
    items: [
      { title: "Usuarios", icon: Users, href: "/dashboard/usuarios", permiso: 'usuarios.administrar' },
      { title: "Roles", icon: Shield, href: "/dashboard/roles", permisos: ['roles.ver', 'roles.administrar'] },
      { title: "Trabajadores", icon: Users, href: "/dashboard/trabajadores" },
      { title: "Bitácora", icon: FileText, href: "/dashboard/bitacora", permiso: 'bitacora.ver' },
      { title: "Configuración", icon: Settings, href: "/dashboard/configuracion" },
    ],
  },
]

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()
  const { puede } = usePermisos()
  const [usuarioProfile, setUsuarioProfile] = useState<any | null>(null)
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true)
  const [imageLoaded, setImageLoaded] = useState<boolean>(false)
  const collapsed = isCollapsed && isDesktop

  const visibleGroups = useMemo<MenuGroup[]>(() => (
    menuGroups
      .map((group) => ({
        label: group.label,
        items: group.items.filter((item) => {
          if (Array.isArray(item.permisos)) {
            return item.permisos.some((codigo) => puede(codigo))
          }
          if (item.permiso) {
            return puede(item.permiso)
          }
          return true
        }),
      }))
      .filter((group) => group.items.length > 0)
  ), [puede])

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" })
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)")
    const updateDesktop = (event?: MediaQueryListEvent) => {
      setIsDesktop(event ? event.matches : mediaQuery.matches)
    }

    updateDesktop()

    if (typeof mediaQuery.addEventListener === "function") {
      const listener = (event: MediaQueryListEvent) => updateDesktop(event)
      mediaQuery.addEventListener("change", listener)
      return () => mediaQuery.removeEventListener("change", listener)
    }

    const legacyListener = (event: MediaQueryListEvent) => updateDesktop(event)
    mediaQuery.addListener(legacyListener)
    return () => mediaQuery.removeListener(legacyListener)
  }, [])

  useEffect(() => {
    if (!isDesktop && isCollapsed) {
      setIsCollapsed(false)
    }
  }, [isDesktop, isCollapsed])

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
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-[rgba(34,59,95,0.9)] text-white shadow-lg backdrop-blur"
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
        "fixed left-0 top-0 h-full w-72 overflow-hidden text-[var(--sidebar-foreground)] border-r border-[var(--sidebar-border)] transform transition-transform duration-200 ease-in-out z-40",
        "lg:translate-x-0 lg:static lg:z-auto",
        isOpen ? "translate-x-0" : "-translate-x-full",
        collapsed && isDesktop && "lg:w-[5.75rem]"
      )}>
        <div className="absolute inset-0 bg-[var(--sidebar)]" aria-hidden />
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(213,182,131,0.22),_transparent_60%)]"
          aria-hidden
        />
        <div
          className="absolute inset-x-0 bottom-0 h-56 bg-[radial-gradient(circle_at_bottom,_rgba(34,59,95,0.55),_transparent_70%)]"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-white/5 opacity-30" aria-hidden />

        <div className="relative z-10 flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 p-6 border-b border-white/10">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shadow-inner">
              <Wrench className="w-5 h-5 text-[var(--sidebar-primary)]" />
            </div>
            <div className={cn("min-w-0", collapsed && "lg:hidden")}> 
              <h1 className="font-semibold text-lg tracking-wide">MecaniSoft</h1>
              <p className="text-xs text-white/60">v1.0.0</p>
            </div>
            {isDesktop && (
              <button
                type="button"
                aria-label={collapsed ? "Expandir barra lateral" : "Contraer barra lateral"}
                onClick={() => setIsCollapsed((prev) => !prev)}
                className="ml-auto hidden rounded-full border border-white/10 bg-white/10 p-2 text-white transition hover:bg-white/20 lg:flex"
              >
                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            )}
          </div>

          {/* User info */}
          <div className={cn(
            "p-4 border-b border-white/10 bg-white/10",
            collapsed && "lg:px-4 lg:py-5"
          )}>
            <div className="flex items-center gap-3">
              {/** Avatar: prefer profile image from /api/usuarios/me, fallback to session.user.image, then initials */}
              <div className="w-11 h-11 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
                {loadingProfile ? (
                  <div className="animate-pulse w-full h-full bg-white/20" data-testid="sidebar-avatar-skeleton" />
                ) : usuarioProfile?.imagen_usuario ? (
                  // imageUrl stored as '/uploads/avatars/...' so can be used directly
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={usuarioProfile.imagen_usuario} alt="Avatar" className={cn('w-full h-full object-cover transition-opacity duration-300', imageLoaded ? 'opacity-100' : 'opacity-0')} onLoad={() => setImageLoaded(true)} />
                ) : session?.user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image as string} alt="Avatar" className={cn('w-full h-full object-cover transition-opacity duration-300', imageLoaded ? 'opacity-100' : 'opacity-0')} onLoad={() => setImageLoaded(true)} />
                ) : (
                  <span className="text-sm font-semibold text-white/80">
                    {session?.user?.name?.charAt(0) ?? ''}
                  </span>
                )}
              </div>
              <div className={cn("min-w-0", collapsed && "lg:hidden")}> 
                <p className="font-medium text-sm text-white">{loadingProfile ? <span className="inline-block w-28 h-4 bg-white/10 animate-pulse" data-testid="sidebar-name-skeleton" /> : (usuarioProfile?.persona ? `${usuarioProfile.persona.nombre} ${usuarioProfile.persona.apellido_paterno ?? ''}` : session?.user?.name)}</p>
                <p className="text-xs text-white/70">{loadingProfile ? <span className="inline-block w-20 h-3 bg-white/10 animate-pulse" data-testid="sidebar-role-skeleton" /> : (usuarioProfile?.rol?.nombre ?? session?.user?.role)}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className={cn(
            "flex-1 px-5 py-6 overflow-y-auto",
            collapsed && "lg:px-3"
          )}>
            <div className="space-y-6">
              {visibleGroups.map((group) => (
                <div key={group.label}>
                  <p className={cn(
                    "px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.34em] text-white/50",
                    collapsed && "lg:hidden"
                  )}>
                    {group.label}
                  </p>
                  <ul className="space-y-1.5">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const isActive = !!pathname && (pathname === item.href || pathname.startsWith(item.href + '/'))

                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            title={item.title}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all border border-white/10 shadow-[0_10px_30px_-20px_rgba(8,12,24,0.9)]",
                              collapsed && "lg:justify-center lg:px-2",
                              isActive
                                ? "bg-white/18 text-white border-white/20 backdrop-blur"
                                : "text-white/70 hover:bg-white/8 hover:text-white hover:border-white/15"
                            )}
                          >
                            <Icon className="w-5 h-5" />
                            <span className={cn("truncate", collapsed && "lg:hidden")}>{item.title}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-white/10 bg-white/10">
            <Button 
              variant="ghost" 
              className={cn(
                "w-full gap-3 text-red-100 hover:text-white hover:bg-red-500/40",
                collapsed ? "lg:justify-center" : "lg:justify-start"
              )}
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5" />
              <span className={cn(collapsed && "lg:hidden")}>Cerrar Sesión</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}