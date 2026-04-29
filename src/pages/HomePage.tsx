import { useEffect, useState, useMemo } from 'react'
import { CheckCircle2, Clock, AlertTriangle, Calendar, ChevronRight, ListChecks, Target, Check, X, UserCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/data/supabase'


interface Action { id: string; text: string; status: string; date?: string; owner?: string; type?: string; [k: string]: unknown }
interface PendingAbsence { id: string; member_id: string; type: string; date_from: string; date_to: string; days: number; notes: string }
interface PendingRetro { id: string; member_id: string; sala: string; date: string; hours: number }

const ABS_LABELS: Record<string, string> = { vacaciones: 'Vacaciones', baja_medica: 'Baja médica', asuntos_propios: 'Asuntos propios', formacion: 'Formación', permiso_retribuido: 'Permiso retrib.' }

export function HomePage() {
  const { user } = useAuth()
  const [actions, setActions] = useState<Action[]>([])
  const [rooms, setRooms] = useState<Array<{ slug: string; name: string }>>([])
  const [loading, setLoading] = useState(true)
  const [pendingAbs, setPendingAbs] = useState<PendingAbsence[]>([])
  const [pendingRetro, setPendingRetro] = useState<PendingRetro[]>([])
  const [members, setMembers] = useState<Array<{ id: string; name: string; avatar: string; color: string }>>([])
  const [resolvedAbs, setResolvedAbs] = useState<Array<{ id: string; type: string; date_from: string; date_to: string; days: number; status: string }>>([])
  const [resolvedRetro, setResolvedRetro] = useState<Array<{ id: string; sala: string; date: string; hours: number; status: string }>>([])
  const today = new Date().toISOString().slice(0, 10)
  const weekEnd = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10) })()

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('rooms').select('slug, name'),
      supabase.from('retros').select('sala, data').eq('status', 'active'),
      supabase.from('team_members').select('id, name, avatar, color'),
    ]).then(([rR, retR, mR]) => {
      if (rR.data) setRooms(rR.data)
      if (mR.data) setMembers(mR.data as Array<{ id: string; name: string; avatar: string; color: string }>)
      const all: Action[] = []
      ;(retR.data || []).forEach((r: { sala: string; data: Record<string, unknown> }) => {
        ;((r.data?.actions || []) as Action[]).forEach(a => { if (a.status !== 'discarded' && a.status !== 'cancelled') all.push({ ...a, _sala: r.sala }) })
      })
      setActions(all)
      setLoading(false)
    })

    // Load my resolved requests (last 7 days)
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
    supabase.from('absence_requests').select('id, type, date_from, date_to, days, status').eq('member_id', user.id).in('status', ['aprobada', 'rechazada']).gte('created_at', weekAgo.toISOString()).then(({ data }) => {
      if (data) setResolvedAbs(data)
    })
    supabase.from('time_entries').select('id, sala, date, hours, status').eq('member_id', user.id).in('status', ['approved', 'rejected']).then(({ data }) => {
      // Filter to only show retro filings (auto_distributed ones that were pending)
      if (data) setResolvedRetro((data as Array<{ id: string; sala: string; date: string; hours: number; status: string; auto_distributed?: boolean }>).filter(e => e.status === 'rejected' || e.auto_distributed))
    })

    // Load pending approvals (for SM / responsable)
    if (user?.is_superuser) {
      supabase.from('absence_requests').select('id, member_id, type, date_from, date_to, days, notes').eq('status', 'pendiente').then(({ data }) => { if (data) setPendingAbs(data as PendingAbsence[]) })
      supabase.from('time_entries').select('id, member_id, sala, date, hours').eq('status', 'pending_approval').then(({ data }) => { if (data) setPendingRetro(data as PendingRetro[]) })
    }
  }, [user])

  const myItems = useMemo(() => actions.filter(a => a.owner === user?.name), [actions, user])
  const myPending = myItems.filter(a => a.status !== 'done' && a.status !== 'archived')
  const myOverdue = myPending.filter(a => a.date && a.date < today)
  const myThisWeek = myPending.filter(a => a.date && a.date >= today && a.date <= weekEnd)
  const myMilestones = myPending.filter(a => (a.type || '') === 'hito')
  const myDone = myItems.filter(a => a.status === 'done' || a.status === 'archived').length

  const approveAbsence = async (id: string) => { await supabase.from('absence_requests').update({ status: 'aprobada', reviewed_by: user?.id, reviewed_at: new Date().toISOString() }).eq('id', id); setPendingAbs(p => p.filter(a => a.id !== id)) }
  const rejectAbsence = async (id: string) => { await supabase.from('absence_requests').update({ status: 'rechazada', reviewed_by: user?.id, reviewed_at: new Date().toISOString() }).eq('id', id); setPendingAbs(p => p.filter(a => a.id !== id)) }
  const approveRetro = async (id: string) => { await supabase.from('time_entries').update({ status: 'approved' }).eq('id', id); setPendingRetro(p => p.filter(e => e.id !== id)) }
  const rejectRetro = async (id: string) => { await supabase.from('time_entries').update({ status: 'rejected' }).eq('id', id); setPendingRetro(p => p.filter(e => e.id !== id)) }

  const getMember = (id: string) => members.find(m => m.id === id)

  // Group pending by member
  const absByMember = useMemo(() => {
    const map: Record<string, PendingAbsence[]> = {}
    pendingAbs.forEach(a => { if (!map[a.member_id]) map[a.member_id] = []; map[a.member_id]!.push(a) })
    return map
  }, [pendingAbs])
  const retroByMember = useMemo(() => {
    const map: Record<string, PendingRetro[]> = {}
    pendingRetro.forEach(r => { if (!map[r.member_id]) map[r.member_id] = []; map[r.member_id]!.push(r) })
    return map
  }, [pendingRetro])

  const totalPendingApprovals = pendingAbs.length + pendingRetro.length

  if (loading) return <div className="text-sm text-revelio-subtle text-center py-20">Cargando...</div>

  return (
    <div className="w-full max-w-[1600px]">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-revelio-text dark:text-revelio-dark-text">
          {greet()}, {user?.name?.split(' ')[0]} <span className="text-lg">{user?.avatar}</span>
        </h1>
        <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mt-0.5">
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ═══ PENDING APPROVALS — prominent banner ═══ */}
      {totalPendingApprovals > 0 && (
        <div className="rounded-2xl border-2 border-revelio-orange/30 bg-revelio-orange/5 p-4 mb-6">
          <h3 className="text-sm font-bold text-revelio-orange flex items-center gap-2 mb-3">
            <UserCheck className="w-5 h-5" /> Pendiente de tu aprobación ({totalPendingApprovals})
          </h3>

          {/* Absences grouped by person */}
          {Object.entries(absByMember).map(([memberId, items]) => {
            const m = getMember(memberId)
            return (
              <div key={memberId} className="mb-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm" style={{ color: m?.color }}>{m?.avatar || '👤'}</span>
                  <span className="text-xs font-semibold dark:text-revelio-dark-text">{m?.name || 'Usuario'}</span>
                  <span className="text-[9px] text-revelio-subtle">· {items.length} ausencia{items.length > 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-1 ml-6">
                  {items.map(a => (
                    <div key={a.id} className="flex items-center gap-2 bg-white dark:bg-revelio-dark-card rounded-lg px-3 py-2">
                      <div className="flex-1">
                        <p className="text-[10px] font-medium dark:text-revelio-dark-text">{ABS_LABELS[a.type] || a.type}</p>
                        <p className="text-[9px] text-revelio-subtle">{a.date_from} → {a.date_to} · {a.days} día{a.days > 1 ? 's' : ''}{a.notes ? ` · ${a.notes}` : ''}</p>
                      </div>
                      <button onClick={() => approveAbsence(a.id)} className="w-7 h-7 rounded-lg bg-revelio-green/10 flex items-center justify-center hover:bg-revelio-green/20 transition-colors"><Check className="w-3.5 h-3.5 text-revelio-green" /></button>
                      <button onClick={() => rejectAbsence(a.id)} className="w-7 h-7 rounded-lg bg-revelio-red/10 flex items-center justify-center hover:bg-revelio-red/20 transition-colors"><X className="w-3.5 h-3.5 text-revelio-red" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Retro filings grouped by person */}
          {Object.entries(retroByMember).map(([memberId, items]) => {
            const m = getMember(memberId)
            return (
              <div key={memberId} className="mb-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm" style={{ color: m?.color }}>{m?.avatar || '👤'}</span>
                  <span className="text-xs font-semibold dark:text-revelio-dark-text">{m?.name || 'Usuario'}</span>
                  <span className="text-[9px] text-revelio-subtle">· {items.length} fichaje{items.length > 1 ? 's' : ''} retroactivo{items.length > 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-1 ml-6">
                  {items.map(r => (
                    <div key={r.id} className="flex items-center gap-2 bg-white dark:bg-revelio-dark-card rounded-lg px-3 py-2">
                      <div className="flex-1">
                        <p className="text-[10px] font-medium dark:text-revelio-dark-text">{rooms.find(rm => rm.slug === r.sala)?.name || r.sala} · {r.hours}h</p>
                        <p className="text-[9px] text-revelio-subtle">{new Date(r.date + 'T00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                      </div>
                      <button onClick={() => approveRetro(r.id)} className="w-7 h-7 rounded-lg bg-revelio-green/10 flex items-center justify-center hover:bg-revelio-green/20 transition-colors"><Check className="w-3.5 h-3.5 text-revelio-green" /></button>
                      <button onClick={() => rejectRetro(r.id)} className="w-7 h-7 rounded-lg bg-revelio-red/10 flex items-center justify-center hover:bg-revelio-red/20 transition-colors"><X className="w-3.5 h-3.5 text-revelio-red" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Resolved requests notification for solicitante */}
      {(resolvedAbs.length > 0 || resolvedRetro.filter(r => r.status === 'rejected').length > 0) && (
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4 mb-4">
          <h4 className="text-[10px] font-semibold text-revelio-subtle uppercase mb-2">Tus solicitudes resueltas</h4>
          <div className="space-y-1">
            {resolvedAbs.map(a => (
              <div key={a.id} className="flex items-center gap-2 py-1">
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${a.status === 'aprobada' ? 'bg-revelio-green/10 text-revelio-green' : 'bg-revelio-red/10 text-revelio-red'}`}>{a.status === 'aprobada' ? 'Aprobada' : 'Rechazada'}</span>
                <span className="text-[10px] dark:text-revelio-dark-text">{ABS_LABELS[a.type] || a.type} · {a.date_from} → {a.date_to} ({a.days}d)</span>
              </div>
            ))}
            {resolvedRetro.filter(r => r.status === 'rejected').map(r => (
              <div key={r.id} className="flex items-center gap-2 py-1">
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-revelio-red/10 text-revelio-red">Rechazado</span>
                <span className="text-[10px] dark:text-revelio-dark-text">Fichaje retroactivo · {r.date} · {r.hours}h</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KPI icon={ListChecks} label="Pendientes" value={myPending.length} color={myPending.length > 5 ? '#FF9500' : '#007AFF'} tooltip={`${myPending.length} items sin completar en todos tus proyectos`} />
        <KPI icon={Clock} label="Vencidos" value={myOverdue.length} color={myOverdue.length > 0 ? '#FF3B30' : '#34C759'} tooltip={myOverdue.length > 0 ? `${myOverdue.map(a => a.text).slice(0, 3).join(', ')}${myOverdue.length > 3 ? '...' : ''}` : 'Todo al día'} />
        <KPI icon={Calendar} label="Esta semana" value={myThisWeek.length} color="#5856D6" tooltip={myThisWeek.length > 0 ? `Próximos: ${myThisWeek.map(a => a.text).slice(0, 3).join(', ')}` : 'Sin entregas esta semana'} />
        <KPI icon={CheckCircle2} label="Completados" value={myDone} color="#34C759" tooltip={`${myDone} items completados en total`} />
      </div>

      {/* Overdue — urgent */}
      {myOverdue.length > 0 && (
        <Section title="Vencidos" icon={AlertTriangle} color="#FF3B30" count={myOverdue.length}>
          {myOverdue.sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(a => <ItemRow key={a.id} item={a} rooms={rooms} today={today} />)}
        </Section>
      )}

      {/* This week */}
      <Section title="Esta semana" icon={Calendar} color="#5856D6" count={myThisWeek.length}>
        {myThisWeek.length > 0 ? myThisWeek.sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(a => <ItemRow key={a.id} item={a} rooms={rooms} today={today} />) : <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle py-3">Sin items para esta semana</p>}
      </Section>

      {/* All pending */}
      <Section title="Todos mis pendientes" icon={ListChecks} color="#007AFF" count={myPending.length}>
        {myPending.slice(0, 10).map(a => <ItemRow key={a.id} item={a} rooms={rooms} today={today} />)}
        {myPending.length > 10 && <p className="text-[9px] text-revelio-subtle text-center pt-1">+{myPending.length - 10} más</p>}
        {myPending.length === 0 && <p className="text-[10px] text-revelio-green py-3 text-center font-semibold">Todo al día</p>}
      </Section>

      {/* Milestones */}
      {myMilestones.length > 0 && (
        <Section title="Mis hitos" icon={Target} color="#FF9500" count={myMilestones.length}>
          {myMilestones.map(a => <ItemRow key={a.id} item={a} rooms={rooms} today={today} />)}
        </Section>
      )}
    </div>
  )
}

function KPI({ icon: Icon, label, value, color, tooltip }: { icon: typeof Clock; label: string; value: number; color: string; tooltip?: string }) {
  return (
    <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-3 cursor-default group relative" title={tooltip}>
      <Icon className="w-4 h-4 mb-1" style={{ color }} />
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
      <p className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wide">{label}</p>
      {tooltip && <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-revelio-text dark:bg-white text-white dark:text-revelio-text text-[9px] rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">{tooltip}</div>}
    </div>
  )
}

function Section({ title, icon: Icon, color, count, children }: { title: string; icon: typeof Clock; color: string; count: number; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4 mb-4">
      <h3 className="text-[10px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5" style={{ color }} /> {title} <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: color + '15', color }}>{count}</span>
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function ItemRow({ item, rooms, today }: { item: Action & { _sala?: string }; rooms: Array<{ slug: string; name: string }>; today: string }) {
  const isOverdue = item.date && item.date < today && item.status !== 'done'
  const daysLeft = item.date ? Math.round((new Date(item.date).getTime() - new Date(today).getTime()) / 86400000) : null
  const projName = rooms.find(r => r.slug === item._sala)?.name || item._sala || ''
  return (
    <Link to={`/project/${item._sala}`} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-revelio-bg/50 dark:hover:bg-revelio-dark-border/30 transition-colors">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.status === 'blocked' ? 'bg-revelio-red' : isOverdue ? 'bg-revelio-red' : 'bg-revelio-blue'}`} />
      <span className="text-[10px] flex-1 dark:text-revelio-dark-text truncate">{item.text}</span>
      <span className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle flex-shrink-0">{projName}</span>
      {daysLeft !== null && (
        <span className={`text-[8px] font-bold flex-shrink-0 ${daysLeft < 0 ? 'text-revelio-red' : daysLeft <= 2 ? 'text-revelio-orange' : 'text-revelio-subtle'}`}>
          {daysLeft < 0 ? `${Math.abs(daysLeft)}d tarde` : daysLeft === 0 ? 'Hoy' : `${daysLeft}d`}
        </span>
      )}
      <ChevronRight className="w-3 h-3 text-revelio-border flex-shrink-0" />
    </Link>
  )
}

function greet() { const h = new Date().getHours(); return h < 7 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches' }
