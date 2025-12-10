import { useState, useEffect } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [showOnlineNotice, setShowOnlineNotice] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowOnlineNotice(true)
      setTimeout(() => setShowOnlineNotice(false), 3000)
    }
    
    const handleOffline = () => {
      setIsOnline(false)
      setShowOnlineNotice(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline && !showOnlineNotice) return null

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 px-4 text-xs font-medium transition-all duration-300 ${
        isOnline 
          ? 'bg-green-500/90 text-white' 
          : 'bg-amber-500/90 text-white'
      }`}
    >
      {isOnline ? (
        <>
          <Wifi className="h-3.5 w-3.5" />
          <span>Подключение восстановлено</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5" />
          <span>Офлайн режим - данные сохраняются локально</span>
        </>
      )}
    </div>
  )
}
