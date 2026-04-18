// ═══ PHASE 2: INDIVIDUAL — Private note creation (only see your own) ═══
import { useState } from 'preact/hooks';
import type { AppUser, RetroNote } from '@app-types/index';
import { NOTE_CATEGORIES, NOTE_COLORS } from '../../config/retro';
import { Icon } from '@components/common/Icon';

interface P2IndividualProps {
  notes: unknown[];
  onUpdateNotes: (notes: unknown[]) => void;
  user: AppUser;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const CAT_ICONS: Record<string, string> = { good: 'ThumbsUp', bad: 'ThumbsDown', start: 'Rocket', stop: 'Square' };

export function P2Individual({ notes, onUpdateNotes, user }: P2IndividualProps) {
  const [showModal, setShowModal] = useState(false);
  const [editNote, setEditNote] = useState<RetroNote | null>(null);
  const [text, setText] = useState('');
  const [cat, setCat] = useState('good');
  const [deleteNote, setDeleteNote] = useState<RetroNote | null>(null);
  const [filter, setFilter] = useState<'all' | 'mine'>('all');

  const allNotes = (notes || []) as RetroNote[];
  const myNotes = allNotes.filter(n => n.userId === user.id || n.userName === user.name);
  const isMine = (n: RetroNote) => n.userId === user.id || n.userName === user.name;

  const openAdd = (category?: string) => {
    setText('');
    setCat(category || 'good');
    setEditNote(null);
    setShowModal(true);
  };

  const openEdit = (n: RetroNote) => {
    setText(n.text);
    setCat(n.category || 'good');
    setEditNote(n);
    setShowModal(true);
  };

  const saveNote = () => {
    if (!text.trim()) return;
    if (editNote) {
      // Update
      onUpdateNotes(allNotes.map(n => n.id === editNote.id ? { ...n, text: text.trim(), category: cat } : n));
    } else {
      // Create
      const note = {
        id: uid(), text: text.trim(), category: cat,
        userName: user.name, userId: user.id,
        color: user.color || NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)],
        votes: [], reactions: {}, createdAt: new Date().toISOString(),
      };
      onUpdateNotes([...allNotes, note]);
    }
    setShowModal(false);
  };

  const confirmDelete = () => {
    if (!deleteNote) return;
    onUpdateNotes(allNotes.filter(n => n.id !== deleteNote.id));
    setDeleteNote(null);
  };

  // Group by category — show all notes but blind others'
  const displayNotes = filter === 'mine' ? myNotes : allNotes;
  const grouped = NOTE_CATEGORIES.map(c => ({
    ...c,
    notes: displayNotes.filter(n => n.category === c.id),
  }));

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'mine'].map(f => (
            <button key={f} onClick={() => setFilter(f as typeof filter)}
              style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: filter === f ? '#1D1D1F' : '#F2F2F7', color: filter === f ? '#FFF' : '#6E6E73', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {f === 'all' ? 'Todas' : 'Mis notas'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: '#86868B' }}>{myNotes.length} notas escritas</span>
      </div>

      {/* Category columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {grouped.map(g => (
          <div key={g.id} style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', overflow: 'hidden' }}>
            {/* Category header */}
            <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `3px solid ${g.color}` }}>
              <Icon name={CAT_ICONS[g.id] || 'Circle'} size={14} color={g.color} />
              <span style={{ fontSize: 13, fontWeight: 700, color: g.color }}>{g.label}</span>
              <span style={{ fontSize: 10, color: '#86868B', marginLeft: 'auto' }}>{g.notes.length}</span>
            </div>

            {/* Notes */}
            <div style={{ padding: 8, minHeight: 80 }}>
              {g.notes.map(n => {
                const mine = isMine(n);
                return (
                <div key={n.id} style={{ padding: '8px 10px', borderRadius: 8, background: g.bg, borderLeft: `3px solid ${g.color}`, marginBottom: 4, position: 'relative' }}>
                  <div style={{ fontSize: 12, marginBottom: 4, paddingRight: mine ? 40 : 0, filter: mine ? 'none' : 'blur(5px)', userSelect: mine ? 'auto' : 'none' as any }}>{n.text}</div>
                  <div style={{ fontSize: 10, color: '#86868B', filter: mine ? 'none' : 'blur(4px)' }}>{n.userName}</div>
                  {mine && (
                    <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 2 }}>
                      <button onClick={() => openEdit(n)}
                        style={{ width: 20, height: 20, borderRadius: 5, border: '1px solid #E5E5EA', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="Edit" size={9} color="#007AFF" />
                      </button>
                      <button onClick={() => setDeleteNote(n)}
                        style={{ width: 20, height: 20, borderRadius: 5, border: '1px solid #FF3B3020', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="Trash2" size={9} color="#FF3B30" />
                      </button>
                    </div>
                  )}
                </div>
                );
              })}

              {/* Add note button */}
              <button onClick={() => openAdd(g.id)}
                style={{ width: '100%', padding: '8px', borderRadius: 8, border: `1.5px dashed ${g.color}30`, background: 'transparent', fontSize: 11, color: g.color, cursor: 'pointer', fontWeight: 600, marginTop: 4 }}>
                + Añadir nota
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowModal(false)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.3)', backdropFilter: 'blur(4px)' }} />
          <div onClick={e => e.stopPropagation()} style={{
            position: 'relative', background: '#FFF', borderRadius: 20, maxWidth: 460, width: '100%', padding: 24,
            boxShadow: '0 20px 60px rgba(0,0,0,.2)',
            borderTop: `4px solid ${NOTE_CATEGORIES.find(c => c.id === cat)?.color || '#007AFF'}`,
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Icon name={CAT_ICONS[cat] || 'Circle'} size={16} color={NOTE_CATEGORIES.find(c => c.id === cat)?.color || '#007AFF'} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>{editNote ? 'Editar nota' : NOTE_CATEGORIES.find(c => c.id === cat)?.label || 'Nueva nota'}</span>
              <span style={{ fontSize: 11, color: '#86868B', marginLeft: 'auto' }}>{user.name}</span>
              <button onClick={() => setShowModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: '#C7C7CC' }}>
                <Icon name="X" size={16} color="#C7C7CC" />
              </button>
            </div>

            {/* Category selector */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {NOTE_CATEGORIES.map(c => (
                <button key={c.id} onClick={() => setCat(c.id)}
                  style={{
                    flex: 1, padding: '6px 4px', borderRadius: 8, fontSize: 10, fontWeight: cat === c.id ? 700 : 500,
                    border: cat === c.id ? `2px solid ${c.color}` : '1.5px solid #E5E5EA',
                    background: cat === c.id ? c.color + '15' : '#FFF',
                    color: cat === c.id ? c.color : '#86868B', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                  }}>
                  <Icon name={CAT_ICONS[c.id] || 'Circle'} size={10} color={cat === c.id ? c.color : '#C7C7CC'} />
                  {c.label}
                </button>
              ))}
            </div>

            {/* Text */}
            <textarea value={text} onInput={e => setText((e.target as HTMLTextAreaElement).value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNote(); } }}
              placeholder="Escribe tu nota..."
              rows={4}
              style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', background: '#F9F9FB' }}
              autoFocus />

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              {editNote && (
                <button onClick={() => { setDeleteNote(editNote); setShowModal(false); }}
                  style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #FF3B30', background: '#FFF', color: '#FF3B30', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Eliminar
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button onClick={() => setShowModal(false)}
                style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>
                Cancelar
              </button>
              <button onClick={saveNote} disabled={!text.trim()}
                style={{
                  padding: '10px 24px', borderRadius: 10, border: 'none',
                  background: NOTE_CATEGORIES.find(c => c.id === cat)?.color || '#007AFF',
                  color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  opacity: text.trim() ? 1 : 0.4,
                }}>
                {editNote ? 'Guardar' : 'Añadir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteNote && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 20100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setDeleteNote(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.3)' }} />
          <div onClick={e => e.stopPropagation()}
            style={{ position: 'relative', background: '#FFF', borderRadius: 20, maxWidth: 380, width: '100%', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.2)', textAlign: 'center' }}>
            <Icon name="AlertTriangle" size={28} color="#FF3B30" />
            <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>Eliminar nota</h3>
            <p style={{ fontSize: 12, color: '#86868B', marginTop: 6 }}>"{deleteNote.text?.slice(0, 60)}"</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setDeleteNote(null)}
                style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid #E5E5EA', background: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6E6E73' }}>Cancelar</button>
              <button onClick={confirmDelete}
                style={{ flex: 1, padding: 10, borderRadius: 10, border: 'none', background: '#FF3B30', color: '#FFF', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
