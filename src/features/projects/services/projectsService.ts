import { supabase } from '@/services/supabase/supabaseClient'
import { db, Project } from '@/services/storage/indexedDB'

export const projectsService = {
  async getAll(customerId: string, userId: string): Promise<Project[]> {
    const localProjects = await db.projects
      .where('[customerId+userId]')
      .equals([customerId, userId])
      .toArray()

    // Синхронизация отключена здесь, чтобы избежать дублирования
    // Синхронизация происходит через SyncService автоматически
    // this.syncFromServer(customerId, userId).catch(console.error)

    return localProjects
  },

  async getById(id: string | number): Promise<Project | undefined> {
    // Пробуем найти по строковому ID (UUID из Supabase)
    let project = await db.projects.get(id)
    
    // Если не нашли и ID похож на число, пробуем найти по числовому ID (локальный)
    if (!project && typeof id === 'string' && /^\d+$/.test(id)) {
      project = await db.projects.get(Number(id))
    }
    
    return project
  },

  async create(data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'lastSyncedAt' | 'syncStatus'>): Promise<Project> {
    const now = new Date().toISOString()
    
    // Validate required data
    if (!data.customerId || !data.userId) {
      throw new Error('Отсутствуют обязательные поля: customerId или userId')
    }
    
    if (!data.points || data.points.length < 3) {
      throw new Error('Необходимо минимум 3 точки для создания объекта')
    }
    
    // Создаем объект БЕЗ id, чтобы Dexie мог автоматически сгенерировать его
    const projectData = {
      ...data,
      // Ensure numeric values are properly formatted
      area: Number(data.area) || 0,
      perimeter: Number(data.perimeter) || 0,
      elementCount: Number(data.elementCount) || 0,
      points: [...data.points], // Create a copy to avoid mutation
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: null,
      syncStatus: 'pending' as const,
    }

    // Сохраняем локально (id будет сгенерирован автоматически)
    let id: number
    try {
      id = await db.projects.add(projectData) as number
    } catch (dbError: any) {
      console.error('IndexedDB save error:', dbError)
      throw new Error('Ошибка сохранения в локальную базу данных')
    }
    
    const savedProject: Project = { ...projectData, id }

    // Add to sync queue (non-blocking)
    try {
      await db.syncQueue.add({
        table: 'projects',
        recordId: String(id),
        operation: 'create',
        data: savedProject,
        timestamp: now,
        retries: 0,
      })
    } catch (queueError) {
      console.error('Sync queue error:', queueError)
      // Don't throw - project is saved locally
    }

    return savedProject
  },

  async update(id: string | number, data: Partial<Project>): Promise<Project> {
    const now = new Date().toISOString()
    
    let project
    let actualId: string | number = id
    try {
      project = await db.projects.get(id)
      // Если не нашли и ID похож на число, пробуем найти по числовому ID
      if (!project && typeof id === 'string' && /^\d+$/.test(id)) {
        actualId = Number(id)
        project = await db.projects.get(actualId)
      }
    } catch (dbError) {
      console.error('IndexedDB read error:', dbError)
      throw new Error('Ошибка чтения из локальной базы данных')
    }
    
    if (!project) throw new Error('Проект не найден')

    const updated: Project = {
      ...project,
      ...data,
      // Ensure numeric values are properly formatted
      area: data.area !== undefined ? Number(data.area) || project.area : project.area,
      perimeter: data.perimeter !== undefined ? Number(data.perimeter) || project.perimeter : project.perimeter,
      elementCount: data.elementCount !== undefined ? Number(data.elementCount) || 0 : project.elementCount,
      points: data.points ? [...data.points] : project.points,
      updatedAt: now,
      syncStatus: 'pending',
    }

    try {
      await db.projects.update(actualId, updated)
    } catch (dbError: any) {
      console.error('IndexedDB update error:', dbError)
      throw new Error('Ошибка обновления в локальной базе данных')
    }

    // Add to sync queue (non-blocking)
    try {
      await db.syncQueue.add({
        table: 'projects',
        recordId: String(actualId),
        operation: 'update',
        data: updated,
        timestamp: now,
        retries: 0,
      })
    } catch (queueError) {
      console.error('Sync queue error:', queueError)
      // Don't throw - project is saved locally
    }

    return updated
  },

  async delete(id: string | number): Promise<void> {
    let project = await db.projects.get(id)
    let actualId: string | number = id
    // Если не нашли и ID похож на число, пробуем найти по числовому ID
    if (!project && typeof id === 'string' && /^\d+$/.test(id)) {
      actualId = Number(id)
      project = await db.projects.get(actualId)
    }
    if (!project) throw new Error('Проект не найден')

    await db.projects.delete(actualId)

    // Если проект был синхронизирован (имеет UUID) или находится в очереди синхронизации
    if (project.id && typeof project.id === 'string') {
      // Проект имеет UUID - удаляем с сервера
      const projectId = project.id
      await db.syncQueue.add({
        table: 'projects',
        recordId: projectId,
        operation: 'delete',
        data: { id: projectId },
        timestamp: new Date().toISOString(),
        retries: 0,
      })

      // Пытаемся удалить с сервера
      this.deleteFromServer(projectId).catch(console.error)
    } else if (project.id) {
      // Проект с числовым ID - удаляем из очереди синхронизации, если он там есть
      const queueItems = await db.syncQueue
        .where('table').equals('projects')
        .and((q: any) => q.recordId === String(project.id))
        .toArray()
      for (const queueItem of queueItems) {
        await db.syncQueue.delete(queueItem.id!)
      }
    }
  },

  async syncToServer(project: Project): Promise<void> {
    try {
      // Если ID - число (локальный), не отправляем его (Supabase создаст UUID)
      // Если ID - строка (UUID), отправляем для обновления
      const payload: any = {
        customer_id: project.customerId,
        user_id: project.userId,
        points: project.points, // JSONB принимает объекты напрямую
        area: project.area,
        perimeter: project.perimeter,
        element_count: project.elementCount,
        estimate_data: project.estimateData || null, // JSONB принимает объекты напрямую
        updated_at: project.updatedAt,
      }

      // Добавляем profile_id, если он указан и является UUID
      if (project.profileId) {
        // Проверяем, является ли profileId UUID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(project.profileId))
        if (isUUID) {
          payload.profile_id = project.profileId
        }
      }

      // Добавляем ID только если это строка (UUID из Supabase)
      if (project.id && typeof project.id === 'string') {
        payload.id = project.id
      }

      const { data, error } = await supabase
        .from('projects')
        .upsert(payload)
        .select()
        .single()

      if (error) {
        console.error('Ошибка синхронизации проекта:', error)
        console.error('Детали ошибки:', JSON.stringify(error, null, 2))
        console.error('Отправляемые данные:', JSON.stringify(payload, null, 2))
        throw error
      }

      // Обновляем локальную запись с ID из Supabase (если это была новая запись)
      if (data && project.id && typeof project.id === 'number') {
        // Заменяем локальный числовой ID на UUID из Supabase
        const newId = data.id
        
        // JSONB возвращается как объект, но на всякий случай проверяем
        let points: Array<{ x: number; y: number }> = project.points
        try {
          if (data.points) {
            points = typeof data.points === 'string' ? JSON.parse(data.points) : (data.points || project.points)
          }
        } catch (e) {
          console.error('Ошибка парсинга points при обновлении:', e)
        }

        let estimateData: any = project.estimateData
        try {
          if (data.estimate_data !== undefined && data.estimate_data !== null) {
            estimateData = typeof data.estimate_data === 'string'
              ? JSON.parse(data.estimate_data)
              : data.estimate_data
          }
        } catch (e) {
          console.error('Ошибка парсинга estimate_data при обновлении:', e)
        }

        // Проверяем, не существует ли уже запись с этим UUID
        const existing = await db.projects.get(newId)
        if (existing) {
          // Запись уже существует - удаляем только старую с числовым ID
          await db.projects.delete(project.id)
        } else {
          // Заменяем локальный числовой ID на UUID из Supabase
          await db.projects.delete(project.id)
          // Используем put() для записи с UUID (не auto-increment)
          await db.projects.put({ 
            ...project, 
            id: newId, 
            points,
            estimateData,
            syncStatus: 'synced', 
            lastSyncedAt: new Date().toISOString() 
          })
        }
        
        // Удаляем из очереди синхронизации (для обоих случаев)
        const queueItemsToDelete = await db.syncQueue
          .where('table').equals('projects')
          .and((q: any) => q.recordId === String(project.id))
          .toArray()
        for (const queueItem of queueItemsToDelete) {
          await db.syncQueue.delete(queueItem.id!)
        }
      } else if (project.id) {
        // Обновляем статус синхронизации для существующей записи
        await db.projects.update(project.id, {
          syncStatus: 'synced',
          lastSyncedAt: new Date().toISOString(),
        })
        // Удаляем из очереди синхронизации
        const queueItemsToDelete2 = await db.syncQueue
          .where('table').equals('projects')
          .and((q: any) => q.recordId === String(project.id))
          .toArray()
        for (const queueItem of queueItemsToDelete2) {
          await db.syncQueue.delete(queueItem.id!)
        }
      }
    } catch (error: any) {
      console.error('Ошибка синхронизации проекта:', error)
      const errorMessage = error?.message || 'Неизвестная ошибка'
      
      // Проверяем типичные ошибки
      if (errorMessage.includes('relation') || errorMessage.includes('does not exist')) {
        console.error('Таблица projects не существует в Supabase. Выполните миграции из SETUP.md')
      } else if (errorMessage.includes('permission denied') || errorMessage.includes('row-level security')) {
        console.error('RLS политики не настроены. Настройте RLS в Supabase согласно SETUP.md')
      }
      
      if (project.id) {
        await db.projects.update(project.id, { syncStatus: 'error' })
      }
      // Не пробрасываем ошибку дальше, чтобы не блокировать работу приложения
    }
  },

  async syncFromServer(customerId: string, userId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('customer_id', customerId)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (error) throw error

      if (!data || data.length === 0) {
        return // Нет данных на сервере
      }

      // Получаем все локальные проекты для этого клиента и пользователя
      const localProjects = await db.projects
        .where('[customerId+userId]')
        .equals([customerId, userId])
        .toArray()

      // Создаем Map для быстрого поиска
      const localByUuid = new Map<string, Project>()
      const localByContent = new Map<string, Project>() // Ключ: customerId_userId_pointsHash
      
      localProjects.forEach((p: Project) => {
        if (typeof p.id === 'string') {
          localByUuid.set(p.id, p)
        }
        // Создаем ключ для поиска по содержимому
        const pointsHash = JSON.stringify(p.points || [])
        const contentKey = `${p.customerId}_${p.userId}_${pointsHash.substring(0, 50)}`
        localByContent.set(contentKey, p)
      })

      // Обрабатываем серверные данные
      for (const item of data) {
        // JSONB возвращается как объект, но на всякий случай проверяем
        let points: Array<{ x: number; y: number }> = []
        try {
          if (item.points) {
            points = typeof item.points === 'string' ? JSON.parse(item.points) : item.points
          }
        } catch (e) {
          console.error('Ошибка парсинга points:', e)
        }

        let estimateData: any = null
        try {
          if (item.estimate_data) {
            estimateData = typeof item.estimate_data === 'string' 
              ? JSON.parse(item.estimate_data) 
              : item.estimate_data
          }
        } catch (e) {
          console.error('Ошибка парсинга estimate_data:', e)
        }

        const project: Project = {
          id: item.id,
          customerId: item.customer_id ?? '',
          userId: item.user_id,
          profileId: item.profile_id || null,
          createdAt: item.created_at ?? new Date().toISOString(),
          updatedAt: item.updated_at ?? new Date().toISOString(),
          lastSyncedAt: item.last_synced_at ?? null,
          points,
          area: item.area,
          perimeter: item.perimeter,
          elementCount: item.element_count ?? 0,
          estimateData,
          syncStatus: 'synced',
        }

        // Проверяем, есть ли уже запись с этим UUID
        const existingByUuid = localByUuid.get(item.id)
        if (existingByUuid) {
          // Обновляем существующую запись только если серверная версия новее
          const serverTime = new Date(item.updated_at ?? new Date()).getTime()
          const localTime = new Date(existingByUuid.updatedAt).getTime()
          if (serverTime > localTime) {
            await db.projects.put(project)
          }
          continue
        }

        // Проверяем, нет ли локальной записи с таким же содержимым
        const pointsHash = JSON.stringify(points)
        const contentKey = `${item.customer_id}_${item.user_id}_${pointsHash.substring(0, 50)}`
        const existingByContent = localByContent.get(contentKey)
        
        if (existingByContent) {
          // Найдена локальная запись с таким же содержимым
          if (typeof existingByContent.id === 'number') {
            // Это локальная запись с числовым ID - заменяем на UUID
            await db.projects.delete(existingByContent.id)
            // Удаляем из очереди синхронизации
            const queueItems = await db.syncQueue
              .where('table').equals('projects')
              .and((q: any) => q.recordId === String(existingByContent.id))
              .toArray()
            for (const queueItem of queueItems) {
              await db.syncQueue.delete(queueItem.id!)
            }
          } else {
            // Это уже запись с UUID, но другой ID - пропускаем, чтобы избежать дублирования
            console.log('Пропускаем дубликат проекта:', item.id, existingByContent.id)
            continue
          }
        }

        // Дополнительная проверка: ищем по area/perimeter для предотвращения дубликатов
        const possibleDuplicate = localProjects.find((p: Project) => 
          typeof p.id === 'number' && 
          p.customerId === item.customer_id &&
          Math.abs(p.area - item.area) < 0.01 &&
          Math.abs(p.perimeter - item.perimeter) < 0.01
        )
        
        if (possibleDuplicate && typeof possibleDuplicate.id === 'number') {
          console.log('Найден возможный дубликат по area/perimeter, удаляем локальную запись:', possibleDuplicate.id)
          await db.projects.delete(possibleDuplicate.id)
          // Удаляем из очереди синхронизации
          const queueItems = await db.syncQueue
            .where('table').equals('projects')
            .and((q: any) => q.recordId === String(possibleDuplicate.id))
            .toArray()
          for (const queueItem of queueItems) {
            await db.syncQueue.delete(queueItem.id!)
          }
        }

        // Проверяем, нет ли уже записи с таким же UUID (на случай дублирования)
        const existing = await db.projects.get(item.id)
        if (!existing) {
          // Добавляем запись с UUID только если её еще нет
          await db.projects.put(project)
        }
      }

      // Удаляем локальные записи, которые были удалены на сервере
      // Но только те, которые были синхронизированы (не pending)
      const serverIds = new Set(data.map((item: any) => item.id))
      for (const localProject of localProjects) {
        if (typeof localProject.id === 'string' && !serverIds.has(localProject.id)) {
          // Удаляем только если запись была синхронизирована
          if (localProject.syncStatus === 'synced') {
            await db.projects.delete(localProject.id)
          }
        }
      }
    } catch (error) {
      console.error('Ошибка синхронизации с сервера:', error)
    }
  },

  // Синхронизация всех проектов пользователя
  async syncAllFromServer(userId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (error) throw error

      if (!data || data.length === 0) {
        return // Нет данных на сервере
      }

      // Получаем все локальные проекты для этого пользователя
      const localProjects = await db.projects.where('userId').equals(userId).toArray()
      
      // Создаем Map для быстрого поиска
      const localByUuid = new Map<string, Project>()
      const localByAreaPerimeter = new Map<string, Project>() // Ключ: customerId_area_perimeter
      
      localProjects.forEach((p: Project) => {
        if (typeof p.id === 'string') {
          localByUuid.set(p.id, p)
        }
        // Создаем ключ для поиска по содержимому (customerId + area + perimeter)
        // Используем округленные значения для более надежного совпадения
        const areaRounded = Math.round(p.area * 100)
        const perimeterRounded = Math.round(p.perimeter * 100)
        const contentKey = `${p.customerId}_${areaRounded}_${perimeterRounded}`
        localByAreaPerimeter.set(contentKey, p)
      })

      for (const item of data) {
        // JSONB возвращается как объект, но на всякий случай проверяем
        let points: Array<{ x: number; y: number }> = []
        try {
          if (item.points) {
            points = typeof item.points === 'string' ? JSON.parse(item.points) : item.points
          }
        } catch (e) {
          console.error('Ошибка парсинга points:', e)
        }

        let estimateData: any = null
        try {
          if (item.estimate_data) {
            estimateData = typeof item.estimate_data === 'string' 
              ? JSON.parse(item.estimate_data) 
              : item.estimate_data
          }
        } catch (e) {
          console.error('Ошибка парсинга estimate_data:', e)
        }

        const project: Project = {
          id: item.id,
          customerId: item.customer_id ?? '',
          userId: item.user_id,
          profileId: item.profile_id || null,
          createdAt: item.created_at ?? new Date().toISOString(),
          updatedAt: item.updated_at ?? new Date().toISOString(),
          lastSyncedAt: item.last_synced_at ?? null,
          points,
          area: item.area,
          perimeter: item.perimeter,
          elementCount: item.element_count ?? 0,
          estimateData,
          syncStatus: 'synced',
        }

        // Проверяем, есть ли уже запись с этим UUID
        const existingByUuid = localByUuid.get(item.id)
        if (existingByUuid) {
          // Обновляем существующую запись только если серверная версия новее
          const serverTime = new Date(item.updated_at ?? new Date()).getTime()
          const localTime = new Date(existingByUuid.updatedAt).getTime()
          if (serverTime > localTime) {
            await db.projects.put(project)
          }
          continue
        }

        // Проверяем, нет ли локальной записи с таким же содержимым по area/perimeter
        const areaRounded = Math.round(item.area * 100)
        const perimeterRounded = Math.round(item.perimeter * 100)
        const contentKey = `${item.customer_id}_${areaRounded}_${perimeterRounded}`
        const existingByContent = localByAreaPerimeter.get(contentKey)
        
        if (existingByContent) {
          // Найдена локальная запись с таким же содержимым
          if (typeof existingByContent.id === 'number') {
            // Это локальная запись с числовым ID - заменяем на UUID
            console.log('Удаляем локальный дубликат:', existingByContent.id, '-> заменяем на UUID:', item.id)
            await db.projects.delete(existingByContent.id)
            // Удаляем из очереди синхронизации
            const queueItems = await db.syncQueue
              .where('table').equals('projects')
              .and((q: any) => q.recordId === String(existingByContent.id))
              .toArray()
            for (const queueItem of queueItems) {
              await db.syncQueue.delete(queueItem.id!)
            }
          } else if (existingByContent.id !== item.id) {
            // Это уже запись с UUID, но другой ID - пропускаем, чтобы избежать дублирования
            console.log('Пропускаем дубликат проекта:', item.id, existingByContent.id)
            continue
          }
        }

        // Добавляем новую запись с UUID
        await db.projects.put(project)
      }
    } catch (error) {
      console.error('Ошибка синхронизации всех проектов с сервера:', error)
    }
  },

  async deleteFromServer(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('Ошибка удаления с сервера:', error)
      throw error
    }
  },
}

