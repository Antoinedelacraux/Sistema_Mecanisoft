export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export const throwApiError = (status: number, message: string): never => {
  throw new ApiError(status, message)
}
