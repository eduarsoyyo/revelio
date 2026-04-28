import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/data/supabase'
import type { Room, Member } from '@/types'
import { Plus, Edit, Trash2, ExternalLink, Users, DollarSign, Calendar, X, Upload, Download } from 'lucide-react'
import { soundCreate, soundDelete } from '@/lib/sounds'

const TIPOS = [
  { id: 'agile', label: 'Agile / Scrum' }, { id: 'kanban', label: 'Kanban' },
  { id: 'itil', label: 'ITIL / Servicio' }, { id: 'waterfall', label: 'Waterfall' },
]

interface ServiceContract { id: string; name: string; from: string; to: string; cost: number; margin_pct: number }
interface OrgEntry { id?: string; member_id: string; sala: string; dedication: number; start_date: string; end_date: string }

interface ProjectForm {
  name: string; slug: string; tipo: string; status: string
  start_date: string; end_date: string
  services: ServiceContract[]
}
const emptyForm: ProjectForm = { name: '', slug: '', tipo: 'agile', status: 'active', start_date: '', end_date: '', services: [] }

const fmt = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 })
const rx = (r: Room) => r as unknown as Record<string, unknown>
const saleFromService = (s: ServiceContract) => { const d = 1 - (s.margin_pct / 100); return d > 0 ? Math.round(s.cost / d) : 0 }
const uid = () => crypto.randomUUID().slice(0, 8)

