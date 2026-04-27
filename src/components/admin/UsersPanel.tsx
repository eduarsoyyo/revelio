import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/data/supabase'
import type { Member } from '@/types'
import { Plus, Edit, Trash2, Search, DollarSign, X, Upload, Download, List, Clock, Briefcase } from 'lucide-react'
import { soundCreate, soundDelete } from '@/lib/sounds'

const uid = () => crypto.randomUUID()
const AVATARS = ['👤','🧙','🧙‍♀️','🦁','🐍','🦅','🦡','⚡','🌟','🔮','🏰','📚','🧪','🦋','🐉','🎯','🛡️','🌊','🔥','🌿','💎','🦊','🐺','🦉','🐝','🐙','🦄','🐧','🐻','🐬','🦈','🐢','🦇','🌸','🍀','🌙','☀️','🌈','🎲','🎭','🚀','🎸','🎨','🏆','🎪','🧬','🔬','💻','🎮','🎧','📱','🛸','🌍','🗡️','🏹','🧲','🔑','🗝️','🎩','👑']
const COLORS = ['#007AFF','#5856D6','#AF52DE','#FF2D55','#FF3B30','#FF9500','#FFCC00','#34C759','#00C7BE','#30B0C7','#5AC8FA','#8E8E93','#1D1D1F','#636366','#48484A','#D1D1D6','#0A84FF','#BF5AF2','#FF6482','#FF375F','#FFD60A','#32D74B','#64D2FF','#AC8E68']
const ROLE_COLORS: Record<string, string> = { 'Service Manager': '#FF3B30', 'Jefe de Proyecto': '#FF9500', 'Jefe de proyecto': '#FF9500', 'Scrum Master': '#007AFF', 'Product Owner': '#5856D6', 'Consultor': '#34C759', 'PMO': '#FF9500', 'Tech Lead': '#FF6482', 'DevOps': '#5AC8FA', 'QA / Tester': '#FF2D55', 'Analista Funcional': '#AF52DE', 'Desarrollador/a': '#00C7BE' }

interface CostRate { from: string; to?: string; rate: number }
interface ProjectAssign { slug: string; dedication: number; from: string; to: string }
interface OrgRow { id?: string; member_id: string; sala: string; dedication: number; start_date: string; end_date: string }
interface TimeEntry { member_id: string; date: string; hours: number; status: string; sala: string }
interface AbsenceReq { member_id: string; type: string; date_from: string; date_to: string; days: number; status: string }
interface CalFull { id: string; name: string; convenio_hours: number; daily_hours_lj: number; daily_hours_v: number; daily_hours_intensive: number; intensive_start: string; intensive_end: string; holidays: Array<{ date: string; name: string }> }

interface UserForm { name: string; username: string; password: string; email: string; company: string; role_label: string; avatar: string; color: string; is_superuser: boolean; calendario_id: string; cost_rates: CostRate[]; hire_date: string; contract_type: string; convenio: string; projects: ProjectAssign[]; responsable_id: string; vacation_carryover: number }
const emptyForm: UserForm = { name: '', username: '', password: '', email: '', company: 'ALTEN', role_label: '', avatar: '👤', color: '#007AFF', is_superuser: false, calendario_id: '', cost_rates: [], hire_date: '', contract_type: 'indefinido', convenio: '', projects: [], responsable_id: '', vacation_carryover: 0 }

function getCurrentRate(rates: CostRate[]): number {
  if (!rates || rates.length === 0) return 0
  const now = new Date().toISOString().slice(0, 7)
  const sorted = [...rates].sort((a, b) => b.from.localeCompare(a.from))
  return (sorted.find(r => r.from <= now && (!r.to || r.to >= now)) || sorted[0])?.rate || 0
}

type ViewMode = 'general' | 'jornada' | 'cdc'

// Calendar helpers
function getHolidaySet(cal: CalFull | null, yr: number): Set<string> {
  const s = new Set<string>()
  if (!cal) return s
  for (const h of cal.holidays || []) s.add(h.date.length === 10 ? h.date : `${yr}-${h.date}`)
  return s
}
function holidayCountYr(cal: CalFull | null, yr: number): number {
  if (!cal) return 0
  return (cal.holidays || []).filter(h => { const f = h.date.length === 10 ? h.date : `${yr}-${h.date}`; const d = new Date(f); return d.getFullYear() === yr && d.getDay() !== 0 && d.getDay() !== 6 }).length
}
function expectedHoursToDate(cal: CalFull | null, yr: number, toStr: string): number {
  if (!cal) return 0
  const hS = getHolidaySet(cal, yr); const intS = cal.intensive_start || '08-01'; const intE = cal.intensive_end || '08-31'
  let h = 0; const d = new Date(yr, 0, 1); const end = new Date(toStr)
  while (d <= end) { const dw = d.getDay(); const ds = d.toISOString().slice(0, 10); const mm = ds.slice(5)
    if (dw !== 0 && dw !== 6 && !hS.has(ds)) { if (mm >= intS && mm <= intE) h += cal.daily_hours_intensive || 7; else if (dw === 5) h += cal.daily_hours_v || 8; else h += cal.daily_hours_lj || 8 }
    d.setDate(d.getDate() + 1) }
  return h
}
function workDaysToDate(cal: CalFull | null, yr: number, toStr: string): number {
  const hS = getHolidaySet(cal, yr); let days = 0; const d = new Date(yr, 0, 1); const end = new Date(toStr)
  while (d <= end) { if (d.getDay() !== 0 && d.getDay() !== 6 && !hS.has(d.toISOString().slice(0, 10))) days++; d.setDate(d.getDate() + 1) }
  return days
}
function vacDaysApproved(absences: AbsenceReq[], memberId: string, yr: number): number {
  return absences.filter(a => a.member_id === memberId && a.status === 'aprobada' && a.type === 'vacaciones' && a.date_from.startsWith(String(yr))).reduce((s, a) => s + a.days, 0)
}
function ausDaysApproved(absences: AbsenceReq[], memberId: string, yr: number): number {
  return absences.filter(a => a.member_id === memberId && a.status === 'aprobada' && a.type !== 'vacaciones' && a.date_from.startsWith(String(yr))).reduce((s, a) => s + a.days, 0)
}
const fmtN = (n: number): string => { const [i, de] = n.toFixed(1).split('.'); return `${i!.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${de}` }

