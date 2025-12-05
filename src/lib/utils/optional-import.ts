const missingModuleCodes = new Set(['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'])

function isModuleNotFoundError(error: unknown, moduleName: string) {
  if (!error || typeof error !== 'object') return false
  const err = error as { code?: string; message?: string }
  if (!err.code || !missingModuleCodes.has(err.code)) return false
  if (typeof err.message !== 'string') return true
  return err.message.includes(`'${moduleName}'`) || err.message.includes(`"${moduleName}"`) || err.message.includes(moduleName)
}

export async function optionalCjsImport<T = any>(moduleName: string): Promise<T | undefined> {
  try {
    const [{ createRequire }, path] = await Promise.all([import('module'), import('path')])
    const fallbackBase = path.join(process.cwd(), 'package.json')
    const requireFn = createRequire(fallbackBase)
    return requireFn(moduleName) as T
  } catch (error) {
    if (isModuleNotFoundError(error, moduleName)) {
      return undefined
    }
    throw error
  }
}
