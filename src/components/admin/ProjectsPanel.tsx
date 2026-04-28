import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/data/supabase'
import type { Room, Member } from '@/types'
import { Plus, Edit, Trash2, ExternalLink, Users, DollarSign, Calendar, X, Upload, Download, AlertTriangle } from 'lucide-react'
import { soundCreate, soundDelete } from '@/lib/sounds'

const TIPOS = [
  { id: 'agile', label: 'Agile / Scrum' }, { id: 'kanban', label: 'Kanban' },
  { id: 'itil', label: 'ITIL / Servicio' }, { id: 'waterfall', label: 'Waterfall' },
]
const DEFAULT_SS = 1.33

interface ServiceContract { id: string; name: string; from: string; to: string; cost: number; margin_pct: number; risk_pct: number }
interface OrgEntry { id?: string; member_id: string; sala: string; dedication: number; start_date: string; end_date: string }
interface CalFull { id: string; convenio_hours: number; daily_hours_lj: number; daily_hours_v: number; daily_hours_intensive: number; intensive_start: string; intensive_end: string; holidays: Array<{ date: string }> }
interface AbsReq { member_id: string; type: string; date_from: string; date_to: string; days: number; status: string }
interface LegacyCR { from: string; to?: string; salary?: number; rate?: number; multiplier?: number }

interface ProjectForm {
  name: string; slug: string; tipo: string; status: string
  start_date: string; end_date: string
  services: ServiceContract[]
}
const emptyForm: ProjectForm = { name: '', slug: '', tipo: 'agile', status: 'active', start_date: '', end_date: '', services: [] }

const fmt = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 })
const rx = (r: Room) => r as unknown as Record<string, unknown>
const rxm = (m: Member) => m as unknown as Record<string, unknown>
const saleFromService = (s: ServiceContract) => { const d = 1 - (s.margin_pct / 100) - ((s.risk_pct || 0) / 100); return d > 0 ? Math.round(s.cost / d) : 0 }
const uid = () => crypto.randomUUID().slice(0, 8)

