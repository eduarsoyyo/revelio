import { useEffect, useState } from 'react'
import { History, ChevronDown, ChevronRight, MessageSquare, ListChecks, AlertTriangle, Users, CheckCircle2, Clock } from 'lucide-react'
import { supabase } from '@/data/supabase'

interface RetroRecord {
  id: string
  sala: string
  tipo: string
  status: string
  data: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface RetroMetrics {
  notes: number
  actions: number
  actionsDone: number
  risks: number
  risksOpen: number
  participants: string[]
  objective: string
  duration: string
}

function extractMetrics(data: Record<string, unknown>): RetroMetrics {
  const notes = (data.notes || []) as Array<Record<string, unknown>>
  const actions = (data.actions || []) as Array<Record<string, unknown>>
  const risks = (data.risks || []) as Array<Record<string, unknown>>
  const obj = data.obj as Record<string, string> | undefined

  const participants = [...new Set(notes.map(n => n.userName as string).filter(Boolean))]
  const actionsDone = actions.filter(a => a.status === 'done' || a.status === 'archived').length
  const risksOpen = risks.filter(r => r.status !== 'mitigated').length

  return {
    notes: notes.length,
    actions: actions.length,
    actionsDone,
    risks: risks.length,
    risksOpen,
    participants,
    objective: obj?.text || '',
    duration: '',
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface RetroHistoryProps {
  sala: string
}

export function RetroHistory({ sala }: RetroHistoryProps) {
  const [retros, setRetros] = useState<RetroRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('retros').select('*').eq('sala', sala).order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setRetros(data)
        setLoading(false)
      })
  }, [sala])

  const closed = retros.filter(r => r.status === 'closed' || r.status === 'archived')
  const active = retros.find(r => r.status === 'active')

  if (loading) return <div className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle text-center py-8">Cargando historial...</div>

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <History className="w-4 h-4 text-revelio-violet" />
        <span className="text-sm font-semibold dark:text-revelio-dark-text">Historial de retrospectivas</span>
        <span className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">{closed.length} cerradas</span>
      </div>

      {/* Active retro summary */}
      {active && (() => {
        const m = extractMetrics(active.data)
        return (
          <div className="rounded-card border-2 border-revelio-blue/30 bg-revelio-blue/5 dark:bg-revelio-blue/10 p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-revelio-blue animate-pulse" />
              <span className="text-xs font-semibold text-revelio-blue">Retro activa</span>
              <span className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle ml-auto">{formatDate(active.created_at)}</span>
            </div>
            {m.objective && <p className="text-xs text-revelio-text dark:text-revelio-dark-text mb-2">"{m.objective}"</p>}
            <div className="flex gap-4 text-[10px]">
              <span className="text-revelio-blue font-semibold">{m.notes} notas</span>
              <span className="text-revelio-violet font-semibold">{m.actions} items</span>
              <span className="text-revelio-orange font-semibold">{m.risksOpen} riesgos</span>
            </div>
          </div>
        )
      })()}

      {/* Closed retros */}
      {closed.length === 0 ? (
        <div className="text-center py-12">
          <History className="w-8 h-8 text-revelio-border dark:text-revelio-dark-border mx-auto mb-2" />
          <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">Sin retrospectivas archivadas</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {closed.map(retro => {
            const m = extractMetrics(retro.data)
            const isOpen = expanded === retro.id
            const pct = m.actions > 0 ? Math.round(m.actionsDone / m.actions * 100) : 0
            const notes = (retro.data.notes || []) as Array<Record<string, unknown>>
            const actions = (retro.data.actions || []) as Array<Record<string, unknown>>
            const risks = (retro.data.risks || []) as Array<Record<string, unknown>>

            return (
              <div key={retro.id} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card overflow-hidden">
                {/* Header row */}
                <button onClick={() => setExpanded(isOpen ? null : retro.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-revelio-bg/50 dark:hover:bg-revelio-dark-border/50 transition-colors">
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-revelio-subtle" /> : <ChevronRight className="w-3.5 h-3.5 text-revelio-subtle" />}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold dark:text-revelio-dark-text">{formatDate(retro.created_at)}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle capitalize">{retro.tipo}</span>
                    </div>
                    {m.objective && <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle mt-0.5 truncate max-w-[300px]">"{m.objective}"</p>}
                  </div>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="flex items-center gap-0.5 text-revelio-blue"><MessageSquare className="w-3 h-3" />{m.notes}</span>
                    <span className="flex items-center gap-0.5 text-revelio-violet"><ListChecks className="w-3 h-3" />{m.actionsDone}/{m.actions}</span>
                    <span className="flex items-center gap-0.5 text-revelio-orange"><AlertTriangle className="w-3 h-3" />{m.risks}</span>
                    <span className="flex items-center gap-0.5 text-revelio-subtle dark:text-revelio-dark-subtle"><Users className="w-3 h-3" />{m.participants.length}</span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-revelio-border dark:border-revelio-dark-border px-4 py-4">
                    {/* KPIs */}
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {[
                        { l: 'Notas', v: m.notes, icon: MessageSquare, c: 'text-revelio-blue' },
                        { l: 'Progreso', v: `${pct}%`, icon: CheckCircle2, c: pct >= 70 ? 'text-revelio-green' : 'text-revelio-orange' },
                        { l: 'Riesgos', v: m.risks, icon: AlertTriangle, c: 'text-revelio-orange' },
                        { l: 'Participantes', v: m.participants.length, icon: Users, c: 'text-revelio-subtle dark:text-revelio-dark-subtle' },
                      ].map(s => (
                        <div key={s.l} className="bg-revelio-bg dark:bg-revelio-dark-border rounded-lg p-2.5 text-center">
                          <s.icon className={`w-3.5 h-3.5 mx-auto mb-1 ${s.c}`} />
                          <p className={`text-base font-bold dark:text-revelio-dark-text ${s.c}`}>{s.v}</p>
                          <p className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle uppercase">{s.l}</p>
                        </div>
                      ))}
                    </div>

                    {/* Participants */}
                    {m.participants.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[9px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-1">Participantes</p>
                        <div className="flex gap-1 flex-wrap">
                          {m.participants.map(p => (
                            <span key={p} className="text-[9px] bg-revelio-bg dark:bg-revelio-dark-border text-revelio-text dark:text-revelio-dark-text px-2 py-0.5 rounded-full">{p}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Top notes */}
                    {notes.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[9px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-1">Notas más votadas</p>
                        {[...notes].sort((a, b) => ((b.votes as string[])?.length || 0) - ((a.votes as string[])?.length || 0)).slice(0, 3).map((n, i) => (
                          <div key={i} className="flex items-center gap-1.5 py-1 text-[10px]">
                            <span className="text-revelio-blue font-semibold">{(n.votes as string[])?.length || 0}v</span>
                            <span className="dark:text-revelio-dark-text">{n.text as string}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions summary */}
                    {actions.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[9px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-1">Items ({m.actionsDone}/{m.actions})</p>
                        {actions.slice(0, 5).map((a, i) => {
                          const done = a.status === 'done' || a.status === 'archived'
                          return (
                            <div key={i} className="flex items-center gap-1.5 py-0.5 text-[10px]">
                              {done ? <CheckCircle2 className="w-3 h-3 text-revelio-green" /> : <Clock className="w-3 h-3 text-revelio-subtle" />}
                              <span className={done ? 'line-through text-revelio-subtle dark:text-revelio-dark-subtle' : 'dark:text-revelio-dark-text'}>{String(a.text || '')}</span>
                              {a.owner ? <span className="text-revelio-subtle dark:text-revelio-dark-subtle ml-auto">{String(a.owner).split(' ')[0]}</span> : null}
                            </div>
                          )
                        })}
                        {actions.length > 5 && <p className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle mt-1">+{actions.length - 5} más</p>}
                      </div>
                    )}

                    {/* Risks summary */}
                    {risks.length > 0 && (
                      <div>
                        <p className="text-[9px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-1">Riesgos ({m.risksOpen} abiertos / {risks.length} total)</p>
                        {risks.slice(0, 3).map((r, i) => {
                          const open = r.status !== 'mitigated'
                          return (
                            <div key={i} className="flex items-center gap-1.5 py-0.5 text-[10px]">
                              <AlertTriangle className={`w-3 h-3 ${open ? 'text-revelio-orange' : 'text-revelio-green'}`} />
                              <span className={open ? 'dark:text-revelio-dark-text' : 'line-through text-revelio-subtle dark:text-revelio-dark-subtle'}>{(String(r.title || r.text || ""))}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
