import { useState, useEffect, useRef } from 'react'
import { Home, BarChart3, Users, Clock, AlertTriangle, User, Trophy, Settings, LogOut, ChevronDown, Moon, Sun, Menu, X } from 'lucide-react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { ClockWidget, isClockRunning } from '@/components/common/ClockWidget'
import { NotificationBell } from '@/components/common/NotificationBell'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { supabase } from '@/data/supabase'
import { trackSessionEnd, trackPageView } from '@/lib/usage'

const NAV_ITEMS = [
  { path: '/', icon: Home, label: 'Inicio' },
  { path: '/proyectos', icon: BarChart3, label: 'Proyectos' },
  { path: '/equipo', icon: Users, label: 'Equipo' },
  { path: '/fichaje', icon: Clock, label: 'Fichaje' },
  { path: '/riesgos', icon: AlertTriangle, label: 'Riesgos' },
  { path: '/profile', icon: User, label: 'Mi Perfil' },
  { path: '/logros', icon: Trophy, label: 'Logros' },
]

export function MainLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { isDark, toggle: toggleTheme, setUserId: setThemeUserId } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const [showLogoutWarning, setShowLogoutWarning] = useState(false)

  useEffect(() => { if (user?.id) setThemeUserId(user.id) }, [user?.id, setThemeUserId])

  const handleLogout = () => {
    if (isClockRunning()) { setShowLogoutWarning(true); return }
    if (user?.id) trackSessionEnd(user.id); logout(); navigate('/welcome')
  }
  const forceLogout = () => { if (user?.id) trackSessionEnd(user.id); localStorage.removeItem('revelio-clock'); logout(); navigate('/welcome') }

  useEffect(() => { if (user?.id) trackPageView(user.id, location.pathname) }, [location.pathname, user?.id])

  // Clock prompt
  const [showClockPrompt, setShowClockPrompt] = useState(false)
  useEffect(() => {
    if (!user?.id) return
    const today = new Date().toISOString().slice(0, 10); const dow = new Date().getDay()
    if (dow === 0 || dow === 6) return
    const shown = localStorage.getItem('revelio-clock-prompt')
    if (shown === today) return
    const saved = localStorage.getItem('revelio-clock')
    if (saved) { try { const s = JSON.parse(saved); if (s.date === today && (s.running || s.base > 0)) return } catch { /* */ } }
    supabase.from('time_entries').select('hours').eq('member_id', user.id).eq('date', today).then(({ data }) => {
      if ((data || []).reduce((s: number, e: { hours: number }) => s + e.hours, 0) === 0) setShowClockPrompt(true)
    })
  }, [user?.id])

  const dismissClockPrompt = (start: boolean) => {
    localStorage.setItem('revelio-clock-prompt', new Date().toISOString().slice(0, 10)); setShowClockPrompt(false)
    if (start) { localStorage.setItem('revelio-clock', JSON.stringify({ date: new Date().toISOString().slice(0, 10), running: true, startAt: Math.floor(Date.now() / 1000), base: 0, mode: 'down' })); window.dispatchEvent(new Event('revelio-clock-start')) }
  }

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (isClockRunning()) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false) }
    document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler)
  }, [])

  const isActive = (path: string) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path))

  return (
    <div className="h-screen flex bg-revelio-bg dark:bg-revelio-dark-bg">
      {/* ═══ SIDEBAR — desktop ═══ */}
      <aside className="hidden sm:flex flex-col w-[200px] bg-white dark:bg-revelio-dark-card border-r border-revelio-border dark:border-revelio-dark-border flex-shrink-0">
        {/* Logo */}
        <Link to="/" className="px-4 py-4 flex items-center gap-2">
          <span className="text-lg font-bold text-revelio-blue" style={{ fontFamily: 'Comfortaa, sans-serif' }}>revelio</span>
        </Link>

        {/* Nav items */}
        <nav className="flex-1 px-2 space-y-0.5">
          {NAV_ITEMS.map(item => (
            <Link key={item.path} to={item.path}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isActive(item.path) ? 'bg-revelio-blue/10 text-revelio-blue' : 'text-revelio-subtle dark:text-revelio-dark-subtle hover:bg-revelio-bg dark:hover:bg-revelio-dark-border'}`}>
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
          {user?.is_superuser && (
            <Link to="/admin"
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isActive('/admin') ? 'bg-revelio-violet/10 text-revelio-violet' : 'text-revelio-subtle dark:text-revelio-dark-subtle hover:bg-revelio-bg dark:hover:bg-revelio-dark-border'}`}>
              <Settings className="w-4 h-4" />
              Centro de Control
            </Link>
          )}
        </nav>

        {/* User info at bottom */}
        <div className="px-3 py-3 border-t border-revelio-border dark:border-revelio-dark-border">
          <Link to="/profile" className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-revelio-bg dark:hover:bg-revelio-dark-border transition-colors">
            <span className="text-lg" style={{ color: user?.color }}>{user?.avatar || '👤'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold dark:text-revelio-dark-text truncate">{user?.name}</p>
              <p className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle">{user?.role_label}</p>
            </div>
          </Link>
        </div>
      </aside>

      {/* ═══ MAIN AREA ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-12 flex items-center justify-between px-4 bg-white dark:bg-revelio-dark-card border-b border-revelio-border dark:border-revelio-dark-border flex-shrink-0">
          {/* Mobile hamburger */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="sm:hidden w-8 h-8 rounded-lg flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border">
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          {/* Page title */}
          <h1 className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text hidden sm:block capitalize">
            {NAV_ITEMS.find(n => isActive(n.path))?.label || 'Revelio'}
          </h1>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <ClockWidget userId={user?.id} />
            <button onClick={toggleTheme} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border transition-colors">
              {isDark ? <Sun className="w-4 h-4 text-revelio-orange" /> : <Moon className="w-4 h-4 text-revelio-subtle" />}
            </button>
            <NotificationBell userId={user?.id} />

            {/* Avatar menu */}
            <div className="relative" ref={menuRef}>
              <button onClick={() => setShowMenu(!showMenu)} className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-revelio-bg dark:hover:bg-revelio-dark-border transition-colors">
                <span className="text-sm" style={{ color: user?.color }}>{user?.avatar || '👤'}</span>
                <span className="text-xs font-medium dark:text-revelio-dark-text hidden sm:block">{user?.name?.split(' ')[0]}</span>
                <ChevronDown className="w-3 h-3 text-revelio-subtle" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-revelio-dark-card border border-revelio-border dark:border-revelio-dark-border rounded-xl shadow-lg z-50 overflow-hidden">
                  <Link to="/profile" onClick={() => setShowMenu(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-revelio-text dark:text-revelio-dark-text hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><User className="w-3.5 h-3.5 text-revelio-blue" /> Mi perfil</Link>
                  {user?.is_superuser && <Link to="/admin" onClick={() => setShowMenu(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-revelio-text dark:text-revelio-dark-text hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><Settings className="w-3.5 h-3.5 text-revelio-violet" /> Centro de Control</Link>}
                  <button onClick={handleLogout} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-revelio-red hover:bg-revelio-red/5"><LogOut className="w-3.5 h-3.5" /> Cerrar sesión</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile nav overlay */}
        {mobileMenuOpen && (
          <div className="sm:hidden absolute inset-0 z-40 bg-black/40" onClick={() => setMobileMenuOpen(false)}>
            <div onClick={e => e.stopPropagation()} className="w-64 h-full bg-white dark:bg-revelio-dark-card p-4 space-y-1">
              {NAV_ITEMS.map(item => (
                <Link key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium ${isActive(item.path) ? 'bg-revelio-blue/10 text-revelio-blue' : 'text-revelio-text dark:text-revelio-dark-text'}`}>
                  <item.icon className="w-4 h-4" /> {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      {/* Clock prompt */}
      {showClockPrompt && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-revelio-dark-card rounded-2xl max-w-sm w-full p-6 shadow-xl text-center">
            <div className="text-4xl mb-3">⏰</div>
            <h3 className="text-base font-semibold dark:text-revelio-dark-text mb-1">{greet()}</h3>
            <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mb-4">No has fichado hoy. ¿Empezamos la jornada?</p>
            <div className="flex gap-2">
              <button onClick={() => dismissClockPrompt(false)} className="flex-1 py-2.5 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-sm font-medium text-revelio-subtle">Ahora no</button>
              <button onClick={() => dismissClockPrompt(true)} className="flex-[2] py-2.5 rounded-lg bg-revelio-green text-white text-sm font-semibold">Fichar entrada</button>
            </div>
          </div>
        </div>
      )}

      {/* Logout warning */}
      {showLogoutWarning && (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-revelio-dark-card rounded-2xl max-w-sm w-full p-6 shadow-xl text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-base font-semibold dark:text-revelio-dark-text mb-1">Fichada abierta</h3>
            <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mb-4">Debes cerrar la fichada antes de salir.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowLogoutWarning(false)} className="flex-[2] py-2.5 rounded-lg bg-revelio-blue text-white text-sm font-semibold">Volver</button>
              <button onClick={forceLogout} className="flex-1 py-2.5 rounded-lg border border-revelio-red/30 text-sm font-medium text-revelio-red">Salir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function greet() { const h = new Date().getHours(); return h < 7 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches' }
