import { useEffect, useState } from 'react'
import { History, Plus, Edit, Trash2, Check, AlertTriangle, ArrowRight } from 'lucide-react'
import { supabase } from '@/data/supabase'

interface LogEntry {
  id: string; user_id: string; user_name: string; user_avatar: string
  action: string; entity_type: string; entity_name: string
  project: string; created_at: string; metadata?: Record<string, unknown>
}

const ACTION_ICONS: Record<string, typeof Plus> = { create: Plus, update: Edit, delete: Trash2, complete: Check, escalate: AlertTriangle, move: ArrowRight }
const ACTION_COLORS: Record<string, string> = { create: '#34C759', update: '#007AFF', delete: '#FF3B30', complete: '#34C759', escalate: '#FF9500', move: '#5856D6' }
const ACTION_LABELS: Record<string, string> = { create: 'creó', update: 'editó', delete: 'eliminó', complete: 'completó', escalate: 'escaló', move: 'movió' }

export function ActivityLog({ userId, projectSlug, limit = 20 }: { userId?: string; projectSlug?: string; limit?: number }) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let q = supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(limit)
    if (userId) q = q.eq('user_id', userId)
    if (projectSlug) q = q.eq('project', projectSlug)
    q.then(({ data }) => { if (data) setEntries(data as LogEntry[]); setLoading(false) })
  }, [userId, projectSlug, limit])

  if (loading) return <div className="text-[10px] text-revelio-subtle text-center py-4">Cargando actividad...</div>

  if (entries.length === 0) return (
    <div className="text-center py-6">
      <History className="w-5 h-5 text-revelio-border dark:text-revelio-dark-border mx-auto mb-1" />
      <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">Sin actividad reciente</p>
    </div>
  )

  // Group by date
  const grouped: Record<string, LogEntry[]> = {}
  entries.forEach(e => {
    const day = e.created_at.slice(0, 10)
    if (!grouped[day]) grouped[day] = []
    grouped[day]!.push(e)
  })

  return (
    <div className="space-y-3">
      {Object.entries(grouped).map(([day, items]) => (
        <div key={day}>
          <p className="text-[8px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-1.5">
            {day === new Date().toISOString().slice(0, 10) ? 'Hoy' : new Date(day + 'T00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
          <div className="space-y-1">
            {items.map(e => {
              const Icon = ACTION_ICONS[e.action] || Edit
              const color = ACTION_COLORS[e.action] || '#8E8E93'
              const label = ACTION_LABELS[e.action] || e.action
              return (
                <div key={e.id} className="flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-revelio-bg/30 dark:hover:bg-revelio-dark-border/20">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: color + '15' }}>
                    <Icon className="w-2.5 h-2.5" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] dark:text-revelio-dark-text">
                      <span className="font-semibold">{e.user_name || 'Sistema'}</span>
                      {' '}<span className="text-revelio-subtle dark:text-revelio-dark-subtle">{label}</span>
                      {' '}<span className="font-medium">{e.entity_type === 'item' ? 'item' : e.entity_type === 'risk' ? 'riesgo' : e.entity_type}</span>
                      {' '}<span className="text-revelio-blue">"{e.entity_name}"</span>
                    </p>
                    <p className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle">
                      {e.project} · {new Date(e.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="text-sm flex-shrink-0" style={{ color: e.user_avatar ? undefined : '#8E8E93' }}>{e.user_avatar || '👤'}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// Helper to log activity from anywhere in the app
export function logActivity(userId: string, userName: string, userAvatar: string, action: string, entityType: string, entityName: string, project: string, metadata?: Record<string, unknown>) {
  void supabase.from('activity_log').insert({ user_id: userId, user_name: userName, user_avatar: userAvatar, action, entity_type: entityType, entity_name: entityName, project, metadata: metadata || {} })
}
