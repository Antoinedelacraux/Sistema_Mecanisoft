import pino from 'pino'

const level = process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug')

export const logger = pino({
  level,
  base: undefined,
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  formatters: {
    level(label: string) {
      return { level: label }
    }
  },
  redact: {
    paths: ['password', 'headers.authorization'],
    censor: '[REDACTED]'
  }
})

export default logger
