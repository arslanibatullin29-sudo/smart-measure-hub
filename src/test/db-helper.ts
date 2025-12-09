import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'

/**
 * Инициализация fake-indexeddb для тестов
 * Должна быть вызвана ДО импорта db
 */
export function setupFakeIndexedDB() {
  const fakeIndexedDB = new IDBFactory()

  // Устанавливаем глобальные переменные
  if (typeof global !== 'undefined') {
    (global as any).indexedDB = fakeIndexedDB
    ;(global as any).IDBKeyRange = IDBKeyRange
  }

  if (typeof window !== 'undefined') {
    ;(window as any).indexedDB = fakeIndexedDB
    ;(window as any).IDBKeyRange = IDBKeyRange
  }

  // Настраиваем Dexie
  if (Dexie.dependencies) {
    Dexie.dependencies.indexedDB = fakeIndexedDB as any
    Dexie.dependencies.IDBKeyRange = IDBKeyRange as any
  }
}

