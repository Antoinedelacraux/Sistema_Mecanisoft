import { Prisma } from '@prisma/client'

import { InventarioBasicoError } from './errors'

export const DECIMAL_ZERO = new Prisma.Decimal(0)

export const toDecimal = (value: Prisma.Decimal | number | string): Prisma.Decimal => {
  if (value instanceof Prisma.Decimal) return value
  if (typeof value === 'number') return new Prisma.Decimal(value)
  const trimmed = value.trim()
  if (trimmed.length === 0) return DECIMAL_ZERO
  return new Prisma.Decimal(trimmed)
}

export const ensurePositiveDecimal = (value: Prisma.Decimal, message: string) => {
  if (value.lte(DECIMAL_ZERO)) {
    throw new InventarioBasicoError(message, 422, 'VALOR_NO_POSITIVO')
  }
}

export const ensureNotNegativeDecimal = (value: Prisma.Decimal, message: string) => {
  if (value.lt(DECIMAL_ZERO)) {
    throw new InventarioBasicoError(message, 422, 'VALOR_NEGATIVO')
  }
}

export const decimalToString = (value: Prisma.Decimal | null | undefined): string =>
  value ? value.toString() : '0'
