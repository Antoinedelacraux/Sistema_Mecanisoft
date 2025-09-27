import { toast as sonnerToast } from "sonner"

type ToastPayload =
  | string
  | {
      title: string
      description?: string
      variant?: any
      [key: string]: any
    }

// Module-level toast function: keep stable reference across renders/components
const toast = (content: ToastPayload, options?: Record<string, any>) => {
  // If caller passed a simple string or React node, forward as-is
  if (typeof content === 'string') {
    sonnerToast(content, options)
    return
  }

  // If caller passed an object like { title, description, variant }, map to sonner signature
  if (content && typeof content === 'object' && 'title' in content) {
    const { title, description, variant, ...rest } = content as any
    sonnerToast(title, { description, variant, ...rest })
    return
  }

  // Fallback: stringify
  sonnerToast(String(content), options)
}

export const useToast = () => {
  return { toast }
}

export { toast }
