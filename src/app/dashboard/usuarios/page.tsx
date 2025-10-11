'use client'

import { useEffect, useState } from 'react'
import type { Rol } from '@prisma/client'

import { UsuariosTable } from '@/components/usuarios/usuarios-table'
import { UsuarioCreateForm, UsuarioEditForm } from '@/components/usuarios/usuario-form'
import { UsuarioDetalle } from '@/components/usuarios/usuario-detalle'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/components/ui/use-toast'
import type { UsuarioCompleto } from '@/types'

interface RolesResponse {
  roles: Rol[]
}

const fetchRoles = async (): Promise<Rol[]> => {
  const response = await fetch('/api/roles', {
    credentials: 'include',
    cache: 'no-store'
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const message = body?.error ?? 'No se pudo obtener la lista de roles'
    throw new Error(message)
  }

  const data: RolesResponse = await response.json()
  return data.roles
}

type ModalState = 'closed' | 'create' | 'edit' | 'view'

export default function UsuariosPage() {
  const [modalState, setModalState] = useState<ModalState>('closed')
  const [selectedUsuario, setSelectedUsuario] = useState<UsuarioCompleto | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [roles, setRoles] = useState<Rol[]>([])
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)

  const { toast } = useToast()

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const data = await fetchRoles()
        setRoles(data)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Error al cargar roles'
        toast({ title: 'Error', description: message, variant: 'destructive' })
      }
    }

    loadRoles()
  }, [toast])

  const closeModal = () => {
    setModalState('closed')
    setSelectedUsuario(null)
  }

  const handleCreate = () => {
    setSelectedUsuario(null)
    setModalState('create')
  }

  const handleEdit = (usuario: UsuarioCompleto) => {
    setSelectedUsuario(usuario)
    setModalState('edit')
  }

  const handleView = (usuario: UsuarioCompleto) => {
    setSelectedUsuario(usuario)
    setModalState('view')
  }

  const handleSuccess = () => {
    closeModal()
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Usuarios</h1>
        <p className="text-gray-600">Gestiona las credenciales, roles y accesos del equipo del taller</p>
      </header>

      {generatedPassword && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTitle>Contraseña generada</AlertTitle>
          <AlertDescription>
            Guarda esta contraseña temporal en un lugar seguro: <strong>{generatedPassword}</strong>
          </AlertDescription>
        </Alert>
      )}

      <UsuariosTable
        roles={roles.map((rol) => ({ id_rol: rol.id_rol, nombre_rol: rol.nombre_rol }))}
        onCreateNew={handleCreate}
        onEdit={handleEdit}
        onView={handleView}
        refreshTrigger={refreshTrigger}
        onRequireRefresh={() => setRefreshTrigger((prev) => prev + 1)}
      />

      <Dialog open={modalState === 'create'} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="sr-only">Crear usuario</DialogTitle>
          </DialogHeader>
          <UsuarioCreateForm
            roles={roles}
            onSuccess={handleSuccess}
            onCancel={closeModal}
            onPasswordGenerated={(password) => setGeneratedPassword(password)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={modalState === 'edit'} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="sr-only">Editar usuario</DialogTitle>
          </DialogHeader>
          {selectedUsuario && (
            <UsuarioEditForm
              usuario={selectedUsuario}
              roles={roles}
              onSuccess={handleSuccess}
              onCancel={closeModal}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={modalState === 'view'} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Detalle de usuario</DialogTitle>
          </DialogHeader>
          {selectedUsuario && <UsuarioDetalle usuario={selectedUsuario} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
