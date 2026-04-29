import { useEffect, useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/data/supabase'
import type { Member } from '@/types'

interface OrgEntry { member_id: string; sala: string; dedication: number; start_date?: string; end_date?: string }

export function TeamOverview() {
  const { } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [org, setOrg] = useState<OrgEntry[]>([])
  const [rooms, setRooms] = useState<Array<{ slug: string; name: string }>>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('team_members').select('*').order('name'),
      supabase.from('org_chart').select('member_id, sala, dedication, start_date, end_date'),
      supabase.from('rooms').select('slug, name'),
    ]).then(([mR, oR, rR]) => {
      if (mR.data) setMembers(mR.data)
      if (oR.data) setOrg(oR.data as OrgEntry[])
      if (rR.data) setRooms(rR.data)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return members.filter(m => m.name.toLowerCase().includes(q) || (m.role_label || '').toLowerCase().includes(q))
  }, [members, search])

  // Stats
  const dedStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    let over = 0, under = 0, ok = 0, ic = 0
    members.forEach(m => {
      if (m.is_superuser) return
      const myOrg = org.filter(o => o.member_id === m.id && (o.start_date || '2000-01-01') <= today && (o.end_date || '2099-12-31') >= today && rooms.some(r => r.slug === o.sala))
      const ded = myOrg.reduce((s, o) => s + (o.dedication || 0), 0)
      const isIC = myOrg.some(o => o.sala.toLowerCase().includes('intercontrato') || o.sala.toLowerCase() === 'ic')
      if (isIC) ic++
      else if (ded > 1.05) over++
      else if (ded < 0.5 && ded > 0) under++
      else ok++
    })
    return { over, under, ok, ic }
  }, [members, org])

  if (loading) return <div className="text-sm text-revelio-subtle text-center py-20">Cargando equipo...</div>

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-revelio-text dark:text-revelio-dark-text">Equipo ({members.length})</h2>
        <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-revelio-subtle" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-8 pr-3 py-1.5 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs outline-none w-40 dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
      </div>

      {/* Donut + stats */}
      <div className="grid sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3 text-center"><p className="text-lg font-bold text-revelio-green">{dedStats.ok}</p><p className="text-[8px] text-revelio-subtle uppercase">OK</p></div>
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3 text-center"><p className="text-lg font-bold text-revelio-red">{dedStats.over}</p><p className="text-[8px] text-revelio-subtle uppercase">Sobreasignados</p></div>
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3 text-center"><p className="text-lg font-bold text-revelio-orange">{dedStats.under}</p><p className="text-[8px] text-revelio-subtle uppercase">Infrautilizados</p></div>
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3 text-center"><p className="text-lg font-bold text-[#8E8E93]">{dedStats.ic}</p><p className="text-[8px] text-revelio-subtle uppercase">Intercontrato</p></div>
      </div>

      {/* Team grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {filtered.map(m => {
          const today = new Date().toISOString().slice(0, 10)
          const myOrg = org.filter(o => o.member_id === m.id && (o.start_date || '2000-01-01') <= today && (o.end_date || '2099-12-31') >= today && rooms.some(r => r.slug === o.sala))
          const totalDed = myOrg.reduce((s, o) => s + (o.dedication || 0), 0)
          const pct = Math.round(totalDed * 100)
          const barColor = pct > 100 ? '#FF3B30' : pct === 0 ? '#C7C7CC' : pct < 50 ? '#FF9500' : '#34C759'
          return (
            <Link key={m.id} to={`/persona/${m.id}`} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3 hover:shadow-md hover:border-revelio-blue/30 transition-all">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="text-xl" style={{ color: m.color }}>{m.avatar || '👤'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold dark:text-revelio-dark-text truncate">{m.name}</p>
                  <p className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle">{m.role_label || 'Sin rol'}</p>
                </div>
                {myOrg.some(o => o.sala.toLowerCase().includes('intercontrato') || o.sala.toLowerCase() === 'ic') && <span className="text-[7px] font-bold text-revelio-red bg-revelio-red/10 px-1.5 py-0.5 rounded flex-shrink-0">IC</span>}
              </div>
              {/* Dedication bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-revelio-bg dark:bg-revelio-dark-border rounded-full overflow-hidden flex">
                  {myOrg.map((o, i) => {
                    const w = Math.round((o.dedication || 0) * 100)
                    const colors = ['#007AFF', '#5856D6', '#FF9500', '#34C759', '#FF2D55']
                    return <div key={i} className="h-full" style={{ width: `${w}%`, background: colors[i % colors.length] }} title={`${rooms.find(r => r.slug === o.sala)?.name}: ${w}%`} />
                  })}
                </div>
                <span className="text-[9px] font-bold w-8 text-right" style={{ color: barColor }}>{pct}%</span>
              </div>
              {myOrg.length > 0 && <div className="flex gap-1 mt-1.5 flex-wrap">{myOrg.map((o, i) => <span key={i} className="text-[7px] text-revelio-subtle dark:text-revelio-dark-subtle">{rooms.find(r => r.slug === o.sala)?.name || o.sala}</span>)}</div>}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
