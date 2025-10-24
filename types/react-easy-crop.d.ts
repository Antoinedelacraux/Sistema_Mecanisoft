declare module 'react-easy-crop' {
  import * as React from 'react'
  type Area = { x: number; y: number; width: number; height: number }
  type Props = {
    image: string
    crop: { x: number; y: number }
    zoom?: number
    aspect?: number
    rotation?: number
    onCropChange: (crop: { x: number; y: number }) => void
    onCropComplete?: (croppedArea: Area, croppedAreaPixels: Area) => void
    onZoomChange?: (zoom: number) => void
    onRotationChange?: (rotation: number) => void
  }
  const ReactEasyCrop: React.ComponentType<Props>
  export default ReactEasyCrop
}
