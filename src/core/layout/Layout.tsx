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

  useEffect(() => {
    if (user?.id) {
      setupNetworkSync(user.id)
      
      const updateCache = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['customers', user.id] })
        queryClient.invalidateQueries({ queryKey: ['projects'] })
      }, 2000)
      
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
      <div className="flex-1 flex flex-col min-w-0 lg:ml-56 transition-all duration-300">
        <header className="h-12 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 flex items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden h-8 w-8 p-0"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
            <h1 className="text-base sm:text-lg font-semibold">Room App</h1>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <SyncIndicator />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-3 sm:p-4 lg:p-5 w-full max-w-full">
          <div className="w-full max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

