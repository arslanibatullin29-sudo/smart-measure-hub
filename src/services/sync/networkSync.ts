import { syncService } from './syncService'
import { customersService } from '@/features/customers/services/customersService'
import { projectsService } from '@/features/projects/services/projectsService'
import { profileService } from '@/features/projects/estimate/profile/services/profileService'

let syncInterval: NodeJS.Timeout | null = null
let isSyncing = false

// Полная синхронизация с защитой от дублирования
async function fullSync(userId: string): Promise<void> {
  if (isSyncing) {
    console.log('⏳ Синхронизация уже выполняется, пропускаем...')
    return
  }
  
  isSyncing = true
  
  try {
    console.log('🔄 Начало синхронизации...')
    
    // 1. Сначала отправляем локальные изменения на сервер
    // И ЖДЕМ пока все локальные ID заменятся на UUID
    await syncService.processSyncQueue()
    
    // 2. Небольшая задержка чтобы убедиться что все записи обновлены
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 3. Только после этого загружаем данные с сервера
    // Это предотвратит дублирование, так как локальные записи уже имеют UUID
    await customersService.syncFromServer(userId)
    await projectsService.syncAllFromServer(userId)
    await profileService.syncAllFromServer(userId)
    
    console.log('✓ Синхронизация завершена')
  } catch (error) {
    console.error('Ошибка синхронизации:', error)
  } finally {
    isSyncing = false
  }
}

// Настройка автоматической синхронизации
export function setupNetworkSync(userId: string): void {
  // Первоначальная синхронизация при входе
  if (navigator.onLine) {
    fullSync(userId)
  }

  // Слушаем события сети
  const handleOnline = () => {
    console.log('🌐 Сеть восстановлена, запускаем синхронизацию')
    fullSync(userId)
  }
  
  const handleOffline = () => {
    console.log('📴 Сеть потеряна, переходим в офлайн режим')
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Периодическая синхронизация (каждые 30 секунд)
  if (syncInterval) {
    clearInterval(syncInterval)
  }

  syncInterval = setInterval(async () => {
    if (navigator.onLine && !syncService.isProcessing && !isSyncing) {
      await syncService.processSyncQueue()
    }
  }, 30000)
}

// Остановка синхронизации
export function stopNetworkSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}

