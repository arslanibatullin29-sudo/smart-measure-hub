import { supabase } from '@/services/supabase/supabaseClient'
import { db, InstallationProfile, Material, Work, WorkMaterial } from '@/services/storage/indexedDB'
import { findEntityById } from '@/shared/utils/dbHelpers'
import { handleError } from '@/shared/utils/errorHandler'
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
    const profiles = await db.installationProfiles.where('userId').equals(userId).toArray()
    // Фильтруем дубликаты по id на случай проблем с синхронизацией
    const uniqueProfiles = Array.from(
      new Map(profiles.map(p => [String(p.id), p])).values()
    )
    // Фильтруем профили, которые были удалены (проверяем через syncQueue на операцию delete)
    const syncQueue = await db.syncQueue
      .where('table').equals('installation_profiles')
      .and(item => item.operation === 'delete')
      .toArray()
    
    const deletedProfileIds = new Set(syncQueue.map(item => item.recordId))
    
    // Фильтруем профили, которые в очереди на удаление или уже удалены из локальной БД
    return uniqueProfiles.filter(p => {
      const profileId = String(p.id)
      // Исключаем профили, которые в очереди на удаление
      if (deletedProfileIds.has(profileId)) {
        return false
      }
      return true
    })
  },

  async createProfile(userId: string, name: string, isDefault: boolean = false): Promise<InstallationProfile> {
    const now = new Date().toISOString()
    
    // Если создаем профиль по умолчанию, сначала снимаем флаг с других профилей на СЕРВЕРЕ
    if (isDefault) {
      try {
        // Снимаем флаг is_default на сервере ПЕРЕД созданием нового профиля
        const { data: serverProfiles } = await supabase
          .from('installation_profiles')
          .select('id, is_default')
          .eq('user_id', userId)
          .eq('is_default', true)
        
        if (serverProfiles && serverProfiles.length > 0) {
          for (const otherProfile of serverProfiles) {
            await supabase
              .from('installation_profiles')
              .update({ is_default: false, updated_at: now })
              .eq('id', otherProfile.id)
          }
        }
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
    
    // Создаем объект БЕЗ id
    const profileData = {
      userId,
      name,
      isDefault: isDefault || false,
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: null,
      syncStatus: 'pending' as const,
    }

    const id = await db.installationProfiles.add(profileData)
    const saved: InstallationProfile = { ...profileData, id } as InstallationProfile

    await db.syncQueue.add({
      table: 'installation_profiles',
      recordId: String(id),
      operation: 'create',
      data: saved,
      timestamp: now,
      retries: 0,
    })

    // Синхронизируем профиль, но НЕ устанавливаем is_default повторно (уже сделано выше)
    try {
      await this.syncProfileToServer({ ...saved, isDefault: false })
      // После синхронизации обновляем с правильным isDefault
      if (isDefault) {
        const syncedProfile = await db.installationProfiles.get(id)
        if (syncedProfile) {
          await supabase
            .from('installation_profiles')
            .update({ is_default: true, updated_at: now })
            .eq('id', String(syncedProfile.id))
          await db.installationProfiles.update(syncedProfile.id!, { isDefault: true, syncStatus: 'synced' })
        }
      }
    } catch (error) {
      console.error('Ошибка синхронизации профиля:', error)
    }
    
    // Возвращаем актуальный профиль из БД
    const result = await db.installationProfiles.get(id)
    return result || saved
  },

  async updateProfile(id: string | number, data: Partial<InstallationProfile>): Promise<InstallationProfile> {
    const now = new Date().toISOString()
    const profile = await findEntityById<InstallationProfile>(db.installationProfiles, id)
    if (!profile) throw new Error('Профиль не найден')

    // Если устанавливаем профиль по умолчанию, снимаем флаг с других СНАЧАЛА НА СЕРВЕРЕ
    if (data.isDefault === true) {
      try {
        // Снимаем флаг is_default на сервере ПЕРЕД обновлением
        const { data: serverProfiles } = await supabase
          .from('installation_profiles')
          .select('id, is_default')
          .eq('user_id', profile.userId)
          .eq('is_default', true)
        
        if (serverProfiles && serverProfiles.length > 0) {
          const otherProfiles = serverProfiles.filter(p => String(p.id) !== String(id))
          for (const otherProfile of otherProfiles) {
            await supabase
              .from('installation_profiles')
              .update({ is_default: false, updated_at: now })
              .eq('id', otherProfile.id)
          }
        }
      } catch (error) {
        console.error('Ошибка при снятии флага is_default на сервере:', error)
      }
      
      // Затем снимаем флаг локально
      const existingDefault = await db.installationProfiles
        .where('userId').equals(profile.userId)
        .and(p => p.isDefault === true && String(p.id) !== String(id))
        .toArray()
      
      for (const p of existingDefault) {
        await db.installationProfiles.update(p.id!, { isDefault: false, syncStatus: 'synced', updatedAt: now })
      }
    }

    const updated: InstallationProfile = { ...profile, ...data, updatedAt: now, syncStatus: 'pending' }
    await db.installationProfiles.update(profile.id!, updated)

    // Синхронизируем обновленный профиль
    try {
      await this.syncProfileToServer(updated)
    } catch (error) {
      console.error('Ошибка синхронизации профиля:', error)
    }
    
    return updated
  },

  // Материалы
  async getMaterials(profileId: string): Promise<Material[]> {
    // Получаем все материалы и фильтруем по profileId (поддерживаем и строковые, и числовые ID)
    const allMaterials = await db.materials.toArray()
    return allMaterials.filter(m => String(m.profileId) === String(profileId))
  },

  async createMaterial(profileId: string, userId: string, data: Omit<Material, 'id' | 'profileId' | 'userId' | 'createdAt' | 'updatedAt' | 'syncStatus'>): Promise<Material> {
    const now = new Date().toISOString()
    // Создаем объект БЕЗ id
    const materialData = {
      profileId,
      userId,
      ...data,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending' as const,
    }

    const id = await db.materials.add(materialData)
    const saved: Material = { ...materialData, id: id as number }

    await db.syncQueue.add({
      table: 'materials',
      recordId: String(id),
      operation: 'create',
      data: saved,
      timestamp: now,
      retries: 0,
    })

    this.syncMaterialToServer(saved).catch(console.error)
    return saved
  },

  async updateMaterial(id: string | number, data: Partial<Material>): Promise<Material> {
    const now = new Date().toISOString()
    const material = await findEntityById<Material>(db.materials, id)
    if (!material) throw new Error('Материал не найден')

    const updated: Material = { ...material, ...data, updatedAt: now, syncStatus: 'pending' }
    await db.materials.update(material.id!, updated)

    await db.syncQueue.add({
      table: 'materials',
      recordId: String(material.id),
      operation: 'update',
      data: updated,
      timestamp: now,
      retries: 0,
    })

    this.syncMaterialToServer(updated).catch(console.error)
    return updated
  },

  async deleteMaterial(id: string | number): Promise<void> {
    const material = await findEntityById<Material>(db.materials, id)
    if (!material) throw new Error('Материал не найден')
    
    const materialId = String(material.id)
    
    // Удаляем связи с работами
    await db.workMaterials.where('materialId').equals(materialId).delete()
    
    // Удаляем материал из локальной БД
    await db.materials.delete(material.id!)
    
    // Добавляем в очередь синхронизации для удаления на сервере
    await db.syncQueue.add({
      table: 'materials',
      recordId: materialId,
      operation: 'delete',
      data: material,
      timestamp: new Date().toISOString(),
      retries: 0,
    })
    
    // Синхронизируем удаление с сервером
    this.deleteMaterialFromServer(material).catch(console.error)
  },

  // Работы
  async getWorks(profileId: string): Promise<Work[]> {
    // Получаем все работы и фильтруем по profileId (поддерживаем и строковые, и числовые ID)
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
    // Создаем объект БЕЗ id
    const workData = {
      profileId,
      userId,
      ...data,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending' as const,
    }

    const id = await db.works.add(workData)
    const saved: Work = { ...workData, id: id as number }

    // Создаём связи с материалами
    for (const materialId of materialIds) {
      await db.workMaterials.add({
        workId: String(id),
        materialId,
        quantity: 1,
        calculationOverride: null,
        createdAt: now,
        syncStatus: 'pending' as const,
      })
    }

    await db.syncQueue.add({
      table: 'works',
      recordId: String(id),
      operation: 'create',
      data: saved,
      timestamp: now,
      retries: 0,
    })

    this.syncWorkToServer(saved).catch(console.error)
    return saved
  },

  async updateWork(id: string | number, data: Partial<Work>, materialIds?: string[]): Promise<Work> {
    const now = new Date().toISOString()
    const work = await findEntityById<Work>(db.works, id)
    if (!work) throw new Error('Работа не найдена')

    const updated: Work = { ...work, ...data, updatedAt: now, syncStatus: 'pending' }
    await db.works.update(work.id!, updated)

    if (materialIds) {
      // Удаляем старые связи
      await db.workMaterials.where('workId').equals(String(work.id)).delete()
      // Создаём новые
      for (const materialId of materialIds) {
        await db.workMaterials.add({
          workId: String(work.id),
          materialId,
          quantity: 1,
          calculationOverride: null,
          createdAt: now,
          syncStatus: 'pending',
        } as WorkMaterial)
      }
    }

    await db.syncQueue.add({
      table: 'works',
      recordId: String(work.id),
      operation: 'update',
      data: updated,
      timestamp: now,
      retries: 0,
    })

    this.syncWorkToServer(updated).catch(console.error)
    return updated
  },

  async deleteWork(id: string | number): Promise<void> {
    const work = await findEntityById<Work>(db.works, id)
    if (!work) throw new Error('Работа не найдена')
    
    const workId = String(work.id)
    
    // Удаляем связи с материалами
    await db.workMaterials.where('workId').equals(workId).delete()
    
    // Удаляем работу из локальной БД
    await db.works.delete(work.id!)
    
    // Добавляем в очередь синхронизации для удаления на сервере
    await db.syncQueue.add({
      table: 'works',
      recordId: workId,
      operation: 'delete',
      data: work,
      timestamp: new Date().toISOString(),
      retries: 0,
    })
    
    // Синхронизируем удаление с сервером
    this.deleteWorkFromServer(work).catch(console.error)
  },

  // Синхронизация профилей
  async syncProfileToServer(profile: InstallationProfile): Promise<void> {
    try {
      // НЕ снимаем флаг is_default здесь - это уже сделано в createProfile/updateProfile

      const profileHasUUID = profile.id && isUUID(profile.id)
      
      const dataToUpsert: any = {
        user_id: profile.userId,
        name: profile.name,
        is_default: profile.isDefault || false,
        updated_at: profile.updatedAt || new Date().toISOString(),
      }

      if (profileHasUUID) {
        dataToUpsert.id = profile.id
      }

      let data, error
      
      if (profileHasUUID) {
        const result = await supabase
          .from('installation_profiles')
          .upsert(dataToUpsert, { onConflict: 'id' })
          .select()
          .single()
        data = result.data
        error = result.error
      } else {
        const result = await supabase
          .from('installation_profiles')
          .insert(dataToUpsert)
          .select()
          .single()
        data = result.data
        error = result.error
      }

      if (error) throw error

      if (profile.id && !profileHasUUID && data?.id) {
        const oldId = profile.id
        const newId = data.id
        
        await db.installationProfiles.update(oldId as any, { 
          id: newId,
          syncStatus: 'synced',
          lastSyncedAt: new Date().toISOString(),
        } as any)
        
        // Обновляем все материалы и работы с новым profileId
        await db.materials
          .where('profileId')
          .equals(String(oldId))
          .modify({ profileId: String(newId) })
        
        await db.works
          .where('profileId')
          .equals(String(oldId))
          .modify({ profileId: String(newId) })
      } else if (profile.id) {
        await db.installationProfiles.update(profile.id as any, {
          syncStatus: 'synced',
          lastSyncedAt: new Date().toISOString(),
        })
      }
    } catch (error) {
      handleError(error, 'Ошибка синхронизации профиля')
      if (profile.id) {
        await db.installationProfiles.update(profile.id as any, { syncStatus: 'error' })
      }
      throw error // Пробрасываем ошибку для обработки в syncService
    }
  },

  // Удаление профиля на сервере
  async deleteProfileFromServer(profile: InstallationProfile): Promise<void> {
    try {
      const profileHasUUID = profile.id && isUUID(profile.id)
      
      if (profileHasUUID && profile.id) {
        const { error } = await supabase
          .from('installation_profiles')
          .delete()
          .eq('id', String(profile.id))
        
        if (error) throw error
      }
      // Если это локальная запись (числовой ID), просто игнорируем удаление на сервере
    } catch (error) {
      handleError(error, 'Ошибка удаления профиля на сервере')
    }
  },

  // Синхронизация
  async syncMaterialToServer(material: Material): Promise<void> {
    try {
      // Проверяем, является ли ID UUID (строка с форматом UUID)
      const materialHasUUID = material.id && isUUID(material.id)
      
      // Получаем UUID профиля из Supabase, если profileId не является UUID
      let profileIdToUse = material.profileId
      if (!isUUID(material.profileId)) {
        // Ищем профиль в локальной БД
        const profile = await findEntityById<InstallationProfile>(db.installationProfiles, material.profileId)
        if (profile && profile.id && isUUID(profile.id)) {
          profileIdToUse = String(profile.id)
        } else {
          // Если профиль еще не синхронизирован, пропускаем синхронизацию материала
          console.warn('Профиль еще не синхронизирован, пропускаем синхронизацию материала')
          return
        }
      }

      const dataToUpsert: any = {
        profile_id: profileIdToUse,
        user_id: material.userId,
        name: material.name,
        unit: material.unit,
        price: material.price,
        calculation_type: material.calculationType,
        coefficient: material.coefficient,
        updated_at: material.updatedAt,
      }

      // Добавляем опциональные поля, если они есть
      if (material.purchasePrice !== undefined) {
        dataToUpsert.purchase_price = material.purchasePrice
      }
      if (material.totalCost !== undefined) {
        dataToUpsert.total_cost = material.totalCost
      }
      if (material.initialQuantity !== undefined) {
        dataToUpsert.initial_quantity = material.initialQuantity
      }

      // Передаем ID только если это UUID (существующая запись в Supabase)
      if (materialHasUUID) {
        dataToUpsert.id = material.id
      }

      let data, error
      
      if (materialHasUUID) {
        // Для существующих записей используем upsert по ID
        const result = await supabase
          .from('materials')
          .upsert(dataToUpsert, { onConflict: 'id' })
          .select()
          .single()
        data = result.data
        error = result.error
      } else {
        // Для новых записей используем insert (простое создание)
        const result = await supabase
          .from('materials')
          .insert(dataToUpsert)
          .select()
          .single()
        data = result.data
        error = result.error
      }

      if (error) throw error

      // Если это была новая запись и Supabase вернул UUID, обновляем локальную запись
      if (material.id && !materialHasUUID && data?.id) {
        // Обновляем ID в локальной БД на UUID из Supabase
        const oldId = material.id
        const newId = data.id
        
        // Обновляем материал с новым ID
        await db.materials.update(oldId as any, { 
          id: newId,
          syncStatus: 'synced',
          lastSyncedAt: new Date().toISOString(),
        } as any)
        
        // Обновляем все связи workMaterials
        await db.workMaterials
          .where('materialId')
          .equals(String(oldId))
          .modify({ materialId: String(newId) })
      } else if (material.id) {
        await db.materials.update(material.id as any, {
          syncStatus: 'synced',
          lastSyncedAt: new Date().toISOString(),
        })
      }
    } catch (error) {
      handleError(error, 'Ошибка синхронизации материала')
      if (material.id) {
        await db.materials.update(material.id as any, { syncStatus: 'error' })
      }
      throw error // Пробрасываем ошибку для обработки в syncService
    }
  },

  async syncWorkToServer(work: Work): Promise<void> {
    try {
      // Проверяем, является ли ID UUID (строка с форматом UUID)
      const workHasUUID = work.id && isUUID(work.id)
      
      // Проверяем обязательные поля
      if (!work.profileId || !work.userId || !work.name) {
        throw new Error('Отсутствуют обязательные поля для синхронизации работы')
      }

      // Получаем UUID профиля из Supabase, если profileId не является UUID
      let profileIdToUse = work.profileId
      if (!isUUID(work.profileId)) {
        // Ищем профиль в локальной БД
        const profile = await findEntityById<InstallationProfile>(db.installationProfiles, work.profileId)
        if (profile && profile.id && isUUID(profile.id)) {
          profileIdToUse = String(profile.id)
        } else {
          // Если профиль еще не синхронизирован, пропускаем синхронизацию работы
          console.warn('Профиль еще не синхронизирован, пропускаем синхронизацию работы')
          return
        }
      }

      const dataToUpsert: any = {
        profile_id: profileIdToUse,
        user_id: work.userId,
        name: work.name,
        unit: work.unit || '',
        work_price: work.workPrice || 0,
        calculation_type: work.calculationType || 'byArea',
        updated_at: work.updatedAt || new Date().toISOString(),
      }

      // Передаем ID только если это UUID (существующая запись в Supabase)
      if (workHasUUID) {
        dataToUpsert.id = work.id
      }

      let data, error
      
      if (workHasUUID) {
        // Для существующих записей используем upsert по ID
        const result = await supabase
          .from('works')
          .upsert(dataToUpsert, { onConflict: 'id' })
          .select()
          .single()
        data = result.data
        error = result.error
      } else {
        // Для новых записей используем insert (простое создание)
        const result = await supabase
          .from('works')
          .insert(dataToUpsert)
          .select()
          .single()
        data = result.data
        error = result.error
      }

      if (error) {
        console.error('Детали ошибки синхронизации работы:', {
          error,
          dataToUpsert,
          workHasUUID,
          work
        })
        throw error
      }

      // Если это была новая запись и Supabase вернул UUID, обновляем локальную запись
      if (work.id && !workHasUUID && data?.id) {
        // Обновляем ID в локальной БД на UUID из Supabase
        const oldId = work.id
        const newId = data.id
        
        // Обновляем работу с новым ID
        await db.works.update(oldId as any, { 
          id: newId,
          syncStatus: 'synced',
          lastSyncedAt: new Date().toISOString(),
        } as any)
        
        // Обновляем все связи workMaterials
        await db.workMaterials
          .where('workId')
          .equals(String(oldId))
          .modify({ workId: String(newId) })
      } else if (work.id) {
        await db.works.update(work.id as any, {
          syncStatus: 'synced',
          lastSyncedAt: new Date().toISOString(),
        })
      }
    } catch (error) {
      handleError(error, 'Ошибка синхронизации работы')
      if (work.id) {
        await db.works.update(work.id as any, { syncStatus: 'error' })
      }
      throw error // Пробрасываем ошибку для обработки в syncService
    }
  },

  async deleteMaterialFromServer(material: Material): Promise<void> {
    try {
      // Удаляем только если ID является UUID (запись существует в Supabase)
      if (material.id && isUUID(material.id)) {
        const { error } = await supabase
          .from('materials')
          .delete()
          .eq('id', String(material.id))

        if (error) throw error
      }
      // Если это локальная запись (числовой ID), просто игнорируем удаление на сервере
    } catch (error) {
      handleError(error, 'Ошибка удаления материала на сервере')
    }
  },

  async deleteWorkFromServer(work: Work): Promise<void> {
    try {
      // Удаляем только если ID является UUID (запись существует в Supabase)
      if (work.id && isUUID(work.id)) {
        const { error } = await supabase
          .from('works')
          .delete()
          .eq('id', String(work.id))

        if (error) throw error
      }
      // Если это локальная запись (числовой ID), просто игнорируем удаление на сервере
    } catch (error) {
      handleError(error, 'Ошибка удаления работы на сервере')
    }
  },

  // Синхронизация всех профилей с сервера
  async syncAllFromServer(userId: string): Promise<void> {
    try {
      // Синхронизируем профили
      const { data: profilesData, error: profilesError } = await supabase
        .from('installation_profiles')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (profilesError) throw profilesError

      if (profilesData && profilesData.length > 0) {
        const localProfiles = await db.installationProfiles.where('userId').equals(userId).toArray()
        const localByUuid = new Map<string, InstallationProfile>()
        // Также создаем мапу по числовым ID для проверки дубликатов
        const localByNumericId = new Map<number, InstallationProfile>()

        localProfiles.forEach((p: InstallationProfile) => {
          if (typeof p.id === 'string') {
            localByUuid.set(p.id, p)
          } else if (typeof p.id === 'number') {
            localByNumericId.set(p.id, p)
          }
        })

        // Получаем список профилей, которые в очереди на удаление
        const syncQueue = await db.syncQueue
          .where('table').equals('installation_profiles')
          .and(item => item.operation === 'delete')
          .toArray()
        
        const deletedProfileIds = new Set(syncQueue.map(item => item.recordId))

        for (const item of profilesData) {
          // Пропускаем профили, которые были удалены локально
          if (deletedProfileIds.has(item.id)) {
            continue
          }

          const profile: InstallationProfile = {
            id: item.id,
            userId: item.user_id,
            name: item.name,
            isDefault: item.is_default || false,
            createdAt: item.created_at ?? new Date().toISOString(),
            updatedAt: item.updated_at ?? new Date().toISOString(),
            lastSyncedAt: item.last_synced_at ?? null,
            syncStatus: 'synced',
          }

          const existing = localByUuid.get(item.id)
          if (existing) {
            // Проверяем, что локальный профиль не был удален
            const isDeleted = deletedProfileIds.has(item.id)
            if (!isDeleted) {
              const serverTime = new Date(item.updated_at ?? new Date()).getTime()
              const localTime = new Date(existing.updatedAt).getTime()
              if (serverTime > localTime) {
                // Если локальный профиль имеет числовой ID, а серверный UUID, удаляем старый
                if (typeof existing.id === 'number' && typeof item.id === 'string') {
                  await db.installationProfiles.delete(existing.id)
                }
                await db.installationProfiles.put(profile)
              }
            }
          } else {
            // Проверяем, нет ли локального профиля с числовым ID, который соответствует этому UUID
            // (это может быть тот же профиль после синхронизации)
            const matchingNumericProfile = Array.from(localByNumericId.values()).find(
              p => p.name === item.name && p.userId === item.user_id
            )
            
            if (matchingNumericProfile) {
              // Это тот же профиль, но с числовым ID - удаляем старый и добавляем новый с UUID
              await db.installationProfiles.delete(matchingNumericProfile.id!)
              await db.installationProfiles.put(profile)
            } else {
              // Добавляем новый профиль только если он не был удален локально
              if (!deletedProfileIds.has(item.id)) {
                await db.installationProfiles.put(profile)
              }
            }
          }
        }
      }

      // Синхронизируем материалы
      const { data: materialsData, error: materialsError } = await supabase
        .from('materials')
        .select('*')
        .eq('user_id', userId)

      if (materialsError) throw materialsError

      if (materialsData && materialsData.length > 0) {
        const localMaterials = await db.materials.where('userId').equals(userId).toArray()
        const localByUuid = new Map<string, Material>()

        localMaterials.forEach((m: Material) => {
          if (typeof m.id === 'string') {
            localByUuid.set(m.id, m)
          }
        })

        for (const item of materialsData) {
          const material: Material = {
            id: item.id,
            profileId: item.profile_id,
            userId: item.user_id,
            name: item.name,
            unit: item.unit,
            price: item.price,
            purchasePrice: item.purchase_price ?? undefined,
            totalCost: item.total_cost ?? undefined,
            calculationType: (item.calculation_type as 'byArea' | 'byPerimeter' | 'byCount') || 'byArea',
            coefficient: item.coefficient ?? 1,
            initialQuantity: item.initial_quantity ?? undefined,
            createdAt: item.created_at ?? new Date().toISOString(),
            updatedAt: item.updated_at ?? new Date().toISOString(),
            syncStatus: 'synced',
          }

          const existing = localByUuid.get(item.id)
          if (existing) {
            const serverTime = new Date(item.updated_at ?? new Date()).getTime()
            const localTime = new Date(existing.updatedAt).getTime()
            if (serverTime > localTime) {
              await db.materials.put(material)
            }
          } else {
            await db.materials.put(material)
          }
        }
      }

      // Синхронизируем работы
      const { data: worksData, error: worksError } = await supabase
        .from('works')
        .select('*')
        .eq('user_id', userId)

      if (worksError) throw worksError

      if (worksData && worksData.length > 0) {
        const localWorks = await db.works.where('userId').equals(userId).toArray()
        const localByUuid = new Map<string, Work>()

        localWorks.forEach((w: Work) => {
          if (typeof w.id === 'string') {
            localByUuid.set(w.id, w)
          }
        })

        for (const item of worksData) {
          const work: Work = {
            id: item.id,
            profileId: item.profile_id,
            userId: item.user_id,
            name: item.name,
            unit: item.unit,
            workPrice: item.work_price,
            calculationType: (item.calculation_type as 'byArea' | 'byPerimeter' | 'byCount') || 'byArea',
            createdAt: item.created_at ?? new Date().toISOString(),
            updatedAt: item.updated_at ?? new Date().toISOString(),
            syncStatus: 'synced',
          }

          const existing = localByUuid.get(item.id)
          if (existing) {
            const serverTime = new Date(item.updated_at ?? new Date()).getTime()
            const localTime = new Date(existing.updatedAt).getTime()
            if (serverTime > localTime) {
              await db.works.put(work)
            }
          } else {
            await db.works.put(work)
          }
        }
      }
    } catch (error) {
      console.error('Ошибка синхронизации профилей с сервера:', error)
    }
  },
}

