import { supabase } from '@/services/supabase/supabaseClient'
import { db, InstallationProfile, Material, Work, WorkMaterial } from '@/services/storage/indexedDB'
import { findEntityById } from '@/shared/utils/dbHelpers'
import { isUUID } from '@/shared/utils/uuid'

export const profileService = {
  // Профили
  async getProfile(userId: string): Promise<InstallationProfile | null> {
    // Сначала ищем профиль по умолчанию
    const defaultProfile = await db.installationProfiles
      .where('userId').equals(userId)
      .and(p => p.isDefault === true)
      .first()
    
    if (defaultProfile) return defaultProfile
    
    // Если нет профиля по умолчанию, берем первый
    const profiles = await db.installationProfiles.where('userId').equals(userId).toArray()
    return profiles[0] || null
  },

  async getAllProfiles(userId: string): Promise<InstallationProfile[]> {
    // Сначала синхронизируем с сервером, если онлайн
    if (navigator.onLine) {
      await this.syncAllFromServer(userId)
    }
    
    const profiles = await db.installationProfiles.where('userId').equals(userId).toArray()
    // Фильтруем дубликаты по id
    const uniqueProfiles = Array.from(
      new Map(profiles.map(p => [String(p.id), p])).values()
    )
    return uniqueProfiles
  },

  async createProfile(userId: string, name: string, isDefault: boolean = false): Promise<InstallationProfile> {
    const now = new Date().toISOString()
    
    // Если создаем профиль по умолчанию, сначала снимаем флаг с других профилей
    if (isDefault) {
      // Снимаем флаг на сервере
      try {
        await supabase
          .from('installation_profiles')
          .update({ is_default: false, updated_at: now })
          .eq('user_id', userId)
          .eq('is_default', true)
      } catch (error) {
        console.error('Ошибка при снятии флага is_default на сервере:', error)
      }
      
      // Снимаем флаг локально
      const existingDefault = await db.installationProfiles
        .where('userId').equals(userId)
        .and(p => p.isDefault === true)
        .toArray()
      
      for (const profile of existingDefault) {
        await db.installationProfiles.update(profile.id!, { isDefault: false, syncStatus: 'synced' } as any)
      }
    }
    
    // Сразу создаем на сервере с UUID
    const { data: serverProfile, error } = await supabase
      .from('installation_profiles')
      .insert({
        user_id: userId,
        name,
        is_default: isDefault,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()
    
    if (error) throw error
    
    // Сохраняем в локальную БД с серверным UUID
    const profile: InstallationProfile = {
      id: serverProfile.id,
      userId,
      name,
      isDefault,
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: now,
      syncStatus: 'synced',
    }
    
    await db.installationProfiles.put(profile)
    
    return profile
  },

  async updateProfile(id: string | number, data: Partial<InstallationProfile>): Promise<InstallationProfile> {
    const now = new Date().toISOString()
    const profile = await findEntityById<InstallationProfile>(db.installationProfiles, id)
    if (!profile) throw new Error('Профиль не найден')

    // Если устанавливаем профиль по умолчанию, снимаем флаг с других
    if (data.isDefault === true) {
      // Снимаем флаг на сервере
      try {
        await supabase
          .from('installation_profiles')
          .update({ is_default: false, updated_at: now })
          .eq('user_id', profile.userId)
          .eq('is_default', true)
      } catch (error) {
        console.error('Ошибка при снятии флага is_default на сервере:', error)
      }
      
      // Снимаем флаг локально
      const existingDefault = await db.installationProfiles
        .where('userId').equals(profile.userId)
        .and(p => p.isDefault === true && String(p.id) !== String(id))
        .toArray()
      
      for (const p of existingDefault) {
        await db.installationProfiles.update(p.id!, { isDefault: false, syncStatus: 'synced', updatedAt: now })
      }
    }

    const updated: InstallationProfile = { ...profile, ...data, updatedAt: now, syncStatus: 'synced' }
    
    // Обновляем на сервере, если ID - UUID
    if (isUUID(profile.id)) {
      try {
        await supabase
          .from('installation_profiles')
          .update({
            name: updated.name,
            is_default: updated.isDefault,
            updated_at: now,
          })
          .eq('id', String(profile.id))
      } catch (error) {
        console.error('Ошибка обновления профиля на сервере:', error)
        updated.syncStatus = 'error'
      }
    }
    
    await db.installationProfiles.update(profile.id!, updated)
    return updated
  },

  async deleteProfile(id: string | number): Promise<void> {
    const profile = await findEntityById<InstallationProfile>(db.installationProfiles, id)
    if (!profile) return
    
    // Удаляем на сервере, если UUID
    if (isUUID(profile.id)) {
      try {
        // Сначала удаляем связанные материалы и работы на сервере
        await supabase.from('materials').delete().eq('profile_id', String(profile.id))
        await supabase.from('works').delete().eq('profile_id', String(profile.id))
        await supabase.from('installation_profiles').delete().eq('id', String(profile.id))
      } catch (error) {
        console.error('Ошибка удаления профиля на сервере:', error)
      }
    }
    
    // Удаляем локально
    const works = await db.works.where('profileId').equals(String(id)).toArray()
    for (const work of works) {
      await db.workMaterials.where('workId').equals(String(work.id)).delete()
    }
    await db.works.where('profileId').equals(String(id)).delete()
    await db.materials.where('profileId').equals(String(id)).delete()
    await db.installationProfiles.delete(id as any)
  },

  // Материалы
  async getMaterials(profileId: string): Promise<Material[]> {
    const allMaterials = await db.materials.toArray()
    return allMaterials.filter(m => String(m.profileId) === String(profileId))
  },

  async createMaterial(profileId: string, userId: string, data: Omit<Material, 'id' | 'profileId' | 'userId' | 'createdAt' | 'updatedAt' | 'syncStatus'>): Promise<Material> {
    const now = new Date().toISOString()
    
    // Проверяем, что profileId - UUID
    let serverProfileId = profileId
    if (!isUUID(profileId)) {
      const profile = await findEntityById<InstallationProfile>(db.installationProfiles, profileId)
      if (profile && isUUID(profile.id)) {
        serverProfileId = String(profile.id)
      } else {
        throw new Error('Профиль еще не синхронизирован с сервером')
      }
    }
    
    // Создаем на сервере
    const { data: serverMaterial, error } = await supabase
      .from('materials')
      .insert({
        profile_id: serverProfileId,
        user_id: userId,
        name: data.name,
        unit: data.unit,
        price: data.price,
        purchase_price: data.purchasePrice,
        total_cost: data.totalCost,
        calculation_type: data.calculationType,
        coefficient: data.coefficient || 1,
        initial_quantity: data.initialQuantity,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()
    
    if (error) throw error
    
    // Сохраняем локально с серверным UUID
    const material: Material = {
      id: serverMaterial.id,
      profileId: serverProfileId,
      userId,
      ...data,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'synced',
    }
    
    await db.materials.put(material)
    return material
  },

  async updateMaterial(id: string | number, data: Partial<Material>): Promise<Material> {
    const now = new Date().toISOString()
    const material = await findEntityById<Material>(db.materials, id)
    if (!material) throw new Error('Материал не найден')

    const updated: Material = { ...material, ...data, updatedAt: now, syncStatus: 'synced' }
    
    // Обновляем на сервере, если UUID
    if (isUUID(material.id)) {
      try {
        const updateData: any = {
          name: updated.name,
          unit: updated.unit,
          price: updated.price,
          calculation_type: updated.calculationType,
          coefficient: updated.coefficient,
          updated_at: now,
        }
        if (updated.purchasePrice !== undefined) updateData.purchase_price = updated.purchasePrice
        if (updated.totalCost !== undefined) updateData.total_cost = updated.totalCost
        if (updated.initialQuantity !== undefined) updateData.initial_quantity = updated.initialQuantity
        
        await supabase
          .from('materials')
          .update(updateData)
          .eq('id', String(material.id))
      } catch (error) {
        console.error('Ошибка обновления материала на сервере:', error)
        updated.syncStatus = 'error'
      }
    }
    
    await db.materials.update(material.id!, updated)
    return updated
  },

  async deleteMaterial(id: string | number): Promise<void> {
    const material = await findEntityById<Material>(db.materials, id)
    if (!material) return
    
    // Удаляем связи workMaterials
    await db.workMaterials.where('materialId').equals(String(id)).delete()
    
    // Удаляем на сервере, если UUID
    if (isUUID(material.id)) {
      try {
        await supabase.from('work_materials').delete().eq('material_id', String(material.id))
        await supabase.from('materials').delete().eq('id', String(material.id))
      } catch (error) {
        console.error('Ошибка удаления материала на сервере:', error)
      }
    }
    
    await db.materials.delete(material.id!)
  },

  // Работы
  async getWorks(profileId: string): Promise<Work[]> {
    const allWorks = await db.works.toArray()
    return allWorks.filter(w => String(w.profileId) === String(profileId))
  },

  async getWorkWithMaterials(workId: string): Promise<{ work: Work; materials: Array<WorkMaterial & { material?: Material }> } | null> {
    const work = await db.works.get(workId)
    if (!work) return null

    const workMaterials = await db.workMaterials.where('workId').equals(workId).toArray()
    const materials = await Promise.all(
      workMaterials.map(async (wm) => {
        const material = await db.materials.get(wm.materialId)
        return { ...wm, material }
      })
    )

    return { work, materials }
  },

  async createWork(profileId: string, userId: string, data: Omit<Work, 'id' | 'profileId' | 'userId' | 'createdAt' | 'updatedAt' | 'syncStatus'>, materialIds: string[]): Promise<Work> {
    const now = new Date().toISOString()
    
    // Проверяем, что profileId - UUID
    let serverProfileId = profileId
    if (!isUUID(profileId)) {
      const profile = await findEntityById<InstallationProfile>(db.installationProfiles, profileId)
      if (profile && isUUID(profile.id)) {
        serverProfileId = String(profile.id)
      } else {
        throw new Error('Профиль еще не синхронизирован с сервером')
      }
    }
    
    // Создаем на сервере
    const { data: serverWork, error } = await supabase
      .from('works')
      .insert({
        profile_id: serverProfileId,
        user_id: userId,
        name: data.name,
        unit: data.unit || '',
        work_price: data.workPrice || 0,
        calculation_type: data.calculationType || 'byArea',
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()
    
    if (error) throw error
    
    // Сохраняем локально
    const work: Work = {
      id: serverWork.id,
      profileId: serverProfileId,
      userId,
      ...data,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'synced',
    }
    
    await db.works.put(work)
    
    // Создаем связи с материалами
    for (const materialId of materialIds) {
      await this.addMaterialToWork(String(serverWork.id), materialId)
    }
    
    return work
  },

  async updateWork(id: string | number, data: Partial<Work>, materialIds?: string[]): Promise<Work> {
    const now = new Date().toISOString()
    const work = await findEntityById<Work>(db.works, id)
    if (!work) throw new Error('Работа не найдена')

    const updated: Work = { ...work, ...data, updatedAt: now, syncStatus: 'synced' }
    
    // Обновляем на сервере, если UUID
    if (isUUID(work.id)) {
      try {
        await supabase
          .from('works')
          .update({
            name: updated.name,
            unit: updated.unit,
            work_price: updated.workPrice,
            calculation_type: updated.calculationType,
            updated_at: now,
          })
          .eq('id', String(work.id))
      } catch (error) {
        console.error('Ошибка обновления работы на сервере:', error)
        updated.syncStatus = 'error'
      }
    }
    
    await db.works.update(work.id!, updated)

    if (materialIds !== undefined) {
      // Удаляем старые связи
      await db.workMaterials.where('workId').equals(String(work.id)).delete()
      if (isUUID(work.id)) {
        await supabase.from('work_materials').delete().eq('work_id', String(work.id))
      }
      // Создаём новые
      for (const materialId of materialIds) {
        await this.addMaterialToWork(String(work.id), materialId)
      }
    }

    return updated
  },

  async deleteWork(id: string | number): Promise<void> {
    const work = await findEntityById<Work>(db.works, id)
    if (!work) return
    
    // Удаляем связи workMaterials
    await db.workMaterials.where('workId').equals(String(id)).delete()
    
    // Удаляем на сервере, если UUID
    if (isUUID(work.id)) {
      try {
        await supabase.from('work_materials').delete().eq('work_id', String(work.id))
        await supabase.from('works').delete().eq('id', String(work.id))
      } catch (error) {
        console.error('Ошибка удаления работы на сервере:', error)
      }
    }
    
    await db.works.delete(work.id!)
  },

  // Связи работ и материалов
  async addMaterialToWork(workId: string, materialId: string): Promise<WorkMaterial> {
    const now = new Date().toISOString()
    
    // Создаем на сервере, если оба ID - UUID
    let serverWmId: string | undefined
    if (isUUID(workId) && isUUID(materialId)) {
      const { data: serverWm, error } = await supabase
        .from('work_materials')
        .insert({
          work_id: workId,
          material_id: materialId,
          quantity: 1,
          calculation_override: null,
          created_at: now,
        })
        .select()
        .single()
      
      if (error) {
        console.error('Ошибка создания связи на сервере:', error)
      } else {
        serverWmId = serverWm.id
      }
    }
    
    const wm: WorkMaterial = {
      id: serverWmId,
      workId,
      materialId,
      quantity: 1,
      calculationOverride: null,
      createdAt: now,
      syncStatus: serverWmId ? 'synced' : 'pending',
    }
    
    await db.workMaterials.add(wm)
    
    return wm
  },

  // Синхронизация всех данных с сервера
  async syncAllFromServer(userId: string): Promise<void> {
    try {
      // 1. Загружаем профили с сервера
      const { data: profilesData, error: profilesError } = await supabase
        .from('installation_profiles')
        .select('*')
        .eq('user_id', userId)

      if (profilesError) throw profilesError

      // Получаем локальные профили
      const localProfiles = await db.installationProfiles.where('userId').equals(userId).toArray()
      const serverProfileIds = new Set((profilesData || []).map(p => p.id))

      // Удаляем локальные профили, которых нет на сервере (были удалены)
      for (const localProfile of localProfiles) {
        if (isUUID(localProfile.id) && !serverProfileIds.has(String(localProfile.id))) {
          // Профиль удален на сервере - удаляем локально
          await db.workMaterials.where('workId').anyOf(
            (await db.works.where('profileId').equals(String(localProfile.id)).toArray()).map(w => String(w.id))
          ).delete()
          await db.works.where('profileId').equals(String(localProfile.id)).delete()
          await db.materials.where('profileId').equals(String(localProfile.id)).delete()
          await db.installationProfiles.delete(localProfile.id!)
        }
      }

      // Добавляем/обновляем профили с сервера
      for (const serverProfile of (profilesData || [])) {
        const profile: InstallationProfile = {
          id: serverProfile.id,
          userId: serverProfile.user_id,
          name: serverProfile.name,
          isDefault: serverProfile.is_default || false,
          createdAt: serverProfile.created_at ?? new Date().toISOString(),
          updatedAt: serverProfile.updated_at ?? new Date().toISOString(),
          lastSyncedAt: new Date().toISOString(),
          syncStatus: 'synced',
        }
        
        await db.installationProfiles.put(profile)
      }

      // 2. Загружаем материалы с сервера
      const { data: materialsData, error: materialsError } = await supabase
        .from('materials')
        .select('*')
        .eq('user_id', userId)

      if (materialsError) throw materialsError

      // Удаляем локальные материалы, которых нет на сервере
      const localMaterials = await db.materials.where('userId').equals(userId).toArray()
      const serverMaterialIds = new Set((materialsData || []).map(m => m.id))
      
      for (const localMaterial of localMaterials) {
        if (isUUID(localMaterial.id) && !serverMaterialIds.has(String(localMaterial.id))) {
          await db.workMaterials.where('materialId').equals(String(localMaterial.id)).delete()
          await db.materials.delete(localMaterial.id!)
        }
      }

      // Добавляем/обновляем материалы с сервера
      for (const serverMaterial of (materialsData || [])) {
        const material: Material = {
          id: serverMaterial.id,
          profileId: serverMaterial.profile_id,
          userId: serverMaterial.user_id,
          name: serverMaterial.name,
          unit: serverMaterial.unit,
          price: serverMaterial.price,
          purchasePrice: serverMaterial.purchase_price ?? undefined,
          totalCost: serverMaterial.total_cost ?? undefined,
          calculationType: (serverMaterial.calculation_type as 'byArea' | 'byPerimeter' | 'byCount') || 'byArea',
          coefficient: serverMaterial.coefficient ?? 1,
          initialQuantity: serverMaterial.initial_quantity ?? undefined,
          createdAt: serverMaterial.created_at ?? new Date().toISOString(),
          updatedAt: serverMaterial.updated_at ?? new Date().toISOString(),
          syncStatus: 'synced',
        }
        
        await db.materials.put(material)
      }

      // 3. Загружаем работы с сервера
      const { data: worksData, error: worksError } = await supabase
        .from('works')
        .select('*')
        .eq('user_id', userId)

      if (worksError) throw worksError

      // Удаляем локальные работы, которых нет на сервере
      const localWorks = await db.works.where('userId').equals(userId).toArray()
      const serverWorkIds = new Set((worksData || []).map(w => w.id))
      
      for (const localWork of localWorks) {
        if (isUUID(localWork.id) && !serverWorkIds.has(String(localWork.id))) {
          await db.workMaterials.where('workId').equals(String(localWork.id)).delete()
          await db.works.delete(localWork.id!)
        }
      }

      // Добавляем/обновляем работы с сервера
      for (const serverWork of (worksData || [])) {
        const work: Work = {
          id: serverWork.id,
          profileId: serverWork.profile_id,
          userId: serverWork.user_id,
          name: serverWork.name,
          unit: serverWork.unit,
          workPrice: serverWork.work_price,
          calculationType: (serverWork.calculation_type as 'byArea' | 'byPerimeter' | 'byCount') || 'byArea',
          createdAt: serverWork.created_at ?? new Date().toISOString(),
          updatedAt: serverWork.updated_at ?? new Date().toISOString(),
          syncStatus: 'synced',
        }
        
        await db.works.put(work)
      }

      // 4. Загружаем связи work_materials с сервера
      const { data: workMaterialsData, error: wmError } = await supabase
        .from('work_materials')
        .select('*')

      if (wmError) throw wmError

      // Фильтруем только те связи, которые относятся к работам пользователя
      const userWorkIds = new Set((worksData || []).map(w => w.id))
      const userWorkMaterials = (workMaterialsData || []).filter(wm => userWorkIds.has(wm.work_id))

      // Очищаем локальные связи и добавляем с сервера
      for (const workId of serverWorkIds) {
        await db.workMaterials.where('workId').equals(workId).delete()
      }

      for (const serverWm of userWorkMaterials) {
        const wm: WorkMaterial = {
          id: serverWm.id,
          workId: serverWm.work_id,
          materialId: serverWm.material_id,
          quantity: serverWm.quantity ?? 1,
          calculationOverride: serverWm.calculation_override ?? null,
          createdAt: serverWm.created_at ?? new Date().toISOString(),
          syncStatus: 'synced',
        }
        
        await db.workMaterials.put(wm)
      }

      // Удаляем дубликаты профилей с числовыми ID, если есть UUID версии
      const allLocalProfiles = await db.installationProfiles.where('userId').equals(userId).toArray()
      const uuidProfiles = allLocalProfiles.filter(p => isUUID(p.id))
      const numericProfiles = allLocalProfiles.filter(p => !isUUID(p.id))
      
      for (const numProfile of numericProfiles) {
        // Если есть профиль с таким же именем и UUID - удаляем числовой
        const hasDuplicate = uuidProfiles.some(p => p.name === numProfile.name)
        if (hasDuplicate) {
          await db.installationProfiles.delete(numProfile.id!)
        }
      }

    } catch (error) {
      console.error('Ошибка синхронизации с сервера:', error)
    }
  },

  // Устаревшие методы для обратной совместимости
  async syncProfileToServer(_profile: InstallationProfile): Promise<void> {
    // Теперь синхронизация происходит сразу при создании/обновлении
  },

  async deleteProfileFromServer(_profile: InstallationProfile): Promise<void> {
    if (isUUID(_profile.id)) {
      try {
      await supabase.from('installation_profiles').delete().eq('id', String(_profile.id))
      } catch (error) {
        console.error('Ошибка удаления профиля на сервере:', error)
      }
    }
  },

  async syncMaterialToServer(_material: Material): Promise<void> {
    // Теперь синхронизация происходит сразу при создании/обновлении
  },

  async deleteMaterialFromServer(_material: Material): Promise<void> {
    if (isUUID(_material.id)) {
      try {
        await supabase.from('materials').delete().eq('id', String(_material.id))
      } catch (error) {
        console.error('Ошибка удаления материала на сервере:', error)
      }
    }
  },

  async syncWorkToServer(_work: Work): Promise<void> {
    // Теперь синхронизация происходит сразу при создании/обновлении
  },

  async deleteWorkFromServer(_work: Work): Promise<void> {
    if (isUUID(_work.id)) {
      try {
        await supabase.from('works').delete().eq('id', String(_work.id))
      } catch (error) {
        console.error('Ошибка удаления работы на сервере:', error)
      }
    }
  },
}