function getHolidaySet(cal: CalFull | null, yr: number): Set<string> {
  const s = new Set<string>(); if (!cal) return s
  for (const h of cal.holidays || []) { const ds = typeof h === 'string' ? h : (h as { date: string }).date; s.add(ds.length === 10 ? ds : `${yr}-${ds}`) }
  return s
}
/** Effective theoretical hours for a person in a project YTD: dedication * calendar hours (minus vac+aus) from Jan 1 to today */
function memberProjectCostYTD(m: Member, orgDed: number, calendarios: CalFull[], absReqs: AbsReq[], yr: number, todayStr: string): number {
  const calId = rxm(m).calendario_id as string; const cal = calId ? calendarios.find(c => c.id === calId) || null : null
  if (!cal) return 0
  const hSet = getHolidaySet(cal, yr); const intS = cal.intensive_start || '08-01'; const intE = cal.intensive_end || '08-31'
  // Vac + aus days
  const vacD = absReqs.filter(a => a.member_id === m.id && a.status === 'aprobada' && a.type === 'vacaciones' && a.date_from.startsWith(String(yr))).reduce((s, a) => s + a.days, 0)
  const ausD = absReqs.filter(a => a.member_id === m.id && a.status === 'aprobada' && a.type !== 'vacaciones' && a.date_from.startsWith(String(yr))).reduce((s, a) => s + a.days, 0)
  // Hours from calendar YTD
  let h = 0; const d = new Date(yr, 0, 1); const end = new Date(todayStr)
  while (d <= end) { const dw = d.getDay(); const ds = d.toISOString().slice(0, 10); const mm = ds.slice(5)
    if (dw !== 0 && dw !== 6 && !hSet.has(ds)) { if (mm >= intS && mm <= intE) h += cal.daily_hours_intensive || 7; else if (dw === 5) h += cal.daily_hours_v || 8; else h += cal.daily_hours_lj || 8 }
    d.setDate(d.getDate() + 1) }
  const avgH = cal.daily_hours_lj || 8
  const effH = Math.max(0, h - (vacD + ausD) * avgH)
  // Cost rate from salary model
  const crArr = rxm(m).cost_rates as LegacyCR[] | undefined
  let costH = (rxm(m).cost_rate as number) || 0
  if (crArr && crArr.length > 0) {
    const now = new Date().toISOString().slice(0, 7)
    const sorted = [...crArr].sort((a, b) => b.from.localeCompare(a.from))
    const cur = sorted.find(r => r.from <= now && (!r.to || r.to >= now)) || sorted[0]
    if (cur?.salary) { costH = Math.round(((cur.salary * (cur.multiplier || DEFAULT_SS)) / (cal.convenio_hours || 1800)) * 100) / 100 }
    else if (cur?.rate) costH = cur.rate
  }
  return Math.round(effH * orgDed * costH)
}
/** Same but projected to end of year */
function memberProjectCostEOY(m: Member, orgDed: number, calendarios: CalFull[], absReqs: AbsReq[], yr: number): number {
  const calId = rxm(m).calendario_id as string; const cal = calId ? calendarios.find(c => c.id === calId) || null : null
  if (!cal) return 0
  const hSet = getHolidaySet(cal, yr); const intS = cal.intensive_start || '08-01'; const intE = cal.intensive_end || '08-31'
  const vacD = absReqs.filter(a => a.member_id === m.id && a.status === 'aprobada' && a.type === 'vacaciones' && a.date_from.startsWith(String(yr))).reduce((s, a) => s + a.days, 0)
  const ausD = absReqs.filter(a => a.member_id === m.id && a.status === 'aprobada' && a.type !== 'vacaciones' && a.date_from.startsWith(String(yr))).reduce((s, a) => s + a.days, 0)
  let h = 0; const d = new Date(yr, 0, 1); const end = new Date(yr, 11, 31)
  while (d <= end) { const dw = d.getDay(); const ds = d.toISOString().slice(0, 10); const mm = ds.slice(5)
    if (dw !== 0 && dw !== 6 && !hSet.has(ds)) { if (mm >= intS && mm <= intE) h += cal.daily_hours_intensive || 7; else if (dw === 5) h += cal.daily_hours_v || 8; else h += cal.daily_hours_lj || 8 }
    d.setDate(d.getDate() + 1) }
  const avgH = cal.daily_hours_lj || 8; const effH = Math.max(0, h - (vacD + ausD) * avgH)
  const crArr = rxm(m).cost_rates as LegacyCR[] | undefined
  let costH = (rxm(m).cost_rate as number) || 0
  if (crArr && crArr.length > 0) {
    const now = new Date().toISOString().slice(0, 7)
    const sorted = [...crArr].sort((a, b) => b.from.localeCompare(a.from))
    const cur = sorted.find(r => r.from <= now && (!r.to || r.to >= now)) || sorted[0]
    if (cur?.salary) costH = Math.round(((cur.salary * (cur.multiplier || DEFAULT_SS)) / (cal.convenio_hours || 1800)) * 100) / 100
    else if (cur?.rate) costH = cur.rate
  }
  return Math.round(effH * orgDed * costH)
}

