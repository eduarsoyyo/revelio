import { useEffect, useState, useMemo } from 'react'
import { AlertTriangle, CheckCircle2, Grid3X3, Users, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '@/data/supabase'
import type { Member, Room } from '@/types'

const MO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MONTHLY_HOURS = 176

interface OrgEntry { member_id: string; sala: string; dedication: number; start_date: string; end_date: string }

function dedForMonth(entries: OrgEntry[], sala: string, yr: number, month: number): number {
  const pe = entries.filter(e => e.sala === sala)
  if (pe.length === 0) return 0
  if (pe.length === 1 && !pe[0]!.start_date && !pe[0]!.end_date) return pe[0]!.dedication
  const dim = new Date(yr, month + 1, 0).getDate()
  let total = 0, bd = 0
  for (let d = 1; d <= dim; d++) {
    const dt = new Date(yr, month, d); if (dt.getDay() === 0 || dt.getDay() === 6) continue; bd++
    const ds = dt.toISOString().slice(0, 10)
    for (const p of pe) { const s = p.start_date || '2000-01-01'; const e = p.end_date || '2099-12-31'; if (ds >= s && ds <= e) { total += p.dedication; break } }
  }
  return bd > 0 ? total / bd : 0
}

export function CrossProjectPanel() {
  const [members, setMembers] = useState<Member[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [orgData, setOrgData] = useState<OrgEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [matrixMode, setMatrixMode] = useState<'pct' | 'fte' | 'hours'>('pct')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const yr = new Date().getFullYear()
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    Promise.all([
      supabase.from('team_members').select('*').order('name'),
      supabase.from('rooms').select('*').order('name'),
      supabase.from('org_chart').select('member_id, sala, dedication, start_date, end_date'),
    ]).then(([mR, rR, oR]) => {
      if (mR.data) setMembers(mR.data)
      if (rR.data) setRooms(rR.data)
      if (oR.data) setOrgData(oR.data.map((o: Record<string, unknown>) => ({ member_id: o.member_id as string, sala: o.sala as string, dedication: (o.dedication as number) || 0, start_date: (o.start_date as string) || '', end_date: (o.end_date as string) || '' })))
      setLoading(false)
    })
  }, [])

  // Build member-project matrix — only active assignments
  const memberProjects = useMemo(() => {
    return members.filter(m => !m.is_superuser).map(m => {
      const myActive = orgData.filter(o => o.member_id === m.id && rooms.some(r => r.slug === o.sala) && (() => { const s = o.start_date || '2000-01-01'; const ed = o.end_date || '2099-12-31'; return today >= s && today <= ed })())
      const projects = rooms.map(room => {
        const ded = myActive.filter(o => o.sala === room.slug).reduce((s, e) => s + e.dedication, 0)
        return { sala: room.slug, name: room.name, dedication: ded }
      }).filter(p => p.dedication > 0)
      const total = projects.reduce((s, p) => s + p.dedication, 0)
      return { member: m, projects, total }
    })
  }, [members, rooms, orgData, today])

  const overloads = memberProjects.filter(mp => mp.total > 1.05)
  const allProjectSlugs = [...new Set(memberProjects.flatMap(mp => mp.projects.map(p => p.sala)))]

  const fmtVal = (ded: number) => {
    if (matrixMode === 'pct') return `${Math.round(ded * 100)}%`
    if (matrixMode === 'fte') return ded.toFixed(2)
    return `${Math.round(ded * MONTHLY_HOURS)}h`
  }

  // Consultant view
  const consultants = useMemo(() => {
    return members.filter(m => (m.rooms || []).length > 0).map(m => {
      const allEntries = orgData.filter(o => o.member_id === m.id && rooms.some(r => r.slug === o.sala))
      const activeEntries = allEntries.filter(e => { const st = e.start_date || '2000-01-01'; const en = e.end_date || '2099-12-31'; return today >= st && today <= en })
      const uniqueSalas = [...new Set(activeEntries.map(e => e.sala))]
      const todayDed = activeEntries.reduce((s, e) => s + (e.dedication || 0), 0)
      const icDed = activeEntries.filter(e => e.sala.toLowerCase().includes('intercontrato') || e.sala.toLowerCase() === 'ic').reduce((s, e) => s + (e.dedication || 0), 0)
      const unassigned = Math.max(0, 1 - todayDed)
      return { member: m, entries: activeEntries, uniqueSalas, todayDed, ic: icDed, unassigned }
    })
  }, [members, orgData, today])

  if (loading) return <div className="text-sm text-revelio-subtle dark:text-revelio-dark-subtle text-center py-10">Cargando cross-proyecto...</div>

  return (
    <div className="max-w-6xl">
      <h2 className="text-lg font-semibold text-revelio-text dark:text-revelio-dark-text mb-1">Cross-proyecto</h2>
      <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mb-5">Alertas de sobrecarga y asignación cruzada</p>

      {/* Overload alerts */}
      {overloads.length > 0 ? (
        <div className="rounded-card border border-revelio-red/20 bg-revelio-red/5 p-4 mb-5">
          <div className="flex items-center gap-2 mb-3"><AlertTriangle className="w-4 h-4 text-revelio-red" /><span className="text-sm font-semibold text-revelio-red">Sobrecarga detectada ({overloads.length})</span></div>
          {overloads.map(o => (
            <div key={o.member.id} className="bg-white dark:bg-revelio-dark-card rounded-lg px-3 py-2.5 mb-1.5 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: o.member.color || '#007AFF' }}>{o.member.avatar || '👤'}</div>
              <div className="flex-1"><p className="text-xs font-semibold">{o.member.name}</p><p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">{o.projects.map(p => `${p.name} (${Math.round(p.dedication * 100)}%)`).join(' + ')}</p></div>
              <span className={`text-base font-bold ${o.total > 1.2 ? 'text-revelio-red' : 'text-revelio-orange'}`}>{Math.round(o.total * 100)}%</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-card border border-revelio-green/20 bg-revelio-green/5 p-4 mb-5 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-revelio-green" /><span className="text-xs font-medium text-revelio-green">Sin sobrecargas — equipo equilibrado</span>
        </div>
      )}

      {/* Resource matrix */}
      <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4 mb-5 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Grid3X3 className="w-4 h-4 text-revelio-violet" /><span className="text-sm font-semibold">Matriz de asignación</span></div>
          <div className="flex bg-revelio-bg dark:bg-revelio-dark-border rounded-lg overflow-hidden">
            {([['pct', '%'], ['fte', 'FTEs'], ['hours', 'Horas']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setMatrixMode(k)} className={`px-2.5 py-1 text-[10px] font-semibold ${matrixMode === k ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}>{l}</button>
            ))}
          </div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-revelio-bg dark:bg-revelio-dark-border"><th className="px-2 py-1.5 text-left text-[9px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle">Persona</th>
              {allProjectSlugs.map(s => <th key={s} className="px-1.5 py-1.5 text-center text-[9px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle">{rooms.find(r => r.slug === s)?.name || s}</th>)}
              <th className="px-2 py-1.5 text-center text-[9px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle">Total</th>
            </tr>
          </thead>
          <tbody>
            {memberProjects.map((mp, i) => (
              <tr key={mp.member.id} className={`${mp.total > 1.05 ? 'bg-revelio-red/5' : i % 2 ? 'bg-revelio-bg dark:bg-revelio-dark-border/30' : ''}`}>
                <td className="px-2 py-1.5 font-medium whitespace-nowrap"><span className="mr-1.5">{mp.member.avatar || '👤'}</span>{mp.member.name}</td>
                {allProjectSlugs.map(sala => { const p = mp.projects.find(x => x.sala === sala); const d = p ? p.dedication : 0; return (
                  <td key={sala} className="px-1.5 py-1.5 text-center">{d > 0 ? <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${d >= 1 ? 'bg-revelio-blue/15 text-revelio-blue' : d >= 0.5 ? 'bg-revelio-green/15 text-revelio-green' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}>{fmtVal(d)}</span> : <span className="text-revelio-border">—</span>}</td>
                )})}
                <td className={`px-2 py-1.5 text-center font-bold ${mp.total > 1.05 ? 'text-revelio-red' : mp.total >= 1 ? 'text-revelio-green' : 'text-revelio-orange'}`}>{fmtVal(mp.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Consultant view */}
      <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
        <div className="flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-revelio-blue" /><span className="text-sm font-semibold">Vista por consultor — {yr}</span></div>
        {consultants.map(c => {
          const isOpen = expanded.has(c.member.id)
          const icPct = Math.round(c.ic * 100)
          return (
            <div key={c.member.id} className="mb-1">
              <button onClick={() => { const s = new Set(expanded); isOpen ? s.delete(c.member.id) : s.add(c.member.id); setExpanded(s) }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isOpen ? 'bg-revelio-blue/5 border border-revelio-blue/20' : 'hover:bg-revelio-bg dark:hover:bg-revelio-dark-border dark:bg-revelio-dark-border'}`}>
                {isOpen ? <ChevronDown className="w-3 h-3 text-revelio-subtle dark:text-revelio-dark-subtle" /> : <ChevronRight className="w-3 h-3 text-revelio-subtle dark:text-revelio-dark-subtle" />}
                <span className="text-sm">{c.member.avatar || '👤'}</span>
                <span className="text-xs font-semibold flex-1 text-left">{c.member.name}</span>
                <span className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">{c.member.role_label}</span>
                <span className={`text-xs font-bold ${c.todayDed >= 1 ? 'text-revelio-green' : c.todayDed > 0 ? 'text-revelio-blue' : 'text-revelio-red'}`}>{Math.round(c.todayDed * 100)}%</span>
                {icPct > 0 && <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${icPct > 50 ? 'bg-revelio-red/10 text-revelio-red' : 'bg-revelio-orange/10 text-revelio-orange'}`}>IC {icPct}%</span>}
                {Math.round(c.unassigned * 100) > 0 && <span className="text-[9px] text-revelio-subtle">({Math.round(c.unassigned * 100)}% sin asignar)</span>}
              </button>
              {isOpen && (
                <div className="px-8 py-2 overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead><tr>
                      <th className="text-left py-1 text-revelio-subtle dark:text-revelio-dark-subtle font-semibold">Proyecto</th>
                      {MO.map((m, i) => <th key={m} className={`text-center py-1 font-semibold ${i === new Date().getMonth() ? 'text-revelio-blue' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}>{m}</th>)}
                      <th className="text-center py-1 font-semibold text-revelio-text dark:text-revelio-dark-text">Anual</th>
                    </tr></thead>
                    <tbody>
                      {c.uniqueSalas.map(sala => {
                        const name = rooms.find(r => r.slug === sala)?.name || sala
                        const monthly = MO.map((_, mi) => dedForMonth(c.entries, sala, yr, mi))
                        const annual = monthly.reduce((s, v) => s + v, 0) / 12
                        return (
                          <tr key={sala}><td className="py-1 text-revelio-blue font-medium">{name}</td>
                            {monthly.map((v, mi) => { const pct = Math.round(v * 100); return <td key={mi} className={`text-center py-1 ${mi === new Date().getMonth() ? 'bg-revelio-blue/5' : ''}`}>{pct > 0 ? <span className={`font-semibold ${pct >= 100 ? 'text-revelio-blue' : pct >= 50 ? 'text-revelio-green' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}>{pct}%</span> : <span className="text-revelio-border">—</span>}</td> })}
                            <td className="text-center py-1 font-bold text-revelio-violet">{Math.round(annual * 100)}%</td>
                          </tr>
                        )
                      })}
                      <tr className="bg-revelio-bg dark:bg-revelio-dark-border/50"><td className="py-1 font-bold">Total</td>
                        {MO.map((_, mi) => { const t = c.uniqueSalas.reduce((s, sala) => s + dedForMonth(c.entries, sala, yr, mi), 0); const pct = Math.round(t * 100); return <td key={mi} className={`text-center py-1 font-bold ${pct > 100 ? 'text-revelio-red' : pct === 100 ? 'text-revelio-green' : 'text-revelio-orange'}`}>{pct}%</td> })}
                        <td className="text-center py-1 font-bold text-revelio-text dark:text-revelio-dark-text">{Math.round(c.uniqueSalas.reduce((s, sala) => s + MO.reduce((sm, _, mi) => sm + dedForMonth(c.entries, sala, yr, mi), 0) / 12, 0) * 100)}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
