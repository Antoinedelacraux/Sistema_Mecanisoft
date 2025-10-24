"use client"

import React, { useEffect, useState } from 'react'
import AvatarCropper from './AvatarCropper'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

type Usuario = {
  id_usuario: number
  nombre_usuario: string
  imagen_usuario?: string
  persona?: { nombre: string; apellido_paterno: string; apellido_materno?: string; correo?: string }
}

export default function ProfileConfig() {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [loading, setLoading] = useState(false)
  const [bitacora, setBitacora] = useState<Array<any>>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const { toast } = useToast()

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/usuarios/me')
      const data = await res.json()
      setUsuario(data.usuario)
  const persona = data.usuario?.persona
  const fullName = [persona?.nombre, persona?.apellido_paterno, persona?.apellido_materno].filter(Boolean).join(' ')
  setName(fullName)
      setEmail(data.usuario?.persona?.correo ?? '')
      setUsername(data.usuario?.nombre_usuario ?? '')
      setAvatarPreview(data.usuario?.imagen_usuario ?? null)
    } catch (e) {
      console.error('Error cargando usuario', e)
      toast({ title: 'Error', description: 'No se pudo cargar el usuario', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // react-hook-form + zod schema
  const schema = z.object({
    nombre: z.string().min(1, 'Nombre requerido').optional(),
    correo: z.string().email('Email inválido').optional()
  })

  type FormValues = z.infer<typeof schema>

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({ resolver: zodResolver(schema) })
  const currentFileRef = React.useRef<File | null>(null)
  const [cropperOpen, setCropperOpen] = useState(false)
  const [cropperSrc, setCropperSrc] = useState<string | null>(null)
  const [willOpenCropperOnFile, setWillOpenCropperOnFile] = useState(false)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [versions, setVersions] = useState<any[]>([])
  // when the fetched `name` / `email` states change, update the form fields so
  // the controlled inputs show the registered values (react-hook-form defaultValue
  // only applies at mount).
  useEffect(() => {
    // reset form values to reflect loaded name/email
    try { reset({ nombre: name, correo: email }) } catch (_) {}
  }, [name, email, reset])
  async function onSubmit(values: FormValues) {
    try {
      const res = await fetch('/api/usuarios/me', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
      const data = await res.json()
      if (data.success) toast({ title: 'Perfil actualizado', variant: 'success' })
      else toast({ title: 'Error', description: 'Error actualizando', variant: 'destructive' })
      // refresh local fields
      await load()
      try { window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: { usuario: data.usuario } })) } catch (_) {}
  const persona2 = data.usuario?.persona
  const fullName2 = [persona2?.nombre, persona2?.apellido_paterno, persona2?.apellido_materno].filter(Boolean).join(' ')
  reset({ nombre: fullName2, correo: data.usuario?.persona?.correo })
    } catch (e) {
      console.error(e)
      toast({ title: 'Error', description: 'Error actualizando perfil', variant: 'destructive' })
    }
  }
  // upload with progress using XHR to show progress bar
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [previousAvatar, setPreviousAvatar] = useState<string | null>(null)

  // helper to upload a file via XHR (used for immediate uploads and for cropped file uploads)
  function uploadFileWithProgress(file: File) {
    return new Promise<void>((resolve) => {
      const form = new FormData()
      form.append('avatar', file)
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/usuarios/me/avatar')
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100))
      }
      xhr.onload = async () => {
        setUploadProgress(null)
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText)
            if (data.success) {
              setPreviousAvatar(usuario?.imagen_usuario ?? null)
              setAvatarPreview(data.imageUrl)
              try { window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: { imagen_usuario: data.imageUrl } })) } catch (_) {}
              toast({ title: 'Avatar subido', variant: 'success' })
              // refresh server session cookie so SSR components see updated image
              try { await fetch('/api/auth/refresh-session', { method: 'POST' }) } catch (_) {}
              await load()
            } else {
              toast({ title: 'Error', description: data.error || 'Error subiendo avatar', variant: 'destructive' })
            }
          } catch (err) {
            toast({ title: 'Error', description: 'Respuesta inválida del servidor', variant: 'destructive' })
          }
        } else {
          toast({ title: 'Error', description: 'Error subiendo avatar', variant: 'destructive' })
        }
        resolve()
      }
      xhr.onerror = () => { setUploadProgress(null); toast({ title: 'Error', description: 'Error subiendo avatar', variant: 'destructive' }); resolve() }
      xhr.send(form)
    })
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // preview immediately
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(String(reader.result))
    reader.readAsDataURL(file)

    // store candidate file for potential crop/replace
    currentFileRef.current = file

    // If the user intended to open the cropper (we set willOpenCropperOnFile),
    // open the cropper modal with the selected file instead of uploading immediately.
    if (willOpenCropperOnFile) {
      setWillOpenCropperOnFile(false)
      const url = URL.createObjectURL(file)
      setCropperSrc(url)
      setCropperOpen(true)
      return
    }

    // start upload immediately (keeps previous behavior)
    await uploadFileWithProgress(file)
  }

  // center-crop image to square using canvas, returns a File
  // center-crop functionality removed; users should use the interactive cropper

  function openCropper() {
    const file = currentFileRef.current
    if (!file) {
      // if there's no file, set a flag so when the user selects one we open the cropper
      setWillOpenCropperOnFile(true)
      const el = document.getElementById('avatar-upload') as HTMLInputElement | null
      if (el) el.click()
      return
    }
    const url = URL.createObjectURL(file)
    setCropperSrc(url)
    setCropperOpen(true)
  }

  function handleCropperCancel() {
    if (cropperSrc) URL.revokeObjectURL(cropperSrc)
    setCropperOpen(false)
    setCropperSrc(null)
  }

  async function handleCropperComplete(file: File) {
    // set candidate and preview
    currentFileRef.current = file
    const reader = new FileReader()
    reader.onload = () => setAvatarPreview(String(reader.result))
    reader.readAsDataURL(file)
    if (cropperSrc) URL.revokeObjectURL(cropperSrc)
    setCropperOpen(false)
    setCropperSrc(null)
    toast({ title: 'Recorte listo', variant: 'success' })
  }

  // upload the current candidate file (after crop)
  async function handleAvatarUploadRef() {
    const file = currentFileRef.current
    if (!file) return
    await uploadFileWithProgress(file)
  }

  // username change
  const [username, setUsername] = useState('')
  const [changingUsername, setChangingUsername] = useState(false)
  async function handleChangeUsername(e: React.FormEvent) {
    e.preventDefault()
    if (!username) return toast({ title: 'Nombre de usuario requerido', variant: 'destructive' })
    setChangingUsername(true)
    try {
      const res = await fetch('/api/usuarios/me/username', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Nombre de usuario actualizado', variant: 'success' })
        try { await fetch('/api/auth/refresh-session', { method: 'POST' }) } catch (_) {}
        await load()
      } else {
        toast({ title: 'Error', description: data.error || 'No se pudo actualizar nombre de usuario', variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Error actualizando nombre de usuario', variant: 'destructive' })
    } finally { setChangingUsername(false) }
  }

  // password change
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!currentPassword || !newPassword || !confirmPassword) return toast({ title: 'Completa todos los campos', variant: 'destructive' })
    if (newPassword !== confirmPassword) return toast({ title: 'Las contraseñas no coinciden', variant: 'destructive' })
    setChangingPassword(true)
    try {
      const res = await fetch('/api/usuarios/me/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Contraseña actualizada', variant: 'success' })
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        toast({ title: 'Error', description: data.error || 'No se pudo cambiar la contraseña', variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Error cambiando contraseña', variant: 'destructive' })
    } finally { setChangingPassword(false) }
  }

  // fetch recent bitacora for this user
  async function loadBitacora() {
    if (!usuario) return
    try {
      const params = new URLSearchParams({ usuarioId: String(usuario.id_usuario), perPage: '10' })
      const res = await fetch(`/api/bitacora?${params.toString()}`)
      if (!res.ok) return
      const data = await res.json()
      setBitacora(data.eventos ?? [])
    } catch (e) {
      /* ignore */
    }
  }

  useEffect(() => { if (usuario) loadBitacora() }, [usuario])

  async function handleRevertAvatar() {
    if (!previousAvatar) return
    try {
      const res = await fetch('/api/usuarios/me/avatar/revert', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setAvatarPreview(data.imageUrl)
        toast({ title: 'Avatar restaurado', variant: 'success' })
        try { window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: { imagen_usuario: data.imageUrl } })) } catch (_) {}
        try { await fetch('/api/auth/refresh-session', { method: 'POST' }) } catch (_) {}
        await load()
      } else {
        toast({ title: 'Error', description: data.error || 'No se pudo restaurar avatar', variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: 'Error', description: 'No se pudo restaurar avatar', variant: 'destructive' })
    }
  }

  async function loadVersions() {
    try {
      const res = await fetch('/api/usuarios/me/avatar/versions')
      if (!res.ok) return
      const data = await res.json()
      setVersions(data.versions ?? [])
    } catch (e) {
      /* ignore */
    }
  }

  async function openVersions() {
    await loadVersions()
    setVersionsOpen(true)
  }

  async function handleRevertFromList(index: number) {
    // call revert endpoint which reverts to the most recent previous - but we want to be able to revert specific
    // For now, if backend doesn't support revert-by-id, we'll call backend endpoints to set imagen_usuario directly.
    const v = versions[index]
    if (!v) return
    try {
      const payload = { versionId: v.id ?? v.id }
      const res = await fetch('/api/usuarios/me/avatar/revert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (data.success) {
        // refresh UI and session cookie
        try { window.dispatchEvent(new CustomEvent('user-profile-updated', { detail: { imagen_usuario: data.imageUrl } })) } catch (_) {}
        try { await fetch('/api/auth/refresh-session', { method: 'POST' }) } catch (_) {}
        await load()
        setVersionsOpen(false)
        toast({ title: 'Avatar restaurado', variant: 'success' })
      } else {
        toast({ title: 'Error', description: data.error || 'No se pudo restaurar avatar', variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: 'Error', description: 'No se pudo restaurar avatar', variant: 'destructive' })
    }
  }

  return (
    <div className="bg-white border rounded p-4 max-w-2xl">
      {loading && <div>Cargando...</div>}
      {!loading && usuario && (<>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-gray-100 rounded-full overflow-hidden flex items-center justify-center">
              {avatarPreview ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover"/> : <span className="text-xl">{usuario.persona?.nombre?.charAt(0)}</span>}
            </div>
            <div>
              <label htmlFor="avatar-upload" className="text-sm block">Subir avatar</label>
              <input id="avatar-upload" aria-label="Subir avatar" type="file" accept="image/*" onChange={handleAvatarChange} />
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={openCropper}>Abrir recortador</Button>
                <Button size="sm" variant="ghost" onClick={() => { if (currentFileRef.current) { /* trigger upload of currentFileRef.current */ handleAvatarUploadRef() } }}>Subir recortado</Button>
                <Button size="sm" variant="secondary" onClick={openVersions}>Versiones</Button>
              </div>
            </div>
          </div>

          {cropperOpen && cropperSrc && (
            <AvatarCropper src={cropperSrc} onCancel={handleCropperCancel} onComplete={handleCropperComplete} />
          )}
          {versionsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="bg-white rounded shadow-lg w-full max-w-2xl p-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Versiones de avatar</h3>
                  <Button variant="ghost" onClick={() => setVersionsOpen(false)}>Cerrar</Button>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  {versions.length === 0 && <div className="text-sm text-gray-600 col-span-3">No hay versiones guardadas.</div>}
                  {versions.map((v, i) => (
                    <div key={i} className="border rounded p-2 text-center">
                      <div className="w-full h-24 bg-gray-100 overflow-hidden mb-2">
                        {/* show variant thumb if available */}
                        {v?.variants && v.variants[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={v.variants[0]} alt={`version-${i}`} className="w-full h-full object-cover" />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={v.image} alt={`version-${i}`} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mb-2">{new Date(v.created_at).toLocaleString()}</div>
                      <div className="flex gap-2 justify-center">
                        <Button size="sm" onClick={() => handleRevertFromList(i)}>Revertir</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
              <label htmlFor="nombre" className="block text-sm">Nombre</label>
            <Input id="nombre" {...register('nombre')} defaultValue={name} placeholder="Nombre" />
            {errors.nombre && <div className="text-xs text-red-600">{String(errors.nombre?.message)}</div>}
          </div>

          <div>
            <label htmlFor="correo" className="block text-sm">Correo</label>
            <Input id="correo" {...register('correo')} defaultValue={email} placeholder="correo@ejemplo.com" />
            {errors.correo && <div className="text-xs text-red-600">{String(errors.correo?.message)}</div>}
          </div>

          <div>
            <Button type="submit" className="px-4 py-2" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Guardar'}</Button>
            {previousAvatar && <Button variant="ghost" onClick={handleRevertAvatar} className="ml-2">Revertir avatar</Button>}
            {uploadProgress !== null && <div className="inline-block ml-4 text-sm">Subiendo: {uploadProgress}%</div>}
          </div>
  </form>
  <form onSubmit={handleChangeUsername} className="mt-6 border-t pt-4 space-y-3">
          <h3 className="text-sm font-medium">Nombre de usuario</h3>
          <div className="flex gap-2">
            <Input placeholder="Nuevo nombre de usuario" value={username} onChange={(e) => setUsername(e.target.value)} />
            <Button type="submit" disabled={changingUsername}>{changingUsername ? 'Guardando...' : 'Cambiar'}</Button>
          </div>
        </form>

        <form onSubmit={handleChangePassword} className="mt-6 border-t pt-4 space-y-3">
          <h3 className="text-sm font-medium">Cambiar contraseña</h3>
          <div>
            <label className="block text-sm">Contraseña actual</label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm">Nueva contraseña</label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm">Confirmar nueva contraseña</label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <div>
            <Button type="submit" disabled={changingPassword}>{changingPassword ? 'Guardando...' : 'Cambiar contraseña'}</Button>
          </div>
        </form>
        </>
      )}
      {usuario && (
        <div className="mt-6">
          <h3 className="text-sm font-medium mb-2">Historial reciente</h3>
          {bitacora.length === 0 && <div className="text-sm text-gray-600">No hay eventos recientes.</div>}
          {bitacora.length > 0 && (
            <ul className="space-y-2 text-sm">
              {bitacora.map((b) => (
                <li key={b.id_bitacora} className="border rounded p-2">
                  <div className="text-xs text-gray-500">{new Date(b.fecha_hora).toLocaleString()}</div>
                  <div><strong>{b.accion}</strong> — {b.descripcion ?? '-'}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!loading && !usuario && <div>No se encontró usuario.</div>}
    </div>
  )
}
