// ═══ ROLES PANEL — Roles + Habilidades (catálogo) + Formación ═══
import { useState, useEffect, useMemo } from 'preact/hooks';
import type { Member } from '@app-types/index';
import { loadTeamMembers, saveTeamMember } from '@data/team';
import { Icon } from '@components/common/Icon';

// ── Supabase helper ──
async function sb() { return (await import('../../data/supabase')).supabase; }

// ── Roles ──
async function loadRoles(): Promise<Array<{ id: string; name: string }>> {
  try { const s = await sb(); const { data } = await s.from('admin_roles').select('*').order('name'); return data ?? []; } catch { return []; }
}
async function saveRole(name: string) { try { const s = await sb(); await s.from('admin_roles').insert({ name }); } catch {} }
async function deleteRole(name: string) { try { const s = await sb(); await s.from('admin_roles').delete().eq('name', name); } catch {} }

// ── Skill Catalog (tabla propia, sin hack de sala) ──
interface CatSkill { id: string; name: string; category: string; subcategory: string; icon: string; description: string; }
async function loadCatalogSkills(): Promise<CatSkill[]> {
  try { const s = await sb(); const { data } = await s.from('skill_catalog').select('*').order('category,name'); return data ?? []; } catch { return []; }
}
async function saveCatalogSkill(sk: Partial<CatSkill>): Promise<CatSkill | null> {
  try {
    const s = await sb();
    if (sk.id) { const { data } = await s.from('skill_catalog').update(sk).eq('id', sk.id).select().single(); return data; }
    const { data } = await s.from('skill_catalog').insert(sk).select().single(); return data;
  } catch { return null; }
}
async function deleteCatalogSkill(id: string) { try { const s = await sb(); await s.from('skill_catalog').delete().eq('id', id); } catch {} }

// ── Skill Categories ──
interface SkillCat { id: string; name: string; parent_id: string | null; sort_order: number; }
async function loadSkillCats(): Promise<SkillCat[]> {
  try { const s = await sb(); const { data } = await s.from('skill_categories').select('*').order('sort_order,name'); return data ?? []; } catch { return []; }
}
async function saveSkillCat(c: Partial<SkillCat>): Promise<SkillCat | null> {
  try {
    const s = await sb();
    const payload: Record<string, unknown> = { name: c.name, parent_id: c.parent_id || null, sort_order: c.sort_order ?? 0 };
    if (c.id) { const { data } = await s.from('skill_categories').update(payload).eq('id', c.id).select().single(); return data; }
    const { data } = await s.from('skill_categories').insert(payload).select().single(); return data;
  } catch { return null; }
}
async function deleteSkillCat(id: string) { try { const s = await sb(); await s.from('skill_categories').delete().eq('id', id); } catch {} }

// ── Training Catalog ──
interface Training { id: string; name: string; provider: string; duration_hours: number; type: string; category: string; }
async function loadTraining(): Promise<Training[]> {
  try { const s = await sb(); const { data } = await s.from('training_catalog').select('*').order('category,name'); return data ?? []; } catch { return []; }
}
async function saveTraining(t: Partial<Training>): Promise<Training | null> {
  try { const s = await sb(); if (t.id) { const { data } = await s.from('training_catalog').update(t).eq('id', t.id).select().single(); return data; } const { data } = await s.from('training_catalog').insert(t).select().single(); return data; } catch { return null; }
}
async function deleteTrainingItem(id: string) { try { const s = await sb(); await s.from('training_catalog').delete().eq('id', id); } catch {} }

