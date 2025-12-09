import { Material } from './Material'

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
  syncStatus?: 'pending' | 'synced' | 'error'
}

export interface WorkMaterial {
  id?: string
  workId: string
  materialId: string
  quantity: number
  calculationOverride: string | null
  createdAt: string
  syncStatus?: 'pending' | 'synced' | 'error'
}

export interface WorkWithMaterials extends Work {
  materials: Array<WorkMaterial & { material?: Material }>
}

export interface WorkFormData {
  name: string
  unit: string
  workPrice: number
  calculationType: 'byArea' | 'byPerimeter' | 'byCount'
  materials: Array<{
    materialId: string
    quantity: number
    calculationOverride?: string | null
  }>
}

