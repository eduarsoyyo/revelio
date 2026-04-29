import { useEffect, useState } from 'react'
import { Calendar, Plus, Edit, Trash2, Copy, ChevronLeft, ChevronRight, X, Sun, Clock } from 'lucide-react'
import { supabase } from '@/data/supabase'
import { soundCreate, soundDelete } from '@/lib/sounds'

interface Holiday { date: string; name: string }
interface Calendario {
  id: string; name: string; convenio_hours: number; weekly_hours_normal: number
  daily_hours_lj: number; daily_hours_v: number; daily_hours_intensive: number
  intensive_start: string; intensive_end: string; vacation_days: number
  free_days: number; adjustment_days: number; adjustment_hours: number
  holidays: Holiday[]
}
interface CalForm {
  name: string; convenio_hours: number; weekly_hours_normal: number
  daily_hours_lj: number; daily_hours_v: number; daily_hours_intensive: number
  intensive_start: string; intensive_end: string; vacation_days: number
  free_days: number; adjustment_days: number; adjustment_hours: number
  holidays: Holiday[]
}
const emptyForm: CalForm = { name: '', convenio_hours: 1764, weekly_hours_normal: 40, daily_hours_lj: 8.5, daily_hours_v: 6, daily_hours_intensive: 7, intensive_start: '06-15', intensive_end: '09-15', vacation_days: 22, free_days: 2, adjustment_days: 0, adjustment_hours: 0, holidays: [] }

// Festivos nacionales España por defecto
const DEFAULT_HOLIDAYS = (year: number): Holiday[] => [
  { date: `${year}-01-01`, name: 'Año Nuevo' },
  { date: `${year}-01-06`, name: 'Reyes' },
  { date: `${year}-03-28`, name: 'Viernes Santo' },
  { date: `${year}-05-01`, name: 'Día del Trabajo' },
  { date: `${year}-08-15`, name: 'Asunción' },
  { date: `${year}-10-12`, name: 'Fiesta Nacional' },
  { date: `${year}-11-01`, name: 'Todos los Santos' },
  { date: `${year}-12-06`, name: 'Constitución' },
  { date: `${year}-12-08`, name: 'Inmaculada' },
  { date: `${year}-12-25`, name: 'Navidad' },
]

