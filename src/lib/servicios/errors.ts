export class ServicioServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly payload?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ServicioServiceError'
  }
}