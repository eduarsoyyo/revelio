import { useEffect, useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/data/supabase'
import type { Member } from '@/types'

interface OrgEntry { member_id: string; sala: string; dedication: number; start_date: string; end_date: string }

const COLORS = ['#007AFF', '#5856D6', '#FF9500', '#34C759', '#FF2D55', '#AF52DE', '#00C7BE', '#FF3B30']

export function PeopleTimeline() {
  const [members, setMembers] = useState<Member[]>([])
  const [org, setOrg] = useState<OrgEntry[]>([])
  const [rooms, setRooms] = useState<Array<{ slug: string; name: string }>>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('team_members').select('*').order('name'),
      supabase.from('org_chart').select('*'),
      supabase.from('rooms').select('slug, name').order('name'),
    ]).then(([mR, oR, rR]) => {
      if (mR.data) setMembers(mR.data)
      if (oR.data) setOrg(oR.data as OrgEntry[])
      if (rR.data) setRooms(rR.data)
      setLoading(false)
    })
  }, [])

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(year, i, 1)
      return { idx: i, label: d.toLocaleDateString('es-ES', { month: 'short' }), start: `${year}-${String(i + 1).padStart(2, '0')}-01`, end: new Date(year, i + 1, 0).toISOString().slice(0, 10) }
    })
  }, [year])

  const roomColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    rooms.forEach((r, i) => { map[r.slug] = COLORS[i % COLORS.length]! })
    return map
  }, [rooms])

  // For each member, calculate blocks per month
  const rows = useMemo(() => {
    return members.filter(m => !m.is_superuser).map(m => {
      const myOrg = org.filter(o => o.member_id === m.id && rooms.some(r => r.slug === o.sala))
      const monthBlocks = months.map(mo => {
        // Which projects overlap this month?
        const active = myOrg.filter(o => {
          const oStart = o.start_date || '2000-01-01'
          const oEnd = o.end_date || '2099-12-31'
          return oStart <= mo.end && oEnd >= mo.start
        })
        return active.map(o => ({
          sala: o.sala,
          name: rooms.find(r => r.slug === o.sala)?.name || o.sala,
          dedication: o.dedication,
          color: roomColorMap[o.sala] || '#8E8E93',
        }))
      })
      const today = new Date().toISOString().slice(0, 10)
      const activeNow = myOrg.filter(o => { const s = o.start_date || '2000-01-01'; const e = o.end_date || '2099-12-31'; return s <= today && e >= today })
      const totalDed = activeNow.reduce((s, o) => s + (o.dedication || 0), 0)
      return { member: m, monthBlocks, totalDed }
    })
  }, [members, org, months, rooms, roomColorMap])

  if (loading) return <div className="text-sm text-revelio-subtle text-center py-10">Cargando timeline...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-revelio-text dark:text-revelio-dark-text flex items-center gap-1"><Users className="w-4 h-4 text-revelio-violet" /> Timeline de personas</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setYear(y => y - 1)} className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center"><ChevronLeft className="w-3 h-3" /></button>
          <span className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text w-12 text-center">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center"><ChevronRight className="w-3 h-3" /></button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-2 flex-wrap mb-3">
        {rooms.map(r => <span key={r.slug} className="flex items-center gap-1 text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle"><div className="w-2 h-2 rounded-sm" style={{ background: roomColorMap[r.slug] }} />{r.name}</span>)}
        <span className="flex items-center gap-1 text-[8px] text-revelio-subtle"><div className="w-2 h-2 rounded-sm bg-revelio-bg dark:bg-revelio-dark-border border border-dashed border-revelio-red/30" />Sin asignar</span>
      </div>

      <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card overflow-x-auto">
        <table className="w-full text-[9px]">
          <thead>
            <tr className="bg-revelio-bg dark:bg-revelio-dark-border">
              <th className="px-2 py-2 text-left font-semibold text-revelio-subtle dark:text-revelio-dark-subtle sticky left-0 bg-revelio-bg dark:bg-revelio-dark-border z-10 min-w-[120px]">Persona</th>
              {months.map(mo => <th key={mo.idx} className="px-1 py-2 text-center font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase w-[60px]">{mo.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ member: m, monthBlocks, totalDed }) => (
              <tr key={m.id} className="border-t border-revelio-border/30 dark:border-revelio-dark-border/30">
                <td className="px-2 py-1.5 sticky left-0 bg-white dark:bg-revelio-dark-card z-10">
                  <Link to={`/persona/${m.id}`} className="flex items-center gap-1.5 hover:text-revelio-blue">
                    <span style={{ color: m.color }}>{m.avatar || '·'}</span>
                    <div>
                      <p className="font-medium dark:text-revelio-dark-text">{m.name.split(' ')[0]}</p>
                      <p className="text-[7px] text-revelio-subtle">{m.role_label} · {Math.round(totalDed * 100)}%</p>
                    </div>
                  </Link>
                </td>
                {monthBlocks.map((blocks, mi) => (
                  <td key={mi} className="px-0.5 py-1">
                    {blocks.length > 0 ? (
                      <div className="flex flex-col gap-px">
                        {blocks.map((b, bi) => (
                          <div key={bi} className="h-3 rounded-sm flex items-center justify-center" style={{ background: b.color, opacity: Math.max(0.3, b.dedication) }} title={`${b.name}: ${Math.round(b.dedication * 100)}%`}>
                            <span className="text-[6px] text-white font-bold truncate px-0.5">{Math.round(b.dedication * 100)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-3 rounded-sm border border-dashed border-revelio-red/20 bg-revelio-red/5" title="Sin asignar" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
