/**
 * Сервис для разрешения конфликтов при синхронизации
 */

export interface ConflictData {
  local: any
  server: any
  table: string
  recordId: string
}

export class ConflictResolver {
  /**
   * Разрешение конфликтов по timestamp (последнее изменение побеждает)
   */
  resolveByTimestamp(local: any, server: any): any {
    const localTime = new Date(local.updatedAt || local.updated_at || 0).getTime()
    const serverTime = new Date(server.updated_at || server.updatedAt || 0).getTime()
    
    // Последнее изменение побеждает
    if (localTime > serverTime) {
      return this.mapLocalToServer(local)
    } else {
      return this.mapServerToLocal(server)
    }
  }

  /**
   * Преобразование локальных данных в формат сервера
   */
  mapLocalToServer(local: any): any {
    // Базовая реализация, можно расширить для каждой таблицы
    return {
      ...local,
      updated_at: local.updatedAt,
      created_at: local.createdAt,
      last_synced_at: local.lastSyncedAt,
    }
  }

  /**
   * Преобразование данных сервера в локальный формат
   */
  mapServerToLocal(server: any): any {
    // Базовая реализация, можно расширить для каждой таблицы
    return {
      ...server,
      updatedAt: server.updated_at,
      createdAt: server.created_at,
      lastSyncedAt: server.last_synced_at,
      syncStatus: 'synced',
    }
  }

  /**
   * Обнаружение конфликтов (когда локальная и серверная версии отличаются)
   */
  hasConflict(local: any, server: any): boolean {
    const localTime = new Date(local.updatedAt || local.updated_at || 0).getTime()
    const serverTime = new Date(server.updated_at || server.updatedAt || 0).getTime()
    
    // Конфликт есть, если обе версии были изменены после последней синхронизации
    const lastSync = new Date(local.lastSyncedAt || 0).getTime()
    
    return localTime > lastSync && serverTime > lastSync && localTime !== serverTime
  }
}

export const conflictResolver = new ConflictResolver()

