// ═══ PHASE 3: PUESTA EN COMÚN — All notes revealed, voting + reactions ═══
import { useState } from 'preact/hooks';
import type { AppUser, RetroNote } from '@app-types/index';
import { NOTE_CATEGORIES, REACTIONS } from '../../config/retro';
import { Icon } from '@components/common/Icon';

interface P3DiscussProps {
  notes: unknown[];
  onUpdateNotes: (notes: unknown[]) => void;
  user: AppUser;
}

const CAT_ICONS: Record<string, string> = { good: 'ThumbsUp', bad: 'ThumbsDown', start: 'Rocket', stop: 'Square' };

export function P3Discuss({ notes, onUpdateNotes, user }: P3DiscussProps) {
  const [filter, setFilter] = useState<'all' | 'mine'>('all');
  const [reactOpen, setReactOpen] = useState<string | null>(null);
  const allNotes = (notes || []) as RetroNote[];
  const myNotes = allNotes.filter(n => n.userId === user.id || n.userName === user.name);

  const vote = (noteId: string) => {
    onUpdateNotes(allNotes.map(n => {
      if (n.id !== noteId) return n;
      const votes = n.votes || [];
      const hasVoted = votes.includes(user.id);
      return { ...n, votes: hasVoted ? votes.filter((v: string) => v !== user.id) : [...votes, user.id] };
    }));
  };

  const react = (noteId: string, emoji: string) => {
    onUpdateNotes(allNotes.map(n => {
      if (n.id !== noteId) return n;
      const reactions = { ...(n.reactions || {}) } as Record<string, string[]>;
      const users = reactions[emoji] || [];
      if (users.includes(user.id)) {
        reactions[emoji] = users.filter(u => u !== user.id);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji] = [...users, user.id];
      }
      return { ...n, reactions };
    }));
  };

  const displayNotes = filter === 'mine' ? myNotes : allNotes;

  // Group by category, sorted by votes desc
  const grouped = NOTE_CATEGORIES.map(cat => ({
    ...cat,
    notes: displayNotes.filter(n => n.category === cat.id).sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0)),
  }));

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'mine'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: '5px 12px', borderRadius: 8, border: 'none', background: filter === f ? '#1D1D1F' : '#F2F2F7', color: filter === f ? '#FFF' : '#6E6E73', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              {f === 'all' ? 'Todas' : 'Mis notas'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: '#86868B' }}>{displayNotes.length} notas · Click para votar</span>
      </div>

      {/* Category columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        {grouped.map(g => (
          <div key={g.id} style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `3px solid ${g.color}` }}>
              <Icon name={CAT_ICONS[g.id] || 'Circle'} size={14} color={g.color} />
              <span style={{ fontSize: 13, fontWeight: 700, color: g.color }}>{g.label}</span>
              <span style={{ fontSize: 11, color: g.color, fontWeight: 700, marginLeft: 'auto' }}>{g.notes.length}</span>
            </div>

            {/* Notes */}
            <div style={{ padding: 8, minHeight: 60 }}>
              {g.notes.length === 0 && <p style={{ fontSize: 10, color: '#D1D1D6', textAlign: 'center', padding: 12 }}>Sin notas</p>}
              {g.notes.map((n: RetroNote) => {
                const voteCount = n.votes?.length || 0;
                const hasVoted = (n.votes || []).includes(user.id);
                const reactions = (n.reactions || {}) as Record<string, string[]>;
                
                return (
                  <div key={n.id} style={{
                    background: g.bg, borderRadius: 10, padding: '10px 12px', marginBottom: 6,
                    borderLeft: `3px solid ${g.color}`,
                    border: hasVoted ? `2px solid ${g.color}40` : undefined,
                  }}>
                    <div style={{ fontSize: 12, marginBottom: 6 }}>{n.text}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, color: '#86868B' }}>{n.userName}</span>

                      {/* Active reactions */}
                      <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
                        {Object.entries(reactions).filter(([, u]) => u.length > 0).map(([emoji, users]) => (
                          <button key={emoji} onClick={() => react(n.id, emoji)}
                            style={{
                              padding: '1px 5px', borderRadius: 6, fontSize: 10, border: 'none', cursor: 'pointer',
                              background: users.includes(user.id) ? '#007AFF15' : '#F2F2F7',
                            }}>
                            {emoji} {users.length}
                          </button>
                        ))}
                      </div>

                      {/* React toggle */}
                      <button onClick={() => setReactOpen(reactOpen === n.id ? null : n.id)}
                        style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid #E5E5EA', background: reactOpen === n.id ? '#F2F2F7' : '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="Smile" size={11} color="#86868B" />
                      </button>

                      {/* Vote */}
                      <button onClick={() => vote(n.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 6,
                          border: hasVoted ? 'none' : '1px solid #E5E5EA',
                          background: hasVoted ? '#007AFF' : '#FFF',
                          color: hasVoted ? '#FFF' : '#C7C7CC',
                          fontSize: 10, fontWeight: 700, cursor: 'pointer',
                        }}>
                        <Icon name="ThumbsUp" size={10} color={hasVoted ? '#FFF' : '#C7C7CC'} /> {voteCount}
                      </button>
                    </div>

                    {/* Reaction picker (hidden until toggle) */}
                    {reactOpen === n.id && (
                      <div style={{ display: 'flex', gap: 3, marginTop: 6, padding: '4px 0' }}>
                        {REACTIONS.map(r => (
                          <button key={r} onClick={() => { react(n.id, r); setReactOpen(null); }}
                            style={{ width: 26, height: 26, borderRadius: 8, border: (reactions[r] || []).includes(user.id) ? '2px solid #007AFF' : '1px solid #E5E5EA', background: '#FFF', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
