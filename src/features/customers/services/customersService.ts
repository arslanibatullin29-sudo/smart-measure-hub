import { supabase } from '@/services/supabase/supabaseClient'
import { db, Customer } from '@/services/storage/indexedDB'

export const customersService = {
  // Получить всех клиентов (сначала из IndexedDB, затем синхронизировать)
  async getAll(userId: string): Promise<Customer[]> {
    // Сначала получаем из локального хранилища
    const localCustomers = await db.customers
      .where('userId')
      .equals(userId)
      .toArray()

    // Синхронизация отключена здесь, чтобы избежать дублирования
    // Синхронизация происходит через SyncService автоматически
    // this.syncFromServer(userId).catch(console.error)

    return localCustomers
  },

  // Создать клиента
  async create(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'lastSyncedAt' | 'syncStatus'>): Promise<Customer> {
    const now = new Date().toISOString()
    // Создаем объект БЕЗ id, чтобы Dexie мог автоматически сгенерировать его
    const customerData = {
      ...data,
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: null,
      syncStatus: 'pending' as const,
    }

    // Сохраняем локально (id будет сгенерирован автоматически)
    const id = await db.customers.add(customerData)
    const savedCustomer: Customer = { ...customerData, id: id as number }

    // Добавляем в очередь синхронизации
    await db.syncQueue.add({
      table: 'customers',
      recordId: String(id),
      operation: 'create',
      data: savedCustomer,
      timestamp: now,
      retries: 0,
    })

    // Синхронизация будет выполнена через syncService.processSyncQueue()
    // Не вызываем syncToServer здесь, чтобы избежать дублирования
    // Синхронизация произойдет автоматически через очередь

    return savedCustomer
  },

  // Обновить клиента
  async update(id: string | number, data: Partial<Customer>): Promise<Customer> {
    const now = new Date().toISOString()
    const customer = await db.customers.get(id)
    
    if (!customer) throw new Error('Клиент не найден')

    const updated: Customer = {
      ...customer,
      ...data,
      updatedAt: now,
      syncStatus: 'pending',
    }

    // Обновляем локально
    await db.customers.update(id, updated)

    // Добавляем в очередь синхронизации
    await db.syncQueue.add({
      table: 'customers',
      recordId: String(id),
      operation: 'update',
      data: updated,
      timestamp: now,
      retries: 0,
    })

    // Пытаемся синхронизировать сразу (в фоне, не блокируем)
    this.syncToServer(updated)
      .then(() => {
        // После успешной синхронизации обрабатываем очередь
        import('@/services/sync/syncService').then(({ syncService }) => {
          syncService.processSyncQueue().catch(console.error)
        })
      })
      .catch((err) => {
        console.error('Фоновая синхронизация клиента не удалась:', err)
      })

    return updated
  },

  // Удалить клиента
  async delete(id: string | number): Promise<void> {
    const customer = await db.customers.get(id)
    if (!customer) throw new Error('Клиент не найден')

    // Удаляем локально
    await db.customers.delete(id)

    // Если был синхронизирован, добавляем в очередь на удаление
    if (customer.syncStatus === 'synced' && customer.id) {
      const customerId = String(customer.id)
      await db.syncQueue.add({
        table: 'customers',
        recordId: customerId,
        operation: 'delete',
        data: { id: customerId },
        timestamp: new Date().toISOString(),
        retries: 0,
      })

      // Пытаемся удалить на сервере сразу
      this.deleteFromServer(customerId)
        .then(() => {
          // После успешного удаления обрабатываем очередь
          import('@/services/sync/syncService').then(({ syncService }) => {
            syncService.processSyncQueue().catch(console.error)
          })
        })
        .catch(console.error)
    }
  },

  // Синхронизация с сервером (создание/обновление)
  async syncToServer(customer: Customer): Promise<void> {
    try {
      // Если ID - число (локальный), не отправляем его (Supabase создаст UUID)
      // Если ID - строка (UUID), отправляем для обновления
      const payload: any = {
        user_id: customer.userId,
        full_name: customer.fullName,
        address: customer.address,
        phone: customer.phone,
        comment: customer.comment,
        updated_at: customer.updatedAt,
      }

      // Добавляем ID только если это строка (UUID из Supabase)
      if (customer.id && typeof customer.id === 'string') {
        payload.id = customer.id
      }

      const { data, error } = await supabase
        .from('customers')
        .upsert(payload)
        .select()
        .single()

      if (error) {
        console.error('Ошибка синхронизации клиента:', error)
        console.error('Детали ошибки:', JSON.stringify(error, null, 2))
        console.error('Отправляемые данные:', JSON.stringify(payload, null, 2))
        throw error
      }

      // Обновляем локальную запись с ID из Supabase (если это была новая запись)
      if (data && customer.id && typeof customer.id === 'number') {
        // Заменяем локальный числовой ID на UUID из Supabase
        const newId = data.id
        
        // Проверяем, не существует ли уже запись с этим UUID
        const existing = await db.customers.get(newId)
        if (existing) {
          // Запись уже существует - удаляем только старую с числовым ID
          await db.customers.delete(customer.id)
          // Удаляем из очереди синхронизации
          const queueItems = await db.syncQueue
            .where('table').equals('customers')
            .and((q: any) => q.recordId === String(customer.id))
            .toArray()
          for (const queueItem of queueItems) {
            await db.syncQueue.delete(queueItem.id!)
          }
        } else {
          // Заменяем локальный числовой ID на UUID из Supabase
          await db.customers.delete(customer.id)
          // Используем put() для записи с UUID (не auto-increment)
          await db.customers.put({ ...customer, id: newId, syncStatus: 'synced', lastSyncedAt: new Date().toISOString() })
          // Удаляем из очереди синхронизации
          const queueItems = await db.syncQueue
            .where('table').equals('customers')
            .and((q: any) => q.recordId === String(customer.id))
            .toArray()
          for (const queueItem of queueItems) {
            await db.syncQueue.delete(queueItem.id!)
          }
        }
      } else if (customer.id) {
        // Обновляем статус синхронизации для существующей записи
        await db.customers.update(customer.id, {
          syncStatus: 'synced',
          lastSyncedAt: new Date().toISOString(),
        })
        // Удаляем из очереди синхронизации
        const queueItems = await db.syncQueue
          .where('table').equals('customers')
          .and((q: any) => q.recordId === String(customer.id))
          .toArray()
        for (const queueItem of queueItems) {
          await db.syncQueue.delete(queueItem.id!)
        }
      }
    } catch (error: any) {
      console.error('Ошибка синхронизации клиента:', error)
      if (customer.id) {
        await db.customers.update(customer.id, { syncStatus: 'error' })
      }
      // Логируем детали ошибки для отладки
      const errorMessage = error?.message || 'Неизвестная ошибка'
      if (errorMessage.includes('relation') || errorMessage.includes('does not exist')) {
        console.error('⚠️ Таблица customers не существует в Supabase. Выполните миграции из SETUP.md')
      } else if (errorMessage.includes('permission denied') || errorMessage.includes('row-level security')) {
        console.error('⚠️ RLS политики не настроены. Настройте RLS в Supabase согласно SETUP.md')
      }
      // Не пробрасываем ошибку дальше, чтобы не блокировать работу приложения
    }
  },

  // Синхронизация с сервера
  async syncFromServer(userId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (error) throw error

      if (!data || data.length === 0) {
        return // Нет данных на сервере
      }

      // Получаем все локальные записи для этого пользователя
      const localCustomers = await db.customers.where('userId').equals(userId).toArray()
      
      // Создаем Map для быстрого поиска
      const localByUuid = new Map<string, Customer>()
      const localByContent = new Map<string, Customer>() // Ключ: userId_fullName_phone
      
      localCustomers.forEach((c: Customer) => {
        if (typeof c.id === 'string') {
          localByUuid.set(c.id, c)
        }
        // Создаем ключ для поиска по содержимому
        const contentKey = `${c.userId}_${c.fullName}_${c.phone}`
        localByContent.set(contentKey, c)
      })

      // Обрабатываем серверные данные
      for (const item of data) {
        const customer: Customer = {
          id: item.id,
          userId: item.user_id,
          fullName: item.full_name,
          address: item.address ?? '',
          phone: item.phone ?? '',
          comment: item.comment ?? '',
          createdAt: item.created_at ?? new Date().toISOString(),
          updatedAt: item.updated_at ?? new Date().toISOString(),
          lastSyncedAt: item.last_synced_at ?? null,
          syncStatus: 'synced',
        }

        // Проверяем, есть ли уже запись с этим UUID
        const existingByUuid = localByUuid.get(item.id)
        if (existingByUuid) {
          // Обновляем существующую запись только если серверная версия новее
          const serverTime = new Date(item.updated_at ?? new Date()).getTime()
          const localTime = new Date(existingByUuid.updatedAt).getTime()
          if (serverTime > localTime) {
            await db.customers.put(customer)
          }
          continue
        }

        // Проверяем, нет ли локальной записи с таким же содержимым
        const contentKey = `${item.user_id}_${item.full_name}_${item.phone}`
        const existingByContent = localByContent.get(contentKey)
        
        if (existingByContent) {
          // Найдена локальная запись с таким же содержимым
          if (typeof existingByContent.id === 'number') {
            // Это локальная запись с числовым ID - заменяем на UUID
            await db.customers.delete(existingByContent.id)
            // Удаляем из очереди синхронизации
            const queueItems = await db.syncQueue
              .where('table').equals('customers')
              .and((q: any) => q.recordId === String(existingByContent.id))
              .toArray()
            for (const queueItem of queueItems) {
              await db.syncQueue.delete(queueItem.id!)
            }
          } else {
            // Это уже запись с UUID, но другой ID - пропускаем, чтобы избежать дублирования
            console.log('Пропускаем дубликат:', item.id, existingByContent.id)
            continue
          }
        }

        // Добавляем новую запись с UUID
        await db.customers.put(customer)
      }
    } catch (error) {
      console.error('Ошибка синхронизации с сервера:', error)
    }
  },

  // Удаление с сервера
  async deleteFromServer(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('Ошибка удаления с сервера:', error)
      throw error
    }
  },
}

