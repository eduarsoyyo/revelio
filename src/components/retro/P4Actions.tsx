// ═══ PHASE 5: ACCIONABLES — Create tasks from notes + risks ═══
import { useState } from 'preact/hooks';
import type { AppUser, Task, Risk } from '@app-types/index';
import { NOTE_CATEGORIES } from '../../config/retro';
import { RISK_TYPES } from '@domain/risks';
import type { RetroNote } from '../../types/index';
import { Icon } from '@components/common/Icon';

interface P4ActionsProps {
  notes: unknown[];
  actions: Task[];
  risks?: Risk[];
  onUpdateActions: (actions: Task[]) => void;
  onOpenTaskDetail?: (task: Task) => void;
  user: AppUser;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const CAT_ICONS: Record<string, string> = { good: 'ThumbsUp', bad: 'ThumbsDown', start: 'Rocket', stop: 'Square' };

export function P4Actions({ notes, actions, risks = [], onUpdateActions, onOpenTaskDetail, user }: P4ActionsProps) {
  const [delTarget, setDelTarget] = useState<Task | null>(null);

  const allNotes = (notes as RetroNote[]) || [];
  const topNotes = allNotes
    .filter(n => (n.votes?.length || 0) > 0)
    .sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0))
    .slice(0, 10);
  const openRisks = risks.filter(r => r.status !== 'mitigated');

  const createAndOpen = (text: string, extra?: Partial<Task>) => {
    const action: Task = {
      id: uid(), text: text.trim(), owner: user.name,
      date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status: 'backlog', priority: 'medium',
      createdBy: user.id, noteId: null, fromCategory: null,
      ...extra,
    };
    onUpdateActions([...actions, action]);
    if (onOpenTaskDetail) onOpenTaskDetail(action);
  };

  const createManual = () => createAndOpen('');
  const createFromNote = (n: RetroNote) => createAndOpen(n.text, { noteId: n.id, fromCategory: n.category });
  const createFromRisk = (r: Risk) => createAndOpen(`Mitigar: ${r.title || r.text}`, { riskId: r.id } as Partial<Task>);

  const confirmDelete = () => {
    if (!delTarget) return;
    onUpdateActions(actions.filter(a => a.id !== delTarget.id));
    setDelTarget(null);
  };

  const hasActionForNote = (noteId: string) => actions.some(a => a.noteId === noteId);
  const hasActionForRisk = (riskId: string) => actions.some(a => (a as any).riskId === riskId);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Accionables</h3>
          <p style={{ fontSize: 12, color: '#86868B', marginTop: 2 }}>{actions.length} acciones creadas</p>
        </div>
        <button onClick={createManual}
          style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: '#007AFF', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="Plus" size={11} color="#FFF" /> Crear accionable
        </button>
      </div>

      {/* Two-column layout: sources left, actions right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* LEFT: Sources */}
        <div>
          {topNotes.length > 0 && (
            <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 14, marginBottom: 12 }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="MessageSquare" size={13} color="#007AFF" /> Notas más votadas
              </h4>
              {topNotes.map((n: RetroNote) => {
                const cat = NOTE_CATEGORIES.find(c => c.id === n.category);
                const done = hasActionForNote(n.id);
                return (
                  <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: done ? '#F0FFF4' : '#FAFAFA', marginBottom: 4, border: `1px solid ${done ? '#34C75920' : '#E5E5EA'}` }}>
                    <Icon name={CAT_ICONS[n.category] || 'Circle'} size={12} color={cat?.color || '#86868B'} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11 }}>{n.text}</div>
                      <div style={{ fontSize: 9, color: '#86868B' }}>{n.userName}</div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#007AFF' }}>{n.votes?.length || 0}</span>
                    <Icon name="ThumbsUp" size={10} color="#007AFF" />
                    {done ? <Icon name="CheckCircle" size={14} color="#34C759" /> : (
                      <button onClick={() => createFromNote(n)}
                        style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #007AFF30', background: '#FFF', fontSize: 9, fontWeight: 600, color: '#007AFF', cursor: 'pointer' }}>+ Acción</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {openRisks.length > 0 && (
            <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 14 }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name="AlertTriangle" size={13} color="#FF9500" /> Riesgos abiertos
              </h4>
              {openRisks.map(r => {
                const tc = RISK_TYPES.find(t => t.id === r.type);
                const done = hasActionForRisk(r.id);
                return (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: done ? '#F0FFF4' : '#FAFAFA', marginBottom: 4, borderLeft: `3px solid ${tc?.color || '#FF9500'}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 600 }}>{r.title || r.text}</div>
                    </div>
                    {done ? <Icon name="CheckCircle" size={14} color="#34C759" /> : (
                      <button onClick={() => createFromRisk(r)}
                        style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${tc?.color || '#FF9500'}30`, background: '#FFF', fontSize: 9, fontWeight: 600, color: tc?.color || '#FF9500', cursor: 'pointer' }}>+ Acción</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {topNotes.length === 0 && openRisks.length === 0 && (
            <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 24, textAlign: 'center', color: '#C7C7CC' }}>
              <Icon name="Inbox" size={24} color="#E5E5EA" />
              <p style={{ fontSize: 12, marginTop: 6 }}>Sin notas votadas ni riesgos.</p>
            </div>
          )}
        </div>

        {/* RIGHT: Created actions */}
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 14 }}>
          <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="ClipboardList" size={13} color="#007AFF" /> Acciones ({actions.length})
          </h4>
          {actions.length === 0 && <p style={{ fontSize: 11, color: '#C7C7CC', textAlign: 'center', padding: 16 }}>Crea la primera acción.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 500, overflowY: 'auto' }}>
            {actions.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: '#FAFAFA', borderLeft: '3px solid #007AFF' }}>
                <Icon name="CheckSquare" size={13} color="#007AFF" />
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onOpenTaskDetail?.(a)}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{a.text || '(sin título)'}</div>
                  <div style={{ fontSize: 9, color: '#86868B' }}>
                    {a.owner && <span style={{ color: '#007AFF' }}>{a.owner}</span>}
                    {a.date && <span> · {new Date(a.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>}
                    <span> · {a.status || 'backlog'}</span>
                  </div>
                </div>
                <button onClick={() => onOpenTaskDetail?.(a)}
                  style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="Edit" size={9} color="#007AFF" />
                </button>
                <button onClick={() => setDelTarget(a)}
                  style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #FF3B3020', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="Trash2" size={9} color="#FF3B30" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {delTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setDelTarget(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.3)' }} />
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', background: '#FFF', borderRadius: 20, maxWidth: 380, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)', textAlign: 'center' }}>
            <Icon name="AlertTriangle" size={28} color="#FF3B30" />
            <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>Eliminar accionable</h3>
            <p style={{ fontSize: 12, color: '#86868B', marginTop: 6 }}>"{delTarget.text?.slice(0, 60)}"</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setDelTarget(null)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
              <button onClick={confirmDelete} style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: '#FF3B30', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
