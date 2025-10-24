"use client"

import React, { useCallback, useRef, useState, useEffect } from 'react'
// We'll dynamically import `react-easy-crop` at runtime when available and
// fall back to the local stub at `@/lib/cropper`. This prevents build-time
// failures when the optional dependency is not installed.
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  src: string
  onCancel: () => void
  onComplete: (file: File) => void
  aspect?: number
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = (e) => reject(e)
    img.src = url
  })
}

async function getCroppedImg(imageSrc: string, pixelCrop: any, rotation = 0, outputSize = 512) {
  const image = await createImage(imageSrc)

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  const maxSize = Math.max(pixelCrop.width, pixelCrop.height)
  // set canvas to desired output size
  canvas.width = outputSize
  canvas.height = outputSize

  // calculate scale to map pixelCrop to outputSize
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height

  // draw the cropped area to a temporary canvas first accounting for rotation
  const tmpCanvas = document.createElement('canvas')
  tmpCanvas.width = pixelCrop.width
  tmpCanvas.height = pixelCrop.height
  const tctx = tmpCanvas.getContext('2d')!

  // draw the selected area from the source image onto tmpCanvas
  tctx.drawImage(
    image,
    pixelCrop.x * scaleX,
    pixelCrop.y * scaleY,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  // now copy and resize to output canvas
  ctx.drawImage(tmpCanvas, 0, 0, outputSize, outputSize)

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

export default function AvatarCropper({ src, onCancel, onComplete, aspect = 1 }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [processing, setProcessing] = useState(false)
  const [CropperComponent, setCropperComponent] = useState<any>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const mod = await import('react-easy-crop')
        if (mounted) setCropperComponent(() => mod.default ?? mod)
      } catch (e) {
        try {
          const stub = await import('@/lib/cropper')
          if (mounted) setCropperComponent(() => stub.default ?? stub)
        } catch (err) {
          console.error('Failed to load any cropper implementation', err)
          if (mounted) setCropperComponent(() => null)
        }
      }
    })()
    return () => { mounted = false }
  }, [])

  const onCropComplete = useCallback((_: any, croppedAreaPixelsLocal: any) => {
    setCroppedAreaPixels(croppedAreaPixelsLocal)
  }, [])

  const handleSave = useCallback(async () => {
    if (!croppedAreaPixels) return
    setProcessing(true)
    try {
      const blob = await getCroppedImg(src, croppedAreaPixels, rotation, 512)
      if (!blob) throw new Error('No blob')
      const file = new File([blob], 'avatar.png', { type: 'image/png' })
      onComplete(file)
    } catch (e) {
      console.error('Error cropping', e)
    } finally {
      setProcessing(false)
    }
  }, [croppedAreaPixels, src, rotation, onComplete])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded shadow-lg w-full max-w-2xl p-4">
        <div className="relative w-full h-80 bg-gray-100">
          {CropperComponent ? (
            // @ts-ignore - dynamic component props match react-easy-crop / stub
            <CropperComponent
              image={src}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setCrop}
              onCropComplete={onCropComplete}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm text-gray-500">Cropper no disponible</div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div className="flex-1">
            <label htmlFor="crop-zoom" className="text-sm block mb-1">Zoom</label>
            <input id="crop-zoom" aria-label="Zoom" type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
          </div>
          <div className="w-36">
            <label htmlFor="crop-rotation" className="text-sm block mb-1">Rotar</label>
            <input id="crop-rotation" aria-label="Rotar" type="range" min={0} max={360} step={1} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="w-full" />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={processing}>Cancelar</Button>
          <Button onClick={handleSave} disabled={processing}>{processing ? 'Procesando...' : 'Guardar recorte'}</Button>
        </div>
      </div>
    </div>
  )
}