export function ProjectsPanel() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [orgChart, setOrgChart] = useState<OrgEntry[]>([])
  const [calendarios, setCalendarios] = useState<CalFull[]>([])
  const [absReqs, setAbsReqs] = useState<AbsReq[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editRoom, setEditRoom] = useState<Room | null>(null)
  const [form, setForm] = useState<ProjectForm>({ ...emptyForm })
  const [orgEdits, setOrgEdits] = useState<OrgEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [importingProjects, setImportingProjects] = useState(false)
  const [importProjectResult, setImportProjectResult] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)
  const yr = new Date().getFullYear()

  useEffect(() => {
    Promise.all([
      supabase.from('rooms').select('*').order('name'),
      supabase.from('team_members').select('*').order('name'),
      supabase.from('org_chart').select('*'),
      supabase.from('retros').select('sala, data').eq('status', 'active'),
      supabase.from('calendarios').select('*'),
      supabase.from('absence_requests').select('member_id, type, date_from, date_to, days, status'),
    ]).then(([rR, mR, oR, retR, cR, aR]) => {
      if (rR.data) setRooms(rR.data)
      if (mR.data) setMembers(mR.data)
      if (oR.data) setOrgChart(oR.data as OrgEntry[])
      if (cR.data) setCalendarios(cR.data as CalFull[])
      if (aR.data) setAbsReqs(aR.data as AbsReq[])
      const stats: Record<string, { actions: number; done: number; risks: number }> = {}
      ;(retR.data || []).forEach((r: { sala: string; data: Record<string, unknown> }) => {
        const d = r.data || {}; const acts = ((d.actions || []) as Array<Record<string, unknown>>).filter(a => a.status !== 'discarded' && a.status !== 'cancelled')
        stats[r.sala] = { actions: acts.length, done: acts.filter(a => a.status === 'done' || a.status === 'archived').length, risks: ((d.risks || []) as Array<Record<string, unknown>>).filter(ri => ri.status !== 'mitigated').length }
      })
      setLoading(false)
    })
  }, [])

  const getServices = (r: Room): ServiceContract[] => {
    const raw = rx(r).services as ServiceContract[] | undefined
    if (raw && raw.length > 0) return raw
    const budget = Number(rx(r).budget) || 0; const margin = Number(rx(r).target_margin) || 20; const riskP = Number(rx(r).risk_pct) || 0
    if (budget > 0) return [{ id: uid(), name: r.name, from: (rx(r).start_date as string) || '', to: (rx(r).end_date as string) || '', cost: budget, margin_pct: margin, risk_pct: riskP }]
    return []
  }

  // Real cost YTD per project
  const projectCostYTD = (slug: string): number => {
    const projOrg = orgChart.filter(o => o.sala === slug && o.sala !== '__global__')
    return projOrg.reduce((sum, o) => {
      const m = members.find(x => x.id === o.member_id); if (!m) return sum
      return sum + memberProjectCostYTD(m, o.dedication, calendarios, absReqs, yr, today)
    }, 0)
  }
  // Projected cost EOY per project
  const projectCostEOY = (slug: string): number => {
    const projOrg = orgChart.filter(o => o.sala === slug && o.sala !== '__global__')
    return projOrg.reduce((sum, o) => {
      const m = members.find(x => x.id === o.member_id); if (!m) return sum
      return sum + memberProjectCostEOY(m, o.dedication, calendarios, absReqs, yr)
    }, 0)
  }

  const openCreate = () => { setForm({ ...emptyForm }); setOrgEdits([]); setEditRoom(null); setModal('create') }
  const openEdit = (r: Room) => {
    const projMembers = members.filter(m => (m.rooms || []).includes(r.slug))
    const existingOrg = orgChart.filter(o => o.sala === r.slug)
    const edits: OrgEntry[] = projMembers.map(m => {
      const existing = existingOrg.find(o => o.member_id === m.id)
      return existing ? { ...existing, dedication: Math.round((existing.dedication || 0) * 100) } : { member_id: m.id, sala: r.slug, dedication: 100, start_date: (rx(r).start_date as string) || '', end_date: (rx(r).end_date as string) || '' }
    })
    setForm({
      name: r.name, slug: r.slug, tipo: r.tipo || 'agile', status: (rx(r).status as string) || 'active',
      start_date: (rx(r).start_date as string) || '', end_date: (rx(r).end_date as string) || '',
      services: getServices(r),
    })
    setOrgEdits(edits); setEditRoom(r); setModal('edit')
  }

  const handleSave = async () => {
    setSaving(true)
    const totalCost = form.services.reduce((s, sv) => s + sv.cost, 0)
    const totalSale = form.services.reduce((s, sv) => s + saleFromService(sv), 0)
    const avgMargin = totalSale > 0 ? Math.round(((totalSale - totalCost) / totalSale) * 100) : 0
    const payload = {
      name: form.name, tipo: form.tipo, status: form.status,
      start_date: form.start_date || null, end_date: form.end_date || null,
      services: form.services,
      budget: totalCost, fixed_price: totalSale, target_margin: avgMargin,
      billing_type: 'fixed', sell_rate: 0, planned_hours: 0,
      risk_pct: form.services.length > 0 ? Math.round(form.services.reduce((s, sv) => s + (sv.risk_pct || 0), 0) / form.services.length) : 0,
      cost_profiles: [], member_sell_rates: [],
    }
    if (modal === 'create') {
      const slug = form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const { data, error } = await supabase.from('rooms').insert({ ...payload, slug }).select().single()
      if (error) { console.error('[revelio] create error:', error.message); alert('Error: ' + error.message); setSaving(false); return }
      if (data) { setRooms(prev => [...prev, data]); soundCreate() }
      await supabase.from('retros').insert({ sala: slug, data: { actions: [], risks: [], notes: [], positives: [] }, status: 'active' })
    } else if (editRoom) {
      const { data } = await supabase.from('rooms').update(payload).eq('slug', editRoom.slug).select().single()
      if (data) setRooms(prev => prev.map(r => r.slug === editRoom.slug ? data : r))
      for (const oe of orgEdits) {
        const existing = orgChart.find(o => o.member_id === oe.member_id && o.sala === oe.sala)
        if (existing?.id) await supabase.from('org_chart').update({ dedication: oe.dedication / 100, start_date: oe.start_date || null, end_date: oe.end_date || null }).eq('id', existing.id)
        else await supabase.from('org_chart').insert({ member_id: oe.member_id, sala: oe.sala, dedication: oe.dedication / 100, start_date: oe.start_date || null, end_date: oe.end_date || null })
      }
      const { data: newOrg } = await supabase.from('org_chart').select('*')
      if (newOrg) setOrgChart(newOrg as OrgEntry[])
      soundCreate()
    }
    setSaving(false); setModal(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirm !== deleteTarget.name) return
    await supabase.from('rooms').delete().eq('slug', deleteTarget.slug)
    setRooms(prev => prev.filter(r => r.slug !== deleteTarget.slug)); setDeleteTarget(null); setDeleteConfirm(''); soundDelete()
  }

  const projMembers = editRoom ? members.filter(m => (m.rooms || []).includes(editRoom.slug)) : []

  const downloadProjectTemplate = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([
      ['nombre*', 'tipo', 'fecha_inicio', 'fecha_fin', 'servicio_nombre', 'servicio_coste', 'servicio_margen', 'servicio_riesgo'],
      ['VWFS', 'agile', '2025-01-01', '2025-12-31', 'Desarrollo fase 1', '80000', '20', '5'],
      ['Endesa', 'itil', '2025-03-01', '2026-02-28', 'Mantenimiento', '50000', '25', '3'],
    ])
    ws['!cols'] = [{wch:22},{wch:10},{wch:12},{wch:12},{wch:24},{wch:14},{wch:14},{wch:14}]
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Proyectos')
    XLSX.writeFile(wb, 'plantilla_proyectos_revelio.xlsx')
  }
  const handleImportProjects = async (file: File) => {
    setImportingProjects(true); setImportProjectResult(null)
    try {
      const XLSX = await import('xlsx'); const buf = await file.arrayBuffer(); const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]!]; if (!ws) throw new Error('Hoja vacia')
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
      let created = 0; const errors: string[] = []
      for (const row of rows) {
        const name = String(row['nombre*'] || row['nombre'] || '').trim(); if (!name) continue
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        const startDate = String(row['fecha_inicio'] || ''); const endDate = String(row['fecha_fin'] || '')
        const svCost = Number(row['servicio_coste'] || 0); const svMargin = Number(row['servicio_margen'] || 20); const svRisk = Number(row['servicio_riesgo'] || 0)
        const svName = String(row['servicio_nombre'] || name)
        const services: ServiceContract[] = svCost > 0 ? [{ id: uid(), name: svName, from: startDate, to: endDate, cost: svCost, margin_pct: svMargin, risk_pct: svRisk }] : []
        const totalSale = services.reduce((s, sv) => s + saleFromService(sv), 0)
        const { error } = await supabase.from('rooms').insert({ slug, name, tipo: String(row['tipo'] || 'agile'), status: 'active', start_date: startDate || null, end_date: endDate || null, services, budget: svCost, fixed_price: totalSale, target_margin: svMargin, billing_type: 'fixed', sell_rate: 0, planned_hours: 0, risk_pct: svRisk, cost_profiles: [], member_sell_rates: [] })
        if (error) { errors.push(`${name}: ${error.message}`); continue }
        await supabase.from('retros').insert({ sala: slug, data: { actions: [], risks: [], notes: [], positives: [] }, status: 'active' })
        created++
      }
      setImportProjectResult(`${created} creados${errors.length ? `. Errores: ${errors.join('; ')}` : ''}`)
      const { data } = await supabase.from('rooms').select('*').order('name'); if (data) setRooms(data)
    } catch (e) { setImportProjectResult(`Error: ${(e as Error).message}`) }
    setImportingProjects(false)
  }

  if (loading) return <div className="text-sm text-revelio-subtle dark:text-revelio-dark-subtle text-center py-10">Cargando...</div>

  return (
    <div className="max-w-[1200px]">
      <div className="flex items-center justify-between mb-4">
        <div><h2 className="text-lg font-semibold text-revelio-text dark:text-revelio-dark-text">Proyectos</h2><p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">{rooms.length} proyectos</p></div>
        <div className="flex gap-2">
          <button onClick={downloadProjectTemplate} className="px-3 py-1.5 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs font-medium text-revelio-subtle flex items-center gap-1 hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><Download className="w-3.5 h-3.5" /> Plantilla</button>
          <label className="px-3 py-1.5 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs font-medium text-revelio-subtle flex items-center gap-1 cursor-pointer hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><Upload className="w-3.5 h-3.5" /> {importingProjects ? 'Importando...' : 'Importar'}<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImportProjects(f); e.target.value = '' }} disabled={importingProjects} /></label>
          <button onClick={openCreate} className="px-3 py-1.5 rounded-lg bg-revelio-text dark:bg-revelio-blue text-white text-xs font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nuevo</button>
        </div>
      </div>
      {importProjectResult && (<div className={`rounded-lg px-4 py-2 mb-3 text-xs font-medium ${importProjectResult.includes('Error') ? 'bg-revelio-red/10 text-revelio-red' : 'bg-revelio-green/10 text-revelio-green'}`}>{importProjectResult}<button onClick={() => setImportProjectResult(null)} className="ml-2 text-revelio-subtle hover:underline">Cerrar</button></div>)}

      <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-revelio-bg dark:bg-revelio-dark-border">{['Proyecto', 'Periodo', 'Coste est.', 'Venta', 'Coste real', 'Desviacion', 'Margen', 'Equipo', 'Consumido', ''].map(h => <th key={h} className="px-2 py-2 text-center text-[8px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase">{h}</th>)}</tr></thead>
          <tbody>{rooms.map((r, i) => {
            const tc = members.filter(m => (m.rooms || []).includes(r.slug)).length
            const svcs = getServices(r)
            const totalSale = svcs.reduce((sum, sv) => sum + saleFromService(sv), 0)
            const totalEstCost = svcs.reduce((sum, sv) => sum + sv.cost, 0)
            const realCost = projectCostYTD(r.slug)
            const projCost = projectCostEOY(r.slug)
            const deviation = totalEstCost > 0 ? Math.round(((projCost - totalEstCost) / totalEstCost) * 100) : 0
            const realMargin = totalSale > 0 ? Math.round(((totalSale - projCost) / totalSale) * 100) : 0
            const consumed = totalSale > 0 ? Math.min(100, Math.round((realCost / totalSale) * 100)) : 0
            const sd = (rx(r).start_date as string) || ''; const ed = (rx(r).end_date as string) || ''
            // Trend: will we exceed budget?
            const willExceed = projCost > totalSale && totalSale > 0
            return (
              <tr key={r.slug} className={`border-t border-revelio-border dark:border-revelio-dark-border/50 ${i % 2 ? 'bg-revelio-bg/50 dark:bg-revelio-dark-border/20' : ''} hover:bg-revelio-blue/5`}>
                <td className="px-2 py-2.5 text-left"><Link to={`/project/${r.slug}`} className="font-medium text-revelio-text dark:text-revelio-dark-text hover:text-revelio-blue text-xs">{r.name}</Link><div className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle capitalize">{r.tipo}</div></td>
                <td className="px-2 py-2.5 text-center text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{sd && ed ? <span className="flex items-center justify-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{new Date(sd).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })} — {new Date(ed).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })}</span> : '—'}</td>
                <td className="px-2 py-2.5 text-center text-[9px] font-semibold text-revelio-orange">{totalEstCost > 0 ? `${fmt(totalEstCost)}€` : '—'}</td>
                <td className="px-2 py-2.5 text-center text-[9px] font-semibold text-revelio-blue">{totalSale > 0 ? `${fmt(totalSale)}€` : '—'}</td>
                <td className="px-2 py-2.5 text-center text-[9px] font-semibold" style={{ color: realCost > totalEstCost && totalEstCost > 0 ? '#FF3B30' : '#FF9500' }}>{realCost > 0 ? `${fmt(realCost)}€` : '—'}</td>
                <td className="px-2 py-2.5 text-center text-[9px] font-bold">{totalEstCost > 0 ? <span style={{ color: deviation > 5 ? '#FF3B30' : deviation < -5 ? '#34C759' : '#8E8E93' }}>{deviation > 0 ? '+' : ''}{deviation}%</span> : '—'}</td>
                <td className="px-2 py-2.5 text-center text-[9px]"><span className={`font-bold ${realMargin >= 20 ? 'text-revelio-green' : realMargin >= 10 ? 'text-revelio-orange' : 'text-revelio-red'}`}>{totalSale > 0 ? `${realMargin}%` : '—'}</span></td>
                <td className="px-2 py-2.5 text-center"><span className="flex items-center justify-center gap-1 text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle"><Users className="w-3 h-3" />{tc}</span></td>
                <td className="px-2 py-2.5 text-center">
                  {totalSale > 0 ? <div className="flex items-center justify-center gap-1.5">
                    <div className="w-12 h-1.5 bg-revelio-bg dark:bg-revelio-dark-border rounded-full overflow-hidden"><div className={`h-full rounded-full ${consumed >= 90 ? 'bg-revelio-red' : consumed >= 70 ? 'bg-revelio-orange' : 'bg-revelio-green'}`} style={{ width: `${consumed}%` }} /></div>
                    <span className={`text-[9px] font-semibold ${consumed >= 90 ? 'text-revelio-red' : consumed >= 70 ? 'text-revelio-orange' : 'text-revelio-green'}`}>{consumed}%</span>
                    {willExceed && <AlertTriangle className="w-3 h-3 text-revelio-red" />}
                  </div> : <span className="text-[9px] text-revelio-subtle">—</span>}
                </td>
                <td className="px-2 py-2.5 text-center"><div className="flex gap-1 justify-center"><button onClick={() => openEdit(r)} className="w-5 h-5 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><Edit className="w-2.5 h-2.5 text-revelio-blue" /></button><button onClick={() => { setDeleteTarget(r); setDeleteConfirm('') }} className="w-5 h-5 rounded border border-revelio-red/20 flex items-center justify-center hover:bg-revelio-red/5"><Trash2 className="w-2.5 h-2.5 text-revelio-red" /></button><Link to={`/project/${r.slug}`} className="w-5 h-5 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><ExternalLink className="w-2.5 h-2.5 text-revelio-subtle" /></Link></div></td>
              </tr>
            )
          })}</tbody>
        </table>
        </div>
      </div>

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-revelio-dark-card rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[85vh] overflow-y-auto">
            <h3 className="text-base font-semibold mb-4 dark:text-revelio-dark-text">{modal === 'create' ? 'Nuevo proyecto' : `Editar: ${form.name}`}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><L>Nombre *</L><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
                {modal === 'create' && <div className="col-span-2"><L>Slug</L><input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder={form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>}
                <div><L>Tipo</L><select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text">{TIPOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
                <div><L>Estado</L><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text"><option value="active">Activo</option><option value="paused">Pausado</option><option value="closed">Cerrado</option></select></div>
                <div><L>Inicio</L><input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
                <div><L>Fin</L><input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
              </div>

              {/* Services */}
              <div className="border-t border-revelio-border dark:border-revelio-dark-border pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase flex items-center gap-1"><DollarSign className="w-3 h-3 text-revelio-green" /> Servicios / Contratos</p>
                  <button onClick={() => setForm({ ...form, services: [...form.services, { id: uid(), name: '', from: form.start_date, to: form.end_date, cost: 0, margin_pct: 20, risk_pct: 5 }] })} className="text-[9px] text-revelio-blue font-medium flex items-center gap-0.5"><Plus className="w-3 h-3" /> Servicio</button>
                </div>
                {form.services.length === 0 && <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle bg-revelio-bg dark:bg-revelio-dark-border rounded-lg px-3 py-2">Sin servicios.</p>}
                {form.services.map((sv, si) => {
                  const sale = saleFromService(sv); const marginAbs = sale - sv.cost; const riskAbs = Math.round(sale * (sv.risk_pct || 0) / 100)
                  return (
                    <div key={sv.id} className="mb-3 bg-revelio-bg dark:bg-revelio-dark-border rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between mb-2">
                        <input value={sv.name} onChange={e => { const n = [...form.services]; n[si] = { ...n[si]!, name: e.target.value }; setForm({ ...form, services: n }) }} placeholder="Nombre del servicio" className="flex-1 rounded border border-revelio-border dark:border-revelio-dark-border px-2 py-1 text-[10px] outline-none font-semibold dark:bg-revelio-dark-bg dark:text-revelio-dark-text mr-2" />
                        <button onClick={() => setForm({ ...form, services: form.services.filter((_, i) => i !== si) })} className="text-revelio-subtle hover:text-revelio-red"><X className="w-3 h-3" /></button>
                      </div>
                      <div className="grid grid-cols-5 gap-2 mb-2">
                        <div><label className="text-[8px] text-revelio-subtle">Desde</label><input type="date" value={sv.from} onChange={e => { const n = [...form.services]; n[si] = { ...n[si]!, from: e.target.value }; setForm({ ...form, services: n }) }} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-1.5 py-1 text-[10px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
                        <div><label className="text-[8px] text-revelio-subtle">Hasta</label><input type="date" value={sv.to} onChange={e => { const n = [...form.services]; n[si] = { ...n[si]!, to: e.target.value }; setForm({ ...form, services: n }) }} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-1.5 py-1 text-[10px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
                        <div><label className="text-[8px] text-revelio-subtle">Coste est.</label><input type="number" value={sv.cost || ''} onChange={e => { const n = [...form.services]; n[si] = { ...n[si]!, cost: Number(e.target.value) }; setForm({ ...form, services: n }) }} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-1.5 py-1 text-[10px] outline-none text-right font-bold dark:bg-revelio-dark-bg dark:text-revelio-dark-text" step={1000} /></div>
                        <div><label className="text-[8px] text-revelio-subtle">Margen %</label><input type="number" value={sv.margin_pct} onChange={e => { const n = [...form.services]; n[si] = { ...n[si]!, margin_pct: Number(e.target.value) }; setForm({ ...form, services: n }) }} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-1.5 py-1 text-[10px] outline-none text-right dark:bg-revelio-dark-bg dark:text-revelio-dark-text" min={0} max={90} /></div>
                        <div><label className="text-[8px] text-revelio-subtle">Riesgo %</label><input type="number" value={sv.risk_pct || 0} onChange={e => { const n = [...form.services]; n[si] = { ...n[si]!, risk_pct: Number(e.target.value) }; setForm({ ...form, services: n }) }} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-1.5 py-1 text-[10px] outline-none text-right dark:bg-revelio-dark-bg dark:text-revelio-dark-text" min={0} max={30} /></div>
                      </div>
                      {sv.cost > 0 && (
                        <div className="flex gap-3 text-[9px]">
                          <span className="text-revelio-subtle">Coste: <span className="font-bold text-revelio-orange">{fmt(sv.cost)}€</span></span>
                          <span className="text-revelio-subtle">Margen: <span className="font-bold text-revelio-green">+{fmt(marginAbs)}€</span></span>
                          {riskAbs > 0 && <span className="text-revelio-subtle">Riesgo: <span className="font-bold text-revelio-violet">+{fmt(riskAbs)}€</span></span>}
                          <span className="text-revelio-subtle">Venta: <span className="font-bold text-revelio-blue">{fmt(sale)}€</span></span>
                        </div>
                      )}
                    </div>
                  )
                })}
                {form.services.length > 0 && (() => {
                  const tCost = form.services.reduce((s, sv) => s + sv.cost, 0)
                  const tSale = form.services.reduce((s, sv) => s + saleFromService(sv), 0)
                  const tMargin = tSale - tCost; const tPct = tSale > 0 ? Math.round((tMargin / tSale) * 100) : 0
                  return (
                    <div className="rounded-lg bg-white dark:bg-revelio-dark-card border border-revelio-border/50 dark:border-revelio-dark-border/50 p-3 mt-2">
                      <div className="flex justify-between text-[10px] mb-1"><span className="text-revelio-subtle">Coste total</span><span className="font-bold text-revelio-orange">{fmt(tCost)}€</span></div>
                      <div className="flex justify-between text-[10px] mb-1"><span className="text-revelio-subtle">Margen + Riesgo ({tPct}%)</span><span className="font-bold text-revelio-green">+{fmt(tMargin)}€</span></div>
                      <div className="flex justify-between text-xs border-t border-revelio-border/30 dark:border-revelio-dark-border/30 pt-1.5"><span className="font-semibold dark:text-revelio-dark-text">Venta total</span><span className="font-bold text-revelio-blue text-sm">{fmt(tSale)}€</span></div>
                    </div>
                  )
                })()}
              </div>

              {/* Team */}
              {modal === 'edit' && projMembers.length > 0 && (
                <div className="border-t border-revelio-border dark:border-revelio-dark-border pt-4">
                  <p className="text-[10px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-2 flex items-center gap-1"><Users className="w-3 h-3" /> Equipo asignado</p>
                  <table className="w-full text-[9px]">
                    <thead><tr className="text-[8px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase"><th className="text-center py-1">Persona</th><th className="text-center px-1">% Ded.</th><th className="text-center px-1">Desde</th><th className="text-center px-1">Hasta</th></tr></thead>
                    <tbody>{projMembers.map(m => {
                      const oe = orgEdits.find(o => o.member_id === m.id) || { member_id: m.id, sala: editRoom!.slug, dedication: 100, start_date: form.start_date, end_date: form.end_date }
                      const updOrg = (f: keyof OrgEntry, v: string | number) => {
                        const exists = orgEdits.find(o => o.member_id === m.id)
                        setOrgEdits(exists ? orgEdits.map(o => o.member_id === m.id ? { ...o, [f]: v } : o) : [...orgEdits, { ...oe, [f]: v }])
                      }
                      return (
                        <tr key={m.id} className="border-t border-revelio-border/30 dark:border-revelio-dark-border/30">
                          <td className="py-1.5 text-center"><Link to={`/persona/${m.id}`} className="hover:text-revelio-blue"><span style={{ color: m.color }}>{m.avatar || '·'}</span> {m.name.split(' ')[0]} <span className="text-[8px] text-revelio-subtle">{m.role_label}</span></Link></td>
                          <td className="px-1 text-center"><input type="number" value={oe.dedication} onChange={e => updOrg('dedication', Number(e.target.value))} className="w-14 rounded border border-revelio-border dark:border-revelio-dark-border px-1 py-0.5 text-[10px] outline-none text-center dark:bg-revelio-dark-bg dark:text-revelio-dark-text" min={0} max={100} step={5} /></td>
                          <td className="px-1 text-center"><input type="date" value={oe.start_date || ''} onChange={e => updOrg('start_date', e.target.value)} className="rounded border border-revelio-border dark:border-revelio-dark-border px-1 py-0.5 text-[9px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text w-[110px]" /></td>
                          <td className="px-1 text-center"><input type="date" value={oe.end_date || ''} onChange={e => updOrg('end_date', e.target.value)} className="rounded border border-revelio-border dark:border-revelio-dark-border px-1 py-0.5 text-[9px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text w-[110px]" /></td>
                        </tr>
                      )
                    })}</tbody>
                  </table>
                  <p className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle mt-1">Dedicacion se guarda en org_chart (FTEs, Jornada, ficha individual).</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-sm font-medium text-revelio-subtle">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-[2] py-2 rounded-lg bg-revelio-text dark:bg-revelio-blue text-white text-sm font-medium disabled:opacity-40">{saving ? 'Guardando...' : modal === 'create' ? 'Crear' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-revelio-dark-card rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <div className="text-center mb-4"><Trash2 className="w-8 h-8 text-revelio-red mx-auto mb-2" /><h3 className="font-semibold dark:text-revelio-dark-text">Eliminar proyecto</h3><p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mt-1">Escribe <strong className="text-revelio-red">{deleteTarget.name}</strong></p></div>
            <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && deleteConfirm === deleteTarget.name && handleDelete()} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-sm outline-none focus:border-revelio-red mb-3 dark:bg-revelio-dark-bg dark:text-revelio-dark-text" autoFocus />
            <div className="flex gap-2"><button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 rounded-lg border border-revelio-border text-sm font-medium text-revelio-subtle">Cancelar</button><button onClick={handleDelete} disabled={deleteConfirm !== deleteTarget.name} className="flex-1 py-2 rounded-lg bg-revelio-red text-white text-sm font-medium disabled:opacity-30">Eliminar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function L({ children }: { children: React.ReactNode }) { return <label className="text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase block mb-1">{children}</label> }
