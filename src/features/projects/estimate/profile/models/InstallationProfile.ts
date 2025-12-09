export interface InstallationProfile {
  id?: number | string
  userId: string
  name: string
  createdAt: string
  updatedAt: string
  lastSyncedAt: string | null
  syncStatus?: 'pending' | 'synced' | 'error'
}

