/**
 * Проверяет, является ли строка валидным UUID
 */
export function isUUID(value: string | number | undefined): boolean {
  if (!value || typeof value !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
