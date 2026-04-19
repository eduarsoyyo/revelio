// @ts-nocheck — legacy code, superseded by UsersPanel/RolesPanel/CalendarPanel
// ═══ ADMIN PANELS — Maestros, Roles, Usuarios, Convenio, Calendarios, Escalado Global ═══
// All admin sub-panels for Centro de Control.

import { useState, useEffect } from 'preact/hooks';
import type { Member, Room, Risk } from '../../types/index';
import { loadAdminRoles, saveAdminRole, deleteAdminRole, loadAdminCalendars, loadActiveRetroSnapshots } from '../../data/admin';
import { loadConvenios, saveConvenio, deleteConvenio, assignConvenioToMember, type Convenio } from '../../data/convenios';
import { loadCalendarios, saveCalendario, deleteCalendario, assignCalendarioToMember, type Calendario, type Holiday } from '../../data/calendarios';
import { loadTeamMembers, saveTeamMember } from '../../data/team';
import { setUserPassword } from '../../data/auth';
import { loadRooms } from '../../data/rooms';
import { Icon } from '../common/Icon';

// ── Shared helpers ──
const BUILTIN_ROLES: string[] = []; // deprecated — roles from admin_roles table
const ROLE_COLORS: Record<string, string> = {'Scrum Master':'#007AFF','Product Owner':'#5856D6','Desarrollador/a':'#34C759','QA / Tester':'#FF9500','Diseñador/a':'#FF2D55','DevOps':'#00C7BE','Tech Lead':'#FF3B30','Analista':'#AF52DE','Project Manager':'#007AFF','Stakeholder':'#86868B'};

// ═══ 1. ADMIN ROLES ═══

