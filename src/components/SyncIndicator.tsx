import { useSyncStatus } from '@/hooks/useSyncStatus'
import { Badge } from '@/components/ui/badge'
import { Cloud, CloudOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { syncService } from '@/services/sync/syncService'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import { customersService } from '@/features/customers/services/customersService'
import { projectsService } from '@/features/projects/services/projectsService'

export function SyncIndicator() {
  const { isOnline, isSyncing, pendingCount } = useSyncStatus()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const handleManualSync = async () => {
    if (!isOnline) {
      toast.error('Нет подключения к интернету')
      return
    }

    if (!user?.id) {
      toast.error('Пользователь не авторизован')
      return
    }

    toast.info('Запуск синхронизации...')
    try {
      // Синхронизируем очередь
      await syncService.processSyncQueue()
      
      // Синхронизируем данные с сервера
      await customersService.syncFromServer(user.id)
      await projectsService.syncAllFromServer(user.id)
      
      // Обновляем кэш React Query
      queryClient.invalidateQueries({ queryKey: ['customers', user.id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      
      toast.success('Синхронизация завершена')
    } catch (error: any) {
      toast.error('Ошибка синхронизации: ' + (error.message || 'Неизвестная ошибка'))
    }
  }

  if (!isOnline) {
    return (
      <Badge variant="destructive" className="gap-1">
        <CloudOff className="w-3 h-3" />
        Офлайн
      </Badge>
    )
  }

  if (isSyncing) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Loader2 className="w-3 h-3 animate-spin" />
        Синхронизация...
      </Badge>
    )
  }

  if (pendingCount > 0) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="gap-1 border-warning text-warning">
          <AlertCircle className="w-3 h-3" />
          Ожидает: {pendingCount}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleManualSync}
          disabled={isSyncing}
          className="h-6 px-2 text-xs"
        >
          <Cloud className="w-3 h-3 mr-1" />
          Синхронизировать
        </Button>
      </div>
    )
  }

  return (
    <Badge variant="outline" className="gap-1 border-success text-success">
      <CheckCircle2 className="w-3 h-3" />
      Синхронизировано
    </Badge>
  )
}

