import { ReactNode, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Sidebar } from './Sidebar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { SyncIndicator } from '@/components/SyncIndicator'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { setupNetworkSync } from '@/services/sync/networkSync'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Инициализируем автоматическую синхронизацию при монтировании
  useEffect(() => {
    if (user?.id) {
      setupNetworkSync(user.id)
      
      // Обновляем кэш после начальной синхронизации (через небольшую задержку)
      const updateCache = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['customers', user.id] })
        queryClient.invalidateQueries({ queryKey: ['projects'] })
      }, 2000) // Даем время setupNetworkSync выполнить синхронизацию
      
      return () => clearTimeout(updateCache)
    }
  }, [user?.id, queryClient])

  return (
    <div className="min-h-screen bg-background flex relative">
      {/* Overlay для мобильных */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64 transition-all duration-300">
        <header className="h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <h1 className="text-lg font-semibold">Room App</h1>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
            <SyncIndicator />
            {user?.email && (
              <span className="hidden sm:inline text-sm text-muted-foreground truncate max-w-[150px] lg:max-w-none">
                {user.email}
              </span>
            )}
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6 w-full max-w-full">
          <div className="w-full max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

