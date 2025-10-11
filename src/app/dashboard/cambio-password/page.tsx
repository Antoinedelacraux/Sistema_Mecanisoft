'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signIn, signOut } from 'next-auth/react'
import { z } from 'zod'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, ShieldAlert } from 'lucide-react'

const passwordSchema = z.object({
  password_actual: z.string().min(8, 'La contraseña actual debe tener al menos 8 caracteres').optional(),
  password: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
  confirmar_password: z.string().min(8, 'La confirmación debe tener al menos 8 caracteres')
}).refine((data) => data.password === data.confirmar_password, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmar_password']
})

export default function CambioPasswordPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [formState, setFormState] = useState({
    password_actual: '',
    password: '',
    confirmar_password: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const requiereCambio = useMemo(() => session?.user?.requiresPasswordChange ?? false, [session])
  const mostrarCampoActual = useMemo(() => !requiereCambio, [requiereCambio])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setFieldErrors({})
    setIsSubmitting(true)

    try {
      const parsed = passwordSchema.safeParse({
        password_actual: mostrarCampoActual ? formState.password_actual : undefined,
        password: formState.password,
        confirmar_password: formState.confirmar_password
      })

      if (!parsed.success) {
        const issues = parsed.error.flatten()
        const mapped: Record<string, string> = {}
        for (const [key, messages] of Object.entries(issues.fieldErrors)) {
          if (messages && messages.length > 0) {
            mapped[key] = messages[0] ?? ''
          }
        }
        setFieldErrors(mapped)
        setIsSubmitting(false)
        return
      }

      const response = await fetch('/api/usuarios/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password_actual: mostrarCampoActual ? formState.password_actual : undefined,
          password: formState.password,
          confirmar_password: formState.confirmar_password
        })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(typeof data?.error === 'string' ? data.error : 'No se pudo actualizar la contraseña')
        setIsSubmitting(false)
        return
      }

      const username = session?.user?.username ?? ''
      if (!username) {
        toast('Contraseña actualizada', {
          description: 'Vuelve a iniciar sesión para continuar'
        })
        setIsSubmitting(false)
        await signOut({ callbackUrl: '/login' })
        return
      }

      const reLogin = await signIn('credentials', {
        username,
        password: formState.password,
        redirect: false
      })

      if (reLogin?.error) {
        toast('Contraseña actualizada', {
          description: 'Inicia sesión nuevamente para continuar'
        })
        setIsSubmitting(false)
        await signOut({ callbackUrl: '/login' })
        return
      }

      toast('¡Contraseña actualizada!', {
        description: 'Tu sesión continúa activa'
      })
      setIsSubmitting(false)
      router.replace('/dashboard')
      router.refresh()
    } catch (err) {
      console.error('[CambioPassword] Error:', err)
      setError('Ocurrió un error inesperado')
      setIsSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="space-y-2">
          <CardTitle>Actualizar contraseña</CardTitle>
          <CardDescription>
            {requiereCambio
              ? 'Debes establecer una nueva contraseña permanente antes de continuar usando el sistema.'
              : 'Te recomendamos cambiar tu contraseña periódicamente para mantener la seguridad.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6 border border-amber-200 bg-amber-50 text-amber-900">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Seguridad primero</AlertTitle>
            <AlertDescription>
              Usa una contraseña única, con al menos 8 caracteres y combina letras, números y símbolos.
            </AlertDescription>
          </Alert>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {mostrarCampoActual && (
              <div className="space-y-2">
                <Label htmlFor="password_actual">Contraseña actual</Label>
                <Input
                  id="password_actual"
                  name="password_actual"
                  type="password"
                  autoComplete="current-password"
                  value={formState.password_actual}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors.password_actual && (
                  <p className="text-sm text-red-600">{fieldErrors.password_actual}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Nueva contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={formState.password}
                onChange={handleChange}
                disabled={isSubmitting}
                required
              />
              {fieldErrors.password && (
                <p className="text-sm text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmar_password">Confirmar nueva contraseña</Label>
              <Input
                id="confirmar_password"
                name="confirmar_password"
                type="password"
                autoComplete="new-password"
                value={formState.confirmar_password}
                onChange={handleChange}
                disabled={isSubmitting}
                required
              />
              {fieldErrors.confirmar_password && (
                <p className="text-sm text-red-600">{fieldErrors.confirmar_password}</p>
              )}
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col sm:flex-row-reverse sm:items-center sm:justify-between gap-2">
              <Button type="submit" disabled={isSubmitting} className="sm:w-auto">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando
                  </>
                ) : (
                  'Guardar contraseña'
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={isSubmitting}
                onClick={() => signOut({ callbackUrl: '/login' })}
              >
                Cerrar sesión
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