export function ProjectsPanel() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [orgChart, setOrgChart] = useState<OrgEntry[]>([])
  const [retroStats, setRetroStats] = useState<Record<string, { actions: number; done: number; risks: number }>>({})
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

  useEffect(() => {
    Promise.all([
      supabase.from('rooms').select('*').order('name'),
      supabase.from('team_members').select('*').order('name'),
      supabase.from('org_chart').select('*'),
      supabase.from('retros').select('sala, data').eq('status', 'active'),
    ]).then(([rR, mR, oR, retR]) => {
      if (rR.data) setRooms(rR.data)
      if (mR.data) setMembers(mR.data)
      if (oR.data) setOrgChart(oR.data as OrgEntry[])
      const stats: Record<string, { actions: number; done: number; risks: number }> = {}
      ;(retR.data || []).forEach((r: { sala: string; data: Record<string, unknown> }) => {
        const d = r.data || {}; const acts = ((d.actions || []) as Array<Record<string, unknown>>).filter(a => a.status !== 'discarded' && a.status !== 'cancelled')
        stats[r.sala] = { actions: acts.length, done: acts.filter(a => a.status === 'done' || a.status === 'archived').length, risks: ((d.risks || []) as Array<Record<string, unknown>>).filter(ri => ri.status !== 'mitigated').length }
      })
      setRetroStats(stats); setLoading(false)
    })
  }, [])

  // Migrate legacy data to services format
  const getServices = (r: Room): ServiceContract[] => {
    const raw = rx(r).services as ServiceContract[] | undefined
    if (raw && raw.length > 0) return raw
    // Legacy: create one service from old fields
    const budget = Number(rx(r).budget) || 0
    const margin = Number(rx(r).target_margin) || 20
    if (budget > 0) return [{ id: uid(), name: r.name, from: (rx(r).start_date as string) || '', to: (rx(r).end_date as string) || '', cost: budget, margin_pct: margin }]
    return []
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
      // Keep legacy fields for backwards compat
      billing_type: 'fixed', sell_rate: 0, planned_hours: 0, risk_pct: 0,
      cost_profiles: [], member_sell_rates: [],
    }
    if (modal === 'create') {
      const slug = form.slug || form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const { data, error } = await supabase.from('rooms').insert({ ...payload, slug }).select().single()
      if (error) { console.error('[revelio] create project error:', error.message); alert('Error: ' + error.message); setSaving(false); return }
      if (data) { setRooms(prev => [...prev, data]); soundCreate() }
      // Create active retro
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

  // Excel import/export
  const downloadProjectTemplate = async () => {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.aoa_to_sheet([
      ['nombre*', 'tipo', 'fecha_inicio', 'fecha_fin', 'servicio_nombre', 'servicio_coste', 'servicio_margen'],
      ['VWFS', 'agile', '2025-01-01', '2025-12-31', 'Desarrollo fase 1', '80000', '20'],
      ['Endesa Boost', 'itil', '2025-03-01', '2026-02-28', 'Mantenimiento', '50000', '25'],
    ])
    ws['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 14 }]
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Proyectos')
    const instr = XLSX.utils.aoa_to_sheet([
      ['Campo', 'Obligatorio', 'Descripcion'],
      ['nombre*', 'Si', 'Nombre del proyecto'],
      ['tipo', 'No', 'agile, kanban, itil, waterfall'],
      ['fecha_inicio', 'No', 'YYYY-MM-DD'],
      ['fecha_fin', 'No', 'YYYY-MM-DD'],
      ['servicio_nombre', 'No', 'Nombre del servicio/contrato'],
      ['servicio_coste', 'No', 'Coste estimado del servicio'],
      ['servicio_margen', 'No', 'Margen objetivo % (default 20)'],
    ])
    instr['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 36 }]
    XLSX.utils.book_append_sheet(wb, instr, 'Instrucciones')
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
        const tipo = String(row['tipo'] || 'agile')
        const startDate = String(row['fecha_inicio'] || '')
        const endDate = String(row['fecha_fin'] || '')
        const svName = String(row['servicio_nombre'] || name)
        const svCost = Number(row['servicio_coste'] || 0)
        const svMargin = Number(row['servicio_margen'] || 20)
        const services: ServiceContract[] = svCost > 0 ? [{ id: uid(), name: svName, from: startDate, to: endDate, cost: svCost, margin_pct: svMargin }] : []
        const totalSale = services.reduce((s, sv) => s + saleFromService(sv), 0)
        const { error } = await supabase.from('rooms').insert({
          slug, name, tipo, status: 'active',
          start_date: startDate || null, end_date: endDate || null,
          services, budget: svCost, fixed_price: totalSale, target_margin: svMargin,
          billing_type: 'fixed', sell_rate: 0, planned_hours: 0, risk_pct: 0,
          cost_profiles: [], member_sell_rates: [],
        })
        if (error) { errors.push(`${name}: ${error.message}`); continue }
        await supabase.from('retros').insert({ sala: slug, data: { actions: [], risks: [], notes: [], positives: [] }, status: 'active' })
        created++
      }
      setImportProjectResult(`${created} proyectos creados${errors.length ? `. Errores: ${errors.join('; ')}` : ''}`)
      const { data } = await supabase.from('rooms').select('*').order('name'); if (data) setRooms(data)
    } catch (e) { setImportProjectResult(`Error: ${(e as Error).message}`) }
    setImportingProjects(false)
  }

  if (loading) return <div className="text-sm text-revelio-subtle dark:text-revelio-dark-subtle text-center py-10">Cargando...</div>

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div><h2 className="text-lg font-semibold text-revelio-text dark:text-revelio-dark-text">Proyectos</h2><p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">{rooms.length} proyectos</p></div>
        <div className="flex gap-2">
          <button onClick={downloadProjectTemplate} className="px-3 py-1.5 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs font-medium text-revelio-subtle flex items-center gap-1 hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><Download className="w-3.5 h-3.5" /> Plantilla</button>
          <label className="px-3 py-1.5 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-xs font-medium text-revelio-subtle flex items-center gap-1 cursor-pointer hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><Upload className="w-3.5 h-3.5" /> {importingProjects ? 'Importando...' : 'Importar'}<input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImportProjects(f); e.target.value = '' }} disabled={importingProjects} /></label>
          <button onClick={openCreate} className="px-3 py-1.5 rounded-lg bg-revelio-text dark:bg-revelio-blue text-white text-xs font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nuevo</button>
        </div>
      </div>
      {importProjectResult && (<div className={`rounded-lg px-4 py-2 mb-3 text-xs font-medium ${importProjectResult.includes('Error') ? 'bg-revelio-red/10 text-revelio-red' : 'bg-revelio-green/10 text-revelio-green'}`}>{importProjectResult}<button onClick={() => setImportProjectResult(null)} className="ml-2 text-revelio-subtle hover:underline">Cerrar</button></div>)}

      {/* TABLE */}
      <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-revelio-bg dark:bg-revelio-dark-border">{['Proyecto', 'Periodo', 'Venta', 'Margen', 'Equipo', 'Progreso', ''].map(h => <th key={h} className="px-3 py-2 text-center text-[9px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase tracking-wider">{h}</th>)}</tr></thead>
          <tbody>{rooms.map((r, i) => {
            const s = retroStats[r.slug] || { actions: 0, done: 0, risks: 0 }
            const tc = members.filter(m => (m.rooms || []).includes(r.slug)).length
            const pctDone = s.actions > 0 ? Math.round(s.done / s.actions * 100) : 0
            const svcs = getServices(r)
            const totalSale = svcs.reduce((sum, sv) => sum + saleFromService(sv), 0)
            const totalCost = svcs.reduce((sum, sv) => sum + sv.cost, 0)
            const avgMargin = totalSale > 0 ? Math.round(((totalSale - totalCost) / totalSale) * 100) : 0
            const sd = (rx(r).start_date as string) || ''; const ed = (rx(r).end_date as string) || ''
            return (
              <tr key={r.slug} className={`border-t border-revelio-border dark:border-revelio-dark-border/50 ${i % 2 ? 'bg-revelio-bg/50 dark:bg-revelio-dark-border/20' : ''} hover:bg-revelio-blue/5`}>
                <td className="px-3 py-2.5 text-left"><Link to={`/project/${r.slug}`} className="font-medium text-revelio-text dark:text-revelio-dark-text hover:text-revelio-blue">{r.name}</Link><div className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle capitalize">{r.tipo}</div></td>
                <td className="px-3 py-2.5 text-center text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">{sd && ed ? <span className="flex items-center justify-center gap-0.5"><Calendar className="w-2.5 h-2.5" />{new Date(sd).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })} — {new Date(ed).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })}</span> : '—'}</td>
                <td className="px-3 py-2.5 text-center text-[10px]">{totalSale > 0 ? <span className="flex items-center justify-center gap-0.5 font-semibold"><DollarSign className="w-2.5 h-2.5 text-revelio-green" />{fmt(totalSale)}€</span> : <span className="text-revelio-subtle">—</span>}</td>
                <td className="px-3 py-2.5 text-center text-[10px]"><span className={`font-bold ${avgMargin >= 20 ? 'text-revelio-green' : avgMargin >= 10 ? 'text-revelio-orange' : 'text-revelio-red'}`}>{avgMargin}%</span></td>
                <td className="px-3 py-2.5 text-center"><span className="flex items-center justify-center gap-1 text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle"><Users className="w-3 h-3" /> {tc}</span></td>
                <td className="px-3 py-2.5 text-center"><div className="flex items-center justify-center gap-1.5"><div className="w-12 h-1.5 bg-revelio-bg dark:bg-revelio-dark-border rounded-full overflow-hidden"><div className={`h-full rounded-full ${pctDone >= 70 ? 'bg-revelio-green' : pctDone >= 40 ? 'bg-revelio-orange' : 'bg-revelio-red'}`} style={{ width: `${pctDone}%` }} /></div><span className={`text-[10px] font-semibold ${pctDone >= 70 ? 'text-revelio-green' : pctDone >= 40 ? 'text-revelio-orange' : 'text-revelio-red'}`}>{pctDone}%</span></div></td>
                <td className="px-3 py-2.5 text-center"><div className="flex gap-1 justify-center"><button onClick={() => openEdit(r)} className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><Edit className="w-3 h-3 text-revelio-blue" /></button><button onClick={() => { setDeleteTarget(r); setDeleteConfirm('') }} className="w-6 h-6 rounded border border-revelio-red/20 flex items-center justify-center hover:bg-revelio-red/5"><Trash2 className="w-3 h-3 text-revelio-red" /></button><Link to={`/project/${r.slug}`} className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><ExternalLink className="w-3 h-3 text-revelio-subtle" /></Link></div></td>
              </tr>
            )
          })}</tbody>
        </table>
      </div>

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-revelio-dark-card rounded-2xl max-w-2xl w-full p-6 shadow-xl max-h-[85vh] overflow-y-auto">
            <h3 className="text-base font-semibold mb-4 dark:text-revelio-dark-text">{modal === 'create' ? 'Nuevo proyecto' : `Editar: ${form.name}`}</h3>
            <div className="space-y-4">
              {/* Basic */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><L>Nombre *</L><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
                {modal === 'create' && <div className="col-span-2"><L>Slug</L><input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder={form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>}
                <div><L>Tipo</L><select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text">{TIPOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></div>
                <div><L>Estado</L><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none bg-white dark:bg-revelio-dark-bg dark:text-revelio-dark-text"><option value="active">Activo</option><option value="paused">Pausado</option><option value="closed">Cerrado</option></select></div>
                <div><L>Inicio</L><input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
                <div><L>Fin</L><input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
              </div>

              {/* Services / Contracts */}
              <div className="border-t border-revelio-border dark:border-revelio-dark-border pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase flex items-center gap-1"><DollarSign className="w-3 h-3 text-revelio-green" /> Servicios / Contratos</p>
                  <button onClick={() => setForm({ ...form, services: [...form.services, { id: uid(), name: '', from: form.start_date, to: form.end_date, cost: 0, margin_pct: 20 }] })} className="text-[9px] text-revelio-blue font-medium flex items-center gap-0.5"><Plus className="w-3 h-3" /> Servicio</button>
                </div>
                {form.services.length === 0 && <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle bg-revelio-bg dark:bg-revelio-dark-border rounded-lg px-3 py-2">Sin servicios. Añade uno para calcular venta y margen.</p>}
                {form.services.map((sv, si) => {
                  const sale = saleFromService(sv)
                  const marginAbs = sale - sv.cost
                  return (
                    <div key={sv.id} className="mb-3 bg-revelio-bg dark:bg-revelio-dark-border rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between mb-2">
                        <input value={sv.name} onChange={e => { const n = [...form.services]; n[si] = { ...n[si]!, name: e.target.value }; setForm({ ...form, services: n }) }} placeholder="Nombre del servicio" className="flex-1 rounded border border-revelio-border dark:border-revelio-dark-border px-2 py-1 text-[10px] outline-none font-semibold dark:bg-revelio-dark-bg dark:text-revelio-dark-text mr-2" />
                        <button onClick={() => setForm({ ...form, services: form.services.filter((_, i) => i !== si) })} className="text-revelio-subtle hover:text-revelio-red"><X className="w-3 h-3" /></button>
                      </div>
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        <div><label className="text-[8px] text-revelio-subtle">Desde</label><input type="date" value={sv.from} onChange={e => { const n = [...form.services]; n[si] = { ...n[si]!, from: e.target.value }; setForm({ ...form, services: n }) }} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-1.5 py-1 text-[10px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
                        <div><label className="text-[8px] text-revelio-subtle">Hasta</label><input type="date" value={sv.to} onChange={e => { const n = [...form.services]; n[si] = { ...n[si]!, to: e.target.value }; setForm({ ...form, services: n }) }} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-1.5 py-1 text-[10px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
                        <div><label className="text-[8px] text-revelio-subtle">Coste estimado</label><input type="number" value={sv.cost || ''} onChange={e => { const n = [...form.services]; n[si] = { ...n[si]!, cost: Number(e.target.value) }; setForm({ ...form, services: n }) }} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-1.5 py-1 text-[10px] outline-none text-right font-bold dark:bg-revelio-dark-bg dark:text-revelio-dark-text" step={1000} /></div>
                        <div><label className="text-[8px] text-revelio-subtle">Margen %</label><input type="number" value={sv.margin_pct} onChange={e => { const n = [...form.services]; n[si] = { ...n[si]!, margin_pct: Number(e.target.value) }; setForm({ ...form, services: n }) }} className="w-full rounded border border-revelio-border dark:border-revelio-dark-border px-1.5 py-1 text-[10px] outline-none text-right dark:bg-revelio-dark-bg dark:text-revelio-dark-text" min={0} max={90} /></div>
                      </div>
                      {sv.cost > 0 && (
                        <div className="flex gap-4 text-[9px]">
                          <span className="text-revelio-subtle">Coste: <span className="font-bold text-revelio-orange">{fmt(sv.cost)}€</span></span>
                          <span className="text-revelio-subtle">Margen: <span className="font-bold text-revelio-green">+{fmt(marginAbs)}€</span></span>
                          <span className="text-revelio-subtle">Venta: <span className="font-bold text-revelio-blue">{fmt(sale)}€</span></span>
                        </div>
                      )}
                    </div>
                  )
                })}
                {/* Totals */}
                {form.services.length > 0 && (() => {
                  const tCost = form.services.reduce((s, sv) => s + sv.cost, 0)
                  const tSale = form.services.reduce((s, sv) => s + saleFromService(sv), 0)
                  const tMargin = tSale - tCost
                  const tPct = tSale > 0 ? Math.round((tMargin / tSale) * 100) : 0
                  return (
                    <div className="rounded-lg bg-white dark:bg-revelio-dark-card border border-revelio-border/50 dark:border-revelio-dark-border/50 p-3 mt-2">
                      <div className="flex justify-between text-[10px] mb-1"><span className="text-revelio-subtle">Coste total</span><span className="font-bold text-revelio-orange">{fmt(tCost)}€</span></div>
                      <div className="flex justify-between text-[10px] mb-1"><span className="text-revelio-subtle">Margen total ({tPct}%)</span><span className="font-bold text-revelio-green">+{fmt(tMargin)}€</span></div>
                      <div className="flex justify-between text-xs border-t border-revelio-border/30 dark:border-revelio-dark-border/30 pt-1.5"><span className="font-semibold dark:text-revelio-dark-text">Venta total</span><span className="font-bold text-revelio-blue text-sm">{fmt(tSale)}€</span></div>
                    </div>
                  )
                })()}
              </div>

              {/* Team — simplified: dedication + dates only */}
              {modal === 'edit' && projMembers.length > 0 && (
                <div className="border-t border-revelio-border dark:border-revelio-dark-border pt-4">
                  <p className="text-[10px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-2 flex items-center gap-1"><Users className="w-3 h-3" /> Equipo asignado</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[9px]">
                      <thead><tr className="text-[8px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase">
                        <th className="text-center py-1 pr-1">Persona</th><th className="text-center px-1">% Ded.</th><th className="text-center px-1">Desde</th><th className="text-center px-1">Hasta</th>
                      </tr></thead>
                      <tbody>{projMembers.map(m => {
                        const oe = orgEdits.find(o => o.member_id === m.id) || { member_id: m.id, sala: editRoom!.slug, dedication: 100, start_date: form.start_date, end_date: form.end_date }
                        const updOrg = (f: keyof OrgEntry, v: string | number) => {
                          const exists = orgEdits.find(o => o.member_id === m.id)
                          setOrgEdits(exists ? orgEdits.map(o => o.member_id === m.id ? { ...o, [f]: v } : o) : [...orgEdits, { ...oe, [f]: v }])
                        }
                        return (
                          <tr key={m.id} className="border-t border-revelio-border/30 dark:border-revelio-dark-border/30">
                            <td className="py-1.5 pr-1 text-center"><Link to={`/persona/${m.id}`} className="hover:text-revelio-blue"><span style={{ color: m.color }}>{m.avatar || '·'}</span> {m.name.split(' ')[0]} <span className="text-[8px] text-revelio-subtle">{m.role_label}</span></Link></td>
                            <td className="px-1 text-center"><input type="number" value={oe.dedication} onChange={e => updOrg('dedication', Number(e.target.value))} className="w-14 rounded border border-revelio-border dark:border-revelio-dark-border px-1 py-0.5 text-[10px] outline-none text-center dark:bg-revelio-dark-bg dark:text-revelio-dark-text" min={0} max={100} step={5} /></td>
                            <td className="px-1 text-center"><input type="date" value={oe.start_date || ''} onChange={e => updOrg('start_date', e.target.value)} className="rounded border border-revelio-border dark:border-revelio-dark-border px-1 py-0.5 text-[9px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text w-[110px]" /></td>
                            <td className="px-1 text-center"><input type="date" value={oe.end_date || ''} onChange={e => updOrg('end_date', e.target.value)} className="rounded border border-revelio-border dark:border-revelio-dark-border px-1 py-0.5 text-[9px] outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text w-[110px]" /></td>
                          </tr>
                        )
                      })}</tbody>
                    </table>
                  </div>
                  <p className="text-[8px] text-revelio-subtle dark:text-revelio-dark-subtle mt-1">La dedicacion se guarda en org_chart (la usan FTEs, Jornada y ficha individual).</p>
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

      {/* DELETE */}
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
