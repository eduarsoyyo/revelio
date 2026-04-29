import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/data/supabase'
import type { Member } from '@/types'
import { Plus, Edit, Trash2, Search, X } from 'lucide-react'
import { soundCreate, soundDelete } from '@/lib/sounds'
import {
  getCurrentCostRate, memberCostHour,
  vacDaysApproved, ausDaysApproved, effectiveTheoreticalHours,
  type CalendarData, type CostRate,
} from '@/domain/finance'

const uid = () => crypto.randomUUID()
const AVATARS = ['👤','🧙','🧙‍♀️','🦁','🐍','🦅','🦡','⚡','🌟','🔮','🏰','📚','🧪','🦋','🐉','🎯','🛡️','🌊','🔥','🌿','💎','🦊','🐺','🦉','🐝','🐙','🦄','🐧','🐻','🐬','🦈','🐢','🦇','🌸','🍀','🌙','☀️','🌈','🎲','🎭','🚀','🎸','🎨','🏆','🎪','🧬','🔬','💻','🎮','🎧','📱','🛸','🌍','🗡️','🏹','🧲','🔑','🗝️','🎩','👑']
const COLORS = ['#007AFF','#5856D6','#AF52DE','#FF2D55','#FF3B30','#FF9500','#FFCC00','#34C759','#00C7BE','#30B0C7','#5AC8FA','#8E8E93','#1D1D1F','#636366','#48484A','#D1D1D6','#0A84FF','#BF5AF2','#FF6482','#FF375F','#FFD60A','#32D74B','#64D2FF','#AC8E68']

interface OrgRow { id?: string; member_id: string; sala: string; dedication: number; start_date: string; end_date: string }
interface AbsenceReq { member_id: string; type: string; date_from: string; date_to: string; days: number; status: string }
interface UserForm { name: string; username: string; password: string; email: string; company: string; role_label: string; avatar: string; color: string; is_superuser: boolean; calendario_id: string; cost_rates: CostRate[]; hire_date: string; contract_type: string; convenio: string; projects: any[]; responsable_id: string; vacation_carryover: number }
const emptyForm: UserForm = { name: '', username: '', password: '', email: '', company: 'ALTEN', role_label: '', avatar: '👤', color: '#007AFF', is_superuser: false, calendario_id: '', cost_rates: [], hire_date: '', contract_type: 'indefinido', convenio: '', projects: [], responsable_id: '', vacation_carryover: 0 }

