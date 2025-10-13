import { Metadata } from 'next'
import { Shield } from 'lucide-react'
import { getServerSession } from 'next-auth'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RolesPermissionsPanel } from '@/components/permisos/roles-panel'
import { UsuariosPermissionsPanel } from '@/components/permisos/usuarios-panel'
import { authOptions } from '@/lib/auth'
import { asegurarPermiso, PermisoDenegadoError, SesionInvalidaError } from '@/lib/permisos/guards'

export const metadata: Metadata = {
  title: 'Permisos y seguridad',
  description: 'Administra plantillas de permisos por rol y personalizaciones individuales.'
}

export default async function PermisosPage() {
  const session = await getServerSession(authOptions)
  try {
    await asegurarPermiso(session, 'permisos.asignar')
  } catch (error) {
    if (error instanceof SesionInvalidaError) {
      return (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">Sesión requerida</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Debes iniciar sesión nuevamente para administrar permisos.
          </p>
        </div>
      )
    }

    if (error instanceof PermisoDenegadoError) {
      return (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">Acceso restringido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No cuentas con permisos para administrar la configuración de seguridad.
          </p>
        </div>
      )
    }

    throw error
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Permisos y seguridad</h1>
            <p className="text-gray-600">
              Controla qué módulos y acciones puede ejecutar cada rol y ajusta excepciones para usuarios específicos.
            </p>
          </div>
        </div>
      </header>

      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roles">Plantilla por rol</TabsTrigger>
          <TabsTrigger value="usuarios">Personalizaciones por usuario</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-4">
          <RolesPermissionsPanel />
        </TabsContent>

        <TabsContent value="usuarios" className="space-y-4">
          <UsuariosPermissionsPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