// ── Styles & Constants ──
const cardS = { background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA' } as const;
const inputS = { padding: '8px 12px', borderRadius: 10, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit', background: '#F9F9FB' };
const labelS = { fontSize: 10, fontWeight: 700 as number, color: '#86868B', display: 'block', marginBottom: 3, textTransform: 'uppercase' as const, letterSpacing: 0.3 };
const ROLE_COLORS: Record<string, string> = { 'Service Manager': '#FF3B30', 'Jefe de proyecto': '#FF9500', 'Scrum Master': '#007AFF', 'Product Owner': '#5856D6', 'Consultor': '#34C759', 'Analista Funcional': '#AF52DE', 'Desarrollador/a': '#00C7BE', 'QA / Tester': '#FF2D55', 'DevOps': '#5AC8FA', 'Tech Lead': '#FF6482', 'PMO': '#FF9500', 'Diseñador/a': '#AF52DE', 'Jefe de Proyecto': '#FF9500' };
const CAT_COLORS = ['#007AFF', '#5856D6', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#00C7BE', '#FF2D55'];
const SKILL_ICONS = ['📘', '💻', '🧠', '🎯', '🔧', '📊', '🗣️', '✍️', '🔬', '🎨', '📐', '🤝'];

type SubTab = 'roles' | 'skills' | 'training';

export function RolesPanel() {
  const [subTab, setSubTab] = useState<SubTab>('roles');
  const [members, setMembers] = useState<Member[]>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [training, setTraining] = useState<Training[]>([]);
  const [catSkills, setCatSkills] = useState<CatSkill[]>([]);
  const [skillCats, setSkillCats] = useState<SkillCat[]>([]);
  const [loading, setLoading] = useState(true);

  // Roles
  const [newRole, setNewRole] = useState('');
  const [editRole, setEditRole] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState('');

  // Generic delete modal
  const [delModal, setDelModal] = useState<{ type: string; id: string; name: string } | null>(null);
  const [delConfirm, setDelConfirm] = useState('');

  // Skills
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [editSkill, setEditSkill] = useState<CatSkill | null>(null);
  const [skForm, setSkForm] = useState({ name: '', category: '', subcategory: '', icon: '📘', description: '' });
  const [showCatForm, setShowCatForm] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', parent_id: '' as string | null });
  const [editCat, setEditCat] = useState<SkillCat | null>(null);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  // Training
  const [showTrainingForm, setShowTrainingForm] = useState(false);
  const [editTrainingItem, setEditTrainingItem] = useState<Training | null>(null);
  const [tForm, setTForm] = useState({ name: '', provider: '', duration_hours: 0, type: 'recommended', category: 'Técnica' });

  useEffect(() => {
    Promise.all([loadTeamMembers(), loadRoles(), loadTraining(), loadCatalogSkills(), loadSkillCats()]).then(([mR, r, t, sk, sc]) => {
      if (mR.ok) setMembers(mR.data);
      setRoles(r); setTraining(t); setCatSkills(sk); setSkillCats(sc);
      setLoading(false);
    });
  }, []);

  const allRoleNames = useMemo(() => [...new Set([...roles.map(r => r.name), ...members.map(m => m.role_label).filter(Boolean) as string[]])], [roles, members]);
  const byRole = (role: string) => members.filter(m => m.role_label === role);
  const roleColor = (role: string) => ROLE_COLORS[role] || '#5856D6';

  // Category helpers
  const rootCats = useMemo(() => skillCats.filter(c => !c.parent_id), [skillCats]);
  const childCats = (pid: string) => skillCats.filter(c => c.parent_id === pid);
  const skillsInCat = (catName: string) => catSkills.filter(s => s.category === catName);
  const catColor = (i: number) => CAT_COLORS[i % CAT_COLORS.length];
  const allCatNames = useMemo(() => {
    const names = new Set([...skillCats.map(c => c.name), ...catSkills.map(s => s.category)]);
    return [...names].filter(Boolean).sort();
  }, [skillCats, catSkills]);

  // ── Handlers ──
  const handleAddRole = async () => { const t = newRole.trim(); if (!t || allRoleNames.includes(t)) return; await saveRole(t); setRoles(prev => [...prev, { id: t, name: t }]); setNewRole(''); };
  const handleEditRole = async (old: string) => { if (!editRoleName.trim() || editRoleName === old) { setEditRole(null); return; } await deleteRole(old); await saveRole(editRoleName.trim()); setRoles(prev => prev.map(r => r.name === old ? { ...r, name: editRoleName.trim() } : r)); for (const m of members.filter(x => x.role_label === old)) { const u = { ...m, role_label: editRoleName.trim() }; await saveTeamMember(u); setMembers(prev => prev.map(x => x.id === m.id ? u : x)); } setEditRole(null); };

  const handleSaveSkill = async () => {
    if (!skForm.name.trim() || !skForm.category.trim()) return;
    const saved = await saveCatalogSkill(editSkill ? { ...skForm, id: editSkill.id } : skForm);
    if (saved) { if (editSkill) setCatSkills(prev => prev.map(s => s.id === editSkill.id ? saved : s)); else setCatSkills(prev => [...prev, saved]); }
    setShowSkillForm(false); setEditSkill(null);
  };

  const handleSaveCat = async () => {
    if (!catForm.name.trim()) return;
    const payload: Partial<SkillCat> = { name: catForm.name.trim(), parent_id: catForm.parent_id || null, sort_order: skillCats.length };
    if (editCat) payload.id = editCat.id;
    const saved = await saveSkillCat(payload);
    if (saved) { if (editCat) setSkillCats(prev => prev.map(c => c.id === editCat.id ? saved : c)); else setSkillCats(prev => [...prev, saved]); }
    setShowCatForm(false); setEditCat(null);
  };

  const handleSaveTraining = async () => {
    if (!tForm.name.trim()) return;
    const saved = await saveTraining(editTrainingItem ? { ...tForm, id: editTrainingItem.id } : tForm);
    if (saved) { if (editTrainingItem) setTraining(prev => prev.map(t => t.id === editTrainingItem.id ? saved : t)); else setTraining(prev => [...prev, saved]); }
    setShowTrainingForm(false); setEditTrainingItem(null);
  };

  // Generic delete handler
  const handleDelete = async () => {
    if (!delModal || delConfirm !== delModal.name) return;
    if (delModal.type === 'role') { await deleteRole(delModal.name); setRoles(prev => prev.filter(r => r.name !== delModal.name)); }
    if (delModal.type === 'skill') { await deleteCatalogSkill(delModal.id); setCatSkills(prev => prev.filter(s => s.id !== delModal.id)); }
    if (delModal.type === 'category') { await deleteSkillCat(delModal.id); setSkillCats(prev => prev.filter(c => c.id !== delModal.id)); }
    if (delModal.type === 'training') { await deleteTrainingItem(delModal.id); setTraining(prev => prev.filter(t => t.id !== delModal.id)); }
    setDelModal(null); setDelConfirm('');
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando…</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Roles, Habilidades y Formación</h2>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['roles', 'skills', 'training'] as SubTab[]).map(t => (
            <button key={t} onClick={() => setSubTab(t)}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: subTab === t ? '#1D1D1F' : '#F2F2F7', color: subTab === t ? '#FFF' : '#6E6E73', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {t === 'roles' ? 'Roles' : t === 'skills' ? 'Habilidades' : 'Formación'}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ ROLES ═══ */}
      {subTab === 'roles' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input value={newRole} onInput={e => setNewRole((e.target as HTMLInputElement).value)} onKeyDown={e => e.key === 'Enter' && handleAddRole()} placeholder="Nombre del nuevo rol…" style={{ ...inputS, flex: 1 }} />
            <button onClick={handleAddRole} disabled={!newRole.trim()} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: newRole.trim() ? 1 : 0.4, whiteSpace: 'nowrap' }}>+ Añadir</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 10 }}>
            {allRoleNames.map(role => {
              const mems = byRole(role); const color = roleColor(role); const isDb = roles.some(r => r.name === role);
              return (
                <div key={role} style={{ ...cardS, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color }}>{role.charAt(0)}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {editRole === role ? (
                      <input value={editRoleName} onInput={e => setEditRoleName((e.target as HTMLInputElement).value)} onKeyDown={e => { if (e.key === 'Enter') handleEditRole(role); if (e.key === 'Escape') setEditRole(null); }} onBlur={() => handleEditRole(role)} autoFocus style={{ fontSize: 13, fontWeight: 700, border: '1px solid #007AFF', borderRadius: 6, padding: '2px 6px', outline: 'none', width: '100%' }} />
                    ) : <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role}</div>}
                    <div style={{ fontSize: 10, color: mems.length > 0 ? color : '#C7C7CC', fontWeight: 600 }}>{mems.length} persona{mems.length !== 1 ? 's' : ''}</div>
                  </div>
                  {isDb && (
                    <div style={{ display: 'flex', gap: 3 }}>
                      <button onClick={() => { setEditRole(role); setEditRoleName(role); }} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="Edit" size={10} color="#007AFF" /></button>
                      <button onClick={() => { setDelModal({ type: 'role', id: role, name: role }); setDelConfirm(''); }} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #FF3B3020', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="Trash2" size={10} color="#FF3B30" /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ HABILIDADES ═══ */}
      {subTab === 'skills' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: '#86868B' }}>{catSkills.length} habilidades · {allCatNames.length} categorías</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setCatForm({ name: '', parent_id: null }); setEditCat(null); setShowCatForm(true); }}
                style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #5856D630', background: '#5856D608', color: '#5856D6', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="FolderPlus" size={13} color="#5856D6" /> Categoría
              </button>
              <button onClick={() => { setSkForm({ name: '', category: allCatNames[0] || '', subcategory: '', icon: '📘', description: '' }); setEditSkill(null); setShowSkillForm(true); }}
                style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="Plus" size={13} color="#FFF" /> Habilidad
              </button>
            </div>
          </div>

          {allCatNames.length === 0 && <div style={{ ...cardS, padding: 32, textAlign: 'center' }}><Icon name="BookOpen" size={32} color="#E5E5EA" /><p style={{ fontSize: 13, color: '#86868B', marginTop: 8 }}>Crea la primera categoría para empezar.</p></div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allCatNames.map((catName, ci) => {
              const skills = skillsInCat(catName); const color = catColor(ci); const isExp = expandedCat === catName;
              const catObj = skillCats.find(c => c.name === catName);
              const subs = catObj ? childCats(catObj.id) : [];
              return (
                <div key={catName} style={{ ...cardS, overflow: 'hidden' }}>
                  <div onClick={() => setExpandedCat(isExp ? null : catName)} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: isExp ? color + '06' : '#FFF' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="Folder" size={15} color={color} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color }}>{catName}</div>
                      <div style={{ fontSize: 10, color: '#86868B' }}>{skills.length} habilidad{skills.length !== 1 ? 'es' : ''}{subs.length > 0 ? ` · ${subs.length} sub` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 3 }} onClick={e => e.stopPropagation()}>
                      {catObj && <>
                        <button onClick={() => { setCatForm({ name: catObj.name, parent_id: catObj.parent_id || null }); setEditCat(catObj); setShowCatForm(true); }} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="Edit" size={10} color="#007AFF" /></button>
                        <button onClick={() => { setDelModal({ type: 'category', id: catObj.id, name: catObj.name }); setDelConfirm(''); }} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #FF3B3020', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="Trash2" size={10} color="#FF3B30" /></button>
                      </>}
                    </div>
                    <Icon name={isExp ? 'ChevronDown' : 'ChevronRight'} size={14} color="#C7C7CC" />
                  </div>
                  {isExp && (
                    <div style={{ borderTop: '1px solid #F2F2F7', padding: '10px 16px' }}>
                      {subs.length > 0 && <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', marginBottom: 4 }}>SUBCATEGORÍAS</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {subs.map(sc => (
                            <span key={sc.id} style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: color + '10', color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {sc.name}
                              <button onClick={() => { setCatForm({ name: sc.name, parent_id: sc.parent_id }); setEditCat(sc); setShowCatForm(true); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#007AFF', fontSize: 8, padding: 0 }}>✎</button>
                              <button onClick={() => { setDelModal({ type: 'category', id: sc.id, name: sc.name }); setDelConfirm(''); }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#C7C7CC', fontSize: 8, padding: 0 }}>✕</button>
                            </span>
                          ))}
                          <button onClick={() => { setCatForm({ name: '', parent_id: catObj?.id || null }); setEditCat(null); setShowCatForm(true); }} style={{ fontSize: 10, color: '#86868B', border: '1px dashed #E5E5EA', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', background: 'none' }}>+ Sub</button>
                        </div>
                      </div>}
                      {skills.length === 0 && <p style={{ fontSize: 11, color: '#C7C7CC', padding: '6px 0' }}>Sin habilidades</p>}
                      {skills.map(sk => (
                        <div key={sk.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: '#F9F9FB', marginBottom: 3 }}>
                          <span style={{ fontSize: 16 }}>{sk.icon || '📘'}</span>
                          <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600 }}>{sk.name}</div>{sk.description && <div style={{ fontSize: 10, color: '#86868B' }}>{sk.description}</div>}</div>
                          <div style={{ display: 'flex', gap: 3 }}>
                            <button onClick={() => { setSkForm({ name: sk.name, category: sk.category, subcategory: sk.subcategory || '', icon: sk.icon, description: sk.description || '' }); setEditSkill(sk); setShowSkillForm(true); }} style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="Edit" size={9} color="#007AFF" /></button>
                            <button onClick={() => { setDelModal({ type: 'skill', id: sk.id, name: sk.name }); setDelConfirm(''); }} style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #FF3B3020', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="Trash2" size={9} color="#FF3B30" /></button>
                          </div>
                        </div>
                      ))}
                      <button onClick={() => { setSkForm({ name: '', category: catName, subcategory: '', icon: '📘', description: '' }); setEditSkill(null); setShowSkillForm(true); }}
                        style={{ marginTop: 6, fontSize: 10, color, background: color + '08', border: `1px dashed ${color}30`, borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 600, width: '100%' }}>
                        + Añadir habilidad a {catName}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ FORMACIÓN ═══ */}
      {subTab === 'training' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: '#86868B' }}>{training.length} formaciones · {allCatNames.length} categorías</p>
            <button onClick={() => { setTForm({ name: '', provider: '', duration_hours: 0, type: 'recommended', category: allCatNames[0] || 'Técnica' }); setEditTrainingItem(null); setShowTrainingForm(true); }}
              style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Icon name="Plus" size={12} color="#FFF" /> Nueva formación
            </button>
          </div>

          {allCatNames.length === 0 && <div style={{ ...cardS, padding: 24, textAlign: 'center', color: '#86868B' }}><p style={{ fontSize: 12 }}>Crea primero categorías en la pestaña Habilidades.</p></div>}

          {allCatNames.map((cat, ci) => {
            const items = training.filter(t => t.category === cat);
            const color = CAT_COLORS[ci % CAT_COLORS.length];
            return (
              <div key={cat} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>{cat}</span>
                  <span style={{ fontSize: 10, color: '#86868B' }}>{items.length}</span>
                  <button onClick={() => { setTForm({ name: '', provider: '', duration_hours: 0, type: 'recommended', category: cat }); setEditTrainingItem(null); setShowTrainingForm(true); }}
                    style={{ marginLeft: 'auto', fontSize: 10, color, background: color + '08', border: `1px dashed ${color}30`, borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontWeight: 600 }}>
                    + Formación
                  </button>
                </div>
                {items.length > 0 && (
                  <div style={{ ...cardS, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <tbody>
                        {items.map((t, i) => (
                          <tr key={t.id} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                            <td style={{ padding: '8px 12px', borderBottom: '1px solid #F2F2F7', fontWeight: 600 }}>{t.name}</td>
                            <td style={{ padding: '8px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', color: '#6E6E73', fontSize: 11 }}>{t.provider || '—'}</td>
                            <td style={{ padding: '8px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontWeight: 600 }}>{t.duration_hours || '—'}h</td>
                            <td style={{ padding: '8px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}><span style={{ fontSize: 9, fontWeight: 600, color: t.type === 'mandatory' ? '#FF3B30' : '#34C759', background: t.type === 'mandatory' ? '#FF3B3012' : '#34C75912', padding: '2px 6px', borderRadius: 4 }}>{t.type === 'mandatory' ? 'Obligatoria' : 'Recomendada'}</span></td>
                            <td style={{ padding: '8px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                                <button onClick={() => { setTForm({ name: t.name, provider: t.provider, duration_hours: t.duration_hours, type: t.type, category: t.category }); setEditTrainingItem(t); setShowTrainingForm(true); }} style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="Edit" size={10} color="#007AFF" /></button>
                                <button onClick={() => { setDelModal({ type: 'training', id: t.id, name: t.name }); setDelConfirm(''); }} style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #FF3B3020', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="Trash2" size={10} color="#FF3B30" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {/* Training without matching category */}
          {(() => {
            const orphan = training.filter(t => !allCatNames.includes(t.category));
            if (orphan.length === 0) return null;
            return (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: '#86868B' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#86868B' }}>Sin categoría</span>
                  <span style={{ fontSize: 10, color: '#86868B' }}>{orphan.length}</span>
                </div>
                <div style={{ ...cardS, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <tbody>
                      {orphan.map((t, i) => (
                        <tr key={t.id} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid #F2F2F7', fontWeight: 600 }}>{t.name} <span style={{ fontSize: 9, color: '#C7C7CC' }}>({t.category})</span></td>
                          <td style={{ padding: '8px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                              <button onClick={() => { setTForm({ name: t.name, provider: t.provider, duration_hours: t.duration_hours, type: t.type, category: t.category }); setEditTrainingItem(t); setShowTrainingForm(true); }} style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="Edit" size={10} color="#007AFF" /></button>
                              <button onClick={() => { setDelModal({ type: 'training', id: t.id, name: t.name }); setDelConfirm(''); }} style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #FF3B3020', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="Trash2" size={10} color="#FF3B30" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {training.length === 0 && allCatNames.length > 0 && <div style={{ ...cardS, padding: 24, textAlign: 'center', color: '#C7C7CC' }}><Icon name="BookOpen" size={24} color="#E5E5EA" /><p style={{ fontSize: 12, marginTop: 6 }}>Sin formaciones. Usa "+ Formación" en cada categoría.</p></div>}
        </div>
      )}

      {/* ── Skill modal ── */}
      {showSkillForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowSkillForm(false)}>
          <div onClick={(e: Event) => e.stopPropagation()} style={{ background: '#FFF', borderRadius: 20, maxWidth: 460, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{editSkill ? 'Editar habilidad' : 'Nueva habilidad'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label style={labelS}>Nombre *</label><input value={skForm.name} onInput={e => setSkForm({ ...skForm, name: (e.target as HTMLInputElement).value })} style={inputS} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={labelS}>Categoría *</label>
                  <select value={skForm.category} onChange={e => setSkForm({ ...skForm, category: (e.target as HTMLSelectElement).value })} style={inputS}>
                    {allCatNames.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label style={labelS}>Subcategoría</label><input value={skForm.subcategory} onInput={e => setSkForm({ ...skForm, subcategory: (e.target as HTMLInputElement).value })} style={inputS} placeholder="Opcional" /></div>
              </div>
              <div><label style={labelS}>Icono</label>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {SKILL_ICONS.map(ic => <button key={ic} onClick={() => setSkForm({ ...skForm, icon: ic })} style={{ width: 30, height: 30, borderRadius: 8, border: skForm.icon === ic ? '2px solid #007AFF' : '1px solid #E5E5EA', background: '#FFF', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{ic}</button>)}
                </div>
              </div>
              <div><label style={labelS}>Descripción</label><input value={skForm.description} onInput={e => setSkForm({ ...skForm, description: (e.target as HTMLInputElement).value })} style={inputS} placeholder="Opcional" /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowSkillForm(false)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
              <button onClick={handleSaveSkill} disabled={!skForm.name.trim() || !skForm.category.trim()} style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: skForm.name.trim() && skForm.category.trim() ? 1 : 0.4 }}>{editSkill ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Category modal ── */}
      {showCatForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowCatForm(false)}>
          <div onClick={(e: Event) => e.stopPropagation()} style={{ background: '#FFF', borderRadius: 20, maxWidth: 380, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{editCat ? 'Editar categoría' : 'Nueva categoría'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label style={labelS}>Nombre *</label><input value={catForm.name} onInput={e => setCatForm({ ...catForm, name: (e.target as HTMLInputElement).value })} style={inputS} /></div>
              <div><label style={labelS}>Categoría padre (subcategoría de…)</label>
                <select value={catForm.parent_id || ''} onChange={e => setCatForm({ ...catForm, parent_id: (e.target as HTMLSelectElement).value || null })} style={inputS}>
                  <option value="">— Raíz —</option>
                  {rootCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowCatForm(false)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
              <button onClick={handleSaveCat} disabled={!catForm.name.trim()} style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: '#5856D6', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: catForm.name.trim() ? 1 : 0.4 }}>{editCat ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Training modal ── */}
      {showTrainingForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setShowTrainingForm(false)}>
          <div onClick={(e: Event) => e.stopPropagation()} style={{ background: '#FFF', borderRadius: 20, maxWidth: 440, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{editTrainingItem ? 'Editar formación' : 'Nueva formación'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><label style={labelS}>Nombre *</label><input value={tForm.name} onInput={e => setTForm({ ...tForm, name: (e.target as HTMLInputElement).value })} style={inputS} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={labelS}>Proveedor</label><input value={tForm.provider} onInput={e => setTForm({ ...tForm, provider: (e.target as HTMLInputElement).value })} style={inputS} /></div>
                <div><label style={labelS}>Horas</label><input type="number" value={tForm.duration_hours} onInput={e => setTForm({ ...tForm, duration_hours: parseInt((e.target as HTMLInputElement).value) || 0 })} style={inputS} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div><label style={labelS}>Tipo</label><select value={tForm.type} onChange={e => setTForm({ ...tForm, type: (e.target as HTMLSelectElement).value })} style={inputS}><option value="recommended">Recomendada</option><option value="mandatory">Obligatoria</option></select></div>
                <div><label style={labelS}>Categoría</label><select value={tForm.category} onChange={e => setTForm({ ...tForm, category: (e.target as HTMLSelectElement).value })} style={inputS}>{allCatNames.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowTrainingForm(false)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
              <button onClick={handleSaveTraining} disabled={!tForm.name.trim()} style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: tForm.name.trim() ? 1 : 0.4 }}>{editTrainingItem ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation (universal) ── */}
      {delModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setDelModal(null)}>
          <div onClick={(e: Event) => e.stopPropagation()} style={{ background: '#FFF', borderRadius: 20, maxWidth: 420, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <Icon name="AlertTriangle" size={32} color="#FF3B30" />
              <h3 style={{ fontSize: 17, fontWeight: 700, marginTop: 10 }}>Eliminar {delModal.type === 'role' ? 'rol' : delModal.type === 'skill' ? 'habilidad' : delModal.type === 'category' ? 'categoría' : 'formación'}</h3>
              <p style={{ fontSize: 13, color: '#86868B', marginTop: 6 }}>Se eliminará <strong>{delModal.name}</strong>. Esta acción no se puede deshacer.</p>
            </div>
            <div style={{ marginBottom: 14 }}><label style={labelS}>Escribe el nombre para confirmar</label><input value={delConfirm} onInput={e => setDelConfirm((e.target as HTMLInputElement).value)} placeholder={delModal.name} style={{ ...inputS, borderColor: delConfirm === delModal.name ? '#FF3B30' : '#E5E5EA' }} /></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setDelModal(null)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
              <button onClick={handleDelete} disabled={delConfirm !== delModal.name} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: delConfirm === delModal.name ? '#FF3B30' : '#E5E5EA', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
