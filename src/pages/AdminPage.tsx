import { useEffect, useState, useMemo } from 'react'
import {
  BarChart3, FolderOpen, List, AlertTriangle, UserCheck, Shield,
  Calendar, GitBranch, GitMerge, Settings, ChevronDown, ChevronRight,
  Activity, Users, CheckCircle, TrendingUp, Clock, CheckSquare, Zap,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { CalendarPanel } from '@/components/admin/CalendarPanel'
import { ConfigPanel } from '@/components/admin/ConfigPanel'
import { CrossProjectPanel } from '@/components/admin/CrossProjectPanel'
import { EscaladoPanel } from '@/components/admin/EscaladoPanel'
import { OrgChartPanel } from '@/components/admin/OrgChartPanel'
import { PeopleTimeline } from '@/components/admin/PeopleTimeline'
import { ProjectsPanel } from '@/components/admin/ProjectsPanel'
import { RolesPanel } from '@/components/admin/RolesPanel'
import { UsersPanel } from '@/components/admin/UsersPanel'
import { ActivityLog } from '@/components/common/ActivityLog'
import { IntelligencePanel } from '@/components/common/IntelligencePanel'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/data/supabase'
import { getEngagementMetrics, type EngagementMetrics } from '@/lib/usage'
import type { Room, Member } from '@/types'

// ── Types ──
type AdminTab = 'dashboard' | 'intelligence' | 'engagement' | 'activity' | 'proyectos' | 'riesgos' | 'usuarios' | 'roles' | 'calendarios' | 'organigrama' | 'cross' | 'timeline' | 'config'

interface NavItem {
  id: AdminTab
  icon: typeof BarChart3
  label: string
  children?: { id: AdminTab; icon: typeof BarChart3; label: string }[]
}

const NAV: NavItem[] = [
  {
    id: 'dashboard', icon: BarChart3, label: 'Dashboard',
    children: [
      { id: 'dashboard', icon: BarChart3, label: 'Cockpit' },
      { id: 'intelligence', icon: Zap, label: 'Inteligencia' },
      { id: 'engagement', icon: Activity, label: 'Engagement' },
      { id: 'activity', icon: Clock, label: 'Actividad' },
    ],
  },
  {
    id: 'proyectos', icon: FolderOpen, label: 'Proyectos',
    children: [
      { id: 'proyectos', icon: List, label: 'Lista de proyectos' },
      { id: 'riesgos', icon: AlertTriangle, label: 'Riesgos y Escalado' },
    ],
  },
  {
    id: 'usuarios', icon: Users, label: 'RRHH',
    children: [
      { id: 'usuarios', icon: UserCheck, label: 'Usuarios' },
      { id: 'roles', icon: Shield, label: 'Roles y Habilidades' },
      { id: 'calendarios', icon: Calendar, label: 'Calendario / Convenio' },
      { id: 'organigrama', icon: GitBranch, label: 'Organigrama' },
      { id: 'cross', icon: GitMerge, label: 'Cross-proyecto' },
      { id: 'timeline', icon: Calendar, label: 'Timeline personas' },
    ],
  },
  { id: 'config', icon: Settings, label: 'Configuración' },
]

interface RetroData { sala: string; data: Record<string, unknown> }
interface Action { id: string; text: string; status: string; owner?: string; date?: string; [k: string]: unknown }
interface Risk { id: string; status: string; prob?: string; impact?: string; escalation?: { level?: string }; [k: string]: unknown }

export function AdminPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<AdminTab>(() => {
    try { return (localStorage.getItem('rv2-admin-tab') as AdminTab) || 'dashboard' } catch { return 'dashboard' }
  })
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['usuarios', 'proyectos']))
  const [rooms, setRooms] = useState<Room[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [retroData, setRetroData] = useState<Record<string, { actions: Action[]; risks: Risk[] }>>({})
  const [loading, setLoading] = useState(true)
  const [engagement, setEngagement] = useState<EngagementMetrics | null>(null)
  const [orgData, setOrgData] = useState<Array<Record<string, unknown>>>([])

  const setTabPersist = (t: AdminTab) => {
    // Dashboard subtabs: redirect to correct tab
    if (['intelligence', 'engagement', 'activity'].includes(t)) {
      setTab(t)
    } else {
      setTab(t)
    }
    try { localStorage.setItem('rv2-admin-tab', t) } catch {}
  }

  useEffect(() => {
    async function load() {
      const [roomsR, membersR, retrosR, orgR] = await Promise.all([
        supabase.from('rooms').select('*').order('name'),
        supabase.from('team_members').select('*').order('name'),
        supabase.from('retros').select('sala, data').eq('status', 'active'),
        supabase.from('org_chart').select('*'),
      ])
      if (roomsR.data) setRooms(roomsR.data)
      if (membersR.data) setMembers(membersR.data)
      if (orgR.data) setOrgData(orgR.data as Array<Record<string, unknown>>)
      if (retrosR.data) {
        const byRoom: Record<string, { actions: Action[]; risks: Risk[] }> = {}
        retrosR.data.forEach((r: RetroData) => {
          const d = r.data || {}
          byRoom[r.sala] = {
            actions: (d.actions || []) as Action[],
            risks: (d.risks || []) as Risk[],
          }
        })
        setRetroData(byRoom)
      }
      setLoading(false)
    }
    load()
    getEngagementMetrics(30).then(setEngagement)
  }, [])

  const toggleSection = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Computed stats ──
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    let totalActions = 0, totalDone = 0, totalOverdue = 0, totalRisks = 0, totalEscalated = 0

    Object.values(retroData).forEach(d => {
      const acts = d.actions.filter(a => a.status !== 'discarded' && a.status !== 'cancelled')
      totalActions += acts.length
      totalDone += acts.filter(a => a.status === 'done' || a.status === 'archived').length
      totalOverdue += acts.filter(a => a.status !== 'done' && a.date && a.date < today).length
      const rOpen = d.risks.filter(r => r.status !== 'mitigated')
      totalRisks += rOpen.length
      totalEscalated += rOpen.filter(r => r.escalation?.level && r.escalation.level !== 'equipo').length
    })

    const pct = totalActions > 0 ? Math.round(totalDone / totalActions * 100) : 0
    const health = Math.max(0, Math.min(100, pct * 0.7 + 30 - Math.min(totalRisks * 3, 30)))

    return { totalActions, totalDone, totalOverdue, totalRisks, totalEscalated, pct, health: Math.round(health) }
  }, [retroData])

  const projectStats = useMemo(() => {
    return rooms.map(r => {
      const d = retroData[r.slug] || { actions: [], risks: [] }
      const acts = d.actions.filter(a => a.status !== 'discarded' && a.status !== 'cancelled')
      const done = acts.filter(a => a.status === 'done' || a.status === 'archived').length
      const risks = d.risks.filter(ri => ri.status !== 'mitigated').length
      const team = members.filter(m => (m.rooms || []).includes(r.slug)).length
      const pct = acts.length > 0 ? Math.round(done / acts.length * 100) : 0
      return { ...r, acts: acts.length, done, risks, team, pct }
    })
  }, [rooms, retroData, members])

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="animate-pulse text-sm text-revelio-subtle dark:text-revelio-dark-subtle">Cargando Centro de Control...</div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* ═══ SIDEBAR ═══ */}
      <aside className="w-52 shrink-0 border-r border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card overflow-y-auto p-3 flex flex-col">
        {NAV.map(item => {
          if (!item.children) {
            return (
              <button key={item.id} onClick={() => setTabPersist(item.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${
                  tab === item.id ? 'bg-revelio-blue/10 text-revelio-blue font-medium' : 'text-revelio-subtle dark:text-revelio-dark-subtle hover:bg-revelio-bg dark:bg-revelio-dark-border'
                }`}>
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            )
          }
          const isExp = expanded.has(item.id)
          const childActive = item.children.some(c => tab === c.id)
          return (
            <div key={item.id} className="mb-0.5">
              <button onClick={() => toggleSection(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  childActive ? 'text-revelio-blue font-medium' : 'text-revelio-subtle dark:text-revelio-dark-subtle hover:bg-revelio-bg dark:bg-revelio-dark-border'
                }`}>
                <span className="flex items-center gap-2">
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </span>
                {isExp ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              </button>
              {isExp && (
                <div className="ml-4 mt-0.5">
                  {item.children.map(child => (
                    <button key={child.id} onClick={() => setTabPersist(child.id)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors mb-0.5 ${
                        tab === child.id ? 'bg-revelio-blue/10 text-revelio-blue font-medium' : 'text-revelio-subtle dark:text-revelio-dark-subtle hover:bg-revelio-bg dark:bg-revelio-dark-border'
                      }`}>
                      <child.icon className="w-3.5 h-3.5" />
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </aside>

      {/* ═══ CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto p-6">

        {/* ── COCKPIT SM ── */}
        {tab === 'dashboard' && (
          <div className="w-full max-w-[1600px]">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-revelio-text dark:text-revelio-dark-text">Cockpit</h2>
              <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">{rooms.length} proyectos · {members.length} personas</p>
            </div>

            <>
            {/* KPIs row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
              {[
                { l: 'Salud global', v: `${stats.health}%`, icon: Activity, c: stats.health >= 70 ? 'text-revelio-green' : stats.health >= 40 ? 'text-revelio-orange' : 'text-revelio-red', bg: stats.health >= 70 ? 'bg-revelio-green/10' : stats.health >= 40 ? 'bg-revelio-orange/10' : 'bg-revelio-red/10' },
                { l: 'Proyectos', v: rooms.length, icon: FolderOpen, c: 'text-revelio-blue', bg: 'bg-revelio-blue/10' },
                { l: 'Personas', v: members.length, icon: Users, c: 'text-revelio-violet', bg: 'bg-revelio-violet/10' },
                { l: 'Items', v: stats.totalActions, icon: CheckSquare, c: 'text-revelio-blue', bg: 'bg-revelio-blue/10' },
                { l: 'Riesgos', v: stats.totalRisks, icon: AlertTriangle, c: stats.totalRisks > 0 ? 'text-revelio-orange' : 'text-revelio-green', bg: stats.totalRisks > 0 ? 'bg-revelio-orange/10' : 'bg-revelio-green/10' },
                { l: 'Escalados', v: stats.totalEscalated, icon: TrendingUp, c: stats.totalEscalated > 0 ? 'text-revelio-red' : 'text-revelio-green', bg: stats.totalEscalated > 0 ? 'bg-revelio-red/10' : 'bg-revelio-green/10' },
              ].map(s => (
                <div key={s.l} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
                  <div className={`w-7 h-7 rounded-badge ${s.bg} flex items-center justify-center mb-2`}><s.icon className={`w-3.5 h-3.5 ${s.c}`} /></div>
                  <p className={`text-lg font-bold ${s.c}`}>{s.v}</p>
                  <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wide">{s.l}</p>
                </div>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              {/* Q1: ¿Alguien sobreasignado o sin asignar? → Barras de dedicación */}
              <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
                <h4 className="text-[10px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-3 flex items-center gap-1"><Users className="w-3 h-3 text-revelio-violet" /> Dedicación del equipo</h4>
                <div className="space-y-2">
                  {members.map(m => {
                    const today = new Date().toISOString().slice(0, 10)
                    const myOrg = orgData.filter(o => o.member_id === m.id && ((o.start_date as string) || '2000-01-01') <= today && ((o.end_date as string) || '2099-12-31') >= today && rooms.some(r => r.slug === (o.sala as string)))
                    const totalDed = myOrg.reduce((s, o) => s + ((o.dedication as number) || 0), 0)
                    const pct = Math.round(totalDed * 100)
                    const barColor = pct > 100 ? '#FF3B30' : pct < 50 && pct > 0 ? '#FF9500' : pct === 0 ? '#C7C7CC' : '#34C759'
                    return (
                      <div key={m.id} className="flex items-center gap-2">
                        <span className="text-[10px] w-20 truncate dark:text-revelio-dark-text" title={m.name}>{m.name.split(' ')[0]}</span>
                        <div className="flex-1 h-3 bg-revelio-bg dark:bg-revelio-dark-border rounded-full overflow-hidden flex">
                          {myOrg.map((o, i) => {
                            const w = Math.round(((o.dedication as number) || 0) * 100)
                            const colors = ['#007AFF', '#5856D6', '#FF9500', '#34C759', '#FF2D55']
                            return <div key={i} style={{ width: `${w}%`, background: colors[i % colors.length] }} className="h-full" title={`${(o as Record<string, unknown>).sala}: ${w}%`} />
                          })}
                        </div>
                        <span className={`text-[9px] font-bold w-8 text-right ${pct > 100 ? 'text-revelio-red' : pct === 0 ? 'text-[#C7C7CC]' : 'dark:text-revelio-dark-text'}`} style={{ color: barColor }}>{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Q2: ¿Riesgos escalados? → Cards con countdown */}
              <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
                <h4 className="text-[10px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-3 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-revelio-red" /> Riesgos escalados</h4>
                {(() => {
                  const escalated: Array<{ title: string; level: string; project: string }> = []
                  Object.entries(retroData).forEach(([sala, d]) => {
                    d.risks.filter(r => (r.escalation as Record<string, unknown>)?.level && (r.escalation as Record<string, unknown>)?.level !== 'equipo' && r.status !== 'cerrado').forEach(r => {
                      escalated.push({ title: String((r as Record<string, unknown>).title || (r as Record<string, unknown>).text || ''), level: String((r.escalation as Record<string, unknown>)?.level), project: sala })
                    })
                  })
                  if (escalated.length === 0) return <div className="text-center py-4"><CheckCircle className="w-5 h-5 text-revelio-green mx-auto mb-1" /><p className="text-[10px] text-revelio-green font-semibold">Sin escalados</p></div>
                  return <div className="space-y-1.5">{escalated.map((e, i) => (
                    <div key={i} className="bg-revelio-red/5 border border-revelio-red/20 rounded-lg px-3 py-2">
                      <p className="text-[10px] font-semibold text-revelio-red">{e.title}</p>
                      <p className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle">{e.project} · Escalado a {e.level}</p>
                    </div>
                  ))}</div>
                })()}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 mb-5">
              {/* Q3: ¿Cómo van los proyectos? → Semáforo */}
              <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
                <h4 className="text-[10px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-3 flex items-center gap-1"><FolderOpen className="w-3 h-3 text-revelio-blue" /> Semáforo de proyectos</h4>
                <div className="space-y-1.5">
                  {projectStats.map(p => {
                    const health = Math.max(0, Math.min(100, p.pct * 0.7 + 30 - Math.min(p.risks * 3, 30)))
                    const color = health >= 70 ? '#34C759' : health >= 40 ? '#FF9500' : '#FF3B30'
                    return (
                      <Link key={p.slug} to={`/project/${p.slug}`} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-revelio-bg dark:hover:bg-revelio-dark-border transition-colors">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-[10px] font-medium flex-1 dark:text-revelio-dark-text">{p.name}</span>
                        <span className="text-[9px] font-bold" style={{ color }}>{Math.round(health)}%</span>
                        <span className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle">{p.pct}% hecho</span>
                      </Link>
                    )
                  })}
                </div>
              </div>

              {/* Q5: ¿Items que vencen pronto? → Top 5 */}
              <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
                <h4 className="text-[10px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-3 flex items-center gap-1"><Clock className="w-3 h-3 text-revelio-orange" /> Vencimientos próximos</h4>
                {(() => {
                  const today = new Date().toISOString().slice(0, 10)
                  const upcoming: Array<{ text: string; date: string; owner: string; project: string; daysLeft: number }> = []
                  Object.entries(retroData).forEach(([sala, d]) => {
                    d.actions.filter(a => a.date && (a.date as string) >= today && a.status !== 'done' && a.status !== 'archived').forEach(a => {
                      const dl = Math.round((new Date(a.date as string).getTime() - new Date(today).getTime()) / 86400000)
                      if (dl <= 7) upcoming.push({ text: a.text as string || '', date: a.date as string, owner: (a.owner as string) || '', project: sala, daysLeft: dl })
                    })
                  })
                  // Also add overdue
                  Object.entries(retroData).forEach(([sala, d]) => {
                    d.actions.filter(a => a.date && (a.date as string) < today && a.status !== 'done' && a.status !== 'archived').forEach(a => {
                      const dl = Math.round((new Date(a.date as string).getTime() - new Date(today).getTime()) / 86400000)
                      upcoming.push({ text: a.text as string || '', date: a.date as string, owner: (a.owner as string) || '', project: sala, daysLeft: dl })
                    })
                  })
                  upcoming.sort((a, b) => a.daysLeft - b.daysLeft)
                  if (upcoming.length === 0) return <div className="text-center py-4"><CheckCircle className="w-5 h-5 text-revelio-green mx-auto mb-1" /><p className="text-[10px] text-revelio-green font-semibold">Sin vencimientos próximos</p></div>
                  return <div className="space-y-1">{upcoming.slice(0, 7).map((u, i) => (
                    <div key={i} className="flex items-center gap-2 py-1">
                      <span className={`text-[9px] font-bold w-10 ${u.daysLeft < 0 ? 'text-revelio-red' : u.daysLeft <= 2 ? 'text-revelio-orange' : 'dark:text-revelio-dark-text'}`}>{u.daysLeft < 0 ? `${Math.abs(u.daysLeft)}d tarde` : u.daysLeft === 0 ? 'Hoy' : `${u.daysLeft}d`}</span>
                      <span className="text-[10px] flex-1 truncate dark:text-revelio-dark-text">{u.text}</span>
                      <span className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle">{u.owner?.split(' ')[0] || '—'} · {u.project}</span>
                    </div>
                  ))}{upcoming.length > 7 && <p className="text-[8px] text-revelio-subtle text-center">+{upcoming.length - 7} más</p>}</div>
                })()}
              </div>
            </div>

            {/* Project table (same as before) */}
            <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-revelio-bg dark:bg-revelio-dark-border">{['Proyecto', 'Tipo', 'Equipo', 'Acciones', 'Progreso', 'Riesgos', ''].map(h => <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">{h}</th>)}</tr></thead>
                <tbody>{projectStats.map((p, i) => (
                  <tr key={p.slug} className={`border-t border-revelio-border dark:border-revelio-dark-border/50 ${i % 2 ? 'bg-revelio-bg dark:bg-revelio-dark-border/30' : ''}`}>
                    <td className="px-4 py-3"><Link to={`/project/${p.slug}`} className="font-medium text-revelio-text dark:text-revelio-dark-text hover:text-revelio-blue">{p.name}</Link></td>
                    <td className="px-4 py-3 text-xs text-revelio-subtle dark:text-revelio-dark-subtle capitalize">{p.tipo}</td>
                    <td className="px-4 py-3"><span className="flex items-center gap-1 text-xs text-revelio-subtle dark:text-revelio-dark-subtle"><Users className="w-3 h-3" /> {p.team}</span></td>
                    <td className="px-4 py-3 text-xs"><span className="font-semibold dark:text-revelio-dark-text">{p.done}</span><span className="text-revelio-subtle dark:text-revelio-dark-subtle">/{p.acts}</span></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-16 h-1.5 bg-revelio-bg dark:bg-revelio-dark-border rounded-full overflow-hidden"><div className={`h-full rounded-full ${p.pct >= 70 ? 'bg-revelio-green' : p.pct >= 40 ? 'bg-revelio-orange' : 'bg-revelio-red'}`} style={{ width: `${p.pct}%` }} /></div><span className={`text-xs font-semibold ${p.pct >= 70 ? 'text-revelio-green' : p.pct >= 40 ? 'text-revelio-orange' : 'text-revelio-red'}`}>{p.pct}%</span></div></td>
                    <td className="px-4 py-3">{p.risks > 0 ? <span className="text-xs font-semibold text-revelio-orange flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {p.risks}</span> : <span className="text-xs text-revelio-green">0</span>}</td>
                    <td className="px-4 py-3"><Link to={`/project/${p.slug}`} className="text-revelio-blue hover:underline text-xs">Abrir</Link></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            </>)
          </div>
        )}

        {tab === 'intelligence' && (
          <div className="w-full max-w-[1600px]">
            <h2 className="text-lg font-semibold text-revelio-text dark:text-revelio-dark-text mb-4">Inteligencia</h2>
            <IntelligencePanel userId={user?.id} />
          </div>
        )}

        {tab === 'engagement' && (
          <div className="w-full max-w-[1600px]">
            <h2 className="text-lg font-semibold text-revelio-text dark:text-revelio-dark-text mb-1">Engagement</h2>
            <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mb-4">Métricas de uso de la plataforma (últimos 30 días)</p>
            {engagement ? (
            <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { l: 'Sesiones', v: engagement.totalSessions, c: '#007AFF', I: Zap },
                { l: 'Media sesión', v: `${engagement.avgSessionMinutes}min`, c: '#5856D6', I: Clock },
                { l: 'Eventos hoy', v: engagement.eventsToday, c: '#34C759', I: Activity, trend: engagement.eventsTrend },
                { l: 'DAU hoy', v: engagement.dailyActiveUsers.length > 0 ? engagement.dailyActiveUsers[engagement.dailyActiveUsers.length - 1]!.count : 0, c: '#FF9500', I: Users },
              ].map(k => (
                <div key={k.l} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
                  <k.I className="w-4 h-4 mb-1" style={{ color: k.c }} />
                  <div className="flex items-end gap-1">
                    <p className="text-xl font-bold" style={{ color: k.c }}>{k.v}</p>
                    {'trend' in k && k.trend !== undefined && k.trend !== 0 && <span className={`text-[9px] font-bold ${(k.trend as number) > 0 ? 'text-revelio-green' : 'text-revelio-red'}`}>{(k.trend as number) > 0 ? '+' : ''}{k.trend}%</span>}
                  </div>
                  <p className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wide">{k.l}</p>
                </div>
              ))}
            </div>

            {/* DAU chart */}
            {engagement.dailyActiveUsers.length > 0 && (
              <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-5 mb-4">
                <h4 className="text-xs font-semibold dark:text-revelio-dark-text mb-3">Usuarios activos por día</h4>
                <div className="flex items-end gap-px" style={{ height: 100 }}>
                  {engagement.dailyActiveUsers.slice(-30).map((d, i) => {
                    const max = Math.max(...engagement.dailyActiveUsers.map(x => x.count), 1)
                    const isToday = d.date === new Date().toISOString().slice(0, 10)
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end" title={`${d.date}: ${d.count} usuarios`}>
                        <span className="text-[7px] text-revelio-subtle dark:text-revelio-dark-subtle mb-0.5">{d.count > 0 ? d.count : ''}</span>
                        <div className="w-full rounded-t-sm" style={{ height: `${(d.count / max) * 100}%`, background: isToday ? '#007AFF' : '#007AFF40', minHeight: 2 }} />
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-1 text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle"><span>-30d</span><span>Hoy</span></div>
              </div>
            )}

            {/* Top users */}
            {engagement.topUsers.length > 0 && (
              <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-5">
                <h4 className="text-xs font-semibold dark:text-revelio-dark-text mb-3">Usuarios más activos</h4>
                <div className="space-y-2">
                  {engagement.topUsers.map((u, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-lg w-8 text-center">{u.avatar || '👤'}</span>
                      <span className="text-xs font-medium flex-1 dark:text-revelio-dark-text">{u.name}</span>
                      <div className="w-24 h-2 bg-revelio-bg dark:bg-revelio-dark-border rounded-full overflow-hidden">
                        <div className="h-full bg-revelio-blue rounded-full" style={{ width: `${(u.sessions / (engagement.topUsers[0]?.sessions || 1)) * 100}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-revelio-blue w-12 text-right">{u.sessions}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>) : <div className="text-sm text-revelio-subtle text-center py-10">Cargando métricas...</div>}
          </div>
        )}

        {tab === 'activity' && (
          <div className="w-full max-w-[1600px]">
            <h2 className="text-lg font-semibold text-revelio-text dark:text-revelio-dark-text mb-4">Actividad</h2>
            <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
              <ActivityLog limit={50} />
            </div>
          </div>
        )}

        {/* ── STUB TABS ── */}
        {tab === 'usuarios' && <UsersPanel />}
        {tab === 'roles' && <RolesPanel />}
        {tab === 'calendarios' && <CalendarPanel />}
        {tab === 'proyectos' && <ProjectsPanel />}
        {tab === 'riesgos' && <EscaladoPanel />}
        {tab === 'cross' && <CrossProjectPanel />}
        {tab === 'timeline' && <PeopleTimeline />}
        {tab === 'organigrama' && <OrgChartPanel />}
        {tab === 'config' && <ConfigPanel />}
      </div>
    </div>
  )
}

// All panels migrated — no stubs remaining
