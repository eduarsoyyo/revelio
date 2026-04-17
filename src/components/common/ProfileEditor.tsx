// ═══ PROFILE EDITOR — Unified: avatar + color + house + fields in one view ═══
import { useState } from 'preact/hooks';
import type { AppUser, Member } from '../../types/index';
import { saveTeamMember } from '../../data/team';
import { Icon } from '../common/Icon';

interface ProfileEditorProps {
  user: AppUser;
  profile: Member;
  onClose: () => void;
  onSave: (updated: Member) => void;
}

const AVATARS = ['🦊','🐻','🐼','🦁','🦉','🐍','🦡','🦅','🐉','🦄','🧙','⚡','🔮','🏰','🪄','🐺','🦋','🐝'];
const COLORS = ['#007AFF','#5856D6','#34C759','#FF9500','#FF3B30','#AF52DE','#FF2D55','#00C7BE','#5AC8FA','#FF6482','#30B0C7','#1D1D1F'];
const HOUSES = [
  { id: 'gryffindor', emoji: '🦁', name: 'Gryffindor', color: '#AE0001' },
  { id: 'slytherin',  emoji: '🐍', name: 'Slytherin',  color: '#2A623D' },
  { id: 'ravenclaw',  emoji: '🦅', name: 'Ravenclaw',  color: '#0E1A40' },
  { id: 'hufflepuff', emoji: '🦡', name: 'Hufflepuff', color: '#FFDB00' },
] as const;

const labelS = { fontSize: 10, color: '#86868B', display: 'block', marginBottom: 3, fontWeight: 700 as number, textTransform: 'uppercase' as const, letterSpacing: 0.4 };
const inputS = { width: '100%', border: '1.5px solid #E5E5EA', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#F9F9FB', boxSizing: 'border-box' as const };

export function ProfileEditor({ user, profile, onClose, onSave }: ProfileEditorProps) {
  const [f, setF] = useState({ ...profile });
  const [saving, setSaving] = useState(false);

  const dirty = f.avatar !== profile.avatar || f.color !== profile.color ||
    (f as Record<string, unknown>).house !== (profile as Record<string, unknown>).house ||
    f.name !== profile.name || f.username !== profile.username ||
    f.email !== profile.email || f.company !== profile.company || f.phone !== profile.phone;

  const handleSave = async () => {
    setSaving(true);
    const result = await saveTeamMember(f);
    if (result.ok) {
      onSave(result.data);
      try {
        const session = JSON.parse(localStorage.getItem('rf-session') || '{}');
        const updated = { ...session, name: f.name, avatar: f.avatar, color: f.color, role: f.role_label };
        localStorage.setItem('rf-session', JSON.stringify(updated));
        if (session.isSuperuser) localStorage.setItem('rf-admin-session', JSON.stringify(updated));
      } catch {}
    }
    setSaving(false);
    onClose();
    window.location.reload();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', background: '#FFF', borderRadius: 20, width: '90%', maxWidth: 440, maxHeight: '88vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)', padding: 24 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 16, borderBottom: '1px solid #F2F2F7', marginBottom: 16 }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: f.color || '#E5E5EA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
            {f.avatar || '👤'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{f.name || user.name}</div>
            <div style={{ fontSize: 12, color: '#86868B', marginTop: 2 }}>{f.role_label || 'Sin rol'}{f.company ? ` · ${f.company}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#F2F2F7', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="X" size={16} color="#86868B" />
          </button>
        </div>

        {/* ── Avatar ── */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelS}>Avatar</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {AVATARS.map(a => (
              <button key={a} onClick={() => setF({ ...f, avatar: a })}
                style={{ width: 36, height: 36, borderRadius: 10, border: f.avatar === a ? '2px solid #007AFF' : '1px solid #E5E5EA', background: '#FFF', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* ── Color ── */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelS}>Color</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <div key={c} onClick={() => setF({ ...f, color: c })}
                style={{ width: 28, height: 28, borderRadius: 14, background: c, cursor: 'pointer', outline: f.color === c ? '2px solid #1D1D1F' : 'none', outlineOffset: 2 }} />
            ))}
          </div>
        </div>

        {/* ── Casa ── */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelS}>Casa</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {HOUSES.map(h => (
              <button key={h.id} onClick={() => setF({ ...f, house: h.id } as typeof f)}
                style={{ flex: 1, padding: '6px 4px', borderRadius: 8, border: (f as Record<string, unknown>).house === h.id ? `2px solid ${h.color}` : '1px solid #E5E5EA', background: (f as Record<string, unknown>).house === h.id ? h.color + '15' : '#FFF', cursor: 'pointer', textAlign: 'center', fontSize: 10, fontWeight: 600 }}>
                <div style={{ fontSize: 18 }}>{h.emoji}</div>
                {h.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── Separator ── */}
        <div style={{ height: 1, background: '#F2F2F7', marginBottom: 14 }} />

        {/* ── Fields ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {([
            ['Nombre', 'name'],
            ['Usuario', 'username'],
            ['Email', 'email'],
            ['Empresa', 'company'],
            ['Teléfono', 'phone'],
          ] as const).map(([label, field]) => (
            <div key={field}>
              <label style={labelS}>{label}</label>
              <input value={(f as Record<string, string>)[field] || ''} onInput={e => setF({ ...f, [field]: (e.target as HTMLInputElement).value })}
                style={inputS} />
            </div>
          ))}
        </div>

        {/* ── Save ── */}
        <button onClick={handleSave} disabled={saving || !dirty}
          style={{ width: '100%', padding: 12, borderRadius: 11, border: 'none', background: dirty ? '#1D1D1F' : '#E5E5EA', color: dirty ? '#FFF' : '#86868B', fontSize: 13, fontWeight: 600, cursor: dirty ? 'pointer' : 'default', marginTop: 16, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Guardando…' : dirty ? 'Guardar cambios' : 'Sin cambios'}
        </button>
      </div>
    </div>
  );
}
