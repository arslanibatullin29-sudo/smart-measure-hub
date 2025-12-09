import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Расширяем Vitest matchers с jest-dom matchers
expect.extend(matchers)

// Очистка после каждого теста
afterEach(() => {
  cleanup()
})

// Мокируем window.matchMedia для компонентов, использующих медиа-запросы
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
})

// Мокируем IndexedDB для тестов с Dexie
// Важно: это должно быть выполнено ДО импорта db
import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'

// Создаем новый экземпляр IDBFactory
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

// Настраиваем Dexie для использования fake-indexeddb
// Это критически важно - должно быть сделано до создания экземпляра db
if (Dexie.dependencies) {
  Dexie.dependencies.indexedDB = fakeIndexedDB as any
  Dexie.dependencies.IDBKeyRange = IDBKeyRange as any
}