export function UsersPanel() {
  const [members, setMembers] = useState<Member[]>([])
  const [rooms, setRooms] = useState<Array<{ slug: string; name: string }>>([])
  const [roles, setRoles] = useState<string[]>([])
  const [calendarios, setCalendarios] = useState<CalFull[]>([])
  const [orgChart, setOrgChart] = useState<OrgRow[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [absReqs, setAbsReqs] = useState<AbsenceReq[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('general')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editMember, setEditMember] = useState<Member | null>(null)
  const [form, setForm] = useState<UserForm>({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [tab, setTab] = useState<'general' | 'costes' | 'contrato'>('general')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const rx = (m: Member) => m as unknown as Record<string, unknown>
  const today = new Date().toISOString().slice(0, 10)
  const yr = new Date().getFullYear()

  // Derived helpers
  const getCal = (m: Member): CalFull | null => { const cid = m.calendario_id || (rx(m).calendario_id as string); return cid ? calendarios.find(c => c.id === cid) || null : null }
  const calNameOf = (m: Member) => getCal(m)?.name || '—'
  const memberDedToday = (m: Member) => orgChart.filter(o => o.member_id === m.id && (o.start_date || '2000-01-01') <= today && (o.end_date || '2099-12-31') >= today).reduce((s, o) => s + (o.dedication || 0), 0)
  const memberProjects = (m: Member) => (m.rooms || []).map(slug => rooms.find(r => r.slug === slug)?.name || slug)

  // Fichadas: real hours from time_entries YTD (excluding rejected and _pendiente)
  const fichadasYTD = (m: Member): number => {
    return timeEntries.filter(e => e.member_id === m.id && e.status !== 'rejected' && e.sala !== '_pendiente').reduce((s, e) => s + e.hours, 0)
  }
  // Expected hours to today from calendar, minus vac+aus days
  const expectedH = (m: Member): number => {
    const cal = getCal(m)
    const vacD = vacDaysApproved(absReqs, m.id, yr)
    const ausD = ausDaysApproved(absReqs, m.id, yr)
    const raw = expectedHoursToDate(cal, yr, today)
    const avgH = cal?.daily_hours_lj || 8
    return Math.max(0, raw - vacD * avgH - ausD * avgH)
  }
  const vacPend = (m: Member): number => {
    const total = (m.annual_vac_days || 22) + (m.prev_year_pending || 0) + (Number(rx(m).vacation_carryover) || 0)
    return Math.max(0, total - vacDaysApproved(absReqs, m.id, yr))
  }
  const vacTotal = (m: Member): number => (m.annual_vac_days || 22) + (m.prev_year_pending || 0) + (Number(rx(m).vacation_carryover) || 0)

  // Import/export
  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([['nombre*','email*','usuario','contraseña','empresa','rol','contrato','fecha_alta','coste_hora','calendario','responsable_email','vacaciones_pendientes','telefono'],['Juan Pérez','juan@empresa.com','jperez','revelio2026','ALTEN','Consultor','indefinido','2024-01-15','25','Madrid 2026','jefe@empresa.com','3','666123456']])
    ws['!cols'] = [{wch:22},{wch:28},{wch:12},{wch:14},{wch:10},{wch:18},{wch:12},{wch:12},{wch:10},{wch:16},{wch:24},{wch:20},{wch:12}]
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Usuarios'); XLSX.writeFile(wb, 'plantilla_usuarios_revelio.xlsx')
  }
  const handleImportExcel = async (file: File) => {
    setImporting(true); setImportResult(null)
    try {
      const XLSX = await import('xlsx'); const buf = await file.arrayBuffer(); const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]!]; if (!ws) throw new Error('Hoja vacía')
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws); let created = 0; const errors: string[] = []
      for (const row of rows) {
        const name = String(row['nombre'] || row['name'] || '').trim(); if (!name) continue
        const email = String(row['email'] || '').trim(); const id = crypto.randomUUID()
        const { error: tmErr } = await supabase.from('team_members').insert({ id, name, username: email.split('@')[0] || name.toLowerCase().replace(/\s+/g,'.'), email, avatar: AVATARS[Math.floor(Math.random()*AVATARS.length)]||'👤', color: COLORS[Math.floor(Math.random()*COLORS.length)]||'#007AFF', company: String(row['empresa']||'ALTEN'), role_label: String(row['rol']||''), is_superuser: false, rooms: [], cost_rates: [], preferences: {} })
        if (tmErr) { errors.push(`${name}: ${tmErr.message}`); continue }
        if (email) { const { error: aE } = await supabase.rpc('create_auth_user', { user_email: email, user_password: String(row['contraseña']||'revelio2026'), user_id: id }); if (aE) errors.push(`${name} auth: ${aE.message}`) }
        created++
      }
      setImportResult(`${created} creados${errors.length ? `. Errores: ${errors.join('; ')}` : ''}`)
      const { data } = await supabase.from('team_members').select('*').order('name'); if (data) setMembers(data)
    } catch (e) { setImportResult(`Error: ${(e as Error).message}`) }
    setImporting(false)
  }

  useEffect(() => {
    const yrStr = String(yr)
    Promise.all([
      supabase.from('team_members').select('*').order('name'),
      supabase.from('rooms').select('slug, name').order('name'),
      supabase.from('calendarios').select('*').order('name'),
      supabase.from('org_chart').select('*'),
      supabase.from('time_entries').select('member_id, date, hours, status, sala').gte('date', `${yrStr}-01-01`).lte('date', `${yrStr}-12-31`),
      supabase.from('absence_requests').select('member_id, type, date_from, date_to, days, status'),
    ]).then(([mR, rR, cR, oR, tR, aR]) => {
      if (mR.data) setMembers(mR.data)
      if (rR.data) setRooms(rR.data)
      if (cR.data) setCalendarios(cR.data as CalFull[])
      if (oR.data) setOrgChart(oR.data as OrgRow[])
      if (tR.data) setTimeEntries(tR.data as TimeEntry[])
      if (aR.data) setAbsReqs(aR.data as AbsenceReq[])
      setLoading(false)
    })
    supabase.from('admin_roles').select('*').order('name').then(({ data }) => {
      if (data && data.length > 0) { setRoles(data.map((r: Record<string, unknown>) => String(r.name||r.label||'')).filter(Boolean)); return }
      supabase.from('roles').select('*').order('label').then(({ data: r2 }) => { if (r2?.length) setRoles(r2.map((r: Record<string, unknown>) => String(r.label||r.name||'')).filter(Boolean)) })
    })
  }, [])

  const filtered = useMemo(() => { const q = search.toLowerCase(); return members.filter(m => m.name.toLowerCase().includes(q) || (m.username||'').toLowerCase().includes(q) || (m.role_label||'').toLowerCase().includes(q) || (m.email||'').toLowerCase().includes(q)) }, [members, search])

  // CRUD
  const openCreate = () => { setForm({...emptyForm}); setEditMember(null); setTab('general'); setSaveError(''); setModal('create') }
  const openEdit = (m: Member) => {
    const crRaw = rx(m).cost_rates; const costRates: CostRate[] = Array.isArray(crRaw) ? crRaw as CostRate[] : []
    const myOrg = orgChart.filter(o => o.member_id === m.id)
    const projects: ProjectAssign[] = (m.rooms||[]).map(slug => { const org = myOrg.find(o => o.sala === slug); return { slug, dedication: org ? Math.round(org.dedication*100) : 100, from: org?.start_date||'', to: org?.end_date||'' } })
    setForm({ name: m.name, username: m.username||'', password: '', email: m.email||'', company: m.company||'ALTEN', role_label: m.role_label||'', avatar: m.avatar||'👤', color: m.color||'#007AFF', is_superuser: m.is_superuser||false, calendario_id: (rx(m).calendario_id as string)||'', cost_rates: costRates, hire_date: (rx(m).hire_date as string)||'', contract_type: (rx(m).contract_type as string)||'indefinido', convenio: (rx(m).convenio as string)||'', projects, responsable_id: (rx(m).responsable_id as string)||'', vacation_carryover: Number(rx(m).vacation_carryover)||0 })
    setEditMember(m); setTab('general'); setSaveError(''); setModal('edit')
  }
  const toggleProject = (slug: string) => { const has = form.projects.find(p => p.slug === slug); if (has) setForm({...form, projects: form.projects.filter(p => p.slug !== slug)}); else setForm({...form, projects: [...form.projects, { slug, dedication: 100, from: '', to: '' }]}) }
  const updProject = (slug: string, field: keyof ProjectAssign, val: string | number) => { setForm({...form, projects: form.projects.map(p => p.slug === slug ? {...p, [field]: val} : p)}) }
  const handleSave = async () => {
    setSaving(true); setSaveError('')
    const roomSlugs = form.projects.map(p => p.slug)
    const payload: Record<string, unknown> = { name: form.name, username: form.username, email: form.email, company: form.company, role_label: form.role_label, avatar: form.avatar, color: form.color, rooms: roomSlugs, is_superuser: form.is_superuser, calendario_id: form.calendario_id||null, cost_rates: form.cost_rates, cost_rate: getCurrentRate(form.cost_rates), hire_date: form.hire_date||null, contract_type: form.contract_type, convenio: form.convenio||null, responsable_id: form.responsable_id||null, vacation_carryover: form.vacation_carryover||0 }
    let memberId = editMember?.id || ''
    if (modal === 'create') {
      memberId = uid()
      const { data, error } = await supabase.from('team_members').insert({ id: memberId, ...payload }).select().single()
      if (error) { setSaveError(error.message); setSaving(false); return }
      if (data) { setMembers(prev => [...prev, data]); soundCreate() }
      if (form.email && form.password) void supabase.rpc('create_auth_user', { user_email: form.email, user_password: form.password, user_id: memberId })
    } else if (editMember) {
      const { data, error } = await supabase.from('team_members').update(payload).eq('id', editMember.id).select().single()
      if (error) { setSaveError(error.message); setSaving(false); return }
      if (data) { setMembers(prev => prev.map(m => m.id === editMember.id ? data : m)); soundCreate() }
      if (form.password) void supabase.rpc('update_auth_password', { target_user_id: editMember.id, new_password: form.password })
      if (form.email && form.email !== editMember.email) void supabase.rpc('update_auth_email', { target_user_id: editMember.id, new_email: form.email })
    }
    for (const pa of form.projects) { const ex = orgChart.find(o => o.member_id === memberId && o.sala === pa.slug); if (ex?.id) await supabase.from('org_chart').update({ dedication: pa.dedication/100, start_date: pa.from||null, end_date: pa.to||null }).eq('id', ex.id); else await supabase.from('org_chart').insert({ member_id: memberId, sala: pa.slug, dedication: pa.dedication/100, start_date: pa.from||null, end_date: pa.to||null }) }
    for (const s of (editMember?.rooms||[]).filter(s => !roomSlugs.includes(s))) await supabase.from('org_chart').delete().eq('member_id', memberId).eq('sala', s)
    const { data: newOrg } = await supabase.from('org_chart').select('*'); if (newOrg) setOrgChart(newOrg as OrgRow[])
    setSaving(false); setModal(null)
  }
  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirm !== deleteTarget.name) return
    await supabase.from('team_members').delete().eq('id', deleteTarget.id)
    await supabase.from('org_chart').delete().eq('member_id', deleteTarget.id)
    void supabase.rpc('delete_auth_user', { target_user_id: deleteTarget.id })
    setMembers(prev => prev.filter(m => m.id !== deleteTarget.id)); setDeleteTarget(null); setDeleteConfirm(''); soundDelete()
  }

  if (loading) return <div className="text-sm text-revelio-subtle dark:text-revelio-dark-subtle text-center py-10">Cargando...</div>

  const views: { id: ViewMode; icon: typeof List; label: string }[] = [{ id: 'general', icon: List, label: 'General' }, { id: 'jornada', icon: Clock, label: 'Vacaciones / Jornada' }, { id: 'cdc', icon: Briefcase, label: 'CdC' }]
  const th = 'px-2 py-2 text-[8px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase whitespace-nowrap border-b-2 border-revelio-border dark:border-revelio-dark-border'
  const td = 'px-2 py-2 border-b border-revelio-border/50 dark:border-revelio-dark-border/50 text-[10px]'

  return (
    <div className="max-w-[1200px]">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div><h2 className="text-lg font-semibold text-revelio-text dark:text-revelio-dark-text">Equipo</h2><p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">{members.length} personas</p></div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex rounded-lg overflow-hidden border border-revelio-border dark:border-revelio-dark-border">
            {views.map(v => (<button key={v.id} onClick={() => setViewMode(v.id)} className={`flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold transition-colors ${viewMode === v.id ? 'bg-revelio-text dark:bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle hover:bg-revelio-bg dark:hover:bg-revelio-dark-border'}`}><v.icon className="w-3 h-3" />{v.label}</button>))}
          </div>
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-revelio-subtle" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-8 pr-3 py-1.5 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs outline-none w-40 dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
          <button onClick={downloadTemplate} className="px-3 py-1.5 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs font-medium text-revelio-subtle flex items-center gap-1 hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><Download className="w-3.5 h-3.5" /> Plantilla</button>
          <label className="px-3 py-1.5 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs font-medium text-revelio-subtle flex items-center gap-1 cursor-pointer hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><Upload className="w-3.5 h-3.5" /> {importing ? 'Importando...' : 'Importar'}<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImportExcel(f); e.target.value = '' }} disabled={importing} /></label>
          <button onClick={openCreate} className="px-3 py-1.5 rounded-lg bg-revelio-text dark:bg-revelio-blue text-white text-xs font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nueva persona</button>
        </div>
      </div>
      {importResult && (<div className={`rounded-lg px-4 py-2 mb-3 text-xs font-medium ${importResult.includes('Error') ? 'bg-revelio-red/10 text-revelio-red' : 'bg-revelio-green/10 text-revelio-green'}`}>{importResult}<button onClick={() => setImportResult(null)} className="ml-2 text-revelio-subtle hover:underline">Cerrar</button></div>)}

      {/* TABLE */}
      <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card overflow-hidden"><div className="overflow-x-auto"><table className="w-full border-collapse">

        {/* ─── GENERAL ─── */}
        {viewMode === 'general' && <><thead><tr className="bg-revelio-bg/50 dark:bg-revelio-dark-border/30"><th className={th}></th><th className={`${th} text-left`}>Nombre</th><th className={th}>Usuario</th><th className={th}>Email</th><th className={th}>Empresa</th><th className={th}>Rol</th><th className={th}>Proyectos</th><th className={th}>Dedicación</th><th className={th}>Sin asignar</th><th className={th}>Calendario</th><th className={th}>Vac. pend.</th><th className={th}>Admin</th><th className={th}>Estado</th><th className={th}></th></tr></thead>
        <tbody>{filtered.map((m, i) => { const ded = memberDedToday(m); const inter = Math.max(0, 1-ded); const showIC = inter > 0; const vp = vacPend(m); const projs = memberProjects(m); const status = (rx(m).contract_type as string) === 'inactive' ? 'inactive' : 'active'; return (
          <tr key={m.id} className={`${i%2 ? 'bg-revelio-bg/20 dark:bg-revelio-dark-border/10' : ''} hover:bg-revelio-blue/5`}>
            <td className={`${td} text-center`}><span className="text-base" style={{color:m.color}}>{m.avatar||'👤'}</span></td>
            <td className={`${td} font-semibold text-revelio-blue cursor-pointer whitespace-nowrap`} onClick={() => openEdit(m)}>{m.name}</td>
            <td className={`${td} text-center text-revelio-subtle dark:text-revelio-dark-subtle`}>{m.username||'—'}</td>
            <td className={`${td} text-center text-revelio-subtle dark:text-revelio-dark-subtle text-[9px]`}>{m.email||'—'}</td>
            <td className={`${td} text-center dark:text-revelio-dark-text`}>{m.company||'—'}</td>
            <td className={`${td} text-center`}>{m.role_label ? <span className="text-[8px] font-semibold px-2 py-0.5 rounded" style={{background:(ROLE_COLORS[m.role_label]||'#5856D6')+'18',color:ROLE_COLORS[m.role_label]||'#5856D6'}}>{m.role_label}</span> : '—'}</td>
            <td className={`${td} text-center max-w-[140px]`}><div className="flex gap-0.5 flex-wrap justify-center">{projs.length > 0 ? projs.map((p,pi) => <span key={pi} className="text-[7px] font-semibold px-1.5 py-0.5 rounded bg-revelio-blue/10 text-revelio-blue truncate max-w-[80px]">{p}</span>) : <span className="text-revelio-subtle">—</span>}</div></td>
            <td className={`${td} text-center font-bold`} style={{color:ded>1?'#FF3B30':ded===1?'#34C759':ded>0?'#FF9500':'#8E8E93'}}>{Math.round(ded*100)}%</td>
            <td className={`${td} text-center font-semibold`} style={{color:showIC?'#FF9500':'#D1D1D6'}}>{showIC?`${Math.round(inter*100)}%`:'—'}</td>
            <td className={`${td} text-center dark:text-revelio-dark-text text-[9px]`}>{calNameOf(m)}</td>
            <td className={`${td} text-center font-bold`} style={{color:vp>10?'#34C759':vp>0?'#FF9500':'#8E8E93'}}>{vp}</td>
            <td className={`${td} text-center`}><input type="checkbox" checked={!!m.is_superuser} readOnly className="w-3.5 h-3.5 accent-revelio-violet pointer-events-none" /></td>
            <td className={`${td} text-center`}><span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded ${status==='active'?'bg-revelio-green/10 text-revelio-green':'bg-revelio-bg text-revelio-subtle'}`}>{status==='active'?'Activo':'Inactivo'}</span></td>
            <td className={`${td} text-center`}><div className="flex gap-1 justify-center"><button onClick={() => openEdit(m)} className="w-5 h-5 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><Edit className="w-2.5 h-2.5 text-revelio-blue" /></button><button onClick={() => {setDeleteTarget(m);setDeleteConfirm('')}} className="w-5 h-5 rounded border border-revelio-red/20 flex items-center justify-center hover:bg-revelio-red/5"><Trash2 className="w-2.5 h-2.5 text-revelio-red" /></button></div></td>
          </tr>) })}</tbody></>}

        {/* ─── JORNADA ─── */}
        {viewMode === 'jornada' && <><thead><tr className="bg-revelio-bg/50 dark:bg-revelio-dark-border/30"><th className={th}></th><th className={`${th} text-left`}>Nombre</th><th className={th}>Calendario</th><th className={th}>H. Convenio</th><th className={th}>H/Semana</th><th className={th}>Festivos</th><th className={th}>Vac. usadas</th><th className={th}>Vac. total</th><th className={th}>Vac. pend.</th><th className={th}>Ausencias</th><th className={th}>Días trab.</th><th className={th}>Fichado vs Esperado</th><th className={th}></th></tr></thead>
        <tbody>{filtered.map((m, i) => { const cal = getCal(m); const hols = holidayCountYr(cal,yr); const vU = vacDaysApproved(absReqs,m.id,yr); const vT = vacTotal(m); const vP = vacPend(m); const aus = ausDaysApproved(absReqs,m.id,yr); const dT = Math.max(0,workDaysToDate(cal,yr,today)-vU-aus); const fichH = fichadasYTD(m); const expH2 = expectedH(m); const diff = Math.round((fichH - expH2)*10)/10; const convH = cal?.convenio_hours || 0; return (
          <tr key={m.id} className={`${i%2?'bg-revelio-bg/20 dark:bg-revelio-dark-border/10':''} hover:bg-revelio-blue/5`}>
            <td className={`${td} text-center`}><span className="text-base" style={{color:m.color}}>{m.avatar||'👤'}</span></td>
            <td className={`${td} font-semibold text-revelio-blue cursor-pointer whitespace-nowrap`} onClick={() => openEdit(m)}>{m.name}</td>
            <td className={`${td} text-center dark:text-revelio-dark-text text-[9px]`}>{calNameOf(m)}</td>
            <td className={`${td} text-center font-bold dark:text-revelio-dark-text`}>{convH > 0 ? `${fmtN(convH)}h` : '—'}</td>
            <td className={`${td} text-center dark:text-revelio-dark-text`}>{cal ? '40h' : '—'}</td>
            <td className={`${td} text-center font-semibold`} style={{color:hols>0?'#FF3B30':'#8E8E93'}}>{hols}</td>
            <td className={`${td} text-center font-semibold`} style={{color:vU>0?'#007AFF':'#8E8E93'}}>{vU}</td>
            <td className={`${td} text-center dark:text-revelio-dark-text`}>{vT}</td>
            <td className={`${td} text-center font-bold`} style={{color:vP>10?'#34C759':vP>0?'#FF9500':'#FF3B30'}}>{vP}</td>
            <td className={`${td} text-center font-semibold`} style={{color:aus>0?'#FF9500':'#8E8E93'}}>{aus}</td>
            <td className={`${td} text-center font-semibold dark:text-revelio-dark-text`}>{dT}</td>
            <td className={`${td} text-center`}>
              <div className="flex flex-col items-center">
                <span className="font-bold text-revelio-blue">{fmtN(fichH)}h</span>
                <span className="text-[7px]" style={{color:diff>0?'#34C759':diff<0?'#FF3B30':'#8E8E93'}}>vs {fmtN(expH2)}h ({diff>0?'+':''}{fmtN(diff)})</span>
              </div>
            </td>
            <td className={`${td} text-center`}><button onClick={() => openEdit(m)} className="w-5 h-5 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><Edit className="w-2.5 h-2.5 text-revelio-blue" /></button></td>
          </tr>) })}</tbody></>}

        {/* ─── CdC ─── */}
        {viewMode === 'cdc' && <><thead><tr className="bg-revelio-bg/50 dark:bg-revelio-dark-border/30"><th className={th}></th><th className={`${th} text-left`}>Persona</th><th className={th}>Rol</th><th className={th}>Coste</th><th className={th}>Convenio</th><th className={th}>Fichadas</th><th className={th}>Esperadas</th><th className={th}>Diferencia</th><th className={th}>Asignación</th><th className={th}>Sin asignar</th><th className={th}></th></tr></thead>
        <tbody>{filtered.map((m, i) => { const cal = getCal(m); const crRaw = rx(m).cost_rates; const cost = getCurrentRate(Array.isArray(crRaw)?crRaw as CostRate[]:[]); const fichH = fichadasYTD(m); const expH2 = expectedH(m); const diff = Math.round((fichH-expH2)*10)/10; const ded = memberDedToday(m); const inter = Math.max(0,1-ded); const rc = ROLE_COLORS[m.role_label||'']||'#5856D6'; const convH = cal?.convenio_hours || 0; return (
          <tr key={m.id} className={`${i%2?'bg-revelio-bg/20 dark:bg-revelio-dark-border/10':''} hover:bg-revelio-blue/5`}>
            <td className={`${td} text-center`}><span className="text-base" style={{color:m.color}}>{m.avatar||'👤'}</span></td>
            <td className={`${td} cursor-pointer whitespace-nowrap`} onClick={() => openEdit(m)}><p className="font-semibold text-revelio-blue">{m.name}</p><p className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle">{m.company||'—'}</p></td>
            <td className={`${td} text-center`}>{m.role_label?<span className="text-[8px] font-semibold px-2 py-0.5 rounded" style={{background:rc+'18',color:rc}}>{m.role_label}</span>:'—'}</td>
            <td className={`${td} text-center`}>{cost>0?<span className="font-bold text-revelio-green flex items-center justify-center gap-0.5"><DollarSign className="w-2.5 h-2.5" />{cost}€/h</span>:<span className="text-revelio-subtle">—</span>}</td>
            <td className={`${td} text-center font-semibold dark:text-revelio-dark-text`}>{convH > 0 ? `${fmtN(convH)}h` : '—'}</td>
            <td className={`${td} text-center font-semibold text-revelio-blue`}>{fmtN(fichH)}h</td>
            <td className={`${td} text-center font-semibold dark:text-revelio-dark-text`}>{fmtN(expH2)}h</td>
            <td className={`${td} text-center font-bold`} style={{color:diff>0?'#34C759':diff<0?'#FF3B30':'#8E8E93'}}>{diff>0?'+':''}{fmtN(diff)}h</td>
            <td className={`${td} text-center`}><div className="flex items-center gap-1.5 justify-center"><div className="w-10 h-1.5 rounded-full bg-revelio-bg dark:bg-revelio-dark-border overflow-hidden"><div className="h-full rounded-full" style={{width:`${Math.min(100,ded*100)}%`,background:ded>1?'#FF3B30':ded===1?'#34C759':'#FF9500'}} /></div><span className="text-[9px] font-bold" style={{color:ded>1?'#FF3B30':ded===1?'#34C759':ded>0?'#FF9500':'#8E8E93'}}>{Math.round(ded*100)}%</span></div></td>
            <td className={`${td} text-center font-semibold`} style={{color:inter>0?'#FF9500':'#D1D1D6'}}>{inter>0?`${Math.round(inter*100)}%`:'—'}</td>
            <td className={`${td} text-center`}><button onClick={() => openEdit(m)} className="w-5 h-5 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><Edit className="w-2.5 h-2.5 text-revelio-blue" /></button></td>
          </tr>) })}</tbody></>}

      </table></div></div>

      {/* MODAL CREATE/EDIT */}
      {modal && (<div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}><div onClick={e => e.stopPropagation()} className="bg-white dark:bg-revelio-dark-card rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[85vh] overflow-y-auto">
        <h3 className="text-base font-semibold mb-3 dark:text-revelio-dark-text">{modal==='create'?'Nueva persona':`Editar: ${form.name}`}</h3>
        <div className="flex gap-0.5 bg-revelio-bg dark:bg-revelio-dark-border rounded-lg overflow-hidden mb-4">{(['general','costes','contrato'] as const).map(t => <button key={t} onClick={() => setTab(t)} className={`flex-1 py-1.5 text-[10px] font-semibold ${tab===t?'bg-revelio-blue text-white':'text-revelio-subtle dark:text-revelio-dark-subtle'}`}>{t==='general'?'General':t==='costes'?'Costes':'Contrato'}</button>)}</div>
        {tab === 'general' && (<div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><div><L>Nombre *</L><I value={form.name} onChange={v => setForm({...form,name:v})} /></div><div><L>Username</L><I value={form.username} onChange={v => setForm({...form,username:v})} /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><L>Email</L><I value={form.email} onChange={v => setForm({...form,email:v})} /></div><div><L>Contraseña</L><input type="password" value={form.password} onChange={e => setForm({...form,password:e.target.value})} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" placeholder={modal==='edit'?'vacío = mantener':''} /></div></div>
          <div><L>Rol</L><select value={form.role_label} onChange={e => setForm({...form,role_label:e.target.value})} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text"><option value="">Sin rol</option>{roles.map(r => <option key={r} value={r}>{r}</option>)}</select></div>
          <div><L>Avatar</L><div className="flex gap-0.5 flex-wrap max-h-[100px] overflow-y-auto rounded-lg border border-revelio-border/30 dark:border-revelio-dark-border/30 p-1.5">{AVATARS.map(a => <button key={a} onClick={() => setForm({...form,avatar:a})} className={`w-7 h-7 rounded text-sm flex items-center justify-center ${form.avatar===a?'ring-2 ring-revelio-blue bg-revelio-blue/10':'hover:bg-revelio-bg dark:hover:bg-revelio-dark-border'}`}>{a}</button>)}</div></div>
          <div><L>Color</L><div className="flex gap-1 flex-wrap">{COLORS.map(c => <button key={c} onClick={() => setForm({...form,color:c})} className={`w-6 h-6 rounded-full ${form.color===c?'ring-2 ring-offset-1 ring-revelio-text dark:ring-revelio-dark-text':''}`} style={{background:c}} />)}</div><div className="mt-1.5 text-2xl w-10 h-10 flex items-center justify-center rounded-xl" style={{background:form.color+'20',color:form.color}}>{form.avatar}</div></div>
          <div><L>Proyectos asignados</L><div className="flex gap-1 flex-wrap mb-2">{rooms.map(r => {const a=form.projects.some(p=>p.slug===r.slug);return <button key={r.slug} onClick={()=>toggleProject(r.slug)} className={`px-2 py-0.5 rounded text-[9px] font-semibold ${a?'bg-revelio-blue text-white':'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}>{r.name}</button>})}</div>
            {form.projects.length>0 && <div className="space-y-1.5">{form.projects.map(pa => {const rN=rooms.find(r=>r.slug===pa.slug)?.name||pa.slug;return(<div key={pa.slug} className="rounded-lg bg-revelio-bg dark:bg-revelio-dark-border px-3 py-2"><div className="flex items-center justify-between mb-1"><span className="text-[10px] font-semibold text-revelio-blue">{rN}</span><button onClick={()=>toggleProject(pa.slug)} className="text-revelio-subtle hover:text-revelio-red"><X className="w-3 h-3" /></button></div><div className="grid grid-cols-3 gap-2"><div><label className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle">Dedicación %</label><input type="number" value={pa.dedication} onChange={e=>updProject(pa.slug,'dedication',Number(e.target.value))} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-2 py-1 text-[10px] outline-none text-right dark:bg-revelio-dark-bg dark:text-revelio-dark-text" min={0} max={100} step={5} /></div><div><label className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle">Desde</label><input type="date" value={pa.from} onChange={e=>updProject(pa.slug,'from',e.target.value)} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-1.5 py-1 text-[10px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div><div><label className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle">Hasta</label><input type="date" value={pa.to} onChange={e=>updProject(pa.slug,'to',e.target.value)} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-1.5 py-1 text-[10px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div></div></div>)})}</div>}
          </div>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_superuser} onChange={e => setForm({...form,is_superuser:e.target.checked})} className="w-4 h-4 accent-revelio-violet rounded" /><span className="text-xs dark:text-revelio-dark-text">Superusuario (admin)</span></label>
        </div>)}
        {tab === 'costes' && (<div className="space-y-4"><div><div className="flex items-center justify-between mb-2"><L>Coste empresa (€/hora)</L><button onClick={() => setForm({...form,cost_rates:[...form.cost_rates,{from:new Date().toISOString().slice(0,7),rate:0}]})} className="text-[9px] text-revelio-blue font-medium flex items-center gap-0.5"><Plus className="w-3 h-3" /> Periodo</button></div>
          {form.cost_rates.length===0 && <p className="text-[10px] text-revelio-subtle bg-revelio-bg dark:bg-revelio-dark-border rounded-lg px-3 py-2">Sin costes definidos.</p>}
          {form.cost_rates.map((cr,i) => (<div key={i} className="flex gap-2 items-center mb-2 bg-revelio-bg dark:bg-revelio-dark-border rounded-lg px-3 py-2"><div className="flex-1 grid grid-cols-3 gap-2"><div><label className="text-[8px] text-revelio-subtle">Desde</label><input type="month" value={cr.from} onChange={e=>{const n=[...form.cost_rates];n[i]={...n[i]!,from:e.target.value};setForm({...form,cost_rates:n})}} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-2 py-1 text-[10px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div><div><label className="text-[8px] text-revelio-subtle">Hasta</label><input type="month" value={cr.to||''} onChange={e=>{const n=[...form.cost_rates];n[i]={...n[i]!,to:e.target.value||undefined};setForm({...form,cost_rates:n})}} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-2 py-1 text-[10px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" placeholder="actual" /></div><div><label className="text-[8px] text-revelio-subtle">€/hora</label><input type="number" value={cr.rate||''} onChange={e=>{const n=[...form.cost_rates];n[i]={...n[i]!,rate:Number(e.target.value)};setForm({...form,cost_rates:n})}} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-2 py-1 text-[10px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text text-right font-bold" step={0.5} /></div></div><button onClick={()=>setForm({...form,cost_rates:form.cost_rates.filter((_,j)=>j!==i)})} className="text-revelio-subtle hover:text-revelio-red"><X className="w-3 h-3" /></button></div>))}
          {form.cost_rates.length>0 && <div className="bg-revelio-green/5 border border-revelio-green/20 rounded-lg px-3 py-2"><p className="text-[9px] font-semibold dark:text-revelio-dark-text flex items-center gap-1"><DollarSign className="w-3 h-3 text-revelio-green" /> Coste actual: <span className="text-revelio-green font-bold">{getCurrentRate(form.cost_rates)}€/h</span></p></div>}
        </div></div>)}
        {tab === 'contrato' && (<div className="space-y-3">
          <div className="grid grid-cols-2 gap-3"><div><L>Fecha de alta</L><input type="date" value={form.hire_date} onChange={e=>setForm({...form,hire_date:e.target.value})} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div><div><L>Empresa</L><I value={form.company} onChange={v=>setForm({...form,company:v})} /></div></div>
          <div className="grid grid-cols-2 gap-3"><div><L>Tipo contrato</L><select value={form.contract_type} onChange={e=>setForm({...form,contract_type:e.target.value})} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text"><option value="indefinido">Indefinido</option><option value="temporal">Temporal</option><option value="practicas">Prácticas</option><option value="becario">Becario</option><option value="externo">Externo</option></select></div><div><L>Calendario</L><select value={form.calendario_id} onChange={e=>setForm({...form,calendario_id:e.target.value})} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text"><option value="">Sin calendario</option>{calendarios.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div></div>
          <div className="grid grid-cols-2 gap-3"><div><L>Responsable</L><select value={form.responsable_id} onChange={e=>setForm({...form,responsable_id:e.target.value})} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text"><option value="">Sin responsable</option>{members.filter(m=>m.is_superuser||m.role_label?.toLowerCase().includes('manager')).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></div><div><L>Vac. pend. año anterior</L><input type="number" value={form.vacation_carryover||0} onChange={e=>setForm({...form,vacation_carryover:Number(e.target.value)})} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" min={0} /></div></div>
        </div>)}
        {saveError && <div className="mt-2 bg-revelio-red/10 border border-revelio-red/20 rounded-lg px-3 py-2 text-[10px] text-revelio-red">{saveError}</div>}
        <div className="flex gap-2 mt-5"><button onClick={()=>setModal(null)} className="flex-1 py-2 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-sm font-medium text-revelio-subtle">Cancelar</button><button onClick={handleSave} disabled={saving||!form.name.trim()} className="flex-[2] py-2 rounded-lg bg-revelio-text dark:bg-revelio-blue text-white text-sm font-medium disabled:opacity-40">{saving?'Guardando...':modal==='create'?'Crear':'Guardar'}</button></div>
      </div></div>)}

      {/* DELETE */}
      {deleteTarget && (<div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={()=>setDeleteTarget(null)}><div onClick={e=>e.stopPropagation()} className="bg-white dark:bg-revelio-dark-card rounded-2xl max-w-sm w-full p-6 shadow-xl">
        <div className="text-center mb-4"><Trash2 className="w-8 h-8 text-revelio-red mx-auto mb-2" /><h3 className="font-semibold dark:text-revelio-dark-text">Eliminar persona</h3><p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mt-1">Escribe <strong className="text-revelio-red">{deleteTarget.name}</strong></p></div>
        <input value={deleteConfirm} onChange={e=>setDeleteConfirm(e.target.value)} onKeyDown={e=>e.key==='Enter'&&deleteConfirm===deleteTarget.name&&handleDelete()} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-sm outline-none focus:border-revelio-red mb-3 dark:bg-revelio-dark-bg dark:text-revelio-dark-text" autoFocus />
        <div className="flex gap-2"><button onClick={()=>setDeleteTarget(null)} className="flex-1 py-2 rounded-lg border border-revelio-border text-sm font-medium text-revelio-subtle">Cancelar</button><button onClick={handleDelete} disabled={deleteConfirm!==deleteTarget.name} className="flex-1 py-2 rounded-lg bg-revelio-red text-white text-sm font-medium disabled:opacity-30">Eliminar</button></div>
      </div></div>)}
    </div>
  )
}

function L({ children }: { children: React.ReactNode }) { return <label className="text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase block mb-1">{children}</label> }
function I({ value, onChange }: { value: string; onChange: (v: string) => void }) { return <input value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /> }
