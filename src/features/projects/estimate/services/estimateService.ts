import { EstimateCalculator, EstimateResult } from '../calculators/estimateCalculator'
import { profileService } from '../profile/services/profileService'
import { Project } from '@/features/projects/models/Project'
import { db } from '@/services/storage/indexedDB'

export const estimateService = {
  async calculate(project: Project): Promise<EstimateResult> {
    try {
      // Получаем профиль: используем profileId из проекта, если указан, иначе профиль по умолчанию
      let profile
      if (project.profileId) {
        const allProfiles = await profileService.getAllProfiles(project.userId)
        profile = allProfiles.find(p => String(p.id) === String(project.profileId))
      }
      
      if (!profile) {
        profile = await profileService.getProfile(project.userId)
      }
      
      if (!profile) {
        // Возвращаем пустую смету если нет профиля (офлайн режим)
        console.warn('Монтажный профиль не найден - возвращаем пустую смету')
        return {
          items: [],
          total: 0,
        }
      }

      // Получаем материалы и работы для этого профиля (из IndexedDB в офлайн)
      const materials = await profileService.getMaterials(String(profile.id!))
      const works = await profileService.getWorks(String(profile.id!))

      // Получаем связи работ и материалов только для работ этого профиля
      const workIds = works.map(w => String(w.id))
      const allWorkMaterials = await db.workMaterials.toArray()
      const workMaterials = allWorkMaterials.filter(wm => workIds.includes(String(wm.workId)))

      // Данные проекта
      const projectData = {
        area: Number(project.area) || 0,
        perimeter: Number(project.perimeter) || 0,
        elementCount: Number(project.elementCount) || 0,
      }

      // Рассчитываем смету
      return EstimateCalculator.calculate(works, materials, workMaterials, projectData)
    } catch (error) {
      console.error('Ошибка расчёта сметы:', error)
      // В офлайн режиме возвращаем пустую смету вместо ошибки
      return {
        items: [],
        total: 0,
      }
    }
  },
}

