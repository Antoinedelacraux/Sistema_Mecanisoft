import path from 'path'

export const PUBLIC_DIR = path.resolve(process.cwd(), 'public')
export const PUBLIC_EXPORTS_DIR = path.join(PUBLIC_DIR, 'exports')

export function resolveReportFilePath(storedPath: string) {
  if (!storedPath) {
    throw new Error('Ruta no disponible')
  }

  let candidate = storedPath.trim()
  if (!candidate) {
    throw new Error('Ruta no disponible')
  }

  const exportsPattern = /^[/\\]*exports([/\\]|$)/i
  if (exportsPattern.test(candidate)) {
    const relativePath = candidate.replace(/^[/\\]+/, '')
    candidate = path.join(PUBLIC_DIR, relativePath)
  } else if (!path.isAbsolute(candidate)) {
    candidate = path.join(process.cwd(), candidate)
  }

  const absolute = path.resolve(candidate)
  if (!absolute.startsWith(PUBLIC_EXPORTS_DIR)) {
    throw new Error('Ruta fuera de public/exports')
  }

  return absolute
}
