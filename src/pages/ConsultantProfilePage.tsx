import { useEffect, useState } from 'react'
import { ChevronLeft, Calendar, Clock, ListChecks, Users, AlertTriangle } from 'lucide-react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/data/supabase'

interface MemberFull { id: string; name: string; avatar: string; color: string; role_label: string; company: string; email: string; hire_date: string; contract_type: string; calendario_id: string; cost_rates: Array<{ from: string; rate: number }>; rooms: string[]; is_superuser: boolean }
interface OrgEntry { sala: string; dedication: number; start_date: string; end_date: string }
interface TimeEntry { date: string; hours: number; sala: string }
interface AbsReq { type: string; date_from: string; date_to: string; days: number; status: string }

export function ConsultantProfilePage() {
  const { id } = useParams()
  const [member, setMember] = useState<MemberFull | null>(null)
  const [org, setOrg] = useState<OrgEntry[]>([])
  const [hours, setHours] = useState<TimeEntry[]>([])
  const [absences, setAbsences] = useState<AbsReq[]>([])
  const [rooms, setRooms] = useState<Array<{ slug: string; name: string }>>([])
  const [actionStats, setActionStats] = useState({ pending: 0, done: 0 })
  const [retroCount, setRetroCount] = useState(0)
  const [riskCount, setRiskCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const yr = new Date().getFullYear()
    Promise.all([
      supabase.from('team_members').select('*').eq('id', id).single(),
      supabase.from('org_chart').select('sala, dedication, start_date, end_date').eq('member_id', id),
      supabase.from('time_entries').select('date, hours, sala').eq('member_id', id).gte('date', `${yr}-01-01`),
      supabase.from('absence_requests').select('type, date_from, date_to, days, status').eq('member_id', id),
      supabase.from('rooms').select('slug, name'),
      supabase.from('retros').select('sala, data, status'),
    ]).then(([mR, oR, tR, aR, rR, retR]) => {
      if (mR.data) setMember(mR.data as unknown as MemberFull)
      if (oR.data) setOrg(oR.data as OrgEntry[])
      if (tR.data) setHours(tR.data as TimeEntry[])
      if (aR.data) setAbsences(aR.data as AbsReq[])
      if (rR.data) setRooms(rR.data)

      // Calc action stats and retro count
      let pending = 0, done = 0, retros = 0, risks = 0
      const mName = (mR.data as Record<string, unknown>)?.name as string
      ;(retR.data || []).forEach((r: { sala: string; data: Record<string, unknown>; status: string }) => {
        const acts = ((r.data?.actions || []) as Array<Record<string, unknown>>)
        pending += acts.filter(a => a.owner === mName && a.status !== 'done' && a.status !== 'archived' && a.status !== 'discarded').length
        done += acts.filter(a => a.owner === mName && (a.status === 'done' || a.status === 'archived')).length
        const rks = ((r.data?.risks || []) as Array<Record<string, unknown>>)
        risks += rks.filter(rk => rk.owner === mName && rk.status !== 'cerrado').length
        if (r.status === 'closed') retros++
      })
      setActionStats({ pending, done }); setRetroCount(retros); setRiskCount(risks)
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="text-sm text-revelio-subtle text-center py-20">Cargando ficha...</div>
  if (!member) return <div className="text-sm text-revelio-red text-center py-20">Persona no encontrada</div>

  const currentCost = (member.cost_rates || []).length > 0 ? [...member.cost_rates].sort((a, b) => b.from.localeCompare(a.from))[0]?.rate || 0 : 0
  const today = new Date().toISOString().slice(0, 10)
  const activeOrgs = org.filter(o => { const from = o.start_date || '2000-01-01'; const to = o.end_date || '2099-12-31'; return from <= today && to >= today })
    .filter(o => rooms.some(r => r.slug === o.sala)) // Only show rooms that exist in DB
  const totalDed = activeOrgs.reduce((s, o) => s + (o.dedication || 0), 0)
  const hoursThisYear = Math.round(hours.reduce((s, h) => s + h.hours, 0) * 10) / 10
  const approvedAbsDays = absences.filter(a => a.status === 'aprobada').reduce((s, a) => s + a.days, 0)

  // Intercontrato detection
  const isIntercontrato = activeOrgs.some(o => o.sala.toLowerCase().includes('intercontrato') || o.sala.toLowerCase() === 'ic')
  const daysSinceLastProject = (() => {
    const lastEnd = org.map(o => o.end_date).filter(Boolean).sort().reverse()[0]
    if (!lastEnd) return null
    return Math.round((Date.now() - new Date(lastEnd).getTime()) / 86400000)
  })()

  return (
    <div className="max-w-4xl mx-auto">
      <Link to="/admin" className="text-xs text-revelio-blue flex items-center gap-1 mb-4 hover:underline"><ChevronLeft className="w-3 h-3" /> Volver al CdC</Link>

      {/* Header */}
      <div className="rounded-2xl border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-6 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ background: (member.color || '#007AFF') + '20', color: member.color || '#007AFF' }}>{member.avatar || '👤'}</div>
          <div className="flex-1">
            <h1 className="text-xl font-bold dark:text-revelio-dark-text">{member.name}</h1>
            <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">{member.role_label || 'Sin rol'} · {member.company || 'ALTEN'} · {member.contract_type || 'indefinido'}</p>
            <div className="flex gap-3 mt-1 text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">
              {member.email && <span>{member.email}</span>}
              {member.hire_date && <span>Alta: {member.hire_date}</span>}
              {currentCost > 0 && <span>{currentCost}€/h</span>}
            </div>
          </div>
          {isIntercontrato && <div className="bg-revelio-red/10 border border-revelio-red/20 rounded-lg px-3 py-2 text-center"><AlertTriangle className="w-4 h-4 text-revelio-red mx-auto mb-0.5" /><p className="text-[9px] font-bold text-revelio-red">Intercontrato</p>{daysSinceLastProject !== null && <p className="text-[8px] text-revelio-subtle">{daysSinceLastProject}d sin proyecto</p>}</div>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {[
          { l: 'Dedicación', v: `${Math.round(totalDed * 100)}%`, c: totalDed > 1 ? '#FF3B30' : totalDed > 0 ? '#34C759' : '#8E8E93', I: Users },
          { l: 'Horas ' + new Date().getFullYear(), v: `${hoursThisYear}h`, c: '#007AFF', I: Clock },
          { l: 'Items pend.', v: actionStats.pending, c: actionStats.pending > 5 ? '#FF9500' : '#34C759', I: ListChecks },
          { l: 'Completados', v: actionStats.done, c: '#34C759', I: ListChecks },
          { l: 'Ausencias', v: `${approvedAbsDays}d`, c: '#5856D6', I: Calendar },
        ].map(s => (
          <div key={s.l} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3">
            <s.I className="w-3.5 h-3.5 mb-1" style={{ color: s.c }} />
            <p className="text-lg font-bold" style={{ color: s.c }}>{s.v}</p>
            <p className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle uppercase">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Projects with dedication bars */}
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
          <h4 className="text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-3">Proyectos asignados</h4>
          {org.length > 0 ? (
            <div className="space-y-2">
              {org.filter(o => rooms.some(r => r.slug === o.sala)).map((o, i) => {
                const rName = rooms.find(r => r.slug === o.sala)?.name || o.sala
                const pct = Math.round((o.dedication || 0) * 100)
                const colors = ['#007AFF', '#5856D6', '#FF9500', '#34C759', '#FF2D55']
                return (
                  <div key={i}>
                    <div className="flex justify-between text-[10px] mb-0.5"><span className="font-medium dark:text-revelio-dark-text">{rName}</span><span className="text-revelio-subtle">{pct}% · {o.start_date || '?'} → {o.end_date || 'actual'}</span></div>
                    <div className="h-2 bg-revelio-bg dark:bg-revelio-dark-border rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: colors[i % colors.length] }} /></div>
                  </div>
                )
              })}
              <div className="flex items-center gap-2 pt-2 border-t border-revelio-border/30 dark:border-revelio-dark-border/30"><span className="text-[10px] text-revelio-subtle">Total:</span><span className={`text-[10px] font-bold ${totalDed > 1 ? 'text-revelio-red' : 'text-revelio-green'}`}>{Math.round(totalDed * 100)}%</span></div>
            </div>
          ) : <p className="text-[10px] text-revelio-subtle text-center py-3">Sin proyectos asignados</p>}
        </div>

        {/* Absences */}
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
          <h4 className="text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-3">Ausencias</h4>
          {absences.length > 0 ? (
            <div className="space-y-1">{absences.map((a, i) => (
              <div key={i} className="flex items-center gap-2 py-1"><span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${a.status === 'aprobada' ? 'bg-revelio-green/10 text-revelio-green' : a.status === 'rechazada' ? 'bg-revelio-red/10 text-revelio-red' : 'bg-revelio-orange/10 text-revelio-orange'}`}>{a.status.charAt(0).toUpperCase()}</span><span className="text-[10px] dark:text-revelio-dark-text">{a.type}</span><span className="text-[9px] text-revelio-subtle">{a.date_from} → {a.date_to} ({a.days}d)</span></div>
            ))}</div>
          ) : <p className="text-[10px] text-revelio-subtle text-center py-3">Sin ausencias registradas</p>}
        </div>

        {/* Hours by project this year */}
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
          <h4 className="text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-3">Horas {new Date().getFullYear()} por proyecto</h4>
          {(() => {
            const bySala: Record<string, number> = {}
            hours.forEach(h => { bySala[h.sala] = (bySala[h.sala] || 0) + h.hours })
            const entries = Object.entries(bySala).sort((a, b) => b[1] - a[1])
            if (entries.length === 0) return <p className="text-[10px] text-revelio-subtle text-center py-3">Sin horas registradas</p>
            return <div className="space-y-1">{entries.map(([sala, h]) => <div key={sala} className="flex justify-between text-[10px]"><span className="dark:text-revelio-dark-text">{rooms.find(r => r.slug === sala)?.name || sala}</span><span className="font-bold text-revelio-blue">{Math.round(h * 10) / 10}h</span></div>)}</div>
          })()}
        </div>

        {/* Activity summary */}
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
          <h4 className="text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-3">Actividad</h4>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div><p className="text-lg font-bold text-revelio-blue">{actionStats.pending}</p><p className="text-[8px] text-revelio-subtle uppercase">Items pendientes</p></div>
            <div><p className="text-lg font-bold text-revelio-green">{actionStats.done}</p><p className="text-[8px] text-revelio-subtle uppercase">Completados</p></div>
            <div><p className="text-lg font-bold text-revelio-orange">{riskCount}</p><p className="text-[8px] text-revelio-subtle uppercase">Riesgos asignados</p></div>
            <div><p className="text-lg font-bold text-revelio-violet">{retroCount}</p><p className="text-[8px] text-revelio-subtle uppercase">Retros cerradas</p></div>
          </div>
        </div>
      </div>
    </div>
  )
}
