'use client'

import { useEffect, useState } from "react"
import { signIn, getSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Wrench } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isMounted, setIsMounted] = useState(false)
  
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 80)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Usuario o contraseña incorrectos")
        toast("Error de autenticación", {
          description: "Usuario o contraseña incorrectos",
          variant: "destructive",
        })
      } else {
        const session = await getSession()
        const requiereCambio = session?.user?.requiresPasswordChange

        if (requiereCambio) {
          toast("Contraseña temporal detectada", {
            description: "Debes registrar una nueva contraseña para continuar"
          })
          router.push("/dashboard/cambio-password")
        } else {
          toast(
            "¡Bienvenido!",
            { description: "Sesión iniciada correctamente" }
          )
          router.push("/dashboard")
          router.refresh()
        }
      }
    } catch (error) {
      console.error("Error en login:", error)
      setError("Error del servidor. Intenta nuevamente.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[url('/images/login-bg.svg')] bg-cover bg-center" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b1224]/85 via-[#0b1224]/70 to-[#223b5f]/55" aria-hidden />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center p-6">
        <div
          className={`w-full max-w-2xl transition-all duration-700 ease-out ${isMounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          {/* Logo y título */}
          <div className="text-center mb-10">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-white/15 border border-white/10 flex items-center justify-center backdrop-blur">
              <Wrench className="w-8 h-8 text-[var(--accent)]" />
            </div>
            <h1 className="text-3xl font-semibold text-white mt-6">MecaniSoft</h1>
            <p className="text-sm text-white/70 mt-2 tracking-wide">Sistema integral para la gestión moderna del taller</p>
          </div>

          {/* Formulario de login */}
          <Card className="bg-white/90 backdrop-blur-xl border-white/40 shadow-2xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-semibold text-[var(--primary)]">Iniciar Sesión</CardTitle>
              <CardDescription className="text-sm text-[var(--foreground)] opacity-70">
                Ingresa tus credenciales para acceder al sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-8">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="username">Usuario</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ingresa tu usuario"
                    required
                    disabled={isLoading}
                    className="bg-white/70 backdrop-blur border-[var(--border)] focus-visible:ring-[var(--primary)]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña"
                    required
                    disabled={isLoading}
                    className="bg-white/70 backdrop-blur border-[var(--border)] focus-visible:ring-[var(--primary)]"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50/80 border border-red-200 rounded-lg px-3 py-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 text-base bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[#1c2e4c]"
                  disabled={isLoading}
                >
                  {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
                </Button>
              </form>

              {/* Credenciales de prueba */}
              <div className="mt-8 p-5 rounded-xl bg-white/60 border border-white/50 shadow-inner">
                <p className="text-sm font-semibold text-[var(--primary)] mb-3 uppercase tracking-widest">
                  Credenciales de prueba
                </p>
                <div className="grid gap-4 text-sm text-[var(--foreground)] opacity-80 md:grid-cols-2">
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">Administrador</p>
                    <p><strong>Usuario:</strong> admin.pruebas</p>
                    <p><strong>Contraseña:</strong> Admin123!</p>
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">Recepción</p>
                    <p><strong>Usuario:</strong> recepcion.lucia</p>
                    <p><strong>Contraseña:</strong> Taller123!</p>
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">Mecánico senior</p>
                    <p><strong>Usuario:</strong> mecanico.jorge</p>
                    <p><strong>Contraseña:</strong> Taller123!</p>
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">Diagnóstico</p>
                    <p><strong>Usuario:</strong> mecanico.sofia</p>
                    <p><strong>Contraseña:</strong> Taller123!</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}