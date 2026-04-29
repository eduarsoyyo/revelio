import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/data/supabase'
import { logger } from '@/lib/logger'
import type { AuthUser } from '@/types'

interface AuthState {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

// Clean all Supabase auth storage keys
function clearAuthStorage() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('sb-') || k === 'revelio-auth')
  keys.forEach(k => localStorage.removeItem(k))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (authUserId: string, email: string): Promise<AuthUser | null> => {
    try {
      // Try by ID first
      const { data } = await supabase.from('team_members').select('*').eq('id', authUserId).single()
      const profile = data || (await supabase.from('team_members').select('*').eq('email', email).single()).data

      if (!profile) {
        logger.error('Profile not found for', authUserId, email)
        return null
      }

      return {
        id: profile.id, name: profile.name, username: profile.username || '',
        email: profile.email || email, avatar: profile.avatar || '👤',
        color: profile.color || '#007AFF', role_label: profile.role_label || '',
        is_superuser: profile.is_superuser || false, rooms: profile.rooms || [],
      }
    } catch (err) {
      logger.error('Profile load error:', err)
      return null
    }
  }, [])

  // Restore session — with aggressive timeout and error recovery
  useEffect(() => {
    let done = false
    const finish = () => { if (!done) { done = true; setLoading(false) } }

    // Hard timeout — if anything takes >3s, just show login
    const timeout = setTimeout(() => {
      logger.info('Session restore timeout — proceeding without session')
      finish()
    }, 8000)

    supabase.auth.getSession().then(async ({ data: { session }, error }) => {
      clearTimeout(timeout)
      if (error) {
        logger.error('getSession error — clearing:', error.message)
        clearAuthStorage()
        finish()
        return
      }
      if (session?.user) {
        const profile = await loadProfile(session.user.id, session.user.email || '')
        if (profile) {
          setUser(profile)
        } else {
          // Profile not found — session is for a deleted/mismatched user
          logger.error('Session user has no profile — signing out')
          try { await supabase.auth.signOut() } catch { /* */ }
          clearAuthStorage()
        }
      }
      finish()
    }).catch((err) => {
      clearTimeout(timeout)
      logger.error('Session restore failed:', err)
      clearAuthStorage()
      finish()
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await loadProfile(session.user.id, session.user.email || '')
        if (profile) setUser(profile)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [loadProfile])

  const login = useCallback(async (emailOrUsername: string, password: string) => {
    try {
      // Resolve username → email
      let loginEmail = emailOrUsername
      if (!emailOrUsername.includes('@')) {
        const { data: member } = await supabase.from('team_members').select('email').eq('username', emailOrUsername).single()
        if (member?.email) loginEmail = member.email
        else return { ok: false, error: 'USER_NOT_FOUND' }
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password })

      if (error) {
        logger.error('Auth error:', error.message)
        if (error.message.includes('Invalid login')) return { ok: false, error: 'WRONG_PASSWORD' }
        return { ok: false, error: error.message }
      }
      if (!data.user) return { ok: false, error: 'NO_USER' }

      const profile = await loadProfile(data.user.id, data.user.email || '')
      if (!profile) return { ok: false, error: 'PROFILE_NOT_FOUND' }

      setUser(profile)
      logger.info('Login OK:', profile.name)

      // Track login event
      try {
        const { trackLogin } = await import('@/lib/usage')
        trackLogin(data.user.id)
      } catch { /* */ }

      return { ok: true, userId: data.user.id }
    } catch (err) {
      logger.error('Login failed:', err)
      return { ok: false, error: 'Error de conexión' }
    }
  }, [loadProfile])

  const logout = useCallback(async () => {
    setUser(null)
    clearAuthStorage()
    logger.info('Logged out')
    // Sign out in background — don't wait
    supabase.auth.signOut().catch(() => {})
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
