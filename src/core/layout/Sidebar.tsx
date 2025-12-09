import { Link, useLocation } from 'react-router-dom'
import { 
  Users, 
  Ruler,
  Settings
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { authService } from '@/features/auth/services/authService'
import { useNavigate } from 'react-router-dom'

const navItems = [
  { to: '/customers', icon: Users, label: 'Клиенты' },
  { to: '/profiles', icon: Settings, label: 'Профили' },
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const location = useLocation()
  const { user } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await authService.signOut()
    navigate('/login')
  }

  const handleLinkClick = () => {
    // Закрываем sidebar на мобильных при клике на ссылку
    if (window.innerWidth < 1024 && onClose) {
      onClose()
    }
  }

  return (
    <aside className={cn(
      "w-64 bg-sidebar h-screen flex flex-col fixed left-0 top-0 z-50 border-r border-sidebar-border transition-transform duration-300 ease-in-out",
      "lg:translate-x-0",
      isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
    )}>
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <Link to="/customers" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
            <Ruler className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">Room App</h1>
            <p className="text-xs text-sidebar-foreground/60">Замеры и сметы</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={handleLinkClick}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200',
                isActive && 'bg-sidebar-accent text-sidebar-foreground font-medium'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
            <span className="text-sm font-medium text-sidebar-foreground">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.email || 'Пользователь'}
            </p>
            <p className="text-xs text-sidebar-foreground/60">Онлайн</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full mt-2 px-4 py-2 text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-all duration-200"
        >
          Выйти
        </button>
      </div>
    </aside>
  )
}

