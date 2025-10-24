"use client"

import React, { useEffect, useRef } from 'react'

export default function Cropper(props: any) {
  const { image, onCropComplete } = props
  const imgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    const img = imgRef.current
    if (!img) return
    const handler = () => {
      const w = img.naturalWidth || 512
      const h = img.naturalHeight || 512
      const size = Math.min(w, h)
      const cropped = { x: 0, y: 0, width: size, height: size }
      // call onCropComplete with both params (area, pixels)
      if (typeof onCropComplete === 'function') onCropComplete(cropped, cropped)
    }
    img.addEventListener('load', handler)
    return () => img.removeEventListener('load', handler)
  }, [image, onCropComplete])

  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      {/* simple image preview for tests/dev when react-easy-crop not installed */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={image} alt="crop-preview" className="max-h-full max-w-full" />
    </div>
  )
}
