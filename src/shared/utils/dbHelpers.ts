import { Dexie } from 'dexie'

/**
 * Универсальная функция для поиска сущности по ID в IndexedDB
 * Поддерживает поиск как по number, так и по string ID
 */
export async function findEntityById<T>(
  table: Dexie.Table<T, any>,
  id: string | number
): Promise<T | null> {
  // Сначала пробуем найти напрямую
  let entity = await table.get(id as any)
  
  if (!entity) {
    // Если не нашли, ищем по строковому сравнению
    const allEntities = await table.toArray()
    entity = (allEntities as any[]).find((e: any) => String(e.id) === String(id)) || null
  }
  
  return entity
}

/**
 * Преобразует ID в строку, поддерживая number и string
 */
export function normalizeId(id: string | number): string {
  return typeof id === 'number' ? String(id) : id
}
