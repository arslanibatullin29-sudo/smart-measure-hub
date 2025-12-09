export interface Material {
  id?: number | string
  profileId: string
  userId: string
  name: string
  unit: string
  price: number // Цена продажи
  purchasePrice?: number // Стоимость закупа
  totalCost?: number // Общая себестоимость
  calculationType: 'byArea' | 'byPerimeter' | 'byCount'
  coefficient: number
  initialQuantity?: number // Изначальное количество из Excel (умножается на площадь/периметр/количество)
  createdAt: string
  updatedAt: string
  syncStatus?: 'pending' | 'synced' | 'error'
}

export interface MaterialFormData {
  name: string
  unit: string
  price: number
  calculationType: 'byArea' | 'byPerimeter' | 'byCount'
  coefficient: number
  initialQuantity?: number // Изначальное количество
}

