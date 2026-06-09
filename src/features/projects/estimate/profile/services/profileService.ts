import { supabase } from '@/services/supabase/supabaseClient'
import { db, InstallationProfile, Material, Work, WorkMaterial } from '@/services/storage/indexedDB'
import { findEntityById } from '@/shared/utils/dbHelpers'
import { getActiveOrgIdForUser } from '@/features/organizations/services/activeOrg'
import { isUUID } from '@/shared/utils/uuid'

// Кэш последней синхронизации
let lastSyncTime: number = 0
const SYNC_COOLDOWN = 30000 // 30 секунд между синхронизациями

export const profileService = {
  // Профили
  async getProfile(userId: string): Promise<InstallationProfile | null> {
    const defaultProfile = await db.installationProfiles
      .where('userId').equals(userId)
      .and(p => p.isDefault === true)
      .first()
    
    if (defaultProfile) return defaultProfile
    
    const profiles = await db.installationProfiles.where('userId').equals(userId).toArray()
    return profiles[0] || null
  },

  async getAllProfiles(userId: string): Promise<InstallationProfile[]> {
    const profiles = await db.installationProfiles.where('userId').equals(userId).toArray()
    // Фильтруем дубликаты по id
    const uniqueProfiles = Array.from(
      new Map(profiles.map(p => [String(p.id), p])).values()
    )
    return uniqueProfiles
  },

  async createProfile(userId: string, name: string, isDefault: boolean = false): Promise<InstallationProfile> {
    const now = new Date().toISOString()
    
    if (isDefault) {
      try {
        await supabase
          .from('installation_profiles')
          .update({ is_default: false, updated_at: now })
          .eq('user_id', userId)
          .eq('is_default', true)
      } catch (error) {
        console.error('Ошибка при снятии флага is_default на сервере:', error)
      }
      
      const existingDefault = await db.installationProfiles
        .where('userId').equals(userId)
        .and(p => p.isDefault === true)
        .toArray()
      
      for (const profile of existingDefault) {
        await db.installationProfiles.update(profile.id!, { isDefault: false, syncStatus: 'synced' } as any)
      }
    }
    
    const organizationId = await getActiveOrgIdForUser(userId)
    const { data: serverProfile, error } = await supabase
      .from('installation_profiles')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        created_by: userId,
        name,
        is_default: isDefault,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()
    
    if (error) throw error
    
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

    if (data.isDefault === true) {
      try {
        await supabase
          .from('installation_profiles')
          .update({ is_default: false, updated_at: now })
          .eq('user_id', profile.userId)
          .eq('is_default', true)
      } catch (error) {
        console.error('Ошибка при снятии флага is_default на сервере:', error)
      }
      
      const existingDefault = await db.installationProfiles
        .where('userId').equals(profile.userId)
        .and(p => p.isDefault === true && String(p.id) !== String(id))
        .toArray()
      
      for (const p of existingDefault) {
        await db.installationProfiles.update(p.id!, { isDefault: false, syncStatus: 'synced', updatedAt: now })
      }
    }

    const updated: InstallationProfile = { ...profile, ...data, updatedAt: now, syncStatus: 'synced' }
    
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
    
    if (isUUID(profile.id)) {
      try {
        await supabase.from('materials').delete().eq('profile_id', String(profile.id))
        await supabase.from('works').delete().eq('profile_id', String(profile.id))
        await supabase.from('installation_profiles').delete().eq('id', String(profile.id))
      } catch (error) {
        console.error('Ошибка удаления профиля на сервере:', error)
      }
    }
    
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
    
    let serverProfileId = profileId
    if (!isUUID(profileId)) {
      const profile = await findEntityById<InstallationProfile>(db.installationProfiles, profileId)
      if (profile && isUUID(profile.id)) {
        serverProfileId = String(profile.id)
      } else {
        throw new Error('Профиль еще не синхронизирован с сервером')
      }
    }
    
    const organizationId = await getActiveOrgIdForUser(userId)
    const { data: serverMaterial, error } = await supabase
      .from('materials')
      .insert({
        profile_id: serverProfileId,
        user_id: userId,
        organization_id: organizationId,
        created_by: userId,
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
    
    await db.workMaterials.where('materialId').equals(String(id)).delete()
    
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
    
    let serverProfileId = profileId
    if (!isUUID(profileId)) {
      const profile = await findEntityById<InstallationProfile>(db.installationProfiles, profileId)
      if (profile && isUUID(profile.id)) {
        serverProfileId = String(profile.id)
      } else {
        throw new Error('Профиль еще не синхронизирован с сервером')
      }
    }
    
    const organizationId = await getActiveOrgIdForUser(userId)
    const { data: serverWork, error } = await supabase
      .from('works')
      .insert({
        profile_id: serverProfileId,
        user_id: userId,
        organization_id: organizationId,
        created_by: userId,
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
      await db.workMaterials.where('workId').equals(String(work.id)).delete()
      if (isUUID(work.id)) {
        await supabase.from('work_materials').delete().eq('work_id', String(work.id))
      }
      for (const materialId of materialIds) {
        await this.addMaterialToWork(String(work.id), materialId)
      }
    }

    return updated
  },

  async deleteWork(id: string | number): Promise<void> {
    const work = await findEntityById<Work>(db.works, id)
    if (!work) return
    
    await db.workMaterials.where('workId').equals(String(id)).delete()
    
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

  // Оптимизированная синхронизация - один запрос ко всем данным
  async syncFromServer(userId: string, force: boolean = false): Promise<void> {
    // Проверяем cooldown
    const now = Date.now()
    if (!force && now - lastSyncTime < SYNC_COOLDOWN) {
      console.log('Синхронизация пропущена (cooldown)')
      return
    }
    lastSyncTime = now

    try {
      // Параллельно загружаем все данные одним batch запросом
      const [profilesRes, materialsRes, worksRes, workMaterialsRes] = await Promise.all([
        supabase.from('installation_profiles').select('*').eq('user_id', userId),
        supabase.from('materials').select('*').eq('user_id', userId),
        supabase.from('works').select('*').eq('user_id', userId),
        supabase.from('work_materials').select('*'),
      ])

      if (profilesRes.error) throw profilesRes.error
      if (materialsRes.error) throw materialsRes.error
      if (worksRes.error) throw worksRes.error
      if (workMaterialsRes.error) throw workMaterialsRes.error

      const serverProfiles = profilesRes.data || []
      const serverMaterials = materialsRes.data || []
      const serverWorks = worksRes.data || []
      const serverWorkMaterials = workMaterialsRes.data || []

      // Фильтруем workMaterials только для работ пользователя
      const userWorkIds = new Set(serverWorks.map(w => w.id))
      const userWorkMaterials = serverWorkMaterials.filter(wm => userWorkIds.has(wm.work_id))

      // Batch операции с IndexedDB
      await db.transaction('rw', [db.installationProfiles, db.materials, db.works, db.workMaterials], async () => {
        // Обновляем профили
        const serverProfileIds = new Set(serverProfiles.map(p => p.id))
        const localProfiles = await db.installationProfiles.where('userId').equals(userId).toArray()
        
        // Удаляем удаленные на сервере
        for (const local of localProfiles) {
          if (isUUID(local.id) && !serverProfileIds.has(String(local.id))) {
            await db.installationProfiles.delete(local.id!)
          }
        }
        
        // Добавляем/обновляем
        for (const sp of serverProfiles) {
          await db.installationProfiles.put({
            id: sp.id,
            userId: sp.user_id,
            name: sp.name,
            isDefault: sp.is_default || false,
            createdAt: sp.created_at ?? new Date().toISOString(),
            updatedAt: sp.updated_at ?? new Date().toISOString(),
            lastSyncedAt: new Date().toISOString(),
            syncStatus: 'synced',
          })
        }

        // Обновляем материалы
        const serverMaterialIds = new Set(serverMaterials.map(m => m.id))
        const localMaterials = await db.materials.where('userId').equals(userId).toArray()
        
        for (const local of localMaterials) {
          if (isUUID(local.id) && !serverMaterialIds.has(String(local.id))) {
            await db.materials.delete(local.id!)
          }
        }
        
        for (const sm of serverMaterials) {
          await db.materials.put({
            id: sm.id,
            profileId: sm.profile_id,
            userId: sm.user_id,
            name: sm.name,
            unit: sm.unit,
            price: sm.price,
            purchasePrice: sm.purchase_price ?? undefined,
            totalCost: sm.total_cost ?? undefined,
            calculationType: (sm.calculation_type as 'byArea' | 'byPerimeter' | 'byCount') || 'byArea',
            coefficient: sm.coefficient ?? 1,
            initialQuantity: sm.initial_quantity ?? undefined,
            createdAt: sm.created_at ?? new Date().toISOString(),
            updatedAt: sm.updated_at ?? new Date().toISOString(),
            syncStatus: 'synced',
          })
        }

        // Обновляем работы
        const serverWorkIds = new Set(serverWorks.map(w => w.id))
        const localWorks = await db.works.where('userId').equals(userId).toArray()
        
        for (const local of localWorks) {
          if (isUUID(local.id) && !serverWorkIds.has(String(local.id))) {
            await db.works.delete(local.id!)
          }
        }
        
        for (const sw of serverWorks) {
          await db.works.put({
            id: sw.id,
            profileId: sw.profile_id,
            userId: sw.user_id,
            name: sw.name,
            unit: sw.unit,
            workPrice: sw.work_price,
            calculationType: (sw.calculation_type as 'byArea' | 'byPerimeter' | 'byCount') || 'byArea',
            createdAt: sw.created_at ?? new Date().toISOString(),
            updatedAt: sw.updated_at ?? new Date().toISOString(),
            syncStatus: 'synced',
          })
        }

        // Обновляем workMaterials
        for (const workId of serverWorkIds) {
          await db.workMaterials.where('workId').equals(workId).delete()
        }
        
        for (const swm of userWorkMaterials) {
          await db.workMaterials.put({
            id: swm.id,
            workId: swm.work_id,
            materialId: swm.material_id,
            quantity: swm.quantity ?? 1,
            calculationOverride: swm.calculation_override ?? null,
            createdAt: swm.created_at ?? new Date().toISOString(),
            syncStatus: 'synced',
          })
        }
      })

    } catch (error) {
      console.error('Ошибка синхронизации с сервера:', error)
    }
  },

  // Синхронизация локальных данных на сервер (фоновая)
  async syncLocalToServer(userId: string): Promise<void> {
    try {
      // Синхронизируем только записи без UUID (локальные)
      const localProfiles = await db.installationProfiles.where('userId').equals(userId).toArray()
      const unsyncedProfiles = localProfiles.filter(p => !isUUID(p.id))

      for (const profile of unsyncedProfiles) {
        const now = new Date().toISOString()
        const organizationId = await getActiveOrgIdForUser(userId)
        const { data: serverProfile, error } = await supabase
          .from('installation_profiles')
          .insert({
            user_id: userId,
            organization_id: organizationId,
            created_by: userId,
            name: profile.name,
            is_default: profile.isDefault,
            created_at: profile.createdAt || now,
            updated_at: now,
          })
          .select()
          .single()
        
        if (error) {
          console.error('Ошибка синхронизации профиля:', error)
          continue
        }

        const oldProfileId = String(profile.id)
        const newProfileId = serverProfile.id

        // Обновляем связи
        const profileMaterials = await db.materials.where('profileId').equals(oldProfileId).toArray()
        for (const mat of profileMaterials) {
          await db.materials.update(mat.id!, { profileId: newProfileId })
        }

        const profileWorks = await db.works.where('profileId').equals(oldProfileId).toArray()
        for (const work of profileWorks) {
          await db.works.update(work.id!, { profileId: newProfileId })
        }

        await db.installationProfiles.delete(profile.id!)
        await db.installationProfiles.put({
          ...profile,
          id: newProfileId,
          lastSyncedAt: now,
          syncStatus: 'synced',
        })
      }

      // Синхронизируем материалы
      const localMaterials = await db.materials.toArray()
      const unsyncedMaterials = localMaterials.filter(m => !isUUID(m.id) && isUUID(m.profileId))

      for (const material of unsyncedMaterials) {
        const now = new Date().toISOString()
        const organizationId = await getActiveOrgIdForUser(material.userId)
        const { data: serverMaterial, error } = await supabase
          .from('materials')
          .insert({
            profile_id: material.profileId,
            user_id: material.userId,
            organization_id: organizationId,
            created_by: material.userId,
            name: material.name,
            unit: material.unit,
            price: material.price,
            purchase_price: material.purchasePrice,
            total_cost: material.totalCost,
            calculation_type: material.calculationType,
            coefficient: material.coefficient || 1,
            initial_quantity: material.initialQuantity,
            created_at: material.createdAt || now,
            updated_at: now,
          })
          .select()
          .single()

        if (error) {
          console.error('Ошибка синхронизации материала:', error)
          continue
        }

        const oldMaterialId = String(material.id)
        const newMaterialId = serverMaterial.id

        const relatedWms = await db.workMaterials.where('materialId').equals(oldMaterialId).toArray()
        for (const wm of relatedWms) {
          await db.workMaterials.update(wm.id!, { materialId: newMaterialId })
        }

        await db.materials.delete(material.id!)
        await db.materials.put({
          ...material,
          id: newMaterialId,
          updatedAt: now,
          syncStatus: 'synced',
        })
      }

      // Синхронизируем работы
      const localWorks = await db.works.toArray()
      const unsyncedWorks = localWorks.filter(w => !isUUID(w.id) && isUUID(w.profileId))

      for (const work of unsyncedWorks) {
        const now = new Date().toISOString()
        const organizationId = await getActiveOrgIdForUser(work.userId)
        const { data: serverWork, error } = await supabase
          .from('works')
          .insert({
            profile_id: work.profileId,
            user_id: work.userId,
            organization_id: organizationId,
            created_by: work.userId,
            name: work.name,
            unit: work.unit || '',
            work_price: work.workPrice || 0,
            calculation_type: work.calculationType || 'byArea',
            created_at: work.createdAt || now,
            updated_at: now,
          })
          .select()
          .single()

        if (error) {
          console.error('Ошибка синхронизации работы:', error)
          continue
        }

        const oldWorkId = String(work.id)
        const newWorkId = serverWork.id

        const relatedWms = await db.workMaterials.where('workId').equals(oldWorkId).toArray()
        for (const wm of relatedWms) {
          await db.workMaterials.update(wm.id!, { workId: newWorkId })
        }

        await db.works.delete(work.id!)
        await db.works.put({
          ...work,
          id: newWorkId,
          updatedAt: now,
          syncStatus: 'synced',
        })
      }

      // Синхронизируем workMaterials
      const localWms = await db.workMaterials.toArray()
      const unsyncedWms = localWms.filter(wm => !isUUID(wm.id) && isUUID(wm.workId) && isUUID(wm.materialId))

      for (const wm of unsyncedWms) {
        const now = new Date().toISOString()
        const { data: serverWm, error } = await supabase
          .from('work_materials')
          .insert({
            work_id: wm.workId,
            material_id: wm.materialId,
            quantity: wm.quantity || 1,
            calculation_override: wm.calculationOverride,
            created_at: wm.createdAt || now,
          })
          .select()
          .single()

        if (error) {
          console.error('Ошибка синхронизации workMaterial:', error)
          continue
        }

        await db.workMaterials.delete(wm.id!)
        await db.workMaterials.put({
          ...wm,
          id: serverWm.id,
          syncStatus: 'synced',
        })
      }

    } catch (error) {
      console.error('Ошибка синхронизации на сервер:', error)
    }
  },

  // Устаревшие методы для обратной совместимости
  async syncAllFromServer(userId: string): Promise<void> {
    return this.syncFromServer(userId, true)
  },

  async forceSyncLocalToServer(userId: string): Promise<{ synced: number; errors: number }> {
    await this.syncLocalToServer(userId)
    return { synced: 0, errors: 0 }
  },

  deleteProfileFromServer: async (id: string): Promise<void> => {
    try {
      await supabase.from('materials').delete().eq('profile_id', id)
      await supabase.from('works').delete().eq('profile_id', id)
      await supabase.from('installation_profiles').delete().eq('id', id)
    } catch (error) {
      console.error('Ошибка удаления профиля на сервере:', error)
    }
  },
}
