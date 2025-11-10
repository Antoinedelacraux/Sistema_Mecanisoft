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
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
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
      fileInputRef.current?.click()
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
    if (!username) {
      toast({ title: 'Nombre de usuario requerido', variant: 'destructive' })
      return
    }
    setChangingUsername(true)
    try {
      const res = await fetch('/api/usuarios/me/username', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      })
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
    } finally {
      setChangingUsername(false)
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-white/25 bg-white/80 p-8 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/10">
      {loading && (
        <div className="text-sm text-muted-foreground">Cargando perfil...</div>
      )}

      {!loading && usuario && (
        <>
          <div className="space-y-10">
              <section className="space-y-6">
                <div className="flex flex-col gap-5 rounded-2xl border border-white/20 bg-white/65 px-6 py-6 shadow-sm backdrop-blur lg:flex-row lg:items-center">
                  <div className="relative h-24 w-24 overflow-hidden rounded-full border border-white/40 bg-white/40 shadow-inner">
                    {avatarPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarPreview} alt="avatar" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xl font-semibold text-[var(--primary)]">
                        {usuario.persona?.nombre?.charAt(0) ?? usuario.nombre_usuario?.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">Foto de perfil</p>
                      <p className="text-xs text-muted-foreground">Selecciona una imagen cuadrada (PNG o JPG) para lograr un resultado nítido.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label htmlFor="avatar-upload" className="sr-only">Seleccionar archivo</label>
                      <input
                        ref={fileInputRef}
                        id="avatar-upload"
                        aria-label="Subir avatar"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="sr-only"
                      />
                      <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                        Seleccionar archivo
                      </Button>
                      <Button type="button" size="sm" onClick={openCropper}>
                        Abrir recortador
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!currentFileRef.current) {
                            toast({ title: 'Selecciona un archivo', description: 'Elige una imagen antes de subirla recortada.' })
                            fileInputRef.current?.click()
                            return
                          }
                          void handleAvatarUploadRef()
                        }}
                      >
                        Subir recortado
                      </Button>
                      <Button type="button" size="sm" variant="secondary" onClick={openVersions}>
                        Versiones
                      </Button>
                      {previousAvatar && (
                        <Button type="button" size="sm" variant="ghost" onClick={handleRevertAvatar}>
                          Revertir avatar
                        </Button>
                      )}
                    </div>
                    {uploadProgress !== null && (
                      <div className="text-xs text-muted-foreground">Subiendo: {uploadProgress}%</div>
                    )}
                  </div>
                </div>

                <form
                  onSubmit={handleSubmit(onSubmit)}
                  className="space-y-5 rounded-2xl border border-white/20 bg-white/65 px-6 py-6 shadow-sm backdrop-blur"
                >
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <label htmlFor="nombre" className="text-sm font-medium text-[var(--foreground)]">
                        Nombre completo
                      </label>
                      <Input id="nombre" {...register('nombre')} defaultValue={name} placeholder="Nombre y apellidos" />
                      {errors.nombre && (
                        <div className="text-xs text-red-500">{String(errors.nombre?.message)}</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="correo" className="text-sm font-medium text-[var(--foreground)]">
                        Correo electrónico
                      </label>
                      <Input id="correo" {...register('correo')} defaultValue={email} placeholder="correo@ejemplo.com" />
                      {errors.correo && (
                        <div className="text-xs text-red-500">{String(errors.correo?.message)}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
                    </Button>
                  </div>
                </form>
              </section>

              <section className="space-y-6">
                <form
                  onSubmit={handleChangeUsername}
                  className="space-y-4 rounded-2xl border border-white/20 bg-white/65 px-6 py-6 shadow-sm backdrop-blur"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--foreground)]">Nombre de usuario</h3>
                      <p className="text-xs text-muted-foreground">Este identificador se usa para iniciar sesión en el sistema.</p>
                    </div>
                    <div className="flex w-full min-w-[16rem] flex-col gap-2 sm:max-w-sm sm:flex-row">
                      <Input
                        placeholder="Nuevo nombre de usuario"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                      />
                      <Button type="submit" disabled={changingUsername}>
                        {changingUsername ? 'Guardando...' : 'Actualizar'}
                      </Button>
                    </div>
                  </div>
                </form>

                <form
                  onSubmit={handleChangePassword}
                  className="space-y-4 rounded-2xl border border-white/20 bg-white/65 px-6 py-6 shadow-sm backdrop-blur"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">Cambiar contraseña</h3>
                    <p className="text-xs text-muted-foreground">Crea una contraseña segura con letras, números y símbolos.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      placeholder="Actual"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                    <Input
                      placeholder="Nueva"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <Input
                      placeholder="Confirmar"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={changingPassword}>
                    {changingPassword ? 'Guardando...' : 'Actualizar contraseña'}
                  </Button>
                </form>
              </section>

              <section className="rounded-2xl border border-white/20 bg-white/65 px-6 py-6 shadow-sm backdrop-blur">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">Actividad reciente</h3>
                <div className="mt-3 space-y-3">
                  {bitacora.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sin registros recientes.</p>
                  )}
                  {bitacora.map((evento, idx) => (
                    <div key={idx} className="rounded-xl border border-white/20 bg-white/40 px-4 py-3 text-xs text-muted-foreground">
                      {evento.descripcion ?? evento.evento}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {cropperOpen && cropperSrc && (
              <AvatarCropper src={cropperSrc} onCancel={handleCropperCancel} onComplete={handleCropperComplete} />
            )}
            {versionsOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="w-full max-w-2xl rounded-2xl border border-white/20 bg-white/95 p-5 shadow-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">Versiones de avatar</h3>
                    <Button variant="ghost" onClick={() => setVersionsOpen(false)}>
                      Cerrar
                    </Button>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {versions.length === 0 && (
                      <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                        No hay versiones guardadas.
                      </div>
                    )}
                    {versions.map((v, i) => (
                      <div key={i} className="space-y-3 rounded-xl border border-white/30 bg-white/70 p-3 shadow-sm">
                        <div className="h-28 overflow-hidden rounded-lg bg-muted">
                          {v?.variants && v.variants[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={v.variants[0]} alt={`version-${i}`} className="h-full w-full object-cover" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={v.image} alt={`version-${i}`} className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleString()}</div>
                        <div className="flex justify-end">
                          <Button size="sm" onClick={() => handleRevertFromList(i)}>
                            Revertir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      {!loading && !usuario && (
        <div className="text-sm text-muted-foreground">No se encontró el perfil del usuario.</div>
      )}
      </div>
    )
  }
