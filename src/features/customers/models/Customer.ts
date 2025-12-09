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
  syncStatus?: 'pending' | 'synced' | 'error'
}

export interface CustomerFormData {
  fullName: string
  address: string
  phone: string
  comment: string
}

