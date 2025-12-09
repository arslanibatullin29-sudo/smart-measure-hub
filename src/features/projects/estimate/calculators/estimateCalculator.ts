import { Material, Work, WorkMaterial } from '@/services/storage/indexedDB'
import { Material as MaterialModel } from '../profile/models/Material'
import { Work as WorkModel } from '../profile/models/Work'

export interface EstimateItem {
  workId: string
  workName: string
  workUnit: string
  workQuantity: number
  workPrice: number
  workTotal: number
  materials: Array<{
    materialId: string
    materialName: string
    materialUnit: string
    materialQuantity: number
    materialPrice: number
    materialTotal: number
  }>
  workTotalWithMaterials: number
}

export interface EstimateResult {
  items: EstimateItem[]
  total: number
}

interface ProjectData {
  area: number
  perimeter: number
  elementCount: number
}

export class EstimateCalculator {
  static calculate(
    works: (Work | WorkModel)[],
    materials: (Material | MaterialModel)[],
    workMaterials: WorkMaterial[],
    projectData: ProjectData
  ): EstimateResult {
    const items: EstimateItem[] = []
    let total = 0

    for (const work of works) {
      // 1. Определяем объём работы
      let workQuantity = 0
      switch (work.calculationType) {
        case 'byArea':
          workQuantity = projectData.area
          break
        case 'byPerimeter':
          workQuantity = projectData.perimeter
          break
        case 'byCount':
          workQuantity = projectData.elementCount
          break
      }

      // 2. Рассчитываем стоимость работы
      const workTotal = workQuantity * work.workPrice

      // 3. Рассчитываем материалы для этой работы
      const workMaterialsForWork = workMaterials.filter((wm) => wm.workId === work.id)
      const materialItems: EstimateItem['materials'] = []
      let materialsTotal = 0

      for (const wm of workMaterialsForWork) {
        const material = materials.find((m) => m.id === wm.materialId)
        if (!material) continue

        // Определяем тип расчёта (может быть переопределён)
        const calcType = wm.calculationOverride || material.calculationType

        // Определяем количество материала
        // Используем initialQuantity если есть, иначе quantity из WorkMaterial
        const baseQuantity = material.initialQuantity || wm.quantity || 1
        
        let materialQuantity = 0
        switch (calcType) {
          case 'byArea':
            materialQuantity = projectData.area * baseQuantity * material.coefficient
            break
          case 'byPerimeter':
            materialQuantity = projectData.perimeter * baseQuantity * material.coefficient
            break
          case 'byCount':
            materialQuantity = projectData.elementCount * baseQuantity * material.coefficient
            break
        }

        // Рассчитываем стоимость материала
        const materialTotal = materialQuantity * material.price
        materialsTotal += materialTotal

        materialItems.push({
          materialId: String(material.id!),
          materialName: material.name,
          materialUnit: material.unit,
          materialQuantity,
          materialPrice: material.price,
          materialTotal,
        })
      }

      // 4. Итоговая стоимость работы
      const workTotalWithMaterials = workTotal + materialsTotal
      total += workTotalWithMaterials

      items.push({
        workId: String(work.id!),
        workName: work.name,
        workUnit: work.unit,
        workQuantity,
        workPrice: work.workPrice,
        workTotal,
        materials: materialItems,
        workTotalWithMaterials,
      })
    }

    return { items, total }
  }
}

