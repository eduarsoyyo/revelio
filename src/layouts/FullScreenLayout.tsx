import { ChevronLeft, Moon, Sun } from 'lucide-react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { ClockWidget } from '@/components/common/ClockWidget'
import { NotificationBell } from '@/components/common/NotificationBell'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'

export function FullScreenLayout() {
  const { user } = useAuth()
  const { isDark, toggle } = useTheme()
  const navigate = useNavigate()

  return (
    <div className="h-screen flex flex-col bg-revelio-bg dark:bg-revelio-dark-bg">
      <header className="h-12 flex items-center justify-between px-4 bg-white dark:bg-revelio-dark-card border-b border-revelio-border dark:border-revelio-dark-border flex-shrink-0">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-xs font-medium text-revelio-blue hover:underline">
          <ChevronLeft className="w-4 h-4" /> Volver
        </button>
        <div className="flex items-center gap-2">
          <ClockWidget userId={user?.id} />
          <button onClick={toggle} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border">
            {isDark ? <Sun className="w-4 h-4 text-revelio-orange" /> : <Moon className="w-4 h-4 text-revelio-subtle" />}
          </button>
          <NotificationBell userId={user?.id} />
          <Link to="/profile" className="text-lg" style={{ color: user?.color }}>{user?.avatar || '👤'}</Link>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
