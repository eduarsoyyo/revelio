import { useEffect, useState, useMemo } from 'react'
import { ChevronRight, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { IntelligencePanel } from '@/components/common/IntelligencePanel'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/data/supabase'
import type { Room, Member } from '@/types'

interface RetroData { actions?: Array<Record<string, unknown>>; risks?: Array<Record<string, unknown>> }

export function ProjectsOverview() {
  const { user } = useAuth()
  const [rooms, setRooms] = useState<Room[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [retroData, setRetroData] = useState<Record<string, RetroData>>({})
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('active')
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    Promise.all([
      supabase.from('rooms').select('*').order('name'),
      supabase.from('team_members').select('*').order('name'),
      supabase.from('retros').select('sala, data').eq('status', 'active'),
    ]).then(([rR, mR, retR]) => {
      if (rR.data) setRooms(rR.data)
      if (mR.data) setMembers(mR.data)
      const rd: Record<string, RetroData> = {}
      ;(retR.data || []).forEach((r: { sala: string; data: Record<string, unknown> }) => { rd[r.sala] = { actions: (r.data?.actions || []) as Array<Record<string, unknown>>, risks: (r.data?.risks || []) as Array<Record<string, unknown>> } })
      setRetroData(rd); setLoading(false)
    })
  }, [])

  const rx = (r: Room) => r as unknown as Record<string, unknown>
  const visibleRooms = useMemo(() => {
    let list = user?.is_superuser ? rooms : rooms.filter(r => (user?.rooms || []).includes(r.slug))
    if (filter === 'active') list = list.filter(r => (rx(r).status as string) !== 'closed')
    if (filter === 'closed') list = list.filter(r => (rx(r).status as string) === 'closed')
    return list
  }, [rooms, user, filter])

  // Global donut data
  const globalStats = useMemo(() => {
    let done = 0, pending = 0, blocked = 0, overdue = 0
    Object.values(retroData).forEach(d => {
      const acts = (d.actions || []).filter(a => (a.status as string) !== 'discarded')
      done += acts.filter(a => a.status === 'done' || a.status === 'archived').length
      blocked += acts.filter(a => a.status === 'blocked').length
      overdue += acts.filter(a => a.date && (a.date as string) < today && a.status !== 'done' && a.status !== 'archived').length
      pending += acts.filter(a => a.status !== 'done' && a.status !== 'archived' && a.status !== 'blocked').length
    })
    return { done, pending, blocked, overdue, total: done + pending + blocked }
  }, [retroData, today])

  if (loading) return <div className="text-sm text-revelio-subtle text-center py-20">Cargando...</div>

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-revelio-text dark:text-revelio-dark-text">Proyectos</h2>
        <div className="flex gap-0.5 bg-revelio-bg dark:bg-revelio-dark-border rounded-lg overflow-hidden">
          {(['active', 'closed', 'all'] as const).map(f => <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 text-[10px] font-semibold capitalize ${filter === f ? 'bg-revelio-blue text-white' : 'text-revelio-subtle'}`}>{f === 'active' ? 'Activos' : f === 'closed' ? 'Cerrados' : 'Todos'}</button>)}
        </div>
      </div>

      {/* Donut + stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4 flex items-center gap-4">
          <Donut done={globalStats.done} pending={globalStats.pending} blocked={globalStats.blocked} />
          <div className="text-[10px] space-y-1">
            <p><span className="inline-block w-2 h-2 rounded-full bg-revelio-green mr-1" />{globalStats.done} completados</p>
            <p><span className="inline-block w-2 h-2 rounded-full bg-revelio-blue mr-1" />{globalStats.pending} pendientes</p>
            <p><span className="inline-block w-2 h-2 rounded-full bg-revelio-red mr-1" />{globalStats.blocked} bloqueados</p>
          </div>
        </div>
        <div className="sm:col-span-2 rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
          <p className="text-[10px] font-semibold text-revelio-subtle uppercase mb-2">Resumen global</p>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div><p className="text-lg font-bold text-revelio-blue">{visibleRooms.length}</p><p className="text-[8px] text-revelio-subtle uppercase">Proyectos</p></div>
            <div><p className="text-lg font-bold text-revelio-green">{globalStats.done}</p><p className="text-[8px] text-revelio-subtle uppercase">Completados</p></div>
            <div><p className="text-lg font-bold text-revelio-red">{globalStats.overdue}</p><p className="text-[8px] text-revelio-subtle uppercase">Vencidos</p></div>
            <div><p className="text-lg font-bold text-revelio-violet">{members.length}</p><p className="text-[8px] text-revelio-subtle uppercase">Personas</p></div>
          </div>
        </div>
      </div>

      {/* Project cards */}
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        {visibleRooms.map(room => {
          const d = retroData[room.slug] || { actions: [], risks: [] }
          const acts = (d.actions || []).filter(a => (a.status as string) !== 'discarded')
          const done = acts.filter(a => a.status === 'done' || a.status === 'archived').length
          const pct = acts.length > 0 ? Math.round(done / acts.length * 100) : 0
          const ov = acts.filter(a => a.date && (a.date as string) < today && a.status !== 'done' && a.status !== 'archived').length
          const rk = (d.risks || []).filter(r => (r.status as string) !== 'cerrado').length
          const tc = members.filter(m => (m.rooms || []).includes(room.slug)).length
          const health = Math.max(0, Math.min(100, 100 - ov * 3 - rk * 2))
          const hc = health >= 75 ? '#34C759' : health >= 50 ? '#FF9500' : '#FF3B30'
          return (
            <Link key={room.slug} to={`/project/${room.slug}`} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4 hover:shadow-md hover:border-revelio-blue/30 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="relative w-10 h-10 flex-shrink-0"><svg viewBox="0 0 36 36" className="w-full h-full -rotate-90"><circle cx="18" cy="18" r="15" fill="none" stroke="#F2F2F7" strokeWidth="2.5" className="dark:stroke-[#3A3A3C]" /><circle cx="18" cy="18" r="15" fill="none" stroke={hc} strokeWidth="2.5" strokeDasharray={`${health} ${100 - health}`} strokeLinecap="round" /></svg><span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold" style={{ color: hc }}>{health}</span></div>
                <div className="flex-1"><p className="text-sm font-semibold dark:text-revelio-dark-text">{room.name}</p><p className="text-[9px] text-revelio-subtle capitalize">{room.tipo}</p></div>
                <ChevronRight className="w-4 h-4 text-revelio-border" />
              </div>
              <div className="flex gap-3 text-[9px] text-revelio-subtle">
                <span className={pct >= 70 ? 'text-revelio-green' : ''}>{pct}% hecho</span>
                <span><Users className="w-2.5 h-2.5 inline" /> {tc}</span>
                {ov > 0 && <span className="text-revelio-red">{ov} vencidos</span>}
                {rk > 0 && <span className="text-revelio-orange">{rk} riesgos</span>}
              </div>
            </Link>
          )
        })}
      </div>

      {/* Intelligence */}
      <IntelligencePanel userId={user?.id} />
    </div>
  )
}

function Donut({ done, pending, blocked }: { done: number; pending: number; blocked: number }) {
  const total = done + pending + blocked || 1
  const r = 15; const c = 2 * Math.PI * r
  const s1 = (done / total) * c; const s2 = (pending / total) * c; const s3 = (blocked / total) * c
  return (
    <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#34C759" strokeWidth="4" strokeDasharray={`${s1} ${c - s1}`} strokeDashoffset="0" />
      <circle cx="18" cy="18" r={r} fill="none" stroke="#007AFF" strokeWidth="4" strokeDasharray={`${s2} ${c - s2}`} strokeDashoffset={`${-s1}`} />
      <circle cx="18" cy="18" r={r} fill="none" stroke="#FF3B30" strokeWidth="4" strokeDasharray={`${s3} ${c - s3}`} strokeDashoffset={`${-s1 - s2}`} />
    </svg>
  )
}
