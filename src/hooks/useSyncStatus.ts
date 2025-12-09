import { useState, useEffect } from 'react'
import { syncService } from '@/services/sync/syncService'

export function useSyncStatus() {
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    // Обновляем статус сети
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Периодически обновляем статус синхронизации
    const updateStatus = async () => {
      const status = await syncService.getSyncStatus()
      setPendingCount(status.pending)
      setIsSyncing(status.isProcessing)
      setIsOnline(status.isOnline)
    }

    updateStatus()
    const interval = setInterval(updateStatus, 2000) // Обновляем каждые 2 секунды

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  return {
    pendingCount,
    isSyncing,
    isOnline,
  }
}

