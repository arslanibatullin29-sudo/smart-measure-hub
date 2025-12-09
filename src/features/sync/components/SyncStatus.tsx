interface SyncStatusProps {
  status: 'pending' | 'synced' | 'error'
  lastSyncedAt?: string | null
}

function SyncStatus({ status, lastSyncedAt }: SyncStatusProps) {
  if (status === 'pending') {
    return <span style={{ fontSize: '0.8rem', color: '#ff9800' }}>⏳ Ожидает синхронизации</span>
  }
  
  if (status === 'error') {
    return (
      <span style={{ fontSize: '0.8rem', color: '#f44336' }}>
        ❌ Ошибка синхронизации
        <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', opacity: 0.8 }}>
          (Проверьте настройки Supabase в SETUP.md)
        </span>
      </span>
    )
  }
  
  if (status === 'synced' && lastSyncedAt) {
    return <span style={{ fontSize: '0.8rem', color: '#4caf50' }}>✅ Синхронизировано</span>
  }
  
  return null
}

export default SyncStatus