export function CalendarPanel() {
  const [calendarios, setCalendarios] = useState<Calendario[]>([])
  const [members, setMembers] = useState<Array<{ id: string; name: string; avatar?: string; calendario_id?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editCal, setEditCal] = useState<Calendario | null>(null)
  const [form, setForm] = useState<CalForm>({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Calendario | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [newHolidayDate, setNewHolidayDate] = useState('')
  const [newHolidayName, setNewHolidayName] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('calendarios').select('*').order('name'),
      supabase.from('team_members').select('id, name, avatar, calendario_id').order('name'),
    ]).then(([cR, mR]) => {
      if (cR.data) setCalendarios(cR.data)
      if (mR.data) setMembers(mR.data)
      setLoading(false)
    })
  }, [])

  const openCreate = () => { setForm({ ...emptyForm, holidays: DEFAULT_HOLIDAYS(viewYear) }); setEditCal(null); setModal('create') }
  const openEdit = (c: Calendario) => {
    setForm({ name: c.name, convenio_hours: c.convenio_hours, weekly_hours_normal: c.weekly_hours_normal, daily_hours_lj: c.daily_hours_lj, daily_hours_v: c.daily_hours_v, daily_hours_intensive: c.daily_hours_intensive, intensive_start: c.intensive_start, intensive_end: c.intensive_end, vacation_days: c.vacation_days, free_days: c.free_days, adjustment_days: c.adjustment_days, adjustment_hours: c.adjustment_hours, holidays: c.holidays || [] })
    setEditCal(c); setModal('edit')
  }

  const handleSave = async () => {
    setSaving(true)
    const payload = { ...form }
    if (modal === 'create') {
      const { data } = await supabase.from('calendarios').insert(payload).select().single()
      if (data) { setCalendarios(prev => [...prev, data]); soundCreate() }
    } else if (editCal) {
      const { data } = await supabase.from('calendarios').update(payload).eq('id', editCal.id).select().single()
      if (data) { setCalendarios(prev => prev.map(c => c.id === editCal.id ? data : c)); soundCreate() }
    }
    setSaving(false); setModal(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirm !== deleteTarget.name) return
    await supabase.from('calendarios').delete().eq('id', deleteTarget.id)
    setCalendarios(prev => prev.filter(c => c.id !== deleteTarget.id))
    setDeleteTarget(null); setDeleteConfirm(''); soundDelete()
  }

  const handleClone = async (source: Calendario) => {
    const payload = { ...source, name: `${source.name} (copia)` }
    delete (payload as Record<string, unknown>).id
    const { data } = await supabase.from('calendarios').insert(payload).select().single()
    if (data) { setCalendarios(prev => [...prev, data]); soundCreate() }
  }

  const addHoliday = () => {
    if (!newHolidayDate) return
    const exists = form.holidays.some(h => h.date === newHolidayDate)
    if (exists) return
    setForm({ ...form, holidays: [...form.holidays, { date: newHolidayDate, name: newHolidayName || 'Festivo' }].sort((a, b) => a.date.localeCompare(b.date)) })
    setNewHolidayDate(''); setNewHolidayName('')
  }

  const removeHoliday = (date: string) => setForm({ ...form, holidays: form.holidays.filter(h => h.date !== date) })

  const loadDefaultHolidays = (year: number) => {
    const defaults = DEFAULT_HOLIDAYS(year)
    const merged = [...form.holidays]
    defaults.forEach(d => { if (!merged.some(h => h.date === d.date)) merged.push(d) })
    setForm({ ...form, holidays: merged.sort((a, b) => a.date.localeCompare(b.date)) })
  }

  if (loading) return <div className="text-sm text-revelio-subtle dark:text-revelio-dark-subtle text-center py-10">Cargando calendarios...</div>

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-revelio-text dark:text-revelio-dark-text">Calendario / Convenio</h2>
          <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">{calendarios.length} calendario{calendarios.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={() => setViewYear(y => y - 1)} className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><ChevronLeft className="w-3 h-3" /></button>
            <span className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text w-12 text-center">{viewYear}</span>
            <button onClick={() => setViewYear(y => y + 1)} className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><ChevronRight className="w-3 h-3" /></button>
          </div>
          <button onClick={openCreate} className="px-3 py-1.5 rounded-lg bg-revelio-text text-white text-xs font-medium flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nuevo</button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {calendarios.map(cal => {
          const yh = (cal.holidays || []).filter(h => h.date.startsWith(String(viewYear)))
          const assigned = members.filter(m => m.calendario_id === cal.id)
          return (
            <div key={cal.id} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-revelio-blue" /><h3 className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text">{cal.name}</h3></div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(cal)} className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><Edit className="w-3 h-3 text-revelio-blue" /></button>
                  <button onClick={() => handleClone(cal)} className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border" title="Clonar"><Copy className="w-3 h-3 text-revelio-violet" /></button>
                  <button onClick={() => { setDeleteTarget(cal); setDeleteConfirm('') }} className="w-6 h-6 rounded border border-revelio-red/20 flex items-center justify-center hover:bg-revelio-red/5"><Trash2 className="w-3 h-3 text-revelio-red" /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] mb-3">
                <R l="Convenio" v={`${cal.convenio_hours}h/año`} /><R l="Semanal" v={`${cal.weekly_hours_normal}h`} />
                <R l="L-J" v={`${cal.daily_hours_lj}h`} /><R l="Viernes" v={`${cal.daily_hours_v}h`} />
                <R l="Intensiva" v={`${cal.daily_hours_intensive}h`} /><R l="Vacaciones" v={`${cal.vacation_days}d`} />
                <R l="Libre disp." v={`${cal.free_days}d`} /><R l="Festivos {viewYear}" v={String(yh.length)} red />
              </div>
              {cal.intensive_start && <p className="text-[9px] text-revelio-orange flex items-center gap-0.5 mb-2"><Sun className="w-2.5 h-2.5" /> Intensiva: {cal.intensive_start} → {cal.intensive_end}</p>}
              {assigned.length > 0 && <div className="flex -space-x-1 mt-1">{assigned.slice(0, 6).map(m => <span key={m.id} className="w-5 h-5 rounded-full bg-revelio-blue/10 flex items-center justify-center text-[8px] border border-white" title={m.name}>{m.avatar || '·'}</span>)}{assigned.length > 6 && <span className="text-[8px] text-revelio-subtle ml-1">+{assigned.length - 6}</span>}</div>}
              {yh.length > 0 && <div className="mt-2 pt-2 border-t border-revelio-border/50 dark:border-revelio-dark-border/50"><p className="text-[8px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-1">Festivos {viewYear}</p><div className="flex gap-1 flex-wrap">{yh.slice(0, 10).map(h => <span key={h.date} className="text-[8px] bg-revelio-red/10 text-revelio-red px-1 py-0.5 rounded" title={h.name}>{new Date(h.date + 'T00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>)}{yh.length > 10 && <span className="text-[8px] text-revelio-subtle">+{yh.length - 10}</span>}</div></div>}
            </div>
          )
        })}
      </div>

      {calendarios.length === 0 && <div className="text-center py-16"><Calendar className="w-10 h-10 mx-auto mb-2 text-revelio-border" /><p className="text-sm text-revelio-subtle dark:text-revelio-dark-subtle">Sin calendarios.</p></div>}

      {/* ═══ Create/Edit Modal ═══ */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-revelio-dark-card rounded-2xl max-w-xl w-full p-6 shadow-xl max-h-[85vh] overflow-y-auto">
            <h3 className="text-base font-semibold mb-4 dark:text-revelio-dark-text">{modal === 'create' ? 'Nuevo calendario' : `Editar: ${form.name}`}</h3>
            <div className="space-y-4">
              <div><L>Nombre *</L><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" placeholder="Ej: Convenio Consultoría Sevilla" /></div>

              {/* Jornada */}
              <div className="border-t border-revelio-border dark:border-revelio-dark-border pt-4">
                <p className="text-[10px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-3 flex items-center gap-1"><Clock className="w-3 h-3" /> Jornada</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div><L>Convenio (h/año)</L><N val={form.convenio_hours} set={v => setForm({ ...form, convenio_hours: v })} /></div>
                  <div><L>Semanal (h)</L><N val={form.weekly_hours_normal} set={v => setForm({ ...form, weekly_hours_normal: v })} step={0.5} /></div>
                  <div><L>Diaria L-J (h)</L><N val={form.daily_hours_lj} set={v => setForm({ ...form, daily_hours_lj: v })} step={0.5} /></div>
                  <div><L>Diaria V (h)</L><N val={form.daily_hours_v} set={v => setForm({ ...form, daily_hours_v: v })} step={0.5} /></div>
                </div>
              </div>

              {/* Intensiva */}
              <div className="border-t border-revelio-border dark:border-revelio-dark-border pt-4">
                <p className="text-[10px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-3 flex items-center gap-1"><Sun className="w-3 h-3 text-revelio-orange" /> Jornada intensiva</p>
                <div className="grid grid-cols-3 gap-3">
                  <div><L>Horas/día</L><N val={form.daily_hours_intensive} set={v => setForm({ ...form, daily_hours_intensive: v })} step={0.5} /></div>
                  <div><L>Desde (MM-DD)</L><input value={form.intensive_start} onChange={e => setForm({ ...form, intensive_start: e.target.value })} placeholder="06-15" className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
                  <div><L>Hasta (MM-DD)</L><input value={form.intensive_end} onChange={e => setForm({ ...form, intensive_end: e.target.value })} placeholder="09-15" className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" /></div>
                </div>
              </div>

              {/* Días libres */}
              <div className="border-t border-revelio-border dark:border-revelio-dark-border pt-4">
                <p className="text-[10px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-3">Días libres</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div><L>Vacaciones (d)</L><N val={form.vacation_days} set={v => setForm({ ...form, vacation_days: v })} /></div>
                  <div><L>Libre disp. (d)</L><N val={form.free_days} set={v => setForm({ ...form, free_days: v })} /></div>
                  <div><L>Ajuste (d)</L><N val={form.adjustment_days} set={v => setForm({ ...form, adjustment_days: v })} /></div>
                  <div><L>Ajuste (h)</L><N val={form.adjustment_hours} set={v => setForm({ ...form, adjustment_hours: v })} step={0.5} /></div>
                </div>
              </div>

              {/* Festivos */}
              <div className="border-t border-revelio-border dark:border-revelio-dark-border pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold text-revelio-subtle dark:text-revelio-dark-subtle uppercase flex items-center gap-1"><Calendar className="w-3 h-3 text-revelio-red" /> Festivos ({form.holidays.length})</p>
                  <button onClick={() => loadDefaultHolidays(viewYear)} className="text-[9px] text-revelio-blue font-medium hover:underline">+ Cargar festivos España {viewYear}</button>
                </div>

                {/* Add holiday */}
                <div className="flex gap-2 mb-2">
                  <input type="date" value={newHolidayDate} onChange={e => setNewHolidayDate(e.target.value)} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1.5 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" />
                  <input value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)} placeholder="Nombre del festivo" className="flex-1 rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1.5 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" onKeyDown={e => e.key === 'Enter' && addHoliday()} />
                  <button onClick={addHoliday} disabled={!newHolidayDate} className="px-2 py-1.5 rounded-lg text-revelio-blue text-xs font-medium disabled:opacity-30"><Plus className="w-3.5 h-3.5" /></button>
                </div>

                {/* Holiday list */}
                <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                  {form.holidays.map(h => (
                    <div key={h.date} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-revelio-bg dark:hover:bg-revelio-dark-border group">
                      <span className="text-[10px] text-revelio-red font-semibold w-16">{new Date(h.date + 'T00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                      <span className="text-[10px] flex-1 dark:text-revelio-dark-text">{h.name}</span>
                      <button onClick={() => removeHoliday(h.date)} className="opacity-0 group-hover:opacity-100 text-revelio-subtle hover:text-revelio-red"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
                {form.holidays.length === 0 && <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle text-center py-2">Sin festivos. Usa "Cargar festivos España" o añade manualmente.</p>}
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-lg border border-revelio-border dark:border-revelio-dark-border text-sm font-medium text-revelio-subtle">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-[2] py-2 rounded-lg bg-revelio-text text-white text-sm font-medium disabled:opacity-40">{saving ? 'Guardando...' : modal === 'create' ? 'Crear' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteTarget(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-revelio-dark-card rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <div className="text-center mb-4"><Trash2 className="w-8 h-8 text-revelio-red mx-auto mb-2" /><h3 className="font-semibold dark:text-revelio-dark-text">Eliminar calendario</h3><p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mt-1">Escribe <strong className="text-revelio-red">{deleteTarget.name}</strong></p></div>
            <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} onKeyDown={e => e.key === 'Enter' && deleteConfirm === deleteTarget.name && handleDelete()} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-sm outline-none focus:border-revelio-red mb-3 dark:bg-revelio-dark-bg dark:text-revelio-dark-text" autoFocus />
            <div className="flex gap-2"><button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 rounded-lg border border-revelio-border text-sm font-medium text-revelio-subtle">Cancelar</button><button onClick={handleDelete} disabled={deleteConfirm !== deleteTarget.name} className="flex-1 py-2 rounded-lg bg-revelio-red text-white text-sm font-medium disabled:opacity-30">Eliminar</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

function L({ children }: { children: React.ReactNode }) { return <label className="text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase block mb-1">{children}</label> }
function N({ val, set, step }: { val: number; set: (v: number) => void; step?: number }) { return <input type="number" value={val || ''} onChange={e => set(Number(e.target.value))} className="w-full rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" step={step || 1} /> }
function R({ l, v, red }: { l: string; v: string; red?: boolean }) { return <div><span className="text-revelio-subtle dark:text-revelio-dark-subtle">{l}:</span> <span className={`font-semibold ${red ? 'text-revelio-red' : 'dark:text-revelio-dark-text'}`}>{v}</span></div> }
