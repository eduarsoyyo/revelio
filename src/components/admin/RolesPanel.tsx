import { useEffect, useState, useMemo } from 'react'
import { Plus, ChevronDown, ChevronRight, X, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '@/data/supabase'
import type { Member } from '@/types'

const ROLE_COLORS: Record<string, string> = { 'Service Manager': '#FF3B30', 'Jefe de proyecto': '#FF9500', 'Scrum Master': '#007AFF', 'Product Owner': '#5856D6', 'Consultor': '#34C759', 'Analista Funcional': '#AF52DE', 'Desarrollador/a': '#00C7BE', 'QA / Tester': '#FF2D55', 'DevOps': '#5AC8FA', 'Tech Lead': '#FF6482' }

export function RolesPanel() {
  const [members, setMembers] = useState<Member[]>([])
  const [roles, setRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [newRole, setNewRole] = useState('')
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleteInput, setDeleteInput] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('team_members').select('*').order('name'),
      supabase.from('admin_roles').select('*').order('name'),
    ]).then(([mR, rR]) => {
      if (mR.data) setMembers(mR.data)
      if (rR.data) setRoles(rR.data.map((r: Record<string, unknown>) => String(r.name || r.label || '')).filter(Boolean))
      setLoading(false)
    })
  }, [])

  const allRoleNames = useMemo(() => [...new Set([...roles, ...members.map(m => m.role_label).filter(Boolean) as string[]])].sort(), [roles, members])
  const byRole = (role: string) => members.filter(m => m.role_label === role)
  const roleColor = (role: string) => ROLE_COLORS[role] || '#5856D6'

  const handleAddRole = async () => {
    const t = newRole.trim()
    if (!t || allRoleNames.includes(t)) return
    await supabase.from('admin_roles').insert({ name: t })
    setRoles(prev => [...prev, t]); setNewRole('')
  }

  const handleAssignRole = async (memberId: string, role: string) => {
    setSaving(memberId)
    await supabase.from('team_members').update({ role_label: role }).eq('id', memberId)
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role_label: role } : m))
    setSaving(null)
  }

  const handleUnassignRole = async (memberId: string) => {
    setSaving(memberId)
    await supabase.from('team_members').update({ role_label: '' }).eq('id', memberId)
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role_label: '' } : m))
    setSaving(null)
  }

  const handleRenameRole = async (oldName: string) => {
    const newName = editName.trim()
    if (!newName || newName === oldName) { setEditingRole(null); return }
    // Rename in admin_roles
    await supabase.from('admin_roles').update({ name: newName }).eq('name', oldName)
    // Update all team_members with this role
    await supabase.from('team_members').update({ role_label: newName }).eq('role_label', oldName)
    setRoles(prev => prev.map(r => r === oldName ? newName : r))
    setMembers(prev => prev.map(m => m.role_label === oldName ? { ...m, role_label: newName } : m))
    setEditingRole(null); setEditName('')
  }

  const handleDeleteRole = async (name: string) => {
    // Remove from admin_roles
    await supabase.from('admin_roles').delete().eq('name', name)
    // Clear role from all members with this role
    await supabase.from('team_members').update({ role_label: '' }).eq('role_label', name)
    setRoles(prev => prev.filter(r => r !== name))
    setMembers(prev => prev.map(m => m.role_label === name ? { ...m, role_label: '' } : m))
    setConfirmDelete(null); setDeleteInput('')
  }

  if (loading) return <div className="text-sm text-revelio-subtle dark:text-revelio-dark-subtle text-center py-10">Cargando roles...</div>

  return (
    <div className="max-w-4xl">
      <h2 className="text-lg font-semibold text-revelio-text dark:text-revelio-dark-text mb-1">Roles y Habilidades</h2>
      <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mb-4">{allRoleNames.length} roles · {members.length} personas</p>

      {/* Add role */}
      <div className="flex gap-2 mb-5">
        <input value={newRole} onChange={e => setNewRole(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddRole()} placeholder="Nombre del nuevo rol..." className="flex-1 rounded-lg border border-revelio-border dark:border-revelio-dark-border px-3 py-2 text-sm outline-none focus:border-revelio-blue dark:bg-revelio-dark-bg dark:text-revelio-dark-text" />
        <button onClick={handleAddRole} disabled={!newRole.trim()} className="px-4 py-2 rounded-lg bg-revelio-text text-white text-xs font-medium disabled:opacity-30 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Añadir</button>
      </div>

      {/* Role cards */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {allRoleNames.map(role => {
          const mems = byRole(role)
          const color = roleColor(role)
          const isExp = expandedRole === role
          const unassigned = members.filter(m => m.role_label !== role)

          return (
            <div key={role} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card overflow-hidden">
              <button onClick={() => setExpandedRole(isExp ? null : role)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-revelio-bg dark:hover:bg-revelio-dark-border dark:bg-revelio-dark-border/50 transition-colors">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + '18' }}>
                  <span className="text-base font-bold" style={{ color }}>{role.charAt(0)}</span>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text">{role}</p>
                  <p className="text-[10px]" style={{ color }}>{mems.length} persona{mems.length !== 1 ? 's' : ''}</p>
                </div>
                {isExp ? <ChevronDown className="w-4 h-4 text-revelio-subtle dark:text-revelio-dark-subtle" /> : <ChevronRight className="w-4 h-4 text-revelio-subtle dark:text-revelio-dark-subtle" />}
              </button>

              {isExp && (
                <div className="border-t border-revelio-border dark:border-revelio-dark-border px-4 py-3">
                  {/* Edit / Delete actions */}
                  <div className="flex gap-2 mb-3">
                    {editingRole === role ? (
                      <div className="flex gap-1 flex-1">
                        <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRenameRole(role)} className="flex-1 rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" autoFocus />
                        <button onClick={() => handleRenameRole(role)} className="px-2 py-1 rounded-lg bg-revelio-blue text-white text-[10px] font-semibold">Guardar</button>
                        <button onClick={() => setEditingRole(null)} className="text-[10px] text-revelio-subtle">Cancelar</button>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => { setEditingRole(role); setEditName(role) }} className="flex items-center gap-1 text-[10px] text-revelio-blue hover:underline"><Pencil className="w-2.5 h-2.5" /> Renombrar</button>
                        <button onClick={() => { setConfirmDelete(role); setDeleteInput('') }} className="flex items-center gap-1 text-[10px] text-revelio-red hover:underline"><Trash2 className="w-2.5 h-2.5" /> Eliminar</button>
                      </>
                    )}
                  </div>
                  {/* Confirm delete */}
                  {confirmDelete === role && (
                    <div className="bg-revelio-red/5 border border-revelio-red/20 rounded-lg p-3 mb-3">
                      <p className="text-[10px] text-revelio-red font-semibold mb-1">Escribe "{role}" para confirmar la eliminación</p>
                      <p className="text-[9px] text-revelio-subtle mb-2">Se desasignará el rol de {mems.length} persona{mems.length !== 1 ? 's' : ''}.</p>
                      <div className="flex gap-1">
                        <input value={deleteInput} onChange={e => setDeleteInput(e.target.value)} className="flex-1 rounded-lg border border-revelio-red/30 px-2 py-1 text-xs outline-none" placeholder={role} />
                        <button onClick={() => handleDeleteRole(role)} disabled={deleteInput !== role} className="px-2 py-1 rounded-lg bg-revelio-red text-white text-[10px] font-semibold disabled:opacity-30">Eliminar</button>
                        <button onClick={() => setConfirmDelete(null)} className="text-[10px] text-revelio-subtle">Cancelar</button>
                      </div>
                    </div>
                  )}
                  {/* Assigned */}
                  {mems.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-1.5">Asignados ({mems.length})</p>
                      {mems.map(m => (
                        <div key={m.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg mb-1" style={{ background: color + '08' }}>
                          <div className="w-5 h-5 rounded flex items-center justify-center text-xs" style={{ background: m.color || '#007AFF' }}>{m.avatar || '👤'}</div>
                          <span className="text-xs font-medium flex-1">{m.name}</span>
                          <button onClick={() => handleUnassignRole(m.id)} disabled={saving === m.id} className="text-revelio-subtle dark:text-revelio-dark-subtle hover:text-revelio-red disabled:opacity-30"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {mems.length === 0 && <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle mb-3">Nadie asignado</p>}

                  {/* Available to assign */}
                  <p className="text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase mb-1.5">Asignar personas</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {unassigned.map(m => (
                      <button key={m.id} onClick={() => handleAssignRole(m.id, role)} disabled={saving === m.id}
                        className="flex items-center gap-1 px-2 py-1 rounded-full border border-dashed border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card text-[10px] hover:border-revelio-blue disabled:opacity-30">
                        <span className="text-xs">{m.avatar || '👤'}</span> {m.name.split(' ')[0]}
                        {m.role_label && <span className="text-revelio-subtle dark:text-revelio-dark-subtle">({m.role_label})</span>}
                      </button>
                    ))}
                    {unassigned.length === 0 && <span className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">Todos asignados</span>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
