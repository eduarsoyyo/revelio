import { useEffect, useState, useMemo } from 'react'
import { GitBranch, ChevronDown, ChevronRight } from 'lucide-react'
import { supabase } from '@/data/supabase'
import type { Room, Member } from '@/types'

interface OrgEntry { id: string; sala: string; member_id: string; manager_id: string | null; dedication: number }

export function OrgChartPanel() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [orgData, setOrgData] = useState<OrgEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRoom, setSelectedRoom] = useState<string>('')

  useEffect(() => {
    Promise.all([
      supabase.from('rooms').select('*').order('name'),
      supabase.from('team_members').select('*').order('name'),
      supabase.from('org_chart').select('id, sala, member_id, manager_id, dedication'),
    ]).then(([rR, mR, oR]) => {
      if (rR.data) setRooms(rR.data)
      if (mR.data) setMembers(mR.data)
      if (oR.data) setOrgData(oR.data as OrgEntry[])
      setLoading(false)
    })
  }, [])

  const visibleRooms = useMemo(() => selectedRoom ? rooms.filter(r => r.slug === selectedRoom) : rooms, [rooms, selectedRoom])

  if (loading) return <div className="text-sm text-revelio-subtle dark:text-revelio-dark-subtle text-center py-10">Cargando organigrama...</div>

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-revelio-text dark:text-revelio-dark-text flex items-center gap-2"><GitBranch className="w-5 h-5 text-revelio-violet" /> Organigrama</h2>
          <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">Estructura jerárquica por proyecto</p>
        </div>
        <select value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2.5 py-1.5 text-xs outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text">
          <option value="">Todos los proyectos</option>
          {rooms.map(r => <option key={r.slug} value={r.slug}>{r.name}</option>)}
        </select>
      </div>

      {visibleRooms.map(room => {
        const roomOrg = orgData.filter(o => o.sala === room.slug)
        const roomMembers = members.filter(m => (m.rooms || []).includes(room.slug))
        const orgMap: Record<string, string | null> = {}
        roomOrg.forEach(o => { orgMap[o.member_id] = o.manager_id })

        // Find roots (no manager or manager not in org)
        const roots = roomMembers.filter(m => {
          const mgr = orgMap[m.id]
          return mgr === null || mgr === undefined || !roomMembers.find(x => x.id === mgr)
        })

        const unassigned = roomMembers.filter(m => !Object.keys(orgMap).includes(m.id))

        return (
          <div key={room.slug} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-5 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-revelio-violet/10 flex items-center justify-center"><GitBranch className="w-4 h-4 text-revelio-violet" /></div>
              <div>
                <h3 className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text">{room.name}</h3>
                <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">{roomMembers.length} personas · {roomOrg.length} en organigrama</p>
              </div>
            </div>

            {roots.length > 0 ? (
              <div className="flex flex-col items-center gap-1">
                {roots.map(root => (
                  <OrgNode key={root.id} member={root} members={roomMembers} orgMap={orgMap} orgData={roomOrg} depth={0} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle text-center py-4">Sin organigrama configurado</p>
            )}

            {unassigned.length > 0 && (
              <div className="mt-4 pt-3 border-t border-revelio-border dark:border-revelio-dark-border">
                <p className="text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-2">Sin asignar ({unassigned.length})</p>
                <div className="flex gap-1.5 flex-wrap">
                  {unassigned.map(m => (
                    <span key={m.id} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-revelio-bg dark:bg-revelio-dark-border text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">
                      <span className="text-xs">{m.avatar || '👤'}</span> {m.name.split(' ')[0]}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}

      {rooms.length === 0 && (
        <div className="text-center py-16"><GitBranch className="w-10 h-10 text-revelio-border mx-auto mb-2" /><p className="text-sm text-revelio-subtle dark:text-revelio-dark-subtle">Sin proyectos</p></div>
      )}
    </div>
  )
}

function OrgNode({ member, members, orgMap, orgData, depth }: { member: Member; members: Member[]; orgMap: Record<string, string | null>; orgData: OrgEntry[]; depth: number }) {
  const [open, setOpen] = useState(depth < 2)
  const children = members.filter(m => orgMap[m.id] === member.id)
  const entry = orgData.find(o => o.member_id === member.id)
  const ded = entry ? Math.round(entry.dedication * 100) : null

  return (
    <div className="flex flex-col items-center">
      {depth > 0 && <div className="w-0.5 h-4 bg-revelio-border" />}
      <button onClick={() => children.length > 0 && setOpen(!open)}
        className={`rounded-xl border px-4 py-2.5 text-center min-w-[120px] transition-all ${depth === 0 ? 'border-revelio-text bg-revelio-text/5 border-2' : 'border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card hover:border-revelio-blue/30'}`}>
        <div className="flex items-center justify-center gap-1.5 mb-0.5">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs" style={{ background: member.color || '#007AFF' }}>{member.avatar || '👤'}</div>
          {children.length > 0 && (open ? <ChevronDown className="w-3 h-3 text-revelio-subtle dark:text-revelio-dark-subtle" /> : <ChevronRight className="w-3 h-3 text-revelio-subtle dark:text-revelio-dark-subtle" />)}
        </div>
        <p className="text-xs font-semibold text-revelio-text dark:text-revelio-dark-text">{member.name.split(' ')[0]}</p>
        <p className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{member.role_label || '—'}</p>
        {ded !== null && <p className="text-[9px] font-semibold text-revelio-blue">{ded}%</p>}
      </button>

      {open && children.length > 0 && (
        <>
          <div className="w-0.5 h-4 bg-revelio-border" />
          {children.length > 1 && <div className="h-0.5 bg-revelio-border" style={{ width: `${Math.min(children.length * 140, 500)}px` }} />}
          <div className="flex gap-2 justify-center">
            {children.map(ch => (
              <OrgNode key={ch.id} member={ch} members={members} orgMap={orgMap} orgData={orgData} depth={depth + 1} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
