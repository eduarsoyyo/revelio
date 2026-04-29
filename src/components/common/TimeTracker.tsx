import { useEffect, useState, useMemo, useCallback } from 'react'
import { Clock, ChevronLeft, ChevronRight, Calendar, Check, X, AlertTriangle, Edit, Send, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/data/supabase'

interface TimeEntry { id?: string; member_id?: string; sala: string; date: string; hours: number; status?: string }
interface Calendario { id: string; name: string; convenio_hours: number; weekly_hours_normal: number; daily_hours_lj: number; daily_hours_v: number; daily_hours_intensive: number; intensive_start: string; intensive_end: string; vacation_days: number; free_days: number; adjustment_days: number; adjustment_hours: number; holidays: Array<{ date: string; name: string }> }
interface AbsenceRequest { id: string; member_id: string; type: string; date_from: string; date_to: string; days: number; status: string; notes: string; created_at: string }
interface ClockEvent { event: string; timestamp: string; date: string }

const ABS_TYPES: Record<string, { label: string; initial: string; color: string; bg: string }> = {
  vacaciones: { label: 'Vacaciones', initial: 'V', color: '#FF9500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  baja_medica: { label: 'Baja médica (IT)', initial: 'B', color: '#FF3B30', bg: 'bg-red-100 dark:bg-red-900/30' },
  asuntos_propios: { label: 'Asuntos propios', initial: 'A', color: '#5856D6', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  formacion: { label: 'Formación/examen', initial: 'E', color: '#007AFF', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  permiso_retribuido: { label: 'Permiso retribuido', initial: 'P', color: '#34C759', bg: 'bg-green-100 dark:bg-green-900/30' },
}

/** Format date as YYYY-MM-DD without timezone shift */
function fmt(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
/** Parse YYYY-MM-DD to local Date */
function parse(ds: string): Date { const [y, m, d] = ds.split('-').map(Number); return new Date(y!, m! - 1, d!) }
/** Day of week for a date string (1=Mon..7=Sun) */
function dow(ds: string): number { const d = parse(ds).getDay(); return d === 0 ? 7 : d }
/** Format for display: dd/mm */
function fmtShort(ds: string): string { return `${ds.slice(8, 10)}/${ds.slice(5, 7)}` }

function isWorkday(ds: string): boolean { const d = dow(ds); return d >= 1 && d <= 5 }

function getTargetHours(cal: Calendario | null, ds: string): number {
  if (!isWorkday(ds)) return 0; if (!cal) return 8
  if ((cal.holidays || []).some(h => h.date === ds)) return 0
  const d = dow(ds); const mmdd = ds.slice(5)
  if (cal.intensive_start && cal.intensive_end && mmdd >= cal.intensive_start && mmdd <= cal.intensive_end) return cal.daily_hours_intensive || 7
  if (d === 5) return cal.daily_hours_v || 6
  return cal.daily_hours_lj || 8.5
}

function parseClockDay(events: ClockEvent[]): { entrada: string; salida: string; pausa: string; total: string } {
  if (events.length === 0) return { entrada: '—', salida: '—', pausa: '—', total: '—' }
  const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  const entrada = sorted.find(e => e.event === 'start'); const salida = [...sorted].reverse().find(e => e.event === 'stop')
  let pauseSecs = 0; let pauseStart: number | null = null
  for (const ev of sorted) { if (ev.event === 'pause') pauseStart = new Date(ev.timestamp).getTime(); if (ev.event === 'resume' && pauseStart) { pauseSecs += (new Date(ev.timestamp).getTime() - pauseStart) / 1000; pauseStart = null } }
  let totalSecs = 0
  if (entrada && salida) totalSecs = (new Date(salida.timestamp).getTime() - new Date(entrada.timestamp).getTime()) / 1000 - pauseSecs
  else if (entrada) { const last = sorted[sorted.length - 1]!; totalSecs = ((last.event === 'pause' ? new Date(last.timestamp).getTime() : Date.now()) - new Date(entrada.timestamp).getTime()) / 1000 - pauseSecs }
  const fmtT = (ts: string) => new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const fmtD = (s: number) => `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`
  return { entrada: entrada ? fmtT(entrada.timestamp) : '—', salida: salida ? fmtT(salida.timestamp) : '—', pausa: pauseSecs > 0 ? fmtD(pauseSecs) : '—', total: totalSecs > 0 ? fmtD(totalSecs) : '—' }
}

export function TimeTracker() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'fichaje' | 'ausencias' | 'jornada'>('fichaje')
  const [view, setView] = useState<'semana' | 'mes' | 'año'>('mes')
  const [refDate, setRefDate] = useState(new Date())
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [calendario, setCalendario] = useState<Calendario | null>(null)
  const [absences, setAbsences] = useState<AbsenceRequest[]>([])
  const [clockEvents, setClockEvents] = useState<ClockEvent[]>([])
  const [showRetroModal, setShowRetroModal] = useState<string | null>(null)
  const [retroHours, setRetroHours] = useState('')
  const [pendingToReview, setPendingToReview] = useState<AbsenceRequest[]>([])
  const [pendingRetro, setPendingRetro] = useState<TimeEntry[]>([])
  // Absence calendar state
  const [absMonth, setAbsMonth] = useState(new Date())
  const [absType, setAbsType] = useState('vacaciones')
  const [absNotes, setAbsNotes] = useState('')
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set())

  const range = useMemo(() => {
    const y = refDate.getFullYear(); const m = refDate.getMonth()
    if (view === 'semana') { const d = dow(fmt(refDate)); const mon = new Date(refDate); mon.setDate(refDate.getDate() - d + 1); const fri = new Date(mon); fri.setDate(mon.getDate() + 4); return { from: fmt(mon), to: fmt(fri), label: `Semana del ${mon.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}` } }
    if (view === 'año') return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}` }
    const first = new Date(y, m, 1); const last = new Date(y, m + 1, 0); return { from: fmt(first), to: fmt(last), label: refDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }) }
  }, [view, refDate])

  const loadData = useCallback(async () => {
    if (!user?.id) return
    const [tR, aR, cR] = await Promise.all([
      supabase.from('time_entries').select('*').eq('member_id', user.id).gte('date', range.from).lte('date', range.to),
      supabase.from('absence_requests').select('*').eq('member_id', user.id),
      supabase.from('clock_events').select('event, timestamp, date').eq('member_id', user.id).gte('date', range.from).lte('date', range.to).order('timestamp'),
    ])
    if (tR.data) setEntries(tR.data as TimeEntry[])
    if (aR.data) setAbsences(aR.data as AbsenceRequest[])
    if (cR.data) setClockEvents(cR.data as ClockEvent[])
    // Load calendario from team_members
    const { data: profile } = await supabase.from('team_members').select('calendario_id').eq('id', user.id).single()
    const calId = (profile as Record<string, unknown>)?.calendario_id as string
    if (calId) { const { data } = await supabase.from('calendarios').select('*').eq('id', calId).single(); if (data) setCalendario(data as Calendario) }
    // Load pending approvals: for people I'm responsible for, or all if superuser
    if (user.is_superuser) {
      // Get IDs of people I manage
      const { data: managed } = await supabase.from('team_members').select('id').eq('responsable_id', user.id)
      const managedIds = (managed || []).map((m: { id: string }) => m.id)
      // If I manage people, show their requests. If superuser with no reports, show all.
      if (managedIds.length > 0) {
        const { data: pa } = await supabase.from('absence_requests').select('*').eq('status', 'pendiente').in('member_id', managedIds); if (pa) setPendingToReview(pa as AbsenceRequest[])
        const { data: pr } = await supabase.from('time_entries').select('*').eq('status', 'pending_approval').in('member_id', managedIds); if (pr) setPendingRetro(pr as TimeEntry[])
      } else {
        const { data: pa } = await supabase.from('absence_requests').select('*').eq('status', 'pendiente'); if (pa) setPendingToReview(pa as AbsenceRequest[])
        const { data: pr } = await supabase.from('time_entries').select('*').eq('status', 'pending_approval'); if (pr) setPendingRetro(pr as TimeEntry[])
      }
    }
  }, [user, range.from, range.to])

  useEffect(() => { loadData() }, [loadData])

  // ── FICHAJE TAB DATA ──
  const dayRows = useMemo(() => {
    const today = fmt(new Date())
    if (view === 'año') {
      return Array.from({ length: 12 }, (_, m) => {
        const first = new Date(refDate.getFullYear(), m, 1); const last = new Date(refDate.getFullYear(), m + 1, 0)
        const mFrom = fmt(first); const mTo = fmt(last)
        let target = 0; const d2 = new Date(first); while (d2 <= last) { target += getTargetHours(calendario, fmt(d2)); d2.setDate(d2.getDate() + 1) }
        const filed = entries.filter(e => e.date >= mFrom && e.date <= mTo && e.status !== 'rejected' && e.sala !== '_pendiente').reduce((s, e) => s + e.hours, 0)
        let absH = 0; const da = new Date(first); while (da <= last) { const ds = fmt(da); if (absences.some(a => (a.status === 'aprobada') && ds >= a.date_from && ds <= a.date_to) && getTargetHours(calendario, ds) > 0) absH += getTargetHours(calendario, ds); da.setDate(da.getDate() + 1) }
        return { label: first.toLocaleDateString('es-ES', { month: 'long' }), target: Math.round(target * 10) / 10, filed: Math.round((filed + absH) * 10) / 10, balance: Math.round((filed + absH - target) * 10) / 10, isYear: true as const }
      })
    }
    const rows: Array<{ date: string; dayLabel: string; target: number; filed: number; balance: number; isHoliday: boolean; holidayName?: string; absence?: string; absColor?: string; clockInfo: ReturnType<typeof parseClockDay>; canRetro: boolean; isPending: boolean }> = []
    const d = parse(range.from); const end = parse(range.to)
    while (d <= end) {
      const ds = fmt(d)
      if (isWorkday(ds)) {
        const hol = (calendario?.holidays || []).find(h => h.date === ds); const target = getTargetHours(calendario, ds)
        const filed = entries.filter(e => e.date === ds && e.status !== 'rejected' && e.sala !== '_pendiente').reduce((s, e) => s + e.hours, 0)
        const abs = absences.find(a => (a.status === 'aprobada' || a.status === 'pendiente') && ds >= a.date_from && ds <= a.date_to)
        const eff = abs ? target : filed
        const hasPending = entries.some(e => e.date === ds && e.sala === '_pendiente' && e.status === 'pending_approval')
        const pendingHours = hasPending ? entries.filter(e => e.date === ds && e.sala === '_pendiente' && e.status === 'pending_approval').reduce((s, e) => s + e.hours, 0) : 0
        const displayFiled = hasPending ? pendingHours : Math.round(eff * 10) / 10
        rows.push({ date: ds, dayLabel: d.toLocaleDateString('es-ES', { weekday: 'short' }) + ' ' + fmtShort(ds), target, filed: displayFiled, balance: Math.round((displayFiled - target) * 10) / 10, isHoliday: !!hol, holidayName: hol?.name, absence: abs ? ABS_TYPES[abs.type]?.label : undefined, absColor: abs ? ABS_TYPES[abs.type]?.color : undefined, clockInfo: parseClockDay(clockEvents.filter(e => e.date === ds)), canRetro: ds < today && filed === 0 && !hasPending && !hol && !abs, isPending: hasPending })
      }
      d.setDate(d.getDate() + 1)
    }
    return rows
  }, [range, entries, calendario, absences, clockEvents, view, refDate])

  const totalTarget = Math.round(dayRows.reduce((s, r) => s + r.target, 0) * 10) / 10
  const totalFiled = Math.round(dayRows.reduce((s, r) => s + r.filed, 0) * 10) / 10
  const totalBalance = Math.round((totalFiled - totalTarget) * 10) / 10
  const navigate = (d: number) => { const dt = new Date(refDate); if (view === 'semana') dt.setDate(dt.getDate() + d * 7); else if (view === 'mes') dt.setMonth(dt.getMonth() + d); else dt.setFullYear(dt.getFullYear() + d); setRefDate(dt) }

  const submitRetro = async () => {
    if (!user?.id || !showRetroModal || !retroHours) return
    const h = Number(retroHours); if (h <= 0) return
    // Delete any previous pending or rejected for this date+sala
    await supabase.from('time_entries').delete().eq('member_id', user.id).eq('date', showRetroModal).eq('sala', '_pendiente')
    const { error } = await supabase.from('time_entries').insert({
      member_id: user.id, sala: '_pendiente', date: showRetroModal, hours: h,
      category: 'retro', auto_distributed: false, status: 'pending_approval'
    })
    if (error) { console.error('[revelio] retro save:', error.message); alert('Error: ' + error.message); return }
    setShowRetroModal(null); setRetroHours(''); loadData()
  }

  // ── AUSENCIAS CALENDAR ──
  const calDays = useMemo(() => {
    const y = absMonth.getFullYear(); const m = absMonth.getMonth()
    const first = new Date(y, m, 1); const last = new Date(y, m + 1, 0)
    const startDow = first.getDay() || 7 // Mon=1
    const days: Array<{ date: string; day: number; inMonth: boolean; isWeekend: boolean; isHoliday: boolean; holidayName?: string; absType?: string; absColor?: string }> = []
    // Pad before
    for (let i = 1; i < startDow; i++) { const d = new Date(first); d.setDate(d.getDate() - (startDow - i)); days.push({ date: fmt(d), day: d.getDate(), inMonth: false, isWeekend: [0, 6].includes(d.getDay()), isHoliday: false }) }
    for (let d = 1; d <= last.getDate(); d++) {
      const dt = new Date(y, m, d); const ds = fmt(dt); const dow = dt.getDay()
      const hol = (calendario?.holidays || []).find(h => h.date === ds)
      const abs = absences.find(a => (a.status === 'aprobada' || a.status === 'pendiente') && ds >= a.date_from && ds <= a.date_to)
      days.push({ date: ds, day: d, inMonth: true, isWeekend: dow === 0 || dow === 6, isHoliday: !!hol, holidayName: hol?.name, absType: abs?.type, absColor: abs ? ABS_TYPES[abs.type]?.color : undefined })
    }
    return days
  }, [absMonth, calendario, absences])

  const toggleDay = (ds: string) => {
    if (!isWorkday(ds)) return
    if ((calendario?.holidays || []).some(h => h.date === ds)) return
    const next = new Set(selectedDays)
    if (next.has(ds)) next.delete(ds); else next.add(ds)
    setSelectedDays(next)
  }

  const submitAbsence = async () => {
    if (!user?.id || selectedDays.size === 0) return
    const sorted = [...selectedDays].sort()
    const from = sorted[0]!; const to = sorted[sorted.length - 1]!
    const days = sorted.filter(d => isWorkday(d) && !(calendario?.holidays || []).some(h => h.date === d)).length
    const { error } = await supabase.from('absence_requests').insert({ member_id: user.id, type: absType, date_from: from, date_to: to, days, notes: absNotes, status: 'pendiente' })
    if (error) { console.error('[revelio] absence save error:', error.message); return }
    setSelectedDays(new Set()); setAbsNotes(''); loadData()
  }

  const deleteAbsence = async (id: string) => { await supabase.from('absence_requests').delete().eq('id', id); loadData() }
  const reviewAbsence = async (id: string, status: 'aprobada' | 'rechazada') => { await supabase.from('absence_requests').update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() }).eq('id', id); setPendingToReview(p => p.filter(a => a.id !== id)) }
  const reviewRetro = async (e: TimeEntry, ok: boolean) => {
    if (!ok) {
      // Reject — mark as rejected, stays visible to user
      await supabase.from('time_entries').update({ status: 'rejected' }).eq('id', e.id)
    } else {
      // Approve: distribute hours across projects, mark original as approved
      const { data: org } = await supabase.from('org_chart').select('sala, dedication, start_date, end_date').eq('member_id', e.member_id)
      const today = e.date
      const active = ((org || []) as Array<{ sala: string; dedication: number; start_date?: string; end_date?: string }>)
        .filter(o => { const s = o.start_date || '2000-01-01'; const en = o.end_date || '2099-12-31'; return today >= s && today <= en && o.dedication > 0 })
      let distributed = 0
      for (const o of active) {
        const h = Math.round(o.dedication * e.hours * 100) / 100
        distributed += h
        await supabase.from('time_entries').insert(
          { member_id: e.member_id, sala: o.sala, date: e.date, hours: h, category: 'productivo', auto_distributed: true, status: 'approved' }
        )
      }
      const remainder = Math.round((e.hours - distributed) * 100) / 100
      if (remainder > 0.01) {
        await supabase.from('time_entries').insert({ member_id: e.member_id, sala: '_sin_asignar', date: e.date, hours: remainder, category: 'no_asignado', auto_distributed: true, status: 'approved' })
      }
      if (active.length === 0) {
        await supabase.from('time_entries').insert({ member_id: e.member_id, sala: '_sin_asignar', date: e.date, hours: e.hours, category: 'no_asignado', auto_distributed: true, status: 'approved' })
      }
      // Mark original _pendiente entry as approved (keeps record for user notifications)
      await supabase.from('time_entries').update({ status: 'approved' }).eq('id', e.id)
    }
    setPendingRetro(p => p.filter(x => x.id !== e.id))
  }

  // ── JORNADA ──
  const jornadaData = useMemo(() => {
    if (!calendario) return null
    const y = new Date().getFullYear(); const months: Array<{ label: string; days: number; aus: number; vac: number; hours: number; acum: number }> = []
    let acum = 0
    for (let m = 0; m < 12; m++) {
      const first = new Date(y, m, 1); const last = new Date(y, m + 1, 0)
      let days = 0, hours = 0, aus = 0, vac = 0; const d = new Date(first)
      while (d <= last) {
        const ds = fmt(d); const t = getTargetHours(calendario, ds)
        if (t > 0) { days++; hours += t }
        const abs = absences.find(a => a.status === 'aprobada' && ds >= a.date_from && ds <= a.date_to)
        if (abs && isWorkday(ds)) { if (abs.type === 'vacaciones') vac++; else aus++ }
        d.setDate(d.getDate() + 1)
      }
      acum += hours
      months.push({ label: first.toLocaleDateString('es-ES', { month: 'short' }), days, aus, vac, hours: Math.round(hours * 10) / 10, acum: Math.round(acum * 10) / 10 })
    }
    const totalDays = months.reduce((s, m) => s + m.days, 0); const totalHours = months.reduce((s, m) => s + m.hours, 0)
    const totalAus = months.reduce((s, m) => s + m.aus, 0); const totalVac = months.reduce((s, m) => s + m.vac, 0)
    const effectiveHours = Math.round((totalHours - totalVac * (calendario.daily_hours_lj || 8) - totalAus * (calendario.daily_hours_lj || 8)) * 10) / 10
    return { months, totalDays, totalHours: Math.round(totalHours * 10) / 10, totalAus, totalVac, effectiveHours, convenioHours: calendario.convenio_hours, diff: Math.round((effectiveHours - calendario.convenio_hours) * 10) / 10 }
  }, [calendario, absences])

  // Vacation balance
  // Vacation balance
  const [carryover, setCarryover] = useState(0)
  useEffect(() => {
    if (!user?.id) return
    supabase.from('team_members').select('vacation_carryover').eq('id', user.id).single().then(({ data }) => {
      setCarryover(Number((data as Record<string, unknown>)?.vacation_carryover) || 0)
    })
  }, [user?.id])

  const vacBalance = useMemo(() => {
    if (!calendario) return null
    const total = calendario.vacation_days + carryover
    const used = absences.filter(a => a.status === 'aprobada' && (a.type === 'vacaciones' || a.type === 'asuntos_propios')).reduce((s, a) => s + a.days, 0)
    return { total, yearDays: calendario.vacation_days, prevYear: carryover, used, remaining: total - used }
  }, [calendario, absences, carryover])

  return (
    <div className="max-w-5xl">
      {/* Tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-0.5 bg-revelio-bg dark:bg-revelio-dark-border rounded-lg overflow-hidden">
          {([['fichaje', 'Fichaje'], ['ausencias', 'Vacaciones / Ausencias'], ['jornada', 'Jornada']] as const).map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`px-4 py-2 text-xs font-semibold ${tab === id ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}>{label}</button>)}
        </div>
      </div>

      {/* ════ FICHAJE TAB ════ */}
      {tab === 'fichaje' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle capitalize">{range.label} · {calendario?.name || 'Sin calendario'}</p>
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5 bg-revelio-bg dark:bg-revelio-dark-border rounded-lg overflow-hidden">{(['semana', 'mes', 'año'] as const).map(v => <button key={v} onClick={() => setView(v)} className={`px-2.5 py-1 text-[10px] font-semibold capitalize ${view === v ? 'bg-revelio-blue text-white' : 'text-revelio-subtle'}`}>{v}</button>)}</div>
              <div className="flex items-center gap-1"><button onClick={() => navigate(-1)} className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center"><ChevronLeft className="w-3 h-3" /></button><button onClick={() => setRefDate(new Date())} className="px-2 py-0.5 rounded text-[9px] font-semibold text-revelio-blue">Hoy</button><button onClick={() => navigate(1)} className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center"><ChevronRight className="w-3 h-3" /></button></div>
            </div>
          </div>
          <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card overflow-x-auto mb-4">
            <table className="w-full text-[10px]">
              <thead><tr className="bg-revelio-bg dark:bg-revelio-dark-border"><th className="px-2 py-2 text-left font-semibold text-revelio-subtle uppercase">{view === 'año' ? 'Mes' : 'Día'}</th>{view !== 'año' && <><th className="px-2 py-2 text-center font-semibold text-revelio-subtle uppercase">Entrada</th><th className="px-2 py-2 text-center font-semibold text-revelio-subtle uppercase">Salida</th><th className="px-2 py-2 text-center font-semibold text-revelio-subtle uppercase">Pausa</th></>}<th className="px-2 py-2 text-right font-semibold text-revelio-subtle uppercase">Total</th><th className="px-2 py-2 text-right font-semibold text-revelio-subtle uppercase">Obj.</th><th className="px-2 py-2 text-right font-semibold text-revelio-subtle uppercase">Dif.</th>{view !== 'año' && <><th className="px-2 py-2 text-left font-semibold text-revelio-subtle uppercase">Notas</th><th className="px-2 py-2 w-6" /></>}</tr></thead>
              <tbody>{dayRows.map((r, i) => {
                const d = r as { date: string; isHoliday: boolean; holidayName?: string; absence?: string; absColor?: string; clockInfo: ReturnType<typeof parseClockDay>; canRetro: boolean; isPending: boolean }
                const isToday = 'date' in r && d.date === fmt(new Date())
                return (
                  <tr key={i} className={`border-t border-revelio-border/30 dark:border-revelio-dark-border/30 ${d.isHoliday ? 'bg-revelio-bg/50 dark:bg-revelio-dark-border/20' : ''} ${isToday ? 'bg-revelio-blue/5' : ''}`}>
                    <td className="px-2 py-1.5 font-medium dark:text-revelio-dark-text capitalize">{'dayLabel' in r ? r.dayLabel : (r as { label: string }).label}</td>
                    {view !== 'año' && 'clockInfo' in r && <><td className="px-2 py-1.5 text-center font-mono text-revelio-green">{d.clockInfo.entrada}</td><td className="px-2 py-1.5 text-center font-mono text-revelio-red">{d.clockInfo.salida}</td><td className="px-2 py-1.5 text-center font-mono text-revelio-orange">{d.clockInfo.pausa}</td></>}
                    <td className={`px-2 py-1.5 text-right font-bold ${r.filed > 0 ? (d.isPending ? 'text-revelio-orange' : 'text-revelio-green') : 'text-revelio-subtle'}`}>{r.filed > 0 ? `${r.filed}h` : '—'}{d.isPending && <span className="text-[7px] ml-0.5">⏳</span>}</td>
                    <td className="px-2 py-1.5 text-right dark:text-revelio-dark-text">{r.target > 0 ? `${r.target}h` : '—'}</td>
                    <td className={`px-2 py-1.5 text-right font-bold ${r.balance > 0 ? 'text-revelio-green' : r.balance < 0 ? 'text-revelio-red' : ''}`}>{r.target > 0 || r.filed > 0 ? `${r.balance > 0 ? '+' : ''}${r.balance}h` : ''}</td>
                    {view !== 'año' && 'date' in r && <td className="px-2 py-1.5 text-[9px]">{d.isHoliday && <span className="text-revelio-red">{d.holidayName}</span>}{d.absence && <span style={{ color: d.absColor }}>{d.absence}</span>}</td>}
                    {view !== 'año' && 'canRetro' in r && <td className="px-2 py-1.5">{d.canRetro && <button onClick={() => { setShowRetroModal(d.date); setRetroHours('') }} className="text-revelio-orange hover:underline"><Edit className="w-2.5 h-2.5" /></button>}</td>}
                  </tr>
                )
              })}</tbody>
              <tfoot><tr className="border-t-2 border-revelio-border dark:border-revelio-dark-border bg-revelio-bg dark:bg-revelio-dark-border font-bold"><td className="px-2 py-2 dark:text-revelio-dark-text">Total</td>{view !== 'año' && <td colSpan={3} />}<td className="px-2 py-2 text-right text-revelio-green">{totalFiled}h</td><td className="px-2 py-2 text-right dark:text-revelio-dark-text">{totalTarget}h</td><td className={`px-2 py-2 text-right ${totalBalance >= 0 ? 'text-revelio-green' : 'text-revelio-red'}`}>{totalBalance > 0 ? '+' : ''}{totalBalance}h</td>{view !== 'año' && <td colSpan={2} />}</tr></tfoot>
            </table>
          </div>
          {/* SM approvals */}
          {user?.is_superuser && pendingRetro.length > 0 && <div className="rounded-card border border-revelio-orange/30 bg-revelio-orange/5 p-4 mb-4"><h4 className="text-[10px] font-semibold text-revelio-orange uppercase mb-2"><Send className="w-3 h-3 inline mr-1" />Fichajes retroactivos ({pendingRetro.length})</h4>{pendingRetro.map(e => <div key={e.id} className="flex items-center gap-2 bg-white dark:bg-revelio-dark-card rounded-lg px-3 py-2 mb-1"><div className="flex-1"><p className="text-[10px] dark:text-revelio-dark-text">{fmtShort(e.date)} · {e.hours}h</p></div><button onClick={() => reviewRetro(e, true)} className="w-6 h-6 rounded bg-revelio-green/10 flex items-center justify-center"><Check className="w-3 h-3 text-revelio-green" /></button><button onClick={() => reviewRetro(e, false)} className="w-6 h-6 rounded bg-revelio-red/10 flex items-center justify-center"><X className="w-3 h-3 text-revelio-red" /></button></div>)}</div>}
        </div>
      )}

      {/* ════ AUSENCIAS TAB ════ */}
      {tab === 'ausencias' && (
        <div>
          {/* SM: pending approvals — always at top */}
          {user?.is_superuser && pendingToReview.length > 0 && <div className="rounded-card border border-revelio-orange/30 bg-revelio-orange/5 p-4 mb-4"><h4 className="text-[10px] font-semibold text-revelio-orange uppercase mb-2"><AlertTriangle className="w-3 h-3 inline mr-1" />Pendientes de aprobar ({pendingToReview.length})</h4>{pendingToReview.map(a => <div key={a.id} className="flex items-center gap-2 bg-white dark:bg-revelio-dark-card rounded-lg px-3 py-2 mb-1"><div className="flex-1"><p className="text-[10px] dark:text-revelio-dark-text">{ABS_TYPES[a.type]?.label} · {a.date_from} → {a.date_to} ({a.days}d)</p></div><button onClick={() => reviewAbsence(a.id, 'aprobada')} className="w-6 h-6 rounded bg-revelio-green/10 flex items-center justify-center"><Check className="w-3 h-3 text-revelio-green" /></button><button onClick={() => reviewAbsence(a.id, 'rechazada')} className="w-6 h-6 rounded bg-revelio-red/10 flex items-center justify-center"><X className="w-3 h-3 text-revelio-red" /></button></div>)}</div>}

          {/* Vacation balance — always visible */}
          <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4 mb-4">
            <h4 className="text-xs font-semibold dark:text-revelio-dark-text flex items-center gap-1.5 mb-3"><Calendar className="w-4 h-4 text-revelio-blue" /> Vacaciones {new Date().getFullYear()}</h4>
            {vacBalance ? (
              <>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div className="text-center"><p className="text-xl font-bold text-revelio-blue">{vacBalance.yearDays}</p><p className="text-[8px] text-revelio-subtle uppercase">Días/año</p></div>
                  <div className="text-center"><p className="text-xl font-bold text-revelio-subtle">{vacBalance.prevYear}</p><p className="text-[8px] text-revelio-subtle uppercase">Año anterior</p></div>
                  <div className="text-center"><p className="text-xl font-bold text-revelio-green">{vacBalance.total}</p><p className="text-[8px] text-revelio-subtle uppercase">Total disp.</p></div>
                  <div className="text-center"><p className={`text-xl font-bold ${vacBalance.remaining > 5 ? 'text-revelio-green' : vacBalance.remaining > 0 ? 'text-revelio-orange' : 'text-revelio-red'}`}>{vacBalance.remaining}</p><p className="text-[8px] text-revelio-subtle uppercase">Restantes</p></div>
                </div>
                <div className="mb-1 flex items-center gap-2 text-[9px] text-revelio-subtle"><span>Consumido: {vacBalance.used}d de {vacBalance.total}d</span><span>{Math.round(vacBalance.used / Math.max(vacBalance.total, 1) * 100)}%</span></div>
                <div className="h-2 bg-revelio-bg dark:bg-revelio-dark-border rounded-full overflow-hidden"><div className="h-full rounded-full bg-revelio-orange" style={{ width: `${Math.min(100, (vacBalance.used / Math.max(vacBalance.total, 1)) * 100)}%` }} /></div>
              </>
            ) : <p className="text-[10px] text-revelio-subtle">Sin calendario asignado — no se puede calcular el balance.</p>}
          </div>

          {/* Calendar + type selector */}
          <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4 mb-4">
            <h4 className="text-xs font-semibold dark:text-revelio-dark-text mb-3">Gestionar ausencias</h4>
            <div className="flex gap-1.5 flex-wrap mb-3">
              {Object.entries(ABS_TYPES).map(([id, t]) => <button key={id} onClick={() => setAbsType(id)} className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${absType === id ? 'text-white' : 'text-revelio-subtle border-revelio-border dark:border-revelio-dark-border'}`} style={absType === id ? { background: t.color, borderColor: t.color } : {}}>{t.initial} {t.label}</button>)}
            </div>
            <input value={absNotes} onChange={e => setAbsNotes(e.target.value)} placeholder={`Nota para ${ABS_TYPES[absType]?.label}...`} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none mb-3 dark:bg-revelio-dark-bg dark:text-revelio-dark-text" />

            <div className="flex items-center justify-between mb-2">
              <button onClick={() => setAbsMonth(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n })} className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center"><ChevronLeft className="w-3 h-3" /></button>
              <span className="text-sm font-semibold dark:text-revelio-dark-text capitalize">{absMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</span>
              <button onClick={() => setAbsMonth(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n })} className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center"><ChevronRight className="w-3 h-3" /></button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 mb-2">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => <div key={d} className="text-center text-[9px] font-bold text-revelio-subtle py-1">{d}</div>)}
              {calDays.map((d, i) => {
                const sel = selectedDays.has(d.date); const hasAbs = !!d.absType; const absCol = d.absColor || ABS_TYPES[d.absType || '']?.color
                return (
                  <button key={i} onClick={() => d.inMonth && toggleDay(d.date)} disabled={!d.inMonth || d.isWeekend || d.isHoliday}
                    className={`h-9 rounded-lg text-xs font-medium transition-all ${!d.inMonth ? 'text-revelio-border dark:text-revelio-dark-border' : d.isWeekend ? 'text-revelio-subtle/40' : d.isHoliday ? 'text-revelio-red/40 bg-revelio-red/5' : sel ? 'text-white' : hasAbs ? 'text-white' : 'dark:text-revelio-dark-text hover:bg-revelio-bg dark:hover:bg-revelio-dark-border'} ${d.date === fmt(new Date()) ? 'ring-1 ring-revelio-blue' : ''}`}
                    style={sel ? { background: ABS_TYPES[absType]?.color + 'CC' } : hasAbs ? { background: absCol } : {}}>
                    {d.day}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-3 text-[8px] text-revelio-subtle mb-3 flex-wrap">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{ background: ABS_TYPES[absType]?.color + '80' }} />Seleccionado ({ABS_TYPES[absType]?.initial})</span>
              {Object.entries(ABS_TYPES).map(([id, t]) => <span key={id} className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{ background: t.color }} />{t.initial} {t.label}</span>)}
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-revelio-red/20" />Festivo</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelectedDays(new Set())} disabled={selectedDays.size === 0} className="flex-1 py-2 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-sm font-medium text-revelio-subtle disabled:opacity-30">Cancelar</button>
              <button onClick={submitAbsence} disabled={selectedDays.size === 0} className="flex-[2] py-2 rounded-lg bg-revelio-blue text-white text-sm font-semibold disabled:opacity-30">Guardar {selectedDays.size} día{selectedDays.size !== 1 ? 's' : ''} · {ABS_TYPES[absType]?.initial}</button>
            </div>
          </div>

          {/* Full year absence list — outside calendar */}
          <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
            <h4 className="text-[10px] font-semibold text-revelio-subtle uppercase mb-2">Registro {new Date().getFullYear()}</h4>
            {absences.length > 0 ? (
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {[...absences].sort((a, b) => a.date_from.localeCompare(b.date_from)).map(a => {
                  const t = ABS_TYPES[a.type]
                  return (
                    <div key={a.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-revelio-bg/30 dark:hover:bg-revelio-dark-border/20">
                      <span className="text-[10px] font-bold w-4 text-center" style={{ color: t?.color }}>{t?.initial}</span>
                      <span className="text-[10px] dark:text-revelio-dark-text">{fmtShort(a.date_from)} — {fmtShort(a.date_to)}</span>
                      <span className="text-[9px] text-revelio-subtle flex-1">{t?.label}</span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${a.status === 'aprobada' ? 'bg-revelio-green/10 text-revelio-green' : a.status === 'rechazada' ? 'bg-revelio-red/10 text-revelio-red' : 'bg-revelio-orange/10 text-revelio-orange'}`}>{a.status}</span>
                      {a.status === 'pendiente' && <button onClick={() => deleteAbsence(a.id)} className="text-revelio-red hover:bg-revelio-red/10 rounded p-0.5"><Trash2 className="w-3 h-3" /></button>}
                    </div>
                  )
                })}
              </div>
            ) : <p className="text-[10px] text-revelio-subtle text-center py-3">Sin ausencias registradas este año</p>}
          </div>
        </div>
      )}

      {/* ════ JORNADA TAB ════ */}
      {tab === 'jornada' && calendario && jornadaData && (
        <div>
          <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4 mb-4">
            <h4 className="text-xs font-semibold dark:text-revelio-dark-text flex items-center gap-1.5 mb-2"><Clock className="w-4 h-4 text-revelio-blue" /> Jornada — {calendario.name}</h4>
            <p className="text-[10px] text-revelio-subtle mb-3">{calendario.convenio_hours}h convenio · {jornadaData.effectiveHours}h efectivas · <span className={jornadaData.diff >= 0 ? 'text-revelio-green' : 'text-revelio-red'}>{jornadaData.diff > 0 ? '+' : ''}{jornadaData.diff}h</span></p>
            <div className="flex gap-2 flex-wrap mb-4">
              <span className="px-2 py-1 rounded-lg bg-revelio-blue/10 text-revelio-blue text-[10px] font-semibold">L-J {calendario.daily_hours_lj}h</span>
              <span className="px-2 py-1 rounded-lg bg-revelio-violet/10 text-revelio-violet text-[10px] font-semibold">V {calendario.daily_hours_v}h</span>
              {calendario.intensive_start && <span className="px-2 py-1 rounded-lg bg-revelio-orange/10 text-revelio-orange text-[10px] font-semibold">Intensiva {calendario.daily_hours_intensive}h · {calendario.intensive_start} → {calendario.intensive_end}</span>}
              <span className="px-2 py-1 rounded-lg bg-revelio-green/10 text-revelio-green text-[10px] font-semibold">{calendario.vacation_days} vac</span>
            </div>
            <table className="w-full text-[10px]">
              <thead><tr className="bg-revelio-bg dark:bg-revelio-dark-border"><th className="px-2 py-1.5 text-left font-semibold text-revelio-subtle uppercase">Mes</th><th className="px-2 py-1.5 text-right font-semibold text-revelio-subtle uppercase">Días</th><th className="px-2 py-1.5 text-right font-semibold text-revelio-subtle uppercase">Aus.</th><th className="px-2 py-1.5 text-right font-semibold text-revelio-subtle uppercase">Vac.</th><th className="px-2 py-1.5 text-right font-semibold text-revelio-subtle uppercase">Horas</th><th className="px-2 py-1.5 text-right font-semibold text-revelio-subtle uppercase">Acum.</th></tr></thead>
              <tbody>{jornadaData.months.map((m, i) => {
                const isCurrent = i === new Date().getMonth()
                return <tr key={i} className={`border-t border-revelio-border/30 dark:border-revelio-dark-border/30 ${isCurrent ? 'bg-revelio-blue/5 font-semibold' : ''}`}><td className="px-2 py-1.5 capitalize dark:text-revelio-dark-text">{m.label}</td><td className="px-2 py-1.5 text-right dark:text-revelio-dark-text">{m.days}</td><td className="px-2 py-1.5 text-right text-revelio-red">{m.aus || ''}</td><td className="px-2 py-1.5 text-right text-revelio-orange">{m.vac || ''}</td><td className="px-2 py-1.5 text-right text-revelio-blue">{m.hours}</td><td className="px-2 py-1.5 text-right dark:text-revelio-dark-text">{m.acum}</td></tr>
              })}</tbody>
              <tfoot><tr className="border-t-2 border-revelio-border dark:border-revelio-dark-border bg-revelio-bg dark:bg-revelio-dark-border font-bold"><td className="px-2 py-2 dark:text-revelio-dark-text">TOTAL</td><td className="px-2 py-2 text-right dark:text-revelio-dark-text">{jornadaData.totalDays}</td><td className="px-2 py-2 text-right text-revelio-red">{jornadaData.totalAus}</td><td className="px-2 py-2 text-right text-revelio-orange">{jornadaData.totalVac}</td><td className="px-2 py-2 text-right text-revelio-blue">{jornadaData.totalHours}</td><td className="px-2 py-2 text-right dark:text-revelio-dark-text">{jornadaData.totalHours}</td></tr></tfoot>
            </table>
          </div>
        </div>
      )}
      {tab === 'jornada' && !calendario && <p className="text-sm text-revelio-subtle text-center py-10">Sin calendario asignado. Configúralo en tu perfil.</p>}

      {/* Retro modal */}
      {showRetroModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowRetroModal(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-revelio-dark-card rounded-2xl max-w-sm w-full p-5 shadow-xl">
            <h3 className="text-sm font-semibold dark:text-revelio-dark-text mb-2">Fichaje retroactivo</h3>
            <p className="text-xs text-revelio-subtle mb-1 capitalize">{parse(showRetroModal).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <p className="text-[9px] text-revelio-orange mb-3">Requiere aprobación del SM.</p>
            <div className="flex gap-2 items-center mb-4"><input type="number" value={retroHours} onChange={e => setRetroHours(e.target.value)} placeholder={String(getTargetHours(calendario, showRetroModal))} step={0.5} min={0} max={24} className="flex-1 rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-sm outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" autoFocus /><span className="text-xs text-revelio-subtle">horas</span></div>
            <div className="flex gap-2"><button onClick={() => setShowRetroModal(null)} className="flex-1 py-2 rounded-lg border border-revelio-border text-sm font-medium text-revelio-subtle">Cancelar</button><button onClick={submitRetro} disabled={!retroHours} className="flex-1 py-2 rounded-lg bg-revelio-orange text-white text-sm font-semibold disabled:opacity-40">Enviar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
