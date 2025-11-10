import React from 'react'
import ProfileConfig from '@/components/usuarios/ProfileConfig'

export default function ConfiguracionPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-[var(--foreground)]">Configuración de usuario</h2>
        <p className="text-sm text-muted-foreground">
          Actualiza tus datos personales, credenciales y preferencias visuales del perfil.
        </p>
      </div>
      <ProfileConfig />
    </div>
  )
}
