import { Material, Work, WorkMaterial } from '@/services/storage/indexedDB'
import { Material as MaterialModel } from '../profile/models/Material'
import { Work as WorkModel } from '../profile/models/Work'

export interface MaterialEstimateItem {
  materialId: string
  materialName: string
  materialUnit: string
  materialQuantity: number
  materialPrice: number
  materialTotal: number
  calculationType: 'byArea' | 'byPerimeter' | 'byCount' | 'fixed'
}

export interface EstimateItem {
  workId: string
  workName: string
  workUnit: string
  workQuantity: number
  workPrice: number
  workTotal: number
  materials: MaterialEstimateItem[]
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
  /**
   * Расчет сметы ТОЛЬКО по материалам
   * Стоимость = цена продажи * количество (по площади/периметру/количеству элементов или фиксированное)
   */
  static calculate(
    works: (Work | WorkModel)[],
    materials: (Material | MaterialModel)[],
    workMaterials: WorkMaterial[],
    projectData: ProjectData
  ): EstimateResult {
    const items: EstimateItem[] = []
    let total = 0

    for (const work of works) {
      // Рассчитываем материалы для этой работы
      const workMaterialsForWork = workMaterials.filter((wm) => wm.workId === work.id)
      const materialItems: MaterialEstimateItem[] = []
      let materialsTotal = 0

      for (const wm of workMaterialsForWork) {
        const material = materials.find((m) => m.id === wm.materialId)
        if (!material) continue

        // Определяем тип расчёта (может быть переопределён в связи)
        const calcType = (wm.calculationOverride || material.calculationType) as 'byArea' | 'byPerimeter' | 'byCount' | 'fixed'

        // Базовое количество - из материала или из связи
        const baseQuantity = material.initialQuantity || wm.quantity || 1
        const coefficient = material.coefficient || 1

        // Определяем количество материала
        let materialQuantity = 0
        switch (calcType) {
          case 'byArea':
            materialQuantity = projectData.area * baseQuantity * coefficient
            break
          case 'byPerimeter':
            materialQuantity = projectData.perimeter * baseQuantity * coefficient
            break
          case 'byCount':
            materialQuantity = projectData.elementCount * baseQuantity * coefficient
            break
          case 'fixed':
            // Фиксированное количество - не умножаем на площадь/периметр
            materialQuantity = baseQuantity * coefficient
            break
          default:
            materialQuantity = baseQuantity * coefficient
        }

        // Рассчитываем стоимость материала (используем цену продажи)
        const materialTotal = materialQuantity * material.price
        materialsTotal += materialTotal

        materialItems.push({
          materialId: String(material.id!),
          materialName: material.name,
          materialUnit: material.unit,
          materialQuantity,
          materialPrice: material.price,
          materialTotal,
          calculationType: calcType,
        })
      }

      // В смете только материалы, работы не учитываются в итоговой стоимости
      // Но сохраняем структуру для группировки
      const workTotalWithMaterials = materialsTotal
      total += workTotalWithMaterials

      // Добавляем только если есть материалы
      if (materialItems.length > 0) {
        items.push({
          workId: String(work.id!),
          workName: work.name,
          workUnit: work.unit,
          workQuantity: 0, // Не используется
          workPrice: 0, // Не используется
          workTotal: 0, // Не используется
          materials: materialItems,
          workTotalWithMaterials,
        })
      }
    }

    return { items, total }
  }
}
