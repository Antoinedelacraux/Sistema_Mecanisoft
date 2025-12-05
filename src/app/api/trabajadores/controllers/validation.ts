export type DateInput = string | Date | null | undefined;

export const TELEFONO_REGEX = /^\d{9}$/;
export const DNI_REGEX = /^\d{8}$/;

export function parseDateInput(value: DateInput): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function isAdult(date: Date, requiredYears = 18): boolean {
  const limit = new Date(date);
  limit.setFullYear(limit.getFullYear() + requiredYears);
  return limit <= new Date();
}
