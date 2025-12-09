import Dexie, { Table } from 'dexie'

// Модели данных
export interface Customer {
  id?: number | string
  userId: string
  fullName: string
  address: string
  phone: string
  comment: string
  createdAt: string
  updatedAt: string
  lastSyncedAt: string | null
  syncStatus: 'pending' | 'synced' | 'error'
}

export interface Project {
  id?: number | string
  customerId: string
  userId: string
  profileId?: string | null // ID профиля монтажа для расчета сметы
  createdAt: string
  updatedAt: string
  lastSyncedAt: string | null
  points: Array<{ x: number; y: number }>
  area: number
  perimeter: number
  elementCount: number
  estimateData: any
  syncStatus: 'pending' | 'synced' | 'error'
}

export interface InstallationProfile {
  id?: number | string
  userId: string
  name: string
  isDefault?: boolean // Профиль по умолчанию для пользователя
  createdAt: string
  updatedAt: string
  lastSyncedAt: string | null
  syncStatus: 'pending' | 'synced' | 'error'
}

export interface Material {
  id?: number | string
  profileId: string
  userId: string
  name: string
  unit: string
  price: number // Цена продажи
  purchasePrice?: number // Стоимость закупа
  totalCost?: number // Общая себестоимость
  calculationType: 'byArea' | 'byPerimeter' | 'byCount' | 'fixed'
  coefficient: number
  initialQuantity?: number // Изначальное количество из Excel (умножается на площадь/периметр/количество)
  createdAt: string
  updatedAt: string
  syncStatus: 'pending' | 'synced' | 'error'
}

export interface Work {
  id?: number | string
  profileId: string
  userId: string
  name: string
  unit: string
  workPrice: number
  calculationType: 'byArea' | 'byPerimeter' | 'byCount'
  createdAt: string
  updatedAt: string
  syncStatus: 'pending' | 'synced' | 'error'
}

export interface WorkMaterial {
  id?: number | string
  workId: string
  materialId: string
  quantity: number
  calculationOverride: string | null
  createdAt: string
  syncStatus: 'pending' | 'synced' | 'error'
}

export interface PDFDocument {
  id?: number | string
  projectId: string
  userId: string
  blob: Blob
  createdAt: string
}

export interface SyncQueue {
  id?: number
  table: string
  recordId: string
  operation: 'create' | 'update' | 'delete'
  data: any
  timestamp: string
  retries: number
}

class AppDatabase extends Dexie {
  customers!: Table<Customer>
  projects!: Table<Project>
  installationProfiles!: Table<InstallationProfile>
  materials!: Table<Material>
  works!: Table<Work>
  workMaterials!: Table<WorkMaterial>
  pdfDocuments!: Table<PDFDocument>
  syncQueue!: Table<SyncQueue>

  constructor() {
    super('RoomAppDB')
    
    this.version(1).stores({
      customers: '++id, userId, syncStatus',
      projects: '++id, customerId, userId, syncStatus',
      installationProfiles: '++id, userId, syncStatus',
      materials: '++id, profileId, userId, syncStatus',
      works: '++id, profileId, userId, syncStatus',
      workMaterials: '++id, workId, materialId, syncStatus',
      pdfDocuments: '++id, projectId, userId',
      syncQueue: '++id, table, recordId, timestamp'
    })
    
    // Версия 2: добавляем составной индекс для projects
    this.version(2).stores({
      customers: '++id, userId, syncStatus',
      projects: '++id, customerId, userId, [customerId+userId], syncStatus',
      installationProfiles: '++id, userId, syncStatus',
      materials: '++id, profileId, userId, syncStatus',
      works: '++id, profileId, userId, syncStatus',
      workMaterials: '++id, workId, materialId, syncStatus',
      pdfDocuments: '++id, projectId, userId',
      syncQueue: '++id, table, recordId, timestamp'
    }).upgrade(async () => {
      // Миграция данных не требуется, только обновление схемы
    })
  }
}

export const db = new AppDatabase()

