import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/data/supabase'
import type { Member } from '@/types'
import { Plus, Edit2, Trash2, Search, X } from 'lucide-react'
import { soundCreate, soundDelete } from '@/lib/sounds'
import { vacDaysApproved, type CalendarData, type CostRate } from '@/domain/finance'

const uid = () => crypto.randomUUID()

interface AbsenceReq {
  member_id: string
  type: string
  date_from: string
  date_to: string
  days: number
  status: string
}

interface UserForm {
  name: string
  username: string
  password: string
  email: string
  company: string
  role_label: string
  avatar: string
  color: string
  is_superuser: boolean
  calendario_id: string
  cost_rates: CostRate[]
  hire_date: string
  contract_type: string
  convenio: string
  projects: any[]
  responsable_id: string
  vacation_carryover: number
}

const EMPTY_FORM: UserForm = {
  name: '',
  username: '',
  password: '',
  email: '',
  company: 'ALTEN',
  role_label: '',
  avatar: '👤',
  color: '#007AFF',
  is_superuser: false,
  calendario_id: '',
  cost_rates: [],
  hire_date: '',
  contract_type: 'indefinido',
  convenio: '',
  projects: [],
  responsable_id: '',
  vacation_carryover: 0,
}

export function UsersPanel() {
  const [members, setMembers] = useState<Member[]>([])
  const [calendarios, setCalendarios] = useState<CalendarData[]>([])
  const [absReqs, setAbsReqs] = useState<AbsenceReq[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editMember, setEditMember] = useState<Member | null>(null)
  const [form, setForm] = useState<UserForm>({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const rx = (m: Member) => m as unknown as Record<string, unknown>
  const yr = new Date().getFullYear()

  const getCal = (m: Member): CalendarData | null => {
    const cid = m.calendario_id || (rx(m).calendario_id as string)
    return cid ? calendarios.find((c) => c.id === cid) || null : null
  }

  const calNameOf = (m: Member) => getCal(m)?.name || '—'

  const vacPend = (m: Member): number => {
    const total = (m.annual_vac_days || 22) + (m.prev_year_pending || 0) + (Number(rx(m).vacation_carryover) || 0)
    return Math.max(0, total - vacDaysApproved(absReqs, m.id, yr))
  }

  const vacTotal = (m: Member): number =>
    (m.annual_vac_days || 22) + (m.prev_year_pending || 0) + (Number(rx(m).vacation_carryover) || 0)

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
    () =>
      members.filter(
        (m) =>
          m.name?.toLowerCase().includes(search.toLowerCase()) ||
          m.email?.toLowerCase().includes(search.toLowerCase()),
      ),
    [members, search],
  )

  const openCreateModal = () => {
    setModal('create')
    setEditMember(null)
    setForm({ ...EMPTY_FORM })
  }

  const openEditModal = (m: Member) => {
    setModal('edit')
    setEditMember(m)
    setForm({ ...EMPTY_FORM, name: m.name, email: m.email, username: m.username || '' })
  }

  const closeModal = () => {
    setModal(null)
    setEditMember(null)
    setForm({ ...EMPTY_FORM })
    setSaveError('')
  }

  const handleDelete = async () => {
    if (deleteConfirm !== deleteTarget?.name) return

    try {
      await supabase.from('team_members').delete().eq('id', deleteTarget.id)
      setMembers(members.filter((m) => m.id !== deleteTarget.id))
      setDeleteTarget(null)
      setDeleteConfirm('')
      soundDelete()
    } catch (error) {
      console.error('Error deleting member:', error)
    }
  }

  const handleSave = async () => {
    if (!form.name || !form.email) return

    setSaving(true)
    setSaveError('')

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
      closeModal()
      soundCreate()
    } catch (error) {
      setSaveError((error as Error).message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !saving) {
      handleSave()
    } else if (e.key === 'Escape') {
      closeModal()
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-text-secondary text-sm">Cargando usuarios...</div>
      </div>
    )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Gestión de Usuarios</h1>
          <p className="text-xs text-text-secondary mt-1">
            {filtered.length} usuario{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 text-sm font-medium transition"
          title="Crear nuevo usuario"
        >
          <Plus className="w-4 h-4" />
          Nuevo
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 w-4 h-4 text-text-secondary" />
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          aria-label="Buscar usuarios"
        />
      </div>

      {/* Members List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-gray-200 rounded-lg">
            <p className="text-text-secondary text-sm">No hay usuarios que coincidan con la búsqueda</p>
          </div>
        ) : (
          filtered.map((member) => (
            <div
              key={member.id}
              className="p-4 border border-gray-200 rounded-lg hover:shadow-sm hover:border-gray-300 transition group"
            >
              <div className="flex items-center justify-between gap-4">
                {/* Member info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg"
                    style={{ backgroundColor: `${member.color || '#007AFF'}20` }}
                    title={member.avatar}
                  >
                    {member.avatar || '👤'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-text-primary truncate">{member.name}</div>
                    <div className="text-xs text-text-secondary truncate">{member.email}</div>
                  </div>
                </div>

                {/* Metadata */}
                <div className="hidden sm:block text-right">
                  <div className="text-xs text-text-secondary">{calNameOf(member)}</div>
                  <div className="text-xs text-text-secondary">
                    Vac: {vacDaysApproved(absReqs, member.id, yr)}/{vacTotal(member)}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => openEditModal(member)}
                    className="p-2 hover:bg-gray-100 rounded text-gray-600 hover:text-blue-600 transition"
                    title="Editar usuario"
                    aria-label={`Editar ${member.name}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(member)}
                    className="p-2 hover:bg-gray-100 rounded text-gray-600 hover:text-red-600 transition"
                    title="Eliminar usuario"
                    aria-label={`Eliminar ${member.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full">
            <div className="p-6">
              <h2 className="text-lg font-bold text-text-primary mb-4">Eliminar usuario</h2>
              <p className="text-sm text-text-secondary mb-4">
                Esta acción no se puede deshacer. Escribe el nombre para confirmar:
              </p>
              <input
                type="text"
                placeholder={deleteTarget.name}
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deleteConfirm === deleteTarget.name) {
                    handleDelete()
                  } else if (e.key === 'Escape') {
                    setDeleteTarget(null)
                    setDeleteConfirm('')
                  }
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setDeleteTarget(null)
                    setDeleteConfirm('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 text-sm font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteConfirm !== deleteTarget.name}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-xl w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-text-primary">
                {modal === 'create' ? 'Nuevo usuario' : 'Editar usuario'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-2">Nombre *</label>
                <input
                  type="text"
                  placeholder="Ej: Juan García"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  onKeyDown={handleKeyDown}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-2">Email *</label>
                <input
                  type="email"
                  placeholder="juan@alten.es"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  onKeyDown={handleKeyDown}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-2">Usuario</label>
                <input
                  type="text"
                  placeholder="juan.garcia"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  onKeyDown={handleKeyDown}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {modal === 'create' && (
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-2">Contraseña *</label>
                  <input
                    type="password"
                    placeholder="Mín. 6 caracteres"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    onKeyDown={handleKeyDown}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}

              {saveError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs">
                  {saveError}
                </div>
              )}
            </div>

            <div className="p-6 bg-gray-50 rounded-b-2xl border-t border-gray-200 flex gap-2">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 text-sm font-medium transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.email}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition"
                title="Presiona Enter para guardar"
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
