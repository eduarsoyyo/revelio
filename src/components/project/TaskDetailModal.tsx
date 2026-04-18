// ═══ TASK DETAIL MODAL — Full task editing modal ═══
import { useState } from 'preact/hooks';
import type { Task, Member } from '../../types/index';
import { TASK_STATUSES, ITEM_TYPES, PRIORITIES, DEMAND_ORIGINS, ITEM_TYPE_MAP, PRIORITY_MAP, TASK_STATUS_MAP } from '../../config/tasks';
import { Icon } from '../common/Icon';
import { RichEditor } from '../common/RichEditor';

interface Tag { id: string; name: string; color: string }

interface TaskDetailModalProps {
  task: Task;
  teamMembers: Member[];
  epics?: string[];
  tags?: Tag[];
  tagAssignments?: Array<{ tag_id: string; entity_type: string; entity_id: string }>;
  risks?: Array<{ id: string; text: string; title?: string; type?: string; status?: string }>;
  onSave: (task: Task) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
  onToggleTag?: (tagId: string, taskId: string) => void;
}

const fd = (iso: string | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

export function TaskDetailModal({
  task, teamMembers, epics = [], tags = [], tagAssignments = [], risks = [],
  onSave, onClose, onDelete, onToggleTag,
}: TaskDetailModalProps) {
  const [f, setF] = useState<any>({ ...task });

  const tp = ITEM_TYPE_MAP[(f.type || 'tarea')] || ITEM_TYPES[0];
  const pr = PRIORITY_MAP[(f.priority || 'medium')] || PRIORITIES[2];
  const st = TASK_STATUS_MAP[(f.status || 'backlog')] || TASK_STATUSES[0];
  const entityTags = tags.filter(t => (tagAssignments || []).some(a => a.tag_id === t.id && a.entity_type === 'action' && a.entity_id === task.id));
  const availTags = tags.filter(t => !entityTags.some(et => et.id === t.id));

  const save = () => {
    const updated = { ...f, updatedAt: new Date().toISOString() };
    onSave(updated);
  };

  const labelStyle = { fontSize: 10, color: '#86868B', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.4, display: 'block', marginBottom: 4 };
  const selectStyle = { width: '100%', border: '1.5px solid #E5E5EA', borderRadius: 9, padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', outline: 'none', background: '#FAFAFA', boxSizing: 'border-box' as const };
  const inputStyle = { width: '100%', border: '1.5px solid #E5E5EA', borderRadius: 9, padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.18)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} />

      <div style={{ position: 'relative', background: '#FFF', borderRadius: 20, width: '90%', maxWidth: 780, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 12px 48px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.04)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #F2F2F7', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: '#FAFAFA' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: tp.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={tp.lucide} size={16} color={tp.color} />
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: tp.color, background: tp.color + '12', padding: '2px 8px', borderRadius: 6 }}>{tp.label}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: st.color, background: st.bg, padding: '2px 8px', borderRadius: 6 }}>{st.label}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: pr.color }}>{pr.icon} {pr.label}</span>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#F2F2F7', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: '#86868B' }}>✕</button>
        </div>

        {/* Body: 2 columns */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Left: content */}
          <div style={{ flex: 1, padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div>
              <label style={labelStyle}>Título</label>
              <input value={f.text || ''} onInput={e => setF({ ...f, text: (e.target as HTMLInputElement).value })}
                style={{ ...inputStyle, fontSize: 15, fontWeight: 600, padding: '10px 14px' }} />
            </div>

            <div>
              <label style={labelStyle}>Descripción</label>
              <RichEditor value={f.description || ''} onChange={v => setF({ ...f, description: v })} placeholder="Añadir descripción…" />
            </div>

            {/* Checklist */}
            <div>
              <label style={labelStyle}>Checklist</label>
              {(() => {
                const items: Array<{ id: string; text: string; done: boolean }> = (() => {
                  try { return JSON.parse(f.checklist || '[]'); } catch { return []; }
                })();
                const update = (next: typeof items) => setF({ ...f, checklist: JSON.stringify(next) });
                const toggle = (id: string) => update(items.map(i => i.id === id ? { ...i, done: !i.done } : i));
                const remove = (id: string) => update(items.filter(i => i.id !== id));
                const add = () => update([...items, { id: Date.now().toString(36), text: '', done: false }]);
                const setText = (id: string, text: string) => update(items.map(i => i.id === id ? { ...i, text } : i));
                const doneCount = items.filter(i => i.done).length;

                return (
                  <div>
                    {items.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#F2F2F7' }}>
                          <div style={{ width: `${items.length > 0 ? (doneCount / items.length * 100) : 0}%`, height: 4, borderRadius: 2, background: '#34C759', transition: 'width .3s' }} />
                        </div>
                        <span style={{ fontSize: 10, color: '#86868B', fontWeight: 600 }}>{doneCount}/{items.length}</span>
                      </div>
                    )}
                    {items.map(item => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <input type="checkbox" checked={item.done} onChange={() => toggle(item.id)}
                          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#34C759' }} />
                        <input value={item.text} onInput={e => setText(item.id, (e.target as HTMLInputElement).value)}
                          placeholder="Subtarea…"
                          style={{ ...inputStyle, flex: 1, padding: '5px 8px', fontSize: 12, textDecoration: item.done ? 'line-through' : 'none', color: item.done ? '#C7C7CC' : '#1D1D1F' }} />
                        <button onClick={() => remove(item.id)}
                          style={{ border: 'none', background: 'none', color: '#C7C7CC', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>✕</button>
                      </div>
                    ))}
                    <button onClick={add}
                      style={{ border: '1.5px dashed #E5E5EA', borderRadius: 8, padding: '5px 12px', fontSize: 11, color: '#86868B', background: 'transparent', cursor: 'pointer', marginTop: 2 }}>
                      + Añadir subtarea
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* Tags */}
            <div>
              <label style={labelStyle}>Etiquetas</label>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {entityTags.map(t => (
                  <span key={t.id} onClick={() => onToggleTag?.(t.id, task.id)}
                    style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, background: t.color, color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {t.name} <span style={{ fontSize: 9, opacity: 0.7 }}>✕</span>
                  </span>
                ))}
                {availTags.map(t => (
                  <span key={t.id} onClick={() => onToggleTag?.(t.id, task.id)}
                    style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, border: `1.5px dashed ${t.color}60`, color: t.color, cursor: 'pointer' }}>
                    + {t.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Linked risk */}
            <div>
              <label style={labelStyle}>Riesgo vinculado</label>
              {f.riskId && (() => {
                const rsk = risks.find(r => r.id === f.riskId);
                return rsk ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: '#FFF5F5', border: '1.5px solid #FF3B3015', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#FF3B30' }}>{(rsk.type || 'riesgo') === 'problema' ? 'P' : 'R'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#FF3B30' }}>{rsk.title || rsk.text}</div>
                    </div>
                    <button onClick={() => setF({ ...f, riskId: null, source: 'manual' })}
                      style={{ border: 'none', background: '#FF3B3010', color: '#FF3B30', fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 6, cursor: 'pointer' }}>✕ Desvincular</button>
                  </div>
                ) : null;
              })()}
              <select value="" onChange={e => { if ((e.target as HTMLSelectElement).value) setF({ ...f, riskId: (e.target as HTMLSelectElement).value, source: 'risk' }); (e.target as HTMLSelectElement).value = ''; }}
                style={{ ...selectStyle, border: '1.5px dashed #FF950040', color: '#FF9500', background: '#FFF9E6', cursor: 'pointer' }}>
                <option value="">{f.riskId ? 'Cambiar riesgo vinculado…' : '+ Vincular a un riesgo…'}</option>
                {risks.filter(r => r.status !== 'mitigated' && r.id !== f.riskId).map(r => (
                  <option key={r.id} value={r.id}>{(r.type || 'riesgo') === 'problema' ? 'P' : 'R'}: {(r.title || r.text).slice(0, 45)}</option>
                ))}
              </select>
            </div>

            {/* Context */}
            {(f.source || f.riskId) && (
              <div style={{ background: '#F9F9FB', borderRadius: 10, padding: '10px 14px', border: '1px solid #E5E5EA' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Contexto</div>
                {f.source === 'retro' && <p style={{ fontSize: 12, color: '#6E6E73', margin: 0 }}>Creada durante una retrospectiva.</p>}
                {f.source === 'risk' && <p style={{ fontSize: 12, color: '#6E6E73', margin: 0 }}>Acción de mitigación vinculada a un riesgo.</p>}
                {f.source === 'manual' && !f.riskId && <p style={{ fontSize: 12, color: '#6E6E73', margin: 0 }}>Creada manualmente desde seguimiento.</p>}
              </div>
            )}

            {/* Timestamps */}
            <div style={{ fontSize: 10, color: '#C7C7CC', display: 'flex', gap: 16, paddingTop: 8, borderTop: '1px solid #F2F2F7' }}>
              {f.createdAt && <span>Creado: {fd(f.createdAt)}</span>}
              {f.updatedAt && <span>Actualizado: {fd(f.updatedAt)}</span>}
            </div>
          </div>

          {/* Right sidebar: metadata */}
          <div style={{ width: 240, borderLeft: '1px solid #E5E5EA', padding: 16, overflowY: 'auto', background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
            <div>
              <label style={labelStyle}>Estado</label>
              <select value={f.status || 'backlog'} onChange={e => setF({ ...f, status: (e.target as HTMLSelectElement).value })} style={selectStyle}>
                {TASK_STATUSES.filter(s => s.id !== 'discarded').map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Tipo</label>
              <select value={f.type || 'tarea'} onChange={e => setF({ ...f, type: (e.target as HTMLSelectElement).value })} style={selectStyle}>
                {ITEM_TYPES.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Prioridad</label>
              <select value={f.priority || 'medium'} onChange={e => setF({ ...f, priority: (e.target as HTMLSelectElement).value })} style={selectStyle}>
                {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Responsable</label>
              <select value={f.owner || ''} onChange={e => setF({ ...f, owner: (e.target as HTMLSelectElement).value })} style={{ ...selectStyle, background: '#FFF' }}>
                <option value="">— Sin asignar —</option>
                {f.owner && !teamMembers.some(m => m.name === f.owner) && <option value={f.owner}>{f.owner}</option>}
                {teamMembers.map(m => <option key={m.id} value={m.name}>{m.avatar || '👤'} {m.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Fecha inicio</label>
              <input type="date" value={f.startDate || ''} onInput={e => setF({ ...f, startDate: (e.target as HTMLInputElement).value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Fecha límite</label>
              <input type="date" value={f.date || ''} onInput={e => setF({ ...f, date: (e.target as HTMLInputElement).value })} style={inputStyle} />
            </div>
            <div style={{ borderTop: '1px solid #E5E5EA', paddingTop: 12 }}>
              <label style={labelStyle}>Horas</label>
              <input type="number" min="0" step="1" value={f.hours || ''} onInput={e => setF({ ...f, hours: (e.target as HTMLInputElement).value ? parseInt((e.target as HTMLInputElement).value) : null })}
                placeholder="—" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Avance ({f.progress || 0}%)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="range" min="0" max="100" step="5" value={f.progress || 0}
                  onInput={e => setF({ ...f, progress: parseInt((e.target as HTMLInputElement).value) })}
                  style={{ flex: 1, accentColor: '#007AFF' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: (f.progress || 0) === 100 ? '#34C759' : '#007AFF', minWidth: 36, textAlign: 'right' }}>
                  {f.progress || 0}%
                </span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Épica</label>
              <select value={f.epicLink || ''} onChange={e => setF({ ...f, epicLink: (e.target as HTMLSelectElement).value || undefined })} style={selectStyle}>
                <option value="">— Sin épica —</option>
                {epics.map(ep => <option key={ep} value={ep}>{ep}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Origen de demanda</label>
              <select value={f.demandOrigin || ''} onChange={e => setF({ ...f, demandOrigin: (e.target as HTMLSelectElement).value })} style={selectStyle}>
                <option value="">— Sin especificar —</option>
                {DEMAND_ORIGINS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #F2F2F7', display: 'flex', gap: 8, justifyContent: 'space-between', flexShrink: 0, background: '#FAFAFA' }}>
          <button onClick={() => onDelete(task.id)}
            style={{ padding: '8px 16px', borderRadius: 10, border: '1.5px solid #FF3B3015', background: '#FFF5F5', color: '#FF3B30', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            Eliminar
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 10, border: '1.5px solid #E5E5EA', background: '#FFF', fontSize: 12, fontWeight: 500, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
            <button onClick={save} style={{ padding: '8px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#007AFF,#5856D6)', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Guardar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
