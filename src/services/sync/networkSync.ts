import { syncService } from './syncService'
import { customersService } from '@/features/customers/services/customersService'
import { projectsService } from '@/features/projects/services/projectsService'
import { profileService } from '@/features/projects/estimate/profile/services/profileService'

let syncInterval: NodeJS.Timeout | null = null

// Настройка автоматической синхронизации
export function setupNetworkSync(userId: string): void {
  // Первоначальная синхронизация при входе
  if (navigator.onLine) {
    (async () => {
      try {
        console.log('🔄 Начальная синхронизация при входе...')
        // Сначала синхронизируем очередь
        await syncService.processSyncQueue()
        // Затем синхронизируем данные с сервера
        await customersService.syncFromServer(userId)
        await projectsService.syncAllFromServer(userId)
        await profileService.syncAllFromServer(userId)
        console.log('✓ Начальная синхронизация завершена')
      } catch (error) {
        console.error('Ошибка начальной синхронизации:', error)
      }
    })()
  }

  // Слушаем события сети
  window.addEventListener('online', async () => {
    console.log('🌐 Сеть восстановлена, запускаем синхронизацию')
    
    // Синхронизируем очередь
    await syncService.processSyncQueue()
    
    // Синхронизируем данные с сервера
    try {
      await customersService.syncFromServer(userId)
      await projectsService.syncAllFromServer(userId)
      await profileService.syncAllFromServer(userId)
      console.log('✓ Синхронизация с сервера завершена')
    } catch (error) {
      console.error('Ошибка синхронизации с сервера:', error)
    }
  })

  window.addEventListener('offline', () => {
    console.log('📴 Сеть потеряна, переходим в офлайн режим')
  })

  // Периодическая синхронизация (каждые 30 секунд)
  if (syncInterval) {
    clearInterval(syncInterval)
  }

  syncInterval = setInterval(async () => {
    if (navigator.onLine && !syncService.isProcessing) {
      await syncService.processSyncQueue()
    }
  }, 30000) // 30 секунд
}

// Остановка синхронизации
export function stopNetworkSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}

