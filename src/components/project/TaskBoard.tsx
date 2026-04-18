// ═══ TASK BOARD — Main task management view ═══
import { useState, useRef, useCallback } from 'preact/hooks';
import type { Task, Risk, Member, AppUser } from '@app-types/index';
import { filterTasks, sortTasks, taskMetrics, groupByStatus, type SortBy } from '@domain/tasks';
import { KANBAN_COLUMNS, BOARD_VIEWS, ITEM_TYPES, PRIORITIES, TASK_STATUS_MAP, ITEM_TYPE_MAP, PRIORITY_MAP } from '../../config/tasks';
import { Icon } from '@components/common/Icon';
import { TaskCard } from './TaskCard';
import { EpicManager } from './EpicManager';
import { GanttView } from './GanttView';

interface Tag { id: string; name: string; color: string }
interface TagAssignment { tag_id: string; entity_type: string; entity_id: string; sala: string }

interface TaskBoardProps {
  actions: Task[];
  risks: Risk[];
  user: AppUser;
  sala: string;
  teamMembers: Member[];
  tags: Tag[];
  tagAssignments: TagAssignment[];
  onUpdateActions: (actions: Task[]) => void;
  onUpdateTagAssignments: (ta: TagAssignment[]) => void;
  onOpenTaskDetail: (task: Task) => void;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const fd = (iso: string | undefined) => iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '';

export function TaskBoard({
  actions, risks, user, sala, teamMembers, tags, tagAssignments,
  onUpdateActions, onUpdateTagAssignments, onOpenTaskDetail,
}: TaskBoardProps) {
  const [view, setView] = useState('board');
  const [searchQ, setSearchQ] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('priority');
  const [filterOwner, setFilterOwner] = useState('all');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ text: '', owner: '', date: '', priority: 'medium', type: 'tarea' });

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [touchDragId, setTouchDragId] = useState<string | null>(null);
  const [touchOverCol, setTouchOverCol] = useState<string | null>(null);
  const kanbanRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);

  const handleTouchStart = useCallback((taskId: string, e: TouchEvent) => {
    setTouchDragId(taskId);
    const touch = e.touches[0];
    const ghost = document.createElement('div');
    ghost.style.cssText = `position:fixed;left:${touch.clientX-40}px;top:${touch.clientY-20}px;width:80px;height:36px;background:#007AFF;color:#FFF;border-radius:8px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;z-index:9999;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.2);opacity:.9`;
    ghost.textContent = (actions.find(a => a.id === taskId)?.text || '').slice(0,15) + '…';
    document.body.appendChild(ghost);
    ghostRef.current = ghost;
  }, [actions]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!touchDragId || !kanbanRef.current || !ghostRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    ghostRef.current.style.left = `${touch.clientX-40}px`;
    ghostRef.current.style.top = `${touch.clientY-20}px`;
    const cols = kanbanRef.current.children;
    for (let i = 0; i < cols.length; i++) {
      const rect = cols[i].getBoundingClientRect();
      if (touch.clientX >= rect.left && touch.clientX <= rect.right) { setTouchOverCol(KANBAN_COLUMNS[i]?.id || null); return; }
    }
    setTouchOverCol(null);
  }, [touchDragId]);

  const handleTouchEnd = useCallback(() => {
    if (touchDragId && touchOverCol) updateStatus(touchDragId, touchOverCol);
    setTouchDragId(null); setTouchOverCol(null);
    if (ghostRef.current) { ghostRef.current.remove(); ghostRef.current = null; }
  }, [touchDragId, touchOverCol]);

  const today = new Date().toISOString().slice(0, 10);

  // Filtered data (affected by person + tag)
  const filtered = filterTasks(actions, { search: searchQ, owner: filterOwner, userId: user.id, userName: user.name, tagId: activeTagFilter || undefined, tagAssignments });
  const sorted = sortTasks(filtered, sortBy);
  const metrics = taskMetrics(filtered); // Use filtered!
  const totalHours = filtered.reduce((s, a) => s + ((a as any).hours || 0), 0);
  const openSorted = sorted.filter(a => a.status !== 'done' && a.status !== 'archived' && a.status !== 'cancelled' && a.status !== 'discarded');
  const doneSorted = sorted.filter(a => a.status === 'done');
  const grouped = groupByStatus(filtered);

  const updateStatus = (id: string, status: string) => {
    onUpdateActions(actions.map(a => a.id === id ? { ...a, status: status as Task['status'], updatedAt: new Date().toISOString() } : a));
  };

  const addTask = () => {
    if (!form.text.trim()) return;
    onUpdateActions([...actions, { id: uid(), text: form.text.trim(), owner: form.owner || 'Sin asignar', date: form.date || undefined, status: 'backlog', priority: form.priority as Task['priority'], voteScore: 0, createdBy: user.id } as Task]);
    setForm({ text: '', owner: '', date: '', priority: 'medium', type: 'tarea' });
    setShowForm(false);
  };

  const getTagsForTask = (tid: string) => tags.filter(t => tagAssignments.some(ta => ta.tag_id === t.id && ta.entity_type === 'action' && ta.entity_id === tid));
  const handleDrop = (colId: string) => { if (dragId) { updateStatus(dragId, colId); setDragId(null); } };

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { v: metrics.total, l: 'Total', c: '#1D1D1F' },
          { v: metrics.open, l: 'Abiertas', c: '#007AFF' },
          { v: metrics.overdue, l: 'Vencidas', c: metrics.overdue > 0 ? '#FF3B30' : '#34C759' },
          { v: metrics.blocked, l: 'Bloqueadas', c: metrics.blocked > 0 ? '#FF3B30' : '#6E6E73' },
          { v: `${metrics.completionPct}%`, l: 'Completadas', c: metrics.completionPct >= 75 ? '#34C759' : '#FF9500' },
          { v: `${totalHours}h`, l: 'Horas', c: '#5856D6' },
        ].map(k => (
          <div key={k.l} style={{ padding: '8px 14px', background: '#FFF', borderRadius: 10, border: '1.5px solid #E5E5EA', textAlign: 'center', minWidth: 60 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: k.c }}>{k.v}</div>
            <div style={{ fontSize: 9, color: '#86868B' }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden', border: '1.5px solid #E5E5EA' }}>
          {BOARD_VIEWS.map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              style={{ padding: '6px 12px', fontSize: 11, fontWeight: view === v.id ? 700 : 500, background: view === v.id ? '#1D1D1F' : '#FFF', color: view === v.id ? '#FFF' : '#6E6E73', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name={v.lucide} size={12} color={view === v.id ? '#FFF' : '#86868B'} /> {v.label}
            </button>
          ))}
        </div>
        <input value={searchQ} onInput={e => setSearchQ((e.target as HTMLInputElement).value)} placeholder="Buscar..." style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 12, outline: 'none', width: 140 }} />
        <select value={sortBy} onChange={e => setSortBy((e.target as HTMLSelectElement).value as SortBy)} style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 11, outline: 'none' }}>
          <option value="priority">Prioridad</option><option value="date">Fecha</option><option value="type">Tipo</option><option value="status">Estado</option>
        </select>
        {tags.length > 0 && <div style={{ display: 'flex', gap: 3 }}>
          {activeTagFilter && <button onClick={() => setActiveTagFilter(null)} style={{ padding: '3px 8px', borderRadius: 12, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 10, cursor: 'pointer', color: '#86868B' }}><Icon name="X" size={8} color="#86868B" /></button>}
          {tags.map(t => <button key={t.id} onClick={() => setActiveTagFilter(activeTagFilter === t.id ? null : t.id)} style={{ padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: activeTagFilter === t.id ? 'none' : `1.5px solid ${t.color}40`, background: activeTagFilter === t.id ? t.color : '#FFF', color: activeTagFilter === t.id ? '#FFF' : t.color }}>{t.name}</button>)}
        </div>}
        <select value={filterOwner} onChange={e => setFilterOwner((e.target as HTMLSelectElement).value)} style={{ padding: '6px 10px', borderRadius: 8, border: filterOwner !== 'all' ? '1.5px solid #007AFF' : '1.5px solid #E5E5EA', fontSize: 11, outline: 'none', background: filterOwner !== 'all' ? '#007AFF08' : '#FFF', color: filterOwner !== 'all' ? '#007AFF' : '#6E6E73' }}>
          <option value="all">Todos</option>
          {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
        </select>
        <button onClick={() => setShowForm(true)} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 9, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="Plus" size={11} color="#FFF" /> Nuevo accionable
        </button>
      </div>

      {/* Quick add modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'relative', background: '#FFF', borderRadius: 20, width: '90%', maxWidth: 460, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Nuevo accionable</h3>
              <button onClick={() => setShowForm(false)} style={{ border: 'none', background: '#F2F2F7', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Icon name="X" size={16} color="#86868B" /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={form.text} onInput={e => setForm({ ...form, text: (e.target as HTMLInputElement).value })} placeholder="Descripción" autoFocus onKeyDown={e => e.key === 'Enter' && addTask()} style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E5EA', fontSize: 14, outline: 'none', background: '#F9F9FB' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <select value={form.owner} onChange={e => setForm({ ...form, owner: (e.target as HTMLSelectElement).value })} style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 12, outline: 'none', background: '#F9F9FB' }}>
                  <option value="">Asignar a...</option>
                  {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: (e.target as HTMLSelectElement).value })} style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 12, outline: 'none', background: '#F9F9FB' }}>
                  {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input type="date" value={form.date} onInput={e => setForm({ ...form, date: (e.target as HTMLInputElement).value })} style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 12, outline: 'none', background: '#F9F9FB' }} />
                <select value={form.type} onChange={e => setForm({ ...form, type: (e.target as HTMLSelectElement).value })} style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 12, outline: 'none', background: '#F9F9FB' }}>
                  {ITEM_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
            </div>
            <button onClick={addTask} disabled={!form.text.trim()} style={{ width: '100%', padding: 11, borderRadius: 11, border: 'none', background: '#007AFF', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 16, opacity: form.text.trim() ? 1 : 0.5 }}>Crear accionable</button>
          </div>
        </div>
      )}

      {/* ── KANBAN ── */}
      {view === 'board' && (
        <div ref={kanbanRef} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
          style={{ display: 'grid', gridTemplateColumns: `repeat(${KANBAN_COLUMNS.length}, 1fr)`, gap: 8, touchAction: touchDragId ? 'none' : 'auto' }}>
          {KANBAN_COLUMNS.map(col => {
            const colTasks = grouped[col.id] || [];
            return (
              <div key={col.id} onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(col.id)}
                style={{ background: touchOverCol === col.id ? col.color + '20' : col.bg, borderRadius: 14, padding: 10, minHeight: 200, border: `1.5px solid ${col.color}15`, transition: 'background .15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '4px 6px', borderBottom: `2px solid ${col.color}` }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: col.color }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: col.color }}>{col.label}</span>
                  <span style={{ fontSize: 11, color: col.color, fontWeight: 700, marginLeft: 'auto' }}>{colTasks.length}</span>
                </div>
                {colTasks.map(task => (
                  <div key={task.id} onTouchStart={e => handleTouchStart(task.id, e as unknown as TouchEvent)}>
                    <TaskCard task={task} compact draggable isDragging={dragId === task.id || touchDragId === task.id} teamMembers={teamMembers} tags={getTagsForTask(task.id)} onOpenDetail={onOpenTaskDetail} onDragStart={() => setDragId(task.id)} onDragEnd={() => setDragId(null)} />
                  </div>
                ))}
                {col.id === 'done' && colTasks.length > 0 && (
                  <button onClick={() => onUpdateActions(actions.map(a => a.status === 'done' ? { ...a, status: 'archived' as Task['status'] } : a))}
                    style={{ width: '100%', padding: 6, borderRadius: 8, border: `1px dashed ${col.color}40`, background: 'transparent', fontSize: 10, color: '#34C759', fontWeight: 600, cursor: 'pointer', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Icon name="Archive" size={10} color="#34C759" /> Archivar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── BACKLOG ── */}
      {view === 'backlog' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(grouped['backlog'] || []).length === 0 && <p style={{ textAlign: 'center', color: '#C7C7CC', padding: 24, fontSize: 13 }}>Sin accionables en backlog</p>}
          {(grouped['backlog'] || []).map(task => (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1 }}>
                <TaskCard task={task} teamMembers={teamMembers} tags={getTagsForTask(task.id)} onOpenDetail={onOpenTaskDetail} />
              </div>
              <button onClick={() => updateStatus(task.id, 'pending')} title="Mover a Pendiente"
                style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #FF950030', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: '#FF9500', flexShrink: 0 }}>
                <Icon name="ArrowRight" size={10} color="#FF9500" /> Board
              </button>
            </div>
          ))}
          {/* Other statuses grouped */}
          {['pending', 'inprogress', 'blocked'].map(st => {
            const items = grouped[st] || [];
            if (items.length === 0) return null;
            const cfg = KANBAN_COLUMNS.find(c => c.id === st);
            return (
              <div key={st} style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: cfg?.color || '#86868B', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: cfg?.color }} /> {cfg?.label} ({items.length})
                </div>
                {items.map(task => <TaskCard key={task.id} task={task} teamMembers={teamMembers} tags={getTagsForTask(task.id)} onOpenDetail={onOpenTaskDetail} />)}
              </div>
            );
          })}
        </div>
      )}

      {/* ── LIST (table) ── */}
      {view === 'list' && (
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#FAFAFA' }}>
                {['', 'Accionable', 'Responsable', 'Fecha', 'Prioridad', 'Estado', 'Horas', 'Épica'].map(h => (
                  <th key={h} style={{ padding: '8px 8px', fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', borderBottom: '2px solid #E5E5EA', textAlign: h === 'Accionable' ? 'left' : 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {openSorted.map((t, i) => {
                const tp = ITEM_TYPE_MAP[(t as any).type || 'tarea'] || ITEM_TYPE_MAP.tarea;
                const pr = PRIORITY_MAP[(t as any).priority || 'medium'] || PRIORITY_MAP.medium;
                const st = TASK_STATUS_MAP[t.status || 'backlog'] || TASK_STATUS_MAP.backlog;
                const overdue = t.status !== 'done' && t.date && t.date < today;
                return (
                  <tr key={t.id} onClick={() => onOpenTaskDetail(t)} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA', cursor: 'pointer' }}
                    onMouseOver={e => (e.currentTarget.style.background = '#007AFF08')} onMouseOut={e => (e.currentTarget.style.background = i % 2 === 0 ? '#FFF' : '#FAFAFA')}>
                    <td style={{ padding: '6px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}><Icon name={tp.lucide} size={12} color={tp.color} /></td>
                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #F2F2F7', fontWeight: 600, maxWidth: 300 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.text}</div>
                      {t.riskId && <span style={{ fontSize: 8, color: '#FF9500' }}>riesgo vinculado</span>}
                    </td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', color: '#007AFF', fontSize: 10 }}>{t.owner || '—'}</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', color: overdue ? '#FF3B30' : '#86868B', fontWeight: overdue ? 700 : 400, fontSize: 10 }}>{fd(t.date) || '—'}</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}><span style={{ fontSize: 9, fontWeight: 700, color: pr.color }}>{pr.icon} {pr.label}</span></td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}><span style={{ fontSize: 9, fontWeight: 600, color: st.color, background: st.bg, padding: '2px 6px', borderRadius: 4 }}>{st.label}</span></td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontWeight: 600, color: '#5856D6' }}>{(t as any).hours || '—'}</td>
                    <td style={{ padding: '6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontSize: 9, color: '#AF52DE' }}>{(t as any).epicLink || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {openSorted.length === 0 && <p style={{ textAlign: 'center', color: '#C7C7CC', padding: 24, fontSize: 13 }}>Sin accionables pendientes</p>}
          {/* Completed section */}
          {doneSorted.length > 0 && (
            <details style={{ borderTop: '2px solid #34C75920', padding: '8px 12px' }}>
              <summary style={{ fontSize: 11, color: '#34C759', cursor: 'pointer', fontWeight: 600 }}>Completadas ({doneSorted.length})</summary>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginTop: 6 }}>
                <tbody>
                  {doneSorted.map(t => (
                    <tr key={t.id} onClick={() => onOpenTaskDetail(t)} style={{ cursor: 'pointer', opacity: 0.6 }}>
                      <td style={{ padding: '4px 8px', textDecoration: 'line-through', color: '#86868B' }}>{t.text}</td>
                      <td style={{ padding: '4px', textAlign: 'center', fontSize: 10, color: '#86868B' }}>{t.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      )}

      {/* ── HISTORY (by month, collapsed) ── */}
      {view === 'history' && (() => {
        const archived = sortTasks(actions.filter(a => a.status === 'archived' || a.status === 'done'), 'date');
        const byMonth: Record<string, Task[]> = {};
        archived.forEach(a => {
          const d = a.date || (a as any).updatedAt || (a as any).createdAt || today;
          const key = d.slice(0, 7); // yyyy-MM
          if (!byMonth[key]) byMonth[key] = [];
          byMonth[key].push(a);
        });
        const months = Object.keys(byMonth).sort().reverse();
        return (
          <div>
            {months.length === 0 && (
              <div style={{ textAlign: 'center', padding: 32, color: '#86868B' }}>
                <Icon name="Archive" size={36} color="#C7C7CC" />
                <p style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>Sin accionables archivados</p>
              </div>
            )}
            {months.map(m => {
              const [y, mo] = m.split('-');
              const label = new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
              return (
                <details key={m} style={{ marginBottom: 6 }}>
                  <summary style={{ padding: '8px 12px', background: '#FFF', borderRadius: 10, border: '1.5px solid #E5E5EA', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="Calendar" size={12} color="#86868B" />
                    {label.charAt(0).toUpperCase() + label.slice(1)}
                    <span style={{ fontSize: 10, color: '#86868B', fontWeight: 500, marginLeft: 'auto' }}>{byMonth[m].length} accionables</span>
                  </summary>
                  <div style={{ padding: '4px 0', display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                    {byMonth[m].map(task => (
                      <TaskCard key={task.id} task={task} compact teamMembers={teamMembers} tags={getTagsForTask(task.id)} onOpenDetail={onOpenTaskDetail} />
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        );
      })()}

      {/* ── EPICS ── */}
      {view === 'epicas' && (
        <EpicManager actions={filtered} tags={tags} tagAssignments={tagAssignments}
          onUpdateActions={onUpdateActions} onOpenDetail={onOpenTaskDetail}
          onToggleTag={async (tagId, epicName) => {
            const { toggleTagAssignment } = await import('../../data/tags');
            const added = await toggleTagAssignment(tagId, 'epic', epicName, sala);
            if (added) onUpdateTagAssignments([...tagAssignments, { tag_id: tagId, entity_type: 'epic', entity_id: epicName, sala }]);
            else onUpdateTagAssignments(tagAssignments.filter(a => !(a.tag_id === tagId && a.entity_type === 'epic' && a.entity_id === epicName)));
          }} />
      )}

      {/* ── TIMELINE ── */}
      {view === 'timeline' && (
        <GanttView actions={filtered} sala={sala} teamMembers={teamMembers} onUpdateActions={onUpdateActions} onOpenDetail={onOpenTaskDetail} />
      )}
    </div>
  );
}
