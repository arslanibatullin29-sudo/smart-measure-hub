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
  syncStatus?: 'pending' | 'synced' | 'error'
}