export function UsersPanel() {
  const [members, setMembers] = useState<Member[]>([])
  const [calendarios, setCalendarios] = useState<CalendarData[]>([])
  const [absReqs, setAbsReqs] = useState<AbsenceReq[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editMember, setEditMember] = useState<Member | null>(null)
  const [form, setForm] = useState<UserForm>({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const rx = (m: Member) => m as unknown as Record<string, unknown>
  const today = new Date().toISOString().slice(0, 10)
  const yr = new Date().getFullYear()

  const getCal = (m: Member): CalendarData | null => {
    const cid = m.calendario_id || (rx(m).calendario_id as string)
    return cid ? calendarios.find(c => c.id === cid) || null : null
  }
  const calNameOf = (m: Member) => getCal(m)?.name || '—'
  const vacPend = (m: Member): number => {
    const total = (m.annual_vac_days || 22) + (m.prev_year_pending || 0) + (Number(rx(m).vacation_carryover) || 0)
    return Math.max(0, total - vacDaysApproved(absReqs, m.id, yr))
  }
  const vacTotal = (m: Member): number => (m.annual_vac_days || 22) + (m.prev_year_pending || 0) + (Number(rx(m).vacation_carryover) || 0)

  const getMemberCostRate = (m: Member): CostRate | null => {
    const raw = rx(m).cost_rates as any[]
    return raw && raw.length > 0 ? getCurrentCostRate(raw.map(r => ({ from: r.from, to: r.to, salary: r.salary || 0, multiplier: r.multiplier || 1.33 }))) : null
  }

  useEffect(() => {
    Promise.all([
      supabase.from('team_members').select('*').order('name'),
      supabase.from('calendarios').select('*').order('name'),
      supabase.from('absence_requests').select('member_id, type, date_from, date_to, days, status'),
    ]).then(([mR, cR, aR]) => {
      if (mR.data) setMembers(mR.data)
      if (cR.data) setCalendarios(cR.data as CalendarData[])
      if (aR.data) setAbsReqs(aR.data as AbsenceReq[])
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(
    () => members.filter(m => m.name?.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase())),
    [members, search]
  )

  if (loading) return <div className="p-6 text-center text-text-secondary text-sm">Cargando usuarios...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">👥 Gestión de Usuarios</h1>
        <button
          onClick={() => { setModal('create'); setEditMember(null); setForm({ ...emptyForm }) }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm"
        />
        <Search className="absolute right-3 top-3 w-4 h-4 text-gray-400" />
      </div>

      <div className="space-y-2 max-w-4xl">
        {filtered.map(m => (
          <div key={m.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <span className="text-2xl">{m.avatar || '👤'}</span>
                <div className="flex-1">
                  <div className="font-semibold text-text-primary">{m.name}</div>
                  <div className="text-xs text-text-secondary">{m.email}</div>
                </div>
                <div className="text-xs text-text-secondary">{calNameOf(m)}</div>
                <div className="text-xs text-text-secondary">
                  Vac: {vacDaysApproved(absReqs, m.id, yr)} / {vacTotal(m)} | Pend: {vacPend(m)}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setModal('edit'); setEditMember(m); setForm({ ...emptyForm }) }} className="p-2 hover:bg-gray-200 rounded text-xs"><Edit className="w-4 h-4" /></button>
                <button onClick={() => setDeleteTarget(m)} className="p-2 hover:bg-red-100 rounded text-xs"><Trash2 className="w-4 h-4 text-red-600" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm">
            <h2 className="text-lg font-bold text-text-primary mb-4">Eliminar usuario</h2>
            <p className="text-sm text-text-secondary mb-4">Escriba "{deleteTarget.name}" para confirmar:</p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={deleteTarget.name}
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirm('') }}
                className="flex-1 px-3 py-2 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (deleteConfirm === deleteTarget.name) {
                    await supabase.from('team_members').delete().eq('id', deleteTarget.id)
                    setMembers(members.filter(m => m.id !== deleteTarget.id))
                    setDeleteTarget(null)
                    setDeleteConfirm('')
                    soundDelete()
                  }
                }}
                disabled={deleteConfirm !== deleteTarget.name}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-text-primary">{modal === 'create' ? 'Nuevo usuario' : 'Editar usuario'}</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <input type="text" placeholder="Nombre" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded text-sm" />
              <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded text-sm" />
              <input type="text" placeholder="Usuario" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded text-sm" />
              {modal === 'create' && <input type="password" placeholder="Contraseña" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded text-sm" />}
              {saveError && <div className="text-red-600 text-sm">{saveError}</div>}
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setModal(null)} className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300">Cancelar</button>
              <button
                onClick={async () => {
                  setSaving(true); setSaveError('')
                  try {
                    if (modal === 'create') {
                      await supabase.from('team_members').insert({
                        id: uid(),
                        name: form.name,
                        email: form.email,
                        username: form.username,
                        cost_rates: form.cost_rates,
                      })
                    } else if (editMember) {
                      await supabase.from('team_members').update({
                        name: form.name,
                        email: form.email,
                        username: form.username,
                      }).eq('id', editMember.id)
                    }
                    const { data } = await supabase.from('team_members').select('*').order('name')
                    if (data) setMembers(data)
                    setModal(null)
                    soundCreate()
                  } catch (e) {
                    setSaveError((e as Error).message)
                  }
                  setSaving(false)
                }}
                disabled={saving || !form.name || !form.email}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
