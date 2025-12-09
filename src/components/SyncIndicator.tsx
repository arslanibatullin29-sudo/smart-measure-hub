import { useSyncStatus } from '@/hooks/useSyncStatus'
import { Cloud, CloudOff, Loader2, CheckCircle2 } from 'lucide-react'

export function SyncIndicator() {
  const { isOnline, isSyncing, pendingCount } = useSyncStatus()

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1 text-xs text-destructive">
        <CloudOff className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Офлайн</span>
      </div>
    )
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="hidden sm:inline">Синхронизация</span>
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-warning">
        <Cloud className="w-3.5 h-3.5" />
        <span>{pendingCount}</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 text-xs text-success">
      <CheckCircle2 className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Синхронизировано</span>
    </div>
  )
}

