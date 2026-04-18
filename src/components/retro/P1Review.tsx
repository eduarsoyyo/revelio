// ═══ PHASE 1: REPASO — Iteration review + objective + evaluation ═══
import { useState, useEffect } from 'preact/hooks';
import type { AppUser } from '@app-types/index';
import { DEFAULT_TASKS } from '../../config/retro';
import { Icon } from '@components/common/Icon';

interface Task { text: string; done: boolean; }

interface P1ReviewProps {
  tasks: unknown[];
  onUpdateTasks: (tasks: unknown[]) => void;
  objective: string;
  onUpdateObjective: (obj: string) => void;
  objectiveStatus?: string;
  onUpdateObjectiveStatus?: (status: string) => void;
  user: AppUser;
  tipo?: string;
}

const STATUS_OPTIONS = [
  { id: 'cumplido', label: 'Cumplido', color: '#34C759', icon: '✅' },
  { id: 'parcial',  label: 'Parcial',  color: '#FF9500', icon: '⚠️' },
  { id: 'no_cumplido', label: 'No cumplido', color: '#FF3B30', icon: '❌' },
];

const cardS = { background: '#FFF', borderRadius: 16, border: '1.5px solid #E5E5EA', padding: 20 };
const inputS = { padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit' };
const labelS = { fontSize: 10, fontWeight: 700 as number, color: '#86868B', display: 'block', marginBottom: 4, textTransform: 'uppercase' as const };

export function P1Review({ tasks, onUpdateTasks, objective, onUpdateObjective, objectiveStatus, onUpdateObjectiveStatus, user, tipo }: P1ReviewProps) {
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [taskText, setTaskText] = useState('');
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);

  const taskList = (tasks || []) as Task[];

  // Load default tasks if empty and tipo is known
  useEffect(() => {
    if (taskList.length === 0 && tipo) {
      const defaults = DEFAULT_TASKS[tipo];
      if (defaults?.length) onUpdateTasks([...defaults]);
    }
  }, [tipo]);

  const toggleTask = (idx: number) => {
    const next = [...taskList];
    next[idx] = { ...next[idx], done: !next[idx].done };
    onUpdateTasks(next);
  };

  const openAddTask = () => { setTaskText(''); setEditIdx(null); setShowTaskModal(true); };
  const openEditTask = (idx: number) => { setTaskText(taskList[idx].text); setEditIdx(idx); setShowTaskModal(true); };

  const saveTask = () => {
    if (!taskText.trim()) return;
    const next = [...taskList];
    if (editIdx !== null) {
      next[editIdx] = { ...next[editIdx], text: taskText.trim() };
    } else {
      next.push({ text: taskText.trim(), done: false });
    }
    onUpdateTasks(next);
    setShowTaskModal(false);
  };

  const confirmDelete = () => {
    if (deleteIdx === null) return;
    const next = taskList.filter((_, i) => i !== deleteIdx);
    onUpdateTasks(next);
    setDeleteIdx(null);
  };

  const doneCount = taskList.filter(t => t.done).length;
  const pct = taskList.length > 0 ? Math.round(doneCount / taskList.length * 100) : 0;
  const status = objectiveStatus || '';

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Objective */}
      <div style={{ ...cardS, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>🎯 Objetivo de la iteración</h3>
        <input
          value={objective}
          onInput={e => onUpdateObjective((e.target as HTMLInputElement).value)}
          placeholder="¿Cuál era el objetivo principal de esta iteración?"
          style={inputS}
        />

        {/* Evaluation */}
        {objective.trim() && (
          <div style={{ marginTop: 12 }}>
            <label style={labelS}>Evaluación del objetivo</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {STATUS_OPTIONS.map(s => (
                <button key={s.id} onClick={() => onUpdateObjectiveStatus?.(status === s.id ? '' : s.id)}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                    border: status === s.id ? `2px solid ${s.color}` : '1.5px solid #E5E5EA',
                    background: status === s.id ? s.color + '12' : '#FFF',
                    color: status === s.id ? s.color : '#6E6E73',
                    fontWeight: status === s.id ? 700 : 500, fontSize: 12,
                  }}>
                  <div style={{ fontSize: 18, marginBottom: 2 }}>{s.icon}</div>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Task checklist */}
      <div style={cardS}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>📋 Checklist de la iteración</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: pct >= 80 ? '#34C759' : pct >= 50 ? '#FF9500' : '#FF3B30' }}>
              {doneCount}/{taskList.length} ({pct}%)
            </span>
            <button onClick={openAddTask}
              style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#007AFF', color: '#FFF', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name="Plus" size={11} color="#FFF" /> Tarea
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 6, background: '#F2F2F7', borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#34C759' : pct >= 50 ? '#FF9500' : '#FF3B30', borderRadius: 3, transition: 'width .3s' }} />
        </div>

        {/* Tasks */}
        {taskList.length === 0 && (
          <div style={{ textAlign: 'center', padding: 20, color: '#C7C7CC' }}>
            <p style={{ fontSize: 12 }}>Sin tareas. Pulsa "+ Tarea" o se cargarán las predefinidas del tipo de proyecto.</p>
          </div>
        )}
        {taskList.map((t, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
            background: t.done ? '#F0FFF4' : '#FAFAFA', marginBottom: 4,
            border: `1px solid ${t.done ? '#34C75920' : '#E5E5EA'}`,
          }}>
            <input type="checkbox" checked={t.done} onChange={() => toggleTask(i)} style={{ accentColor: '#34C759', cursor: 'pointer' }} />
            <span style={{ flex: 1, fontSize: 13, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? '#34C759' : '#1D1D1F' }}>
              {t.text}
            </span>
            <button onClick={() => openEditTask(i)}
              style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="Edit" size={10} color="#007AFF" />
            </button>
            <button onClick={() => setDeleteIdx(i)}
              style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid #FF3B3020', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="Trash2" size={10} color="#FF3B30" />
            </button>
          </div>
        ))}

        {/* Methodology hint */}
        {tipo && DEFAULT_TASKS[tipo] && taskList.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 10, color: '#86868B', textAlign: 'center' }}>
            Tareas pre-cargadas para metodología <strong>{tipo.charAt(0).toUpperCase() + tipo.slice(1)}</strong>
          </div>
        )}
      </div>

      {/* ── Add/Edit Task Modal ── */}
      {showTaskModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowTaskModal(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.3)', backdropFilter: 'blur(4px)' }} />
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', background: '#FFF', borderRadius: 20, maxWidth: 440, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{editIdx !== null ? 'Editar tarea' : 'Nueva tarea'}</h3>
            <textarea value={taskText} onInput={e => setTaskText((e.target as HTMLTextAreaElement).value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveTask(); } }}
              placeholder="Descripción de la tarea…"
              rows={3}
              style={{ ...inputS, resize: 'vertical' }}
              autoFocus />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setShowTaskModal(false)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
              <button onClick={saveTask} disabled={!taskText.trim()} style={{ flex: 2, padding: 10, borderRadius: 10, border: 'none', background: '#007AFF', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: taskText.trim() ? 1 : 0.4 }}>
                {editIdx !== null ? 'Guardar' : 'Añadir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Task Confirm ── */}
      {deleteIdx !== null && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setDeleteIdx(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.3)' }} />
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', background: '#FFF', borderRadius: 20, maxWidth: 380, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🗑️</div>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>Eliminar tarea</h3>
            <p style={{ fontSize: 12, color: '#86868B', marginTop: 6 }}>"{taskList[deleteIdx]?.text}"</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setDeleteIdx(null)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
              <button onClick={confirmDelete} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: '#FF3B30', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
