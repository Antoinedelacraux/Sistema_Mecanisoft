import { toast as sonnerToast } from "sonner"
import { ReactNode } from 'react'

type ToastVariant = 'default' | 'destructive' | 'success' | 'warning' | 'info'
interface ToastObject {
  title: string
  description?: string | ReactNode
  variant?: ToastVariant
  // Permitir extensiones sin recurrir a any peligroso
  actionLabel?: string
  duration?: number
}
type ToastPayload = string | ToastObject
type ToastOptions = { duration?: number } & Record<string, unknown>

// Module-level toast function: keep stable reference across renders/components
const toast = (content: ToastPayload, options?: ToastOptions) => {
  // If caller passed a simple string or React node, forward as-is
  if (typeof content === 'string') {
    sonnerToast(content, options)
    return
  }

  // If caller passed an object like { title, description, variant }, map to sonner signature
  if (content && typeof content === 'object' && 'title' in content) {
    const { title, description, variant, ...rest } = content as ToastObject & Record<string, unknown>
    sonnerToast(title, { description, ...(variant ? { className: variant } : {}), ...rest })
    return
  }

  // Fallback: stringify
  sonnerToast(String(content), options)
}

export const useToast = () => {
  return { toast }
}

export { toast }
