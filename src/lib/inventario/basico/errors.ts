export class InventarioBasicoError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status = 400, code = 'INVENTARIO_BASICO_ERROR') {
    super(message)
    this.name = 'InventarioBasicoError'
    this.status = status
    this.code = code
  }
}

export const isInventarioBasicoError = (error: unknown): error is InventarioBasicoError =>
  error instanceof InventarioBasicoError
