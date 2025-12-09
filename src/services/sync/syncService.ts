import { db, SyncQueue } from '@/services/storage/indexedDB'
import { customersService } from '@/features/customers/services/customersService'
import { projectsService } from '@/features/projects/services/projectsService'
import { profileService } from '@/features/projects/estimate/profile/services/profileService'
import { supabase } from '@/services/supabase/supabaseClient'

export class SyncService {
  public isProcessing = false
  private maxRetries = 5

  async processSyncQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('Синхронизация уже выполняется, пропускаем...')
      return
    }

    if (!navigator.onLine) {
      console.log('Нет интернета, синхронизация отложена')
      return
    }

    this.isProcessing = true

    try {
      const queue = await db.syncQueue
        .orderBy('timestamp')
        .toArray()

      console.log(`Обработка очереди синхронизации: ${queue.length} элементов`)

      for (const item of queue) {
        try {
          await this.syncItem(item)
          await db.syncQueue.delete(item.id!)
          console.log(`✓ Синхронизировано: ${item.table}/${item.recordId}`)
        } catch (error: any) {
          console.error(`✗ Ошибка синхронизации ${item.table}/${item.recordId}:`, error)
          
          const newRetries = (item.retries || 0) + 1
          
          if (newRetries >= this.maxRetries) {
            console.error(`Превышено максимальное количество попыток для ${item.table}/${item.recordId}`)
            await db.syncQueue.delete(item.id!)
            await this.markRecordAsError(item.table, item.recordId)
          } else {
            await db.syncQueue.update(item.id!, { 
              retries: newRetries,
              timestamp: new Date().toISOString(),
            })
          }
        }
      }
    } finally {
      this.isProcessing = false
    }
  }

  private async syncItem(item: SyncQueue): Promise<void> {
    switch (item.table) {
      case 'customers':
        if (item.operation === 'delete') {
          await customersService.deleteFromServer(item.recordId)
        } else {
          await customersService.syncToServer(item.data)
        }
        break

      case 'projects':
        if (item.operation === 'delete') {
          await projectsService.deleteFromServer(item.recordId)
        } else {
          await projectsService.syncToServer(item.data)
        }
        break

      case 'materials':
        if (item.operation === 'delete') {
          await supabase.from('materials').delete().eq('id', item.recordId)
        }
        // Для update/create используем profileService.syncLocalToServer
        break

      case 'works':
        if (item.operation === 'delete') {
          await supabase.from('works').delete().eq('id', item.recordId)
        }
        break

      case 'installation_profiles':
        if (item.operation === 'delete') {
          await profileService.deleteProfileFromServer(item.recordId)
        }
        break

      default:
        console.warn(`Неизвестная таблица для синхронизации: ${item.table}`)
    }
  }

  private async markRecordAsError(table: string, recordId: string): Promise<void> {
    try {
      switch (table) {
        case 'customers':
          const customer = await db.customers.get(recordId)
          if (customer) {
            await db.customers.update(recordId, { syncStatus: 'error' })
          }
          break
        case 'projects':
          const project = await db.projects.get(recordId)
          if (project) {
            await db.projects.update(recordId, { syncStatus: 'error' })
          }
          break
        case 'materials':
          const material = await db.materials.get(recordId)
          if (material) {
            await db.materials.update(recordId, { syncStatus: 'error' } as any)
          }
          break
        case 'works':
          const work = await db.works.get(recordId)
          if (work) {
            await db.works.update(recordId, { syncStatus: 'error' } as any)
          }
          break
        case 'installation_profiles':
          const profile = await db.installationProfiles.get(recordId)
          if (profile) {
            await db.installationProfiles.update(recordId, { syncStatus: 'error' } as any)
          }
          break
      }
    } catch (error) {
      console.error(`Ошибка при пометке записи как ошибка: ${table}/${recordId}`, error)
    }
  }

  async getPendingCount(): Promise<number> {
    return await db.syncQueue.count()
  }

  async getSyncStatus(): Promise<{
    pending: number
    isProcessing: boolean
    isOnline: boolean
  }> {
    return {
      pending: await this.getPendingCount(),
      isProcessing: this.isProcessing,
      isOnline: navigator.onLine,
    }
  }
}

export const syncService = new SyncService()