export function AdminRoles() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([...BUILTIN_ROLES]);
  const [newRole, setNewRole] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadTeamMembers().then(r => { if (r.ok) setMembers(r.data); setLoading(false); });
    loadAdminRoles().then(names => {
      if (names.length > 0) setRoles([...new Set([...BUILTIN_ROLES, ...names])]);
    });
  }, []);

  const addRole = async () => {
    const t = newRole.trim();
    if (!t || roles.includes(t)) return;
    await saveAdminRole(t);
    setRoles(prev => [...prev, t]);
    setNewRole('');
  };

  const delRole = async (role: string) => {
    if (BUILTIN_ROLES.includes(role)) return;
    await deleteAdminRole(role);
    setRoles(prev => prev.filter(r => r !== role));
  };

  const assignRole = async (memberId: string, role: string) => {
    setSaving(memberId);
    const m = members.find(x => x.id === memberId);
    if (!m) { setSaving(null); return; }
    const u = { ...m, role_label: role };
    await saveTeamMember(u);
    setMembers(prev => prev.map(x => x.id === memberId ? u : x));
    setSaving(null);
  };

  const removeRole = async (memberId: string) => {
    setSaving(memberId);
    const m = members.find(x => x.id === memberId);
    if (!m) { setSaving(null); return; }
    const u = { ...m, role_label: '' };
    await saveTeamMember(u);
    setMembers(prev => prev.map(x => x.id === memberId ? u : x));
    setSaving(null);
  };

  const byRole = (role: string) => members.filter(m => m.role_label === role);
  const allRoles = [...new Set([...roles, ...members.map(m => m.role_label).filter(Boolean)])];
  const unassigned = members.filter(m => !m.role_label);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando…</div>;

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Gestión de roles</h3>
      <p style={{ fontSize: 12, color: '#86868B', marginBottom: 16 }}>{allRoles.length} roles · {members.length} usuarios</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 10, marginBottom: 16 }}>
        {allRoles.map(role => {
          const mems = byRole(role);
          const color = ROLE_COLORS[role] || '#5856D6';
          const isBuiltin = BUILTIN_ROLES.includes(role);
          const isExp = expanded === role;
          return (
            <div key={role} style={{ background: '#FFF', borderRadius: 14, border: `1.5px solid ${isExp ? color : '#E5E5EA'}`, overflow: 'hidden' }}>
              <div onClick={() => setExpanded(isExp ? null : role)}
                style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color }}>{role.charAt(0)}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {role}
                    {!isBuiltin && <span style={{ fontSize: 9, color: '#86868B', background: '#F2F2F7', padding: '1px 5px', borderRadius: 4, marginLeft: 6 }}>personalizado</span>}
                  </div>
                  <div style={{ fontSize: 11, color: mems.length > 0 ? color : '#C7C7CC', fontWeight: 600, marginTop: 1 }}>
                    {mems.length > 0 ? `${mems.length} persona${mems.length !== 1 ? 's' : ''}` : 'Sin asignar'}
                  </div>
                </div>
                {!isBuiltin && <button onClick={e => { e.stopPropagation(); delRole(role); }} style={{ border: 'none', background: 'none', color: '#FF3B30', fontSize: 14, cursor: 'pointer' }}>✕</button>}
              </div>
              {isExp && (
                <div style={{ borderTop: '1px solid #F2F2F7', padding: '10px 14px' }}>
                  {mems.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: color + '08', marginBottom: 4 }}>
                      <span style={{ fontSize: 15 }}>{m.avatar || '👤'}</span>
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{m.name}</span>
                      <button onClick={() => removeRole(m.id)} disabled={saving === m.id} style={{ border: 'none', background: 'none', color: '#C7C7CC', fontSize: 12, cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#86868B', marginBottom: 6, marginTop: 8, textTransform: 'uppercase' }}>Asignar a…</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {members.filter(m => m.role_label !== role).map(m => (
                      <button key={m.id} onClick={() => assignRole(m.id, role)} disabled={saving === m.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, border: '1.5px solid #E5E5EA', background: '#FFF', cursor: 'pointer', fontSize: 11 }}>
                        {m.avatar || '👤'} {m.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add role */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 14px', borderRadius: 12, background: '#F9F9FB', border: '1.5px solid #E5E5EA' }}>
        <input value={newRole} onInput={e => setNewRole((e.target as HTMLInputElement).value)} onKeyDown={e => e.key === 'Enter' && addRole()}
          placeholder="Nombre del nuevo rol…" style={{ flex: 1, border: '1.5px solid #E5E5EA', borderRadius: 9, padding: '8px 12px', fontSize: 13, outline: 'none', background: '#FFF' }} />
        <button onClick={addRole} disabled={!newRole.trim()} style={{ padding: '8px 18px', borderRadius: 9, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: newRole.trim() ? 1 : 0.4 }}>+ Añadir</button>
      </div>
    </div>
  );
}

// ═══ 2. ADMIN USUARIOS ═══

export function AdminUsuarios() {
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '', role_label: '', company: '', phone: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([loadTeamMembers(), loadAdminRoles()]).then(([r, rolesData]) => {
      if (r.ok) setMembers(r.data);
      setRoles(rolesData || []);
      setLoading(false);
    });
  }, []);

  const filtered = search ? members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || (m.email || '').toLowerCase().includes(search.toLowerCase())) : members;

  const openCreate = () => { setForm({ name: '', email: '', username: '', password: '', role_label: '', company: '', phone: '' }); setEditMember(null); setModal('create'); };
  const openEdit = (m: Member) => { setForm({ name: m.name, email: m.email || '', username: m.username || '', password: '', role_label: m.role_label || '', company: m.company || '', phone: m.phone || '' }); setEditMember(m); setModal('edit'); };
  const closeModal = () => { setModal(null); setEditMember(null); };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (modal === 'create') {
      const newId = Date.now().toString(36) + Math.random().toString(36).slice(2);
      const newMember = { id: newId, name: form.name, email: form.email, username: form.username || form.name.toLowerCase().replace(/\s+/g, '.'), role_label: form.role_label, company: form.company, phone: form.phone, rooms: [], is_superuser: false, vacations: [], annual_vac_days: 22, prev_year_pending: 0 } as Member;
      const result = await saveTeamMember(newMember);
      if (result.ok) {
        if (form.password) await setUserPassword(result.data.id, form.password);
        setMembers(prev => [...prev, result.data]);
      }
    } else if (modal === 'edit' && editMember) {
      const updated = { ...editMember, name: form.name, email: form.email, username: form.username, role_label: form.role_label, company: form.company, phone: form.phone };
      const result = await saveTeamMember(updated);
      if (result.ok) {
        if (form.password) await setUserPassword(result.data.id, form.password);
        setMembers(prev => prev.map(m => m.id === editMember.id ? result.data : m));
      }
    }
    setSaving(false); closeModal();
  };

  const handleDelete = async (id: string) => {
    try { const { supabase } = await import('../../data/supabase'); await supabase.from('team_members').delete().eq('id', id); setMembers(prev => prev.filter(m => m.id !== id)); } catch {}
  };

  const toggleSuperuser = async (m: Member) => {
    const u = { ...m, is_superuser: !m.is_superuser }; await saveTeamMember(u); setMembers(prev => prev.map(x => x.id === m.id ? u : x));
  };

  const inputStyle = { padding: '8px 12px', borderRadius: 10, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit', background: '#F9F9FB' };
  const labelStyle = { fontSize: 10, fontWeight: 700, color: '#86868B', display: 'block', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: 0.4 };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando…</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Usuarios</h3>
          <p style={{ fontSize: 12, color: '#86868B' }}>{members.length} registrados</p>
        </div>
        <button onClick={openCreate} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Nuevo usuario</button>
      </div>

      <input value={search} onInput={e => setSearch((e.target as HTMLInputElement).value)} placeholder="Buscar..."
        style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none', width: '100%', marginBottom: 12, boxSizing: 'border-box' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {filtered.map(m => (
          <div key={m.id} class="card-hover" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#FFF', borderRadius: 12, border: '1px solid #E5E5EA', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: m.color || '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{m.avatar || '👤'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{m.name}</div>
              <div style={{ fontSize: 11, color: '#86868B' }}>{m.username || '—'} · {m.email || '—'} · {m.role_label || 'Sin rol'}</div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: m.is_superuser ? '#007AFF' : '#C7C7CC', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!m.is_superuser} onChange={() => toggleSuperuser(m)} style={{ accentColor: '#007AFF' }} /> Admin
            </label>
            <button onClick={() => openEdit(m)} style={{ border: 'none', background: '#F2F2F7', borderRadius: 6, padding: '4px 8px', fontSize: 10, cursor: 'pointer', color: '#007AFF', fontWeight: 600 }}>Editar</button>
            <button onClick={() => handleDelete(m.id)} style={{ border: 'none', background: '#FF3B3010', borderRadius: 6, padding: '4px 8px', fontSize: 10, cursor: 'pointer', color: '#FF3B30', fontWeight: 600 }}>Eliminar</button>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#FFF', borderRadius: 20, width: '90%', maxWidth: 480, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{modal === 'create' ? 'Nuevo usuario' : 'Editar usuario'}</h3>
              <button onClick={closeModal} style={{ border: 'none', background: '#F2F2F7', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Icon name="X" size={16} color="#86868B" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={labelStyle}>Nombre *</label><input value={form.name} onInput={e => setForm({ ...form, name: (e.target as HTMLInputElement).value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Usuario</label><input value={form.username} onInput={e => setForm({ ...form, username: (e.target as HTMLInputElement).value })} placeholder={form.name.toLowerCase().replace(/\s+/g, '.')} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={labelStyle}>Email</label><input type="email" value={form.email} onInput={e => setForm({ ...form, email: (e.target as HTMLInputElement).value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Contraseña{modal === 'edit' ? ' (dejar vacío para mantener)' : ' *'}</label><input type="password" value={form.password} onInput={e => setForm({ ...form, password: (e.target as HTMLInputElement).value })} style={inputStyle} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div><label style={labelStyle}>Rol</label><select value={form.role_label} onChange={e => setForm({ ...form, role_label: (e.target as HTMLSelectElement).value })} style={inputStyle}><option value="">— Sin rol —</option>{roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}</select></div>
                <div><label style={labelStyle}>Empresa</label><input value={form.company} onInput={e => setForm({ ...form, company: (e.target as HTMLInputElement).value })} style={inputStyle} /></div>
                <div><label style={labelStyle}>Teléfono</label><input value={form.phone} onInput={e => setForm({ ...form, phone: (e.target as HTMLInputElement).value })} style={inputStyle} /></div>
              </div>
            </div>

            <button onClick={handleSave} disabled={saving || !form.name.trim()}
              style={{ width: '100%', padding: 11, borderRadius: 11, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 16, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando…' : modal === 'create' ? 'Crear usuario' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ 3. ADMIN CONVENIO ═══

export function AdminConvenio() {
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', vac_days: 22, notes: '' });

  useEffect(() => {
    Promise.all([loadConvenios(), loadTeamMembers()]).then(([convs, mR]) => {
      setConvenios(convs);
      if (mR.ok) setMembers(mR.data);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const saved = await saveConvenio(editId ? { id: editId, ...form } : form);
    if (saved) {
      if (editId) setConvenios(prev => prev.map(c => c.id === editId ? saved : c));
      else setConvenios(prev => [...prev, saved]);
      setEditId(null); setForm({ name: '', vac_days: 22, notes: '' });
    }
  };

  const handleDelete = async (id: string) => {
    await deleteConvenio(id);
    setConvenios(prev => prev.filter(c => c.id !== id));
  };

  const handleAssign = async (memberId: string, convenioId: string) => {
    await assignConvenioToMember(memberId, convenioId || null);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, convenio_id: convenioId } as Member : m));
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando…</div>;

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Convenios</h3>
      <p style={{ fontSize: 12, color: '#86868B', marginBottom: 16 }}>{convenios.length} convenio{convenios.length !== 1 ? 's' : ''} · Asigna usuarios a cada convenio</p>

      {/* Create/Edit form */}
      <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16, marginBottom: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: 2, minWidth: 160 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#86868B', display: 'block', marginBottom: 3 }}>Nombre</label>
          <input value={form.name} onInput={e => setForm({ ...form, name: (e.target as HTMLInputElement).value })}
            placeholder="Ej: Consultoría e Informática"
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none' }} />
        </div>
        <div style={{ minWidth: 80 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#86868B', display: 'block', marginBottom: 3 }}>Días vac.</label>
          <input type="number" value={form.vac_days} onInput={e => setForm({ ...form, vac_days: parseInt((e.target as HTMLInputElement).value) || 22 })}
            style={{ width: 80, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none' }} />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#86868B', display: 'block', marginBottom: 3 }}>Notas</label>
          <input value={form.notes} onInput={e => setForm({ ...form, notes: (e.target as HTMLInputElement).value })}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none' }} />
        </div>
        <button onClick={handleSave}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {editId ? 'Actualizar' : '+ Crear'}
        </button>
        {editId && <button onClick={() => { setEditId(null); setForm({ name: '', vac_days: 22, notes: '' }); }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 12, cursor: 'pointer', color: '#86868B' }}>Cancelar</button>}
      </div>

      {/* Convenios list */}
      {convenios.map(c => {
        const assigned = members.filter(m => (m as Record<string, unknown>).convenio_id === c.id);
        return (
          <div key={c.id} class="card-hover" style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16, marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: '#86868B' }}>{c.vac_days} días/año {c.notes ? `· ${c.notes}` : ''}</div>
              </div>
              <button onClick={() => { setEditId(c.id); setForm({ name: c.name, vac_days: c.vac_days, notes: c.notes }); }}
                style={{ border: 'none', background: '#F2F2F7', borderRadius: 8, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#007AFF', fontWeight: 600 }}>Editar</button>
              <button onClick={() => handleDelete(c.id)}
                style={{ border: 'none', background: '#FF3B3010', borderRadius: 8, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#FF3B30', fontWeight: 600 }}>Eliminar</button>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', marginBottom: 4 }}>USUARIOS ASIGNADOS ({assigned.length})</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {members.map(m => {
                const isAssigned = (m as Record<string, unknown>).convenio_id === c.id;
                return (
                  <button key={m.id} onClick={() => handleAssign(m.id, isAssigned ? '' : c.id)}
                    style={{ padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: isAssigned ? 'none' : '1px dashed #E5E5EA', background: isAssigned ? '#007AFF' : '#FFF', color: isAssigned ? '#FFF' : '#86868B' }}>
                    {m.avatar || '👤'} {m.name.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══ 4. ADMIN CALENDARIOS ═══

export function AdminCalendarios() {
  const [calendarios, setCalendarios] = useState<Calendario[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [editCal, setEditCal] = useState<Calendario | null>(null);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });

  useEffect(() => {
    Promise.all([loadCalendarios(), loadTeamMembers()]).then(([cals, mR]) => {
      setCalendarios(cals);
      if (mR.ok) setMembers(mR.data);
      setLoading(false);
    });
  }, []);

  const createCal = async () => {
    const saved = await saveCalendario({ name: `Calendario ${new Date().getFullYear()}`, year: new Date().getFullYear(), region: '', holidays: [] });
    if (saved) { setCalendarios(prev => [...prev, saved]); setEditCal(saved); }
  };

  const updateCal = async (cal: Calendario) => {
    const saved = await saveCalendario(cal);
    if (saved) setCalendarios(prev => prev.map(c => c.id === saved.id ? saved : c));
  };

  const removeCal = async (id: string) => {
    await deleteCalendario(id);
    setCalendarios(prev => prev.filter(c => c.id !== id));
    if (editCal?.id === id) setEditCal(null);
  };

  const addHoliday = () => {
    if (!editCal || !newHoliday.date || !newHoliday.name) return;
    const updated = { ...editCal, holidays: [...editCal.holidays, { date: newHoliday.date, name: newHoliday.name }].sort((a, b) => a.date.localeCompare(b.date)) };
    setEditCal(updated);
    updateCal(updated);
    setNewHoliday({ date: '', name: '' });
  };

  const removeHoliday = (date: string) => {
    if (!editCal) return;
    const updated = { ...editCal, holidays: editCal.holidays.filter(h => h.date !== date) };
    setEditCal(updated);
    updateCal(updated);
  };

  const handleAssign = async (memberId: string, calId: string) => {
    await assignCalendarioToMember(memberId, calId || null);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, calendario_id: calId } as Member : m));
  };

  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando…</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Calendarios laborales</h3>
          <p style={{ fontSize: 12, color: '#86868B' }}>{calendarios.length} calendario{calendarios.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={createCal} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Nuevo calendario</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: editCal ? '280px 1fr' : '1fr', gap: 12 }}>
        {/* Calendar list */}
        <div>
          {calendarios.map(c => {
            const assigned = members.filter(m => (m as Record<string, unknown>).calendario_id === c.id);
            return (
              <div key={c.id} onClick={() => setEditCal(c)} class="card-hover"
                style={{ background: editCal?.id === c.id ? '#007AFF08' : '#FFF', borderRadius: 12, border: `1.5px solid ${editCal?.id === c.id ? '#007AFF' : '#E5E5EA'}`, padding: 14, marginBottom: 8, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#86868B' }}>{c.holidays.length} festivos · {c.region || 'Sin región'}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); removeCal(c.id); }}
                    style={{ border: 'none', background: '#FF3B3010', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: '#FF3B30', cursor: 'pointer' }}>
                    <Icon name="Trash2" size={10} color="#FF3B30" />
                  </button>
                </div>
                {assigned.length > 0 && (
                  <div style={{ display: 'flex', gap: 2, marginTop: 6, flexWrap: 'wrap' }}>
                    {assigned.map(m => <span key={m.id} style={{ fontSize: 14 }} title={m.name}>{m.avatar || '👤'}</span>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Calendar editor */}
        {editCal && (
          <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <input value={editCal.name} onInput={e => { const u = { ...editCal, name: (e.target as HTMLInputElement).value }; setEditCal(u); updateCal(u); }}
                style={{ flex: 2, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 13, fontWeight: 700, outline: 'none', minWidth: 150 }} />
              <input value={editCal.region} onInput={e => { const u = { ...editCal, region: (e.target as HTMLInputElement).value }; setEditCal(u); updateCal(u); }}
                placeholder="Región" style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none', minWidth: 100 }} />
            </div>

            {/* Schedule fields */}
            <div style={{ background: '#F9F9FB', borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', marginBottom: 8 }}>JORNADA Y CONVENIO</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, fontSize: 11 }}>
                {([
                  ['H. convenio', 'convenio_hours', 1800],
                  ['Vacaciones (días)', 'vacation_days', 23],
                  ['H/sem normal', 'weekly_hours_normal', 40],
                  ['H/día intensiva', 'daily_hours_intensive', 7],
                  ['H/día L-J', 'daily_hours_lj', 8],
                  ['H/día V', 'daily_hours_v', 8],
                  ['Ajuste días', 'adjustment_days', 0],
                  ['Ajuste horas', 'adjustment_hours', 0],
                ] as const).map(([label, field, def]) => (
                  <div key={field}>
                    <label style={{ fontSize: 8, color: '#86868B', display: 'block', marginBottom: 2 }}>{label}</label>
                    <input type="number" step="0.5" value={(editCal as Record<string, unknown>)[field] as number ?? def}
                      onInput={e => { const u = { ...editCal, [field]: parseFloat((e.target as HTMLInputElement).value) || def }; setEditCal(u); updateCal(u); }}
                      style={{ width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid #E5E5EA', fontSize: 11, outline: 'none' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginTop: 8, fontSize: 11 }}>
                <div>
                  <label style={{ fontSize: 8, color: '#86868B', display: 'block', marginBottom: 2 }}>Intensiva desde</label>
                  <input value={(editCal as Record<string, unknown>).intensive_start as string || '08-01'}
                    onInput={e => { const u = { ...editCal, intensive_start: (e.target as HTMLInputElement).value }; setEditCal(u); updateCal(u); }}
                    placeholder="08-01" style={{ width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid #E5E5EA', fontSize: 11, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 8, color: '#86868B', display: 'block', marginBottom: 2 }}>Intensiva hasta</label>
                  <input value={(editCal as Record<string, unknown>).intensive_end as string || '08-31'}
                    onInput={e => { const u = { ...editCal, intensive_end: (e.target as HTMLInputElement).value }; setEditCal(u); updateCal(u); }}
                    placeholder="08-31" style={{ width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid #E5E5EA', fontSize: 11, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 8, color: '#86868B', display: 'block', marginBottom: 2 }}>Tipo empleado</label>
                  <select value={(editCal as Record<string, unknown>).employee_type as string || 'all'}
                    onChange={e => { const u = { ...editCal, employee_type: (e.target as HTMLSelectElement).value }; setEditCal(u); updateCal(u); }}
                    style={{ width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid #E5E5EA', fontSize: 11, outline: 'none' }}>
                    <option value="all">Todos</option>
                    <option value="consultor">Consultor</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 8, color: '#86868B', display: 'block', marginBottom: 2 }}>Antigüedad</label>
                  <select value={(editCal as Record<string, unknown>).seniority as string || 'all'}
                    onChange={e => { const u = { ...editCal, seniority: (e.target as HTMLSelectElement).value }; setEditCal(u); updateCal(u); }}
                    style={{ width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid #E5E5EA', fontSize: 11, outline: 'none' }}>
                    <option value="all">Todos</option>
                    <option value="pre-2009">Pre-2009</option>
                    <option value="post-2009">Post-2009</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 8, color: '#86868B', display: 'block', marginBottom: 2 }}>Libre disposición</label>
                  <input type="number" value={(editCal as Record<string, unknown>).free_days as number || 0}
                    onInput={e => { const u = { ...editCal, free_days: parseInt((e.target as HTMLInputElement).value) || 0 }; setEditCal(u); updateCal(u); }}
                    style={{ width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid #E5E5EA', fontSize: 11, outline: 'none' }} />
                </div>
              </div>
            </div>

            {/* Add holiday */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center' }}>
              <input type="date" value={newHoliday.date} onInput={e => setNewHoliday({ ...newHoliday, date: (e.target as HTMLInputElement).value })}
                style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 12, outline: 'none' }} />
              <input value={newHoliday.name} onInput={e => setNewHoliday({ ...newHoliday, name: (e.target as HTMLInputElement).value })}
                onKeyDown={e => e.key === 'Enter' && addHoliday()} placeholder="Nombre del festivo"
                style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 12, outline: 'none' }} />
              <button onClick={addHoliday} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#007AFF', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+</button>
            </div>

            {/* Holiday list by month */}
            {months.map((month, mi) => {
              const monthHols = editCal.holidays.filter(h => new Date(h.date).getMonth() === mi);
              if (monthHols.length === 0) return null;
              return (
                <div key={mi} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', marginBottom: 4 }}>{month.toUpperCase()}</div>
                  {monthHols.map(h => (
                    <div key={h.date} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid #F9F9FB' }}>
                      <span style={{ fontSize: 11, color: '#007AFF', fontWeight: 600, minWidth: 40 }}>{new Date(h.date).getDate()}</span>
                      <span style={{ fontSize: 12, flex: 1 }}>{h.name}</span>
                      <button onClick={() => removeHoliday(h.date)} style={{ border: 'none', background: 'none', color: '#C7C7CC', cursor: 'pointer', fontSize: 12 }}>
                        <Icon name="X" size={12} color="#C7C7CC" />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Assign members */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F2F2F7' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', marginBottom: 6 }}>ASIGNAR USUARIOS</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {members.map(m => {
                  const isAssigned = (m as Record<string, unknown>).calendario_id === editCal.id;
                  return (
                    <button key={m.id} onClick={() => handleAssign(m.id, isAssigned ? '' : editCal.id)}
                      style={{ padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: isAssigned ? 'none' : '1px dashed #E5E5EA', background: isAssigned ? '#34C759' : '#FFF', color: isAssigned ? '#FFF' : '#86868B' }}>
                      {m.avatar || '👤'} {m.name.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ 5. ADMIN ESCALADO GLOBAL ═══

export function AdminEscaladoGlobal() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allData, setAllData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadRooms(), loadActiveRetroSnapshots()]).then(([roomsR, retros]) => {
      if (roomsR.ok) setRooms(roomsR.data);
      const byS: Record<string, any> = {};
      (retros || []).forEach((s: Record<string, unknown>) => { if (!byS[s.sala] || s.created_at > byS[s.sala].created_at) byS[s.sala] = s; });
      const d: typeof allData = {};
      Object.entries(byS).forEach(([sala, snap]) => { if (snap.data) d[sala] = snap.data; });
      setAllData(d);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando…</div>;

  const allRisks = Object.entries(allData).flatMap(([sala, d]) =>
    ((d as Record<string, unknown>).risks || []).filter((r: Record<string, unknown>) => r.escalation?.level && r.escalation.level !== 'equipo')
      .map((r: Record<string, unknown>) => ({ ...r, _sala: rooms.find(rm => rm.slug === sala)?.name || sala })),
  );

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>📊 Escalado global</h3>
      <p style={{ fontSize: 12, color: '#86868B', marginBottom: 16 }}>{allRisks.length} riesgo{allRisks.length !== 1 ? 's' : ''} escalado{allRisks.length !== 1 ? 's' : ''}</p>

      {allRisks.length === 0 && (
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 24, textAlign: 'center' }}>
          <Icon name="CheckCircle" size={32} color="#34C759" />
          <p style={{ fontSize: 14, fontWeight: 600, color: '#34C759', marginTop: 8 }}>Sin riesgos escalados</p>
        </div>
      )}

      {allRisks.map((r: Record<string, unknown>) => (
        <div key={r.id} style={{ background: '#FFF', borderRadius: 12, border: '1.5px solid #FF3B3020', borderLeft: '3px solid #FF3B30', padding: '12px 16px', marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{r.title || r.text}</div>
              <div style={{ fontSize: 11, color: '#86868B', marginTop: 2 }}>
                {r._sala} · Nivel: <span style={{ fontWeight: 700, color: '#FF3B30' }}>{r.escalation?.level}</span>
              </div>
            </div>
            <span style={{ fontSize: 10, color: '#86868B' }}>{r.escalation?.escalatedAt ? new Date(r.escalation.escalatedAt).toLocaleDateString('es-ES') : ''}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══ 6. MAESTROS PANEL ═══

export function MaestrosPanel() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadRooms(), loadTeamMembers()]).then(([r, m]) => {
      if (r.ok) setRooms(r.data);
      if (m.ok) setMembers(m.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando…</div>;

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>🗃️ Datos maestros</h3>
      <p style={{ fontSize: 12, color: '#86868B', marginBottom: 16 }}>Resumen de datos del sistema</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#007AFF' }}>{rooms.length}</div>
          <div style={{ fontSize: 12, color: '#86868B' }}>Proyectos</div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {rooms.map(r => <span key={r.slug} style={{ fontSize: 11, color: '#6E6E73' }}>· {r.name} ({r.tipo})</span>)}
          </div>
        </div>
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#5856D6' }}>{members.length}</div>
          <div style={{ fontSize: 12, color: '#86868B' }}>Personas</div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {members.slice(0, 8).map(m => <span key={m.id} style={{ fontSize: 11, color: '#6E6E73' }}>{m.avatar || '👤'} {m.name}</span>)}
            {members.length > 8 && <span style={{ fontSize: 11, color: '#C7C7CC' }}>+{members.length - 8} más</span>}
          </div>
        </div>
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#34C759' }}>{[...new Set(members.map(m => m.role_label).filter(Boolean))].length}</div>
          <div style={{ fontSize: 12, color: '#86868B' }}>Roles únicos</div>
          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {[...new Set(members.map(m => m.role_label).filter(Boolean))].map(r => (
              <span key={r} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: (ROLE_COLORS[r as string] || '#5856D6') + '15', color: ROLE_COLORS[r as string] || '#5856D6', fontWeight: 600 }}>{r}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
