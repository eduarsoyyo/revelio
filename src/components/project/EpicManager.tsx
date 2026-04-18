// ═══ EPIC MANAGER — Create/edit epics, assign tasks, view progress ═══
import { useState, useMemo } from 'preact/hooks';
import type { Task } from '../../types/index';
import { Icon } from '../common/Icon';

interface Tag { id: string; name: string; color: string }
interface TagAssignment { tag_id: string; entity_type: string; entity_id: string; sala?: string }

interface EpicManagerProps {
  actions: Task[];
  tags?: Tag[];
  tagAssignments?: TagAssignment[];
  onUpdateActions: (actions: Task[]) => void;
  onOpenDetail: (task: Task) => void;
  onToggleTag?: (tagId: string, epicName: string) => void;
}

interface Epic {
  name: string;
  color: string;
  tasks: Task[];
  done: number;
  total: number;
  points: number;
  pointsDone: number;
}

const EPIC_COLORS = ['#007AFF', '#5856D6', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#FF2D55', '#00C7BE', '#1D1D1F'];

export function EpicManager({ actions, tags = [], tagAssignments = [], onUpdateActions, onOpenDetail, onToggleTag }: EpicManagerProps) {
  const [newEpic, setNewEpic] = useState('');
  const [selectedEpic, setSelectedEpic] = useState<string | null>(null);
  const [editingEpic, setEditingEpic] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [standaloneEpics, setStandaloneEpics] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('rf-epics') || '[]'); } catch { return []; }
  });

  const saveStandalone = (list: string[]) => { setStandaloneEpics(list); try { localStorage.setItem('rf-epics', JSON.stringify(list)); } catch {} };

  const epics = useMemo(() => {
    const map: Record<string, Epic> = {};
    // Include standalone epics (even without tasks)
    standaloneEpics.forEach(name => { map[name] = { name, color: '#5856D6', tasks: [], done: 0, total: 0, points: 0, pointsDone: 0 }; });
    (actions || []).forEach(t => {
      const epicName = (t as Record<string, unknown>).epicLink as string;
      if (!epicName) return;
      if (!map[epicName]) map[epicName] = { name: epicName, color: '#5856D6', tasks: [], done: 0, total: 0, points: 0, pointsDone: 0 };
      map[epicName].tasks.push(t);
      map[epicName].total++;
      const pts = (t as Record<string, unknown>).hours as number || 0;
      const prog = (t as Record<string, unknown>).progress as number || (t.status === 'done' || t.status === 'archived' ? 100 : 0);
      map[epicName].points += pts;
      if (t.status === 'done' || t.status === 'archived') map[epicName].done++;
      map[epicName].pointsDone += Math.round(pts * prog / 100);
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [actions, standaloneEpics]);

  const unassigned = useMemo(() =>
    (actions || []).filter(t => !(t as Record<string, unknown>).epicLink && t.status !== 'discarded' && t.status !== 'cancelled'),
  [actions]);

  const createEpic = () => {
    if (!newEpic.trim()) return;
    const name = newEpic.trim();
    if (!standaloneEpics.includes(name)) saveStandalone([...standaloneEpics, name]);
    setNewEpic('');
    setSelectedEpic(name);
  };

  const assignToEpic = (taskId: string, epicName: string | null) => {
    onUpdateActions(actions.map(a => a.id === taskId ? { ...a, epicLink: epicName || undefined } as Task : a));
  };

  const renameEpic = (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) { setEditingEpic(null); return; }
    onUpdateActions(actions.map(a => (a as Record<string, unknown>).epicLink === oldName ? { ...a, epicLink: newName } as Task : a));
    if (selectedEpic === oldName) setSelectedEpic(newName);
    setEditingEpic(null);
  };

  const deleteEpic = (epicName: string) => {
    onUpdateActions(actions.map(a => (a as Record<string, unknown>).epicLink === epicName ? { ...a, epicLink: undefined } as Task : a));
    saveStandalone(standaloneEpics.filter(e => e !== epicName));
    if (selectedEpic === epicName) setSelectedEpic(null);
  };

  const selectedTasks = selectedEpic ? epics.find(e => e.name === selectedEpic)?.tasks || [] : [];

  return (
    <div>
      {/* Create epic (popup) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Épicas</h3>
          <p style={{ fontSize: 12, color: '#86868B' }}>{epics.length} épicas · {unassigned.length} sin asignar</p>
        </div>
        <button onClick={() => {
          const name = prompt('Nombre de la nueva épica:');
          if (name?.trim()) { if (!standaloneEpics.includes(name.trim())) saveStandalone([...standaloneEpics, name.trim()]); setSelectedEpic(name.trim()); }
        }} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#1D1D1F', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="Plus" size={11} color="#FFF" /> Nueva épica
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedEpic ? '300px 1fr' : '1fr', gap: 12 }}>
        {/* Epic list */}
        <div>
          {epics.map(epic => {
            const pct = epic.total > 0 ? Math.round(epic.tasks.reduce((s, t) => s + ((t as Record<string, unknown>).progress as number || (t.status === 'done' || t.status === 'archived' ? 100 : 0)), 0) / epic.total) : 0;
            const isSelected = selectedEpic === epic.name;
            return (
              <div key={epic.name} onClick={() => setSelectedEpic(isSelected ? null : epic.name)}
                class="card-hover"
                style={{ background: isSelected ? '#007AFF08' : '#FFF', borderRadius: 12, border: `1.5px solid ${isSelected ? '#007AFF' : '#E5E5EA'}`, padding: '12px 14px', marginBottom: 8, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: epic.color, flexShrink: 0 }} />
                  {editingEpic === epic.name ? (
                    <input value={editName} onInput={e => setEditName((e.target as HTMLInputElement).value)}
                      onBlur={() => renameEpic(epic.name, editName)} onKeyDown={e => e.key === 'Enter' && renameEpic(epic.name, editName)}
                      onClick={e => e.stopPropagation()} autoFocus
                      style={{ flex: 1, padding: '3px 6px', borderRadius: 6, border: '1.5px solid #007AFF', fontSize: 13, fontWeight: 700, outline: 'none' }} />
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{epic.name}</span>
                  )}
                  <button onClick={e => { e.stopPropagation(); setEditingEpic(epic.name); setEditName(epic.name); }}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2 }}>
                    <Icon name="Pencil" size={12} color="#C7C7CC" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteEpic(epic.name); }}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2 }}>
                    <Icon name="Trash2" size={12} color="#C7C7CC" />
                  </button>
                </div>
                {/* Progress bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: '#F2F2F7' }}>
                    <div style={{ width: `${pct}%`, height: 4, borderRadius: 2, background: pct === 100 ? '#34C759' : '#007AFF', transition: 'width .3s' }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: pct === 100 ? '#34C759' : '#86868B' }}>{pct}%</span>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 10, color: '#86868B' }}>
                  <span>{epic.done}/{epic.total} tareas</span>
                  {epic.points > 0 && <span>{epic.pointsDone}/{epic.points}h</span>}
                </div>
                {/* Tags */}
                {tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 3, marginTop: 6, flexWrap: 'wrap' }}>
                    {tags.map(tag => {
                      const assigned = tagAssignments.some(a => a.tag_id === tag.id && a.entity_type === 'epic' && a.entity_id === epic.name);
                      return (
                        <button key={tag.id} onClick={e => { e.stopPropagation(); onToggleTag?.(tag.id, epic.name); }}
                          style={{ padding: '2px 8px', borderRadius: 10, fontSize: 9, fontWeight: 600, cursor: 'pointer', border: assigned ? 'none' : `1px dashed ${tag.color}40`, background: assigned ? tag.color + '20' : 'transparent', color: assigned ? tag.color : '#C7C7CC' }}>
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Unassigned tasks section */}
          {unassigned.length > 0 && (
            <div style={{ background: '#F9F9FB', borderRadius: 12, border: '1.5px dashed #E5E5EA', padding: '12px 14px', marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#86868B', marginBottom: 8 }}>SIN ÉPICA ({unassigned.length})</div>
              {unassigned.slice(0, 10).map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 11 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: '#C7C7CC' }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.text}</span>
                  {selectedEpic && (
                    <button onClick={() => assignToEpic(t.id, selectedEpic)}
                      style={{ border: 'none', background: '#007AFF', color: '#FFF', borderRadius: 6, padding: '2px 8px', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>
                      + Asignar
                    </button>
                  )}
                </div>
              ))}
              {unassigned.length > 10 && <div style={{ fontSize: 10, color: '#C7C7CC', marginTop: 4 }}>+{unassigned.length - 10} más</div>}
            </div>
          )}
        </div>

        {/* Selected epic detail */}
        {selectedEpic && (
          <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{selectedEpic}</h4>
            {selectedTasks.length === 0 ? (
              <p style={{ fontSize: 12, color: '#86868B', textAlign: 'center', padding: 20 }}>Sin accionables asignados. Usa los botones "+ Asignar" de la lista de la izquierda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {selectedTasks.map(t => {
                  const pts = (t as Record<string, unknown>).hours as number || 0;
                  return (
                    <div key={t.id} class="card-hover" onClick={() => onOpenDetail(t)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: '#F9F9FB', cursor: 'pointer' }}>
                      <div style={{ width: 6, height: 6, borderRadius: 3, background: t.status === 'done' || t.status === 'archived' ? '#34C759' : t.status === 'doing' || t.status === 'in_progress' ? '#007AFF' : '#C7C7CC' }} />
                      <span style={{ flex: 1, fontSize: 12, fontWeight: 500, textDecoration: t.status === 'done' || t.status === 'archived' ? 'line-through' : 'none', color: t.status === 'done' || t.status === 'archived' ? '#86868B' : '#1D1D1F' }}>
                        {t.text}
                      </span>
                      {pts > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#5856D6', background: '#5856D615', padding: '2px 6px', borderRadius: 4 }}>{pts}h</span>}
                      {(t as Record<string, unknown>).progress as number > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#007AFF', background: '#007AFF15', padding: '2px 6px', borderRadius: 4 }}>
                          {(t as Record<string, unknown>).progress as number}%
                        </span>
                      )}
                      <span style={{ fontSize: 10, color: '#86868B' }}>{t.owner || '—'}</span>
                      <button onClick={e => { e.stopPropagation(); assignToEpic(t.id, null); }}
                        style={{ border: 'none', background: '#FF3B3010', borderRadius: 6, padding: '2px 6px', fontSize: 9, color: '#FF3B30', cursor: 'pointer' }}>
                        <Icon name="X" size={10} color="#FF3B30" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
