import { useEffect, useState, useMemo } from 'react'
import { CheckCircle2, Shield, TrendingUp } from 'lucide-react'
import { supabase } from '@/data/supabase'
import type { Room } from '@/types'

const LEVELS = [
  { id: 'direccion', label: 'Dirección', color: '#FF3B30' },
  { id: 'jp', label: 'Jefe de Proyecto', color: '#FF9500' },
  { id: 'sm', label: 'Service Manager', color: '#5856D6' },
  { id: 'equipo', label: 'Equipo', color: '#007AFF' },
]

interface RiskItem { id: string; text?: string; title?: string; status: string; type?: string; prob?: string; impact?: string; escalation?: { level?: string; levelLabel?: string; escalatedAt?: string }; _room: string; _slug: string }

export function EscaladoPanel() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [allRisks, setAllRisks] = useState<RiskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filterProject, setFilterProject] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('rooms').select('*').order('name'),
      supabase.from('retros').select('sala, data').eq('status', 'active'),
    ]).then(([rR, retR]) => {
      const rms = rR.data || []
      setRooms(rms)
      const risks: RiskItem[] = []
      ;(retR.data || []).forEach((r: { sala: string; data: Record<string, unknown> }) => {
        const d = r.data || {}
        const roomName = rms.find((rm: Room) => rm.slug === r.sala)?.name || r.sala
        ;((d.risks || []) as Array<Record<string, unknown>>).forEach(risk => {
          if (risk.status === 'mitigated') return
          risks.push({ ...risk, _room: roomName, _slug: r.sala } as RiskItem)
        })
      })
      setAllRisks(risks)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => filterProject ? allRisks.filter(r => r._slug === filterProject) : allRisks, [allRisks, filterProject])
  const escalated = filtered.filter(r => r.escalation?.level && r.escalation.level !== 'equipo')

  if (loading) return <div className="text-sm text-revelio-subtle dark:text-revelio-dark-subtle text-center py-10">Cargando riesgos...</div>

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-revelio-text dark:text-revelio-dark-text flex items-center gap-2"><TrendingUp className="w-5 h-5 text-revelio-red" /> Escalado Global</h2>
          <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">{filtered.length} riesgos · {escalated.length} escalados</p>
        </div>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2.5 py-1.5 text-xs outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text">
          <option value="">Todos los proyectos</option>
          {rooms.map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}
        </select>
      </div>

      {escalated.length === 0 && filtered.length === 0 && (
        <div className="text-center py-16"><CheckCircle2 className="w-10 h-10 text-revelio-green mx-auto mb-2" /><p className="text-sm text-revelio-green font-medium">Sin riesgos escalados</p></div>
      )}

      {/* Group by escalation level */}
      {LEVELS.map(level => {
        const items = filtered.filter(r => (r.escalation?.level || 'equipo') === level.id && r.status !== 'mitigated')
        if (items.length === 0) return null
        return (
          <div key={level.id} className="mb-5">
            <div className="flex items-center gap-2 mb-2 pb-1.5 border-b-2" style={{ borderColor: level.color + '30' }}>
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: level.color }} />
              <span className="text-xs font-bold" style={{ color: level.color }}>{level.label}</span>
              <span className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">{items.length}</span>
            </div>
            <div className="space-y-1.5">
              {items.map(r => {
                const daysSince = r.escalation?.escalatedAt ? Math.floor((Date.now() - new Date(r.escalation.escalatedAt).getTime()) / 86400000) : null
                return (
                  <div key={r.id} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card px-4 py-3 border-l-2" style={{ borderLeftColor: level.color }}>
                    <div className="flex items-start gap-2.5">
                      <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: level.color }} />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-revelio-text dark:text-revelio-dark-text">{r.title || r.text}</p>
                        <div className="flex gap-3 mt-1 text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">
                          <span className="font-semibold text-revelio-blue">{r._room}</span>
                          <span className="capitalize">{r.type || 'riesgo'}</span>
                          {r.prob && <span>P:{r.prob}</span>}
                          {r.impact && <span>I:{r.impact}</span>}
                        </div>
                      </div>
                      {daysSince !== null && (
                        <span className={`text-[10px] font-semibold ${daysSince > 5 ? 'text-revelio-red' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}>hace {daysSince}d</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
