import { useMemo, useState, useEffect } from 'react'
import {
  CheckCircle2, Clock, AlertTriangle, TrendingUp, Shield, Target,
  Zap, Users, ChevronRight, BarChart3, Activity, Download,
} from 'lucide-react'
import { Sparkline } from '@/components/common/Sparkline'
import { loadMetricHistory, snapshotMetrics, type MetricSnapshot } from '@/lib/metrics'
import type { Member } from '@/types'

interface Action {
  id: string; text: string; status: string; owner: string; date: string
  priority: string; createdAt: string; type?: string; epicLink?: string
  startDate?: string; baselineEnd?: string; storyPoints?: number | string | null
  [k: string]: unknown
}

interface Risk {
  id: string; text: string; title: string; status: string; prob: string
  impact: string; type: string; escalation?: { level?: string }
}

interface DashboardPanelProps {
  actions: Action[]
  risks: Risk[]
  team: Member[]
  today: string
  sala?: string
  onTabChange: (tab: string) => void
}

function daysAgo(ds: string, today: string) { return Math.round((new Date(today).getTime() - new Date(ds).getTime()) / 86400000) }

export function DashboardPanel({ actions, risks, team, today, sala, onTabChange }: DashboardPanelProps) {
  const [history, setHistory] = useState<MetricSnapshot[]>([])
  useEffect(() => {
    if (sala) { loadMetricHistory(sala, 30).then(setHistory); snapshotMetrics() }
  }, [sala])

  const work = actions.filter(a => (a.type || 'tarea') !== 'epica' && a.status !== 'discarded' && a.status !== 'cancelled')
  const done = work.filter(a => a.status === 'done' || a.status === 'archived')
  const inProgress = work.filter(a => a.status === 'doing' || a.status === 'inprogress' || a.status === 'in_progress')
  const blocked = work.filter(a => a.status === 'blocked')
  const overdue = work.filter(a => a.date && a.date < today && a.status !== 'done' && a.status !== 'archived')
  const rOpen = risks.filter(r => r.status !== 'mitigated')
  const rEsc = rOpen.filter(r => r.escalation?.level && r.escalation.level !== 'equipo')
  const milestones = actions.filter(a => (a.type || '') === 'hito')
  const epics = actions.filter(a => (a.type || '') === 'epica')

  const pctDone = work.length > 0 ? Math.round(done.length / work.length * 100) : 0

  // ── Health Score (0-100) ──
  const health = useMemo(() => {
    let score = 100
    // Overdue items: -3 per item
    score -= overdue.length * 3
    // Blocked items: -5 per item
    score -= blocked.length * 5
    // Escalated risks: -8 per risk
    score -= rEsc.length * 8
    // Open critical risks: -4
    score -= rOpen.filter(r => r.prob === 'alta' && r.impact === 'alto').length * 4
    // Baseline deviation: -2 per deviated item
    score -= work.filter(a => a.baselineEnd && a.date && a.date > a.baselineEnd).length * 2
    // Bonus for progress
    score += Math.floor(pctDone / 10)
    return Math.max(0, Math.min(100, score))
  }, [overdue, blocked, rEsc, rOpen, work, pctDone])

  const healthColor = health >= 75 ? '#34C759' : health >= 50 ? '#FF9500' : '#FF3B30'
  const healthLabel = health >= 75 ? 'Saludable' : health >= 50 ? 'En riesgo' : 'Crítico'

  // ── Velocity (items done per week, last 4 weeks) ──
  const velocity = useMemo(() => {
    const weeks: number[] = [0, 0, 0, 0]
    done.forEach(a => {
      const ago = daysAgo(a.createdAt, today)
      if (ago < 7) weeks[0]!++
      else if (ago < 14) weeks[1]!++
      else if (ago < 21) weeks[2]!++
      else if (ago < 28) weeks[3]!++
    })
    return weeks
  }, [done, today])
  const avgVelocity = velocity.reduce((s, v) => s + v, 0) / 4

  // ── Burndown (last 30 days) — remaining items per day ──
  const burndown = useMemo(() => {
    const points: Array<{ day: number; remaining: number }> = []
    for (let d = 30; d >= 0; d -= 3) {
      const ds = new Date(today)
      ds.setDate(ds.getDate() - d)
      const dateStr = ds.toISOString().slice(0, 10)
      const remaining = work.filter(a => {
        if (a.status === 'done' || a.status === 'archived') {
          // Was it done before this date? If created after, not counted
          return a.createdAt > dateStr
        }
        return a.createdAt <= dateStr
      }).length
      points.push({ day: 30 - d, remaining })
    }
    return points
  }, [work, today])

  // ── Workload per person ──
  const workload = useMemo(() => {
    return team.map(m => {
      const myItems = work.filter(a => a.owner === m.name)
      const myDone = myItems.filter(a => a.status === 'done' || a.status === 'archived').length
      const myActive = myItems.filter(a => a.status === 'doing' || a.status === 'inprogress' || a.status === 'in_progress').length
      const myOverdue = myItems.filter(a => a.date && a.date < today && a.status !== 'done' && a.status !== 'archived').length
      return { id: m.id, name: m.name, avatar: m.avatar, color: m.color, total: myItems.length, done: myDone, active: myActive, overdue: myOverdue }
    }).filter(w => w.total > 0).sort((a, b) => b.total - a.total)
  }, [team, work, today])

  // ── Status distribution ──
  const statusDist = [
    { label: 'Hecho', count: done.length, color: '#34C759' },
    { label: 'En curso', count: inProgress.length, color: '#007AFF' },
    { label: 'Pendiente', count: work.filter(a => a.status === 'todo' || a.status === 'pending').length, color: '#8E8E93' },
    { label: 'Backlog', count: work.filter(a => a.status === 'backlog').length, color: '#C7C7CC' },
    { label: 'Bloqueado', count: blocked.length, color: '#FF3B30' },
  ].filter(s => s.count > 0)

  const maxBurndown = Math.max(...burndown.map(p => p.remaining), 1)

  return (
    <div className="space-y-4">
      {/* Export button */}
      <div className="flex justify-end">
        <button onClick={() => import('@/lib/exports').then(({ exportExecutivePPTX }) => exportExecutivePPTX({ name: 'Proyecto', health, pctDone, overdue: overdue.length, blocked: blocked.length, risks: risks.filter(r => r.status !== 'cerrado').map(r => ({ title: String(r.title || r.text || ''), prob: String(r.prob || ''), impact: String(r.impact || ''), status: String(r.status) })), milestones: milestones.map(m => ({ text: String(m.text), date: String(m.date || ''), status: String(m.status) })), team: team.map(t => ({ name: t.name, role: t.role_label || '', dedication: 1 })) }))} className="px-3 py-1.5 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle flex items-center gap-1 hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><Download className="w-3 h-3" /> Informe PPTX</button>
      </div>

      {/* ── Row 1: Health Score + KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        {/* Health score — large */}
        <div className="col-span-2 rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4 flex items-center gap-4">
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="#F2F2F7" strokeWidth="3" className="dark:stroke-[#3A3A3C]" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke={healthColor} strokeWidth="3" strokeDasharray={`${health} ${100 - health}`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold" style={{ color: healthColor }}>{health}</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold dark:text-revelio-dark-text">Salud del proyecto</p>
            <p className="text-[10px] font-bold" style={{ color: healthColor }}>{healthLabel}</p>
            <p className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle mt-0.5">{overdue.length} vencidos · {blocked.length} bloqueados · {rEsc.length} escalados</p>
          </div>
        </div>

        {/* KPI cards with sparklines */}
        {[
          { l: 'Progreso', v: `${pctDone}%`, I: CheckCircle2, c: pctDone >= 70 ? '#34C759' : pctDone >= 40 ? '#FF9500' : '#FF3B30', spark: history.map(h => h.pct_done) },
          { l: 'Velocidad', v: `${avgVelocity.toFixed(1)}/sem`, I: Zap, c: '#007AFF', spark: [] as number[] },
          { l: 'Vencidos', v: overdue.length, I: Clock, c: overdue.length > 0 ? '#FF3B30' : '#34C759', spark: history.map(h => h.overdue) },
          { l: 'Riesgos', v: rOpen.length, I: AlertTriangle, c: rOpen.length > 0 ? '#FF9500' : '#34C759', spark: history.map(h => h.risks) },
        ].map(k => (
          <div key={k.l} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3">
            <k.I className="w-4 h-4 mb-1" style={{ color: k.c }} />
            <div className="flex items-end justify-between">
              <p className="text-base font-bold" style={{ color: k.c }}>{k.v}</p>
              {k.spark.length >= 2 && <Sparkline data={k.spark} color={k.c} width={50} height={16} />}
            </div>
            <p className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wide">{k.l}</p>
          </div>
        ))}
      </div>

      {/* ── Row 2: Burndown + Velocity + Status dist ── */}
      <div className="grid sm:grid-cols-3 gap-3">
        {/* Mini burndown */}
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-semibold dark:text-revelio-dark-text flex items-center gap-1"><Activity className="w-3 h-3 text-revelio-blue" /> Burndown (30d)</h4>
          </div>
          <div className="h-20 flex items-end gap-px">
            {burndown.map((p, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end">
                <div className="w-full rounded-t-sm transition-all" style={{ height: `${(p.remaining / maxBurndown) * 100}%`, background: i === burndown.length - 1 ? '#007AFF' : '#007AFF30', minHeight: 2 }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1 text-[7px] text-revelio-subtle dark:text-revelio-dark-subtle">
            <span>-30d</span><span>Hoy</span>
          </div>
        </div>

        {/* Velocity chart */}
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-semibold dark:text-revelio-dark-text flex items-center gap-1"><Zap className="w-3 h-3 text-revelio-violet" /> Velocidad (4 sem)</h4>
            <span className="text-[9px] font-bold text-revelio-violet">{avgVelocity.toFixed(1)}/sem</span>
          </div>
          <div className="h-20 flex items-end gap-2">
            {[...velocity].reverse().map((v, i) => {
              const maxV = Math.max(...velocity, 1)
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <span className="text-[8px] font-bold text-revelio-violet">{v}</span>
                  <div className="w-full rounded-t-sm" style={{ height: `${(v / maxV) * 100}%`, background: '#5856D6' + (i === 3 ? '' : '40'), minHeight: 4 }} />
                  <span className="text-[7px] text-revelio-subtle dark:text-revelio-dark-subtle">{['S-4', 'S-3', 'S-2', 'S-1'][i]}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Status distribution */}
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
          <h4 className="text-[10px] font-semibold dark:text-revelio-dark-text flex items-center gap-1 mb-2"><BarChart3 className="w-3 h-3 text-revelio-blue" /> Distribución</h4>
          {/* Stacked bar */}
          <div className="h-3 flex rounded-full overflow-hidden mb-3">
            {statusDist.map(s => (
              <div key={s.label} style={{ width: `${(s.count / (work.length || 1)) * 100}%`, background: s.color }} title={`${s.label}: ${s.count}`} />
            ))}
          </div>
          <div className="space-y-1">
            {statusDist.map(s => (
              <div key={s.label} className="flex items-center gap-1.5 text-[9px]">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <span className="flex-1 dark:text-revelio-dark-text">{s.label}</span>
                <span className="font-bold" style={{ color: s.color }}>{s.count}</span>
                <span className="text-revelio-subtle dark:text-revelio-dark-subtle w-8 text-right">{Math.round((s.count / (work.length || 1)) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3: Workload + Milestones + Risks ── */}
      <div className="grid sm:grid-cols-3 gap-3">
        {/* Team workload */}
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-semibold dark:text-revelio-dark-text flex items-center gap-1"><Users className="w-3 h-3 text-revelio-blue" /> Carga de trabajo</h4>
            <button onClick={() => onTabChange('equipo')} className="text-[8px] text-revelio-blue hover:underline flex items-center gap-0.5">Ver <ChevronRight className="w-2 h-2" /></button>
          </div>
          <div className="space-y-1.5">
            {workload.slice(0, 6).map(w => {
              const maxW = Math.max(...workload.map(x => x.total), 1)
              return (
                <div key={w.id} className="flex items-center gap-1.5">
                  <span className="text-[10px] w-3 text-center">{w.avatar || '·'}</span>
                  <span className="text-[9px] w-16 truncate dark:text-revelio-dark-text">{w.name.split(' ')[0]}</span>
                  <div className="flex-1 h-2 bg-revelio-bg dark:bg-revelio-dark-border rounded-full overflow-hidden flex">
                    <div style={{ width: `${(w.done / maxW) * 100}%`, background: '#34C759' }} />
                    <div style={{ width: `${(w.active / maxW) * 100}%`, background: '#007AFF' }} />
                    <div style={{ width: `${(w.overdue / maxW) * 100}%`, background: '#FF3B30' }} />
                  </div>
                  <span className={`text-[8px] font-bold w-4 text-right ${w.overdue > 0 ? 'text-revelio-red' : 'dark:text-revelio-dark-text'}`}>{w.total}</span>
                </div>
              )
            })}
            {workload.length === 0 && <p className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle text-center py-2">Sin asignaciones</p>}
          </div>
        </div>

        {/* Milestones */}
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-semibold dark:text-revelio-dark-text flex items-center gap-1"><Target className="w-3 h-3 text-revelio-orange" /> Hitos</h4>
            <button onClick={() => onTabChange('seguimiento')} className="text-[8px] text-revelio-blue hover:underline flex items-center gap-0.5">Timeline <ChevronRight className="w-2 h-2" /></button>
          </div>
          {milestones.length > 0 ? (
            <div className="space-y-1.5">
              {[...milestones].sort((a, b) => (a.date || '').localeCompare(b.date || '')).slice(0, 5).map(m => {
                const isDone = m.status === 'done'
                const isOv = !isDone && m.date && m.date < today
                const dLeft = m.date ? daysAgo(today, m.date) : 0
                return (
                  <div key={m.id} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rotate-45 flex-shrink-0" style={{ background: isDone ? '#34C759' : isOv ? '#FF3B30' : '#FF9500' }} />
                    <span className={`text-[9px] flex-1 truncate ${isDone ? 'line-through text-revelio-subtle dark:text-revelio-dark-subtle' : 'dark:text-revelio-dark-text'}`}>{m.text}</span>
                    <span className={`text-[8px] font-semibold ${isDone ? 'text-revelio-green' : isOv ? 'text-revelio-red' : dLeft <= 7 ? 'text-revelio-orange' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}>
                      {isDone ? 'OK' : isOv ? `${-dLeft}d tarde` : dLeft <= 0 ? 'Hoy' : `${dLeft}d`}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : <p className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle text-center py-2">Sin hitos definidos</p>}
        </div>

        {/* Risks summary */}
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[10px] font-semibold dark:text-revelio-dark-text flex items-center gap-1"><Shield className="w-3 h-3 text-revelio-orange" /> Riesgos ({rOpen.length})</h4>
            <button onClick={() => onTabChange('riesgos')} className="text-[8px] text-revelio-blue hover:underline flex items-center gap-0.5">Ver <ChevronRight className="w-2 h-2" /></button>
          </div>
          {rOpen.length > 0 ? (
            <div className="space-y-1.5">
              {rOpen.slice(0, 5).map(r => {
                const isEsc = r.escalation?.level && r.escalation.level !== 'equipo'
                const isCrit = r.prob === 'alta' && r.impact === 'alto'
                return (
                  <div key={r.id} className="flex items-center gap-1.5">
                    <Shield className={`w-3 h-3 flex-shrink-0 ${isEsc ? 'text-revelio-red' : isCrit ? 'text-revelio-orange' : 'text-revelio-subtle'}`} />
                    <span className="text-[9px] flex-1 truncate dark:text-revelio-dark-text">{r.title || r.text}</span>
                    {isEsc && <span className="text-[7px] font-bold text-revelio-red bg-revelio-red/10 px-1 py-0.5 rounded">ESC</span>}
                    {isCrit && !isEsc && <span className="text-[7px] font-bold text-revelio-orange bg-revelio-orange/10 px-1 py-0.5 rounded">CRIT</span>}
                  </div>
                )
              })}
            </div>
          ) : <div className="text-center py-2"><CheckCircle2 className="w-4 h-4 text-revelio-green mx-auto mb-0.5" /><p className="text-[9px] text-revelio-green">Sin riesgos</p></div>}
        </div>
      </div>

      {/* ── Row 4: Epics progress ── */}
      {epics.length > 0 && (
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-[10px] font-semibold dark:text-revelio-dark-text flex items-center gap-1"><TrendingUp className="w-3 h-3 text-[#AF52DE]" /> Progreso por épica</h4>
            <button onClick={() => onTabChange('seguimiento')} className="text-[8px] text-revelio-blue hover:underline flex items-center gap-0.5">Épicas <ChevronRight className="w-2 h-2" /></button>
          </div>
          <div className="space-y-2">
            {epics.map(ep => {
              const children = work.filter(a => String(a.epicLink || '') === ep.id)
              const epDone = children.filter(a => a.status === 'done' || a.status === 'archived').length
              const epPct = children.length > 0 ? Math.round(epDone / children.length * 100) : 0
              const epSP = children.reduce((s, a) => s + (Number(a.storyPoints) || 0), 0)
              return (
                <div key={ep.id} className="flex items-center gap-2.5">
                  <span className="text-[9px] font-semibold text-[#AF52DE] w-28 truncate">{ep.text}</span>
                  <div className="flex-1 h-1.5 bg-revelio-bg dark:bg-revelio-dark-border rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${epPct}%`, background: epPct === 100 ? '#34C759' : '#AF52DE' }} />
                  </div>
                  <span className="text-[9px] font-bold w-8 text-right" style={{ color: epPct === 100 ? '#34C759' : '#AF52DE' }}>{epPct}%</span>
                  <span className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle w-12 text-right">{epDone}/{children.length}</span>
                  {epSP > 0 && <span className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle">{epSP}SP</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
