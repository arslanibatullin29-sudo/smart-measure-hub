import { EstimateCalculator, EstimateResult } from '../calculators/estimateCalculator'
import { profileService } from '../profile/services/profileService'
import { Project } from '@/features/projects/models/Project'
import { db } from '@/services/storage/indexedDB'

export const estimateService = {
  async calculate(project: Project): Promise<EstimateResult> {
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
      throw new Error('Монтажный профиль не найден. Создайте профиль в настройках или выберите профиль для проекта.')
    }

    // Получаем материалы и работы
    const materials = await profileService.getMaterials(String(profile.id!))
    const works = await profileService.getWorks(String(profile.id!))

    // Получаем связи работ и материалов
    const workMaterials = await db.workMaterials.toArray()

    // Данные проекта
    const projectData = {
      area: project.area,
      perimeter: project.perimeter,
      elementCount: project.elementCount,
    }

    // Рассчитываем смету
    return EstimateCalculator.calculate(works, materials, workMaterials, projectData)
  },
}

