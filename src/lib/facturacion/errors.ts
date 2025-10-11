export class FacturacionError extends Error {
  public readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'FacturacionError'
    this.status = status
  }
}
