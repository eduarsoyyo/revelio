// ═══ PHASE 6: RESUMEN — Structured session walkthrough + ranking + quality ═══
import type { AppUser, Task, Risk } from '@app-types/index';
import { NOTE_CATEGORIES, PHASES } from '../../config/retro';
import { calculateCriticality } from '@domain/criticality';
import { RISK_TYPES } from '@domain/risks';
import { Icon } from '@components/common/Icon';

interface P6SummaryProps {
  notes: unknown[];
  actions: Task[];
  risks: Risk[];
  phaseTimes: Record<number, number>;
  objective: string;
  objectiveStatus?: string;
  tasks?: unknown[];
  user: AppUser;
  onFinalize: () => void;
  finalizing: boolean;
}

const CAT_ICONS: Record<string, string> = { good: 'ThumbsUp', bad: 'ThumbsDown', start: 'Rocket', stop: 'Square' };
const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  cumplido: { label: 'Cumplido', color: '#34C759', icon: 'CheckCircle' },
  parcial: { label: 'Parcial', color: '#FF9500', icon: 'AlertCircle' },
  no_cumplido: { label: 'No cumplido', color: '#FF3B30', icon: 'XCircle' },
};
const cardS = { background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 };

export function P6Summary({ notes, actions, risks, phaseTimes, objective, objectiveStatus, tasks, user, onFinalize, finalizing }: P6SummaryProps) {
  const allNotes = (notes || []) as any[];
  const totalTime = Object.values(phaseTimes).reduce((s, t) => s + t, 0);
  const fmtT = (s: number) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;

  const totalVotes = allNotes.reduce((s: number, n: any) => s + (n.votes?.length || 0), 0);
  const openRisks = risks.filter(r => r.status !== 'mitigated');
  const mitigatedRisks = risks.filter(r => r.status === 'mitigated');
  const taskList = (tasks || []) as Array<{ done: boolean; text: string }>;
  const tasksDone = taskList.filter(t => t.done).length;
  const tasksPct = taskList.length > 0 ? Math.round(tasksDone / taskList.length * 100) : 0;
  const objSt = objectiveStatus ? STATUS_MAP[objectiveStatus] : null;
  const participants = [...new Set(allNotes.map(n => n.userName))];

  // Ranking: notes + votes received per person
  const ranking = [...new Set(allNotes.map(n => n.userName))].map(name => {
    const userNotes = allNotes.filter(n => n.userName === name);
    const votesReceived = userNotes.reduce((s: number, n: any) => s + (n.votes?.length || 0), 0);
    const cats = new Set(userNotes.map(n => n.category)).size;
    return { name, notes: userNotes.length, votes: votesReceived, cats, score: userNotes.length * 2 + votesReceived * 3 + cats * 2 };
  }).sort((a, b) => b.score - a.score);

  // Quality
  const quality = Math.min(100, Math.round(
    (allNotes.length >= 5 ? 20 : allNotes.length * 4) +
    (totalVotes >= 5 ? 15 : totalVotes * 3) +
    (actions.length >= 3 ? 20 : actions.length * 7) +
    (risks.length > 0 ? 10 : 0) +
    (participants.length >= 3 ? 15 : participants.length * 5) +
    (objective ? 10 : 0) +
    (tasksPct >= 80 ? 10 : tasksPct >= 50 ? 5 : 0)
  ));
  const qColor = quality >= 80 ? '#34C759' : quality >= 50 ? '#FF9500' : '#FF3B30';
  const qLabel = quality >= 80 ? 'Excelente' : quality >= 60 ? 'Buena' : quality >= 40 ? 'Aceptable' : 'Mejorable';

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* ═══ STEP 1: OBJETIVO ═══ */}
      <div style={{ ...cardS, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: '#007AFF12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="Target" size={16} color="#007AFF" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase' }}>01 — Objetivo de la iteración</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{objective || 'No definido'}</div>
        </div>
        {objSt ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8, background: objSt.color + '12', color: objSt.color, fontSize: 12, fontWeight: 700 }}>
            <Icon name={objSt.icon} size={14} color={objSt.color} /> {objSt.label}
          </div>
        ) : (
          <span style={{ fontSize: 11, color: '#C7C7CC' }}>Sin evaluar</span>
        )}
      </div>

      {/* ═══ STEP 2: CHECKLIST ═══ */}
      <div style={{ ...cardS, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: tasksPct >= 80 ? '#34C75912' : '#FF950012', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="ClipboardList" size={16} color={tasksPct >= 80 ? '#34C759' : '#FF9500'} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase' }}>02 — Checklist</div>
            <div style={{ height: 6, background: '#F2F2F7', borderRadius: 3, marginTop: 4 }}><div style={{ width: `${tasksPct}%`, height: '100%', borderRadius: 3, background: tasksPct >= 80 ? '#34C759' : tasksPct >= 50 ? '#FF9500' : '#FF3B30' }} /></div>
          </div>
          <span style={{ fontSize: 16, fontWeight: 800, color: tasksPct >= 80 ? '#34C759' : '#FF9500' }}>{tasksDone}/{taskList.length}</span>
        </div>
      </div>

      {/* ═══ STEP 3: NOTAS ═══ */}
      <div style={{ ...cardS, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: '#007AFF12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="StickyNote" size={16} color="#007AFF" />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase' }}>03 — Notas del equipo</div>
            <div style={{ fontSize: 12, color: '#6E6E73' }}>{allNotes.length} notas · {totalVotes} votos · {participants.length} participantes</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {NOTE_CATEGORIES.map(cat => {
            const count = allNotes.filter(n => n.category === cat.id).length;
            return (
              <div key={cat.id} style={{ flex: 1, textAlign: 'center', padding: '6px', borderRadius: 8, background: cat.bg }}>
                <Icon name={CAT_ICONS[cat.id] || 'Circle'} size={12} color={cat.color} />
                <div style={{ fontSize: 16, fontWeight: 800, color: cat.color }}>{count}</div>
                <div style={{ fontSize: 9, color: '#86868B' }}>{cat.label}</div>
              </div>
            );
          })}
        </div>
        {/* Top 3 voted */}
        {allNotes.filter(n => (n.votes?.length || 0) > 0).length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', marginBottom: 4 }}>MAS VOTADAS</div>
            {[...allNotes].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0)).slice(0, 3).map((n: any, i: number) => {
              const cat = NOTE_CATEGORIES.find(c => c.id === n.category);
              return (
                <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 11 }}>
                  <span style={{ fontWeight: 800, color: cat?.color, minWidth: 14 }}>{i + 1}.</span>
                  <span style={{ flex: 1 }}>{n.text?.slice(0, 60)}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#007AFF' }}>{n.votes?.length || 0}</span>
                  <Icon name="ThumbsUp" size={9} color="#007AFF" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══ STEP 4: RIESGOS ═══ */}
      <div style={{ ...cardS, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: openRisks.length > 0 ? '#FF950012' : '#34C75912', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="AlertTriangle" size={16} color={openRisks.length > 0 ? '#FF9500' : '#34C759'} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase' }}>04 — Riesgos</div>
            <div style={{ fontSize: 12 }}><span style={{ fontWeight: 700, color: '#FF9500' }}>{openRisks.length} abiertos</span> · {mitigatedRisks.length} mitigados</div>
          </div>
        </div>
        {openRisks.slice(0, 3).map(r => {
          const tc = RISK_TYPES.find(t => t.id === r.type);
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 11, borderBottom: '1px solid #F9F9FB' }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: tc?.color || '#FF9500' }} />
              <span style={{ flex: 1, fontWeight: 500 }}>{r.title || r.text}</span>
              <span style={{ fontSize: 9, color: '#86868B' }}>{r.impact} / {r.prob}</span>
            </div>
          );
        })}
        {openRisks.length > 3 && <p style={{ fontSize: 10, color: '#86868B', marginTop: 4 }}>+ {openRisks.length - 3} más</p>}
      </div>

      {/* ═══ STEP 5: ACCIONABLES ═══ */}
      <div style={{ ...cardS, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: '#34C75912', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="CheckSquare" size={16} color="#34C759" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase' }}>05 — Accionables comprometidos</div>
            <div style={{ fontSize: 12 }}><span style={{ fontWeight: 700, color: '#34C759' }}>{actions.length} acciones</span> creadas</div>
          </div>
        </div>
        {actions.slice(0, 5).map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 11, borderBottom: '1px solid #F9F9FB' }}>
            <Icon name="CheckSquare" size={11} color="#007AFF" />
            <span style={{ flex: 1, fontWeight: 500 }}>{a.text}</span>
            {a.owner && <span style={{ fontSize: 9, color: '#007AFF' }}>{a.owner}</span>}
            {a.date && <span style={{ fontSize: 9, color: '#86868B' }}>{new Date(a.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</span>}
          </div>
        ))}
        {actions.length > 5 && <p style={{ fontSize: 10, color: '#86868B', marginTop: 4 }}>+ {actions.length - 5} más</p>}
      </div>

      {/* ═══ TIEMPOS ═══ */}
      <div style={{ ...cardS, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: '#007AFF12', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name="Clock" size={16} color="#007AFF" />
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase' }}>Tiempo por fase</div>
          <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 800, color: '#007AFF' }}>{fmtT(totalTime)}</span>
        </div>
        {PHASES.map((p, i) => {
          const secs = phaseTimes[i] || 0;
          const pct = totalTime > 0 ? (secs / totalTime) * 100 : 0;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, fontSize: 10 }}>
              <span style={{ minWidth: 14, color: '#86868B', fontWeight: 600 }}>{p.num}</span>
              <span style={{ minWidth: 75, color: '#6E6E73' }}>{p.label}</span>
              <div style={{ flex: 1, height: 5, background: '#F2F2F7', borderRadius: 3 }}><div style={{ width: `${pct}%`, height: '100%', background: '#007AFF', borderRadius: 3 }} /></div>
              <span style={{ minWidth: 45, textAlign: 'right', fontWeight: 600, color: '#007AFF' }}>{fmtT(secs)}</span>
              <span style={{ minWidth: 28, textAlign: 'right', color: '#C7C7CC' }}>{Math.round(pct)}%</span>
            </div>
          );
        })}
      </div>

      {/* ═══ RANKING ═══ */}
      {ranking.length > 0 && (
        <div style={{ ...cardS, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#5856D612', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="Trophy" size={16} color="#5856D6" />
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase' }}>Ranking de participación</div>
          </div>
          {ranking.map((r, i) => (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: i === 0 ? '#FFD70015' : i === 1 ? '#C0C0C010' : i === 2 ? '#CD7F3210' : 'transparent', marginBottom: 3 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#86868B', minWidth: 20 }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 12, fontWeight: i < 3 ? 700 : 500 }}>{r.name}</span>
              <div style={{ display: 'flex', gap: 6, fontSize: 10, color: '#86868B' }}>
                <span><Icon name="StickyNote" size={9} color="#007AFF" /> {r.notes}</span>
                <span><Icon name="ThumbsUp" size={9} color="#FF9500" /> {r.votes}</span>
                <span style={{ fontWeight: 700, color: '#5856D6' }}>{r.score} pts</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ CALIDAD + MEJORAS + FINALIZAR ═══ */}
      <div style={{ textAlign: 'center', padding: 20, ...cardS }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#86868B', marginBottom: 8 }}>CALIDAD DE LA RETRO</div>
        <div style={{ position: 'relative', width: 90, height: 90, margin: '0 auto 8px' }}>
          <svg viewBox="0 0 100 100" style={{ width: 90, height: 90 }}>
            <circle cx="50" cy="50" r="42" fill="none" stroke="#F2F2F7" strokeWidth="7" />
            <circle cx="50" cy="50" r="42" fill="none" stroke={qColor} strokeWidth="7"
              strokeDasharray={`${quality * 2.64} 264`} strokeLinecap="round" transform="rotate(-90 50 50)" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: qColor }}>{quality}</span>
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: qColor, marginBottom: 10 }}>{qLabel}</div>

        {/* What's missing */}
        {quality < 100 && (() => {
          const m: string[] = [];
          if (allNotes.length < 5) m.push(`Más notas (${allNotes.length}/5)`);
          if (totalVotes < 5) m.push(`Más votos (${totalVotes}/5)`);
          if (actions.length < 3) m.push(`Más acciones (${actions.length}/3)`);
          if (risks.length === 0) m.push('Revisar riesgos');
          if (participants.length < 3) m.push(`Más participantes (${participants.length}/3)`);
          if (!objective) m.push('Definir objetivo');
          if (tasksPct < 80) m.push(`Checklist ≥80% (${tasksPct}%)`);
          if (m.length === 0) return null;
          return (
            <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginBottom: 14 }}>
              {m.map((t, i) => <span key={i} style={{ fontSize: 9, padding: '2px 8px', borderRadius: 6, background: '#FF3B3008', color: '#FF3B30', fontWeight: 600 }}>{t}</span>)}
            </div>
          );
        })()}

        <div>
          <button onClick={onFinalize} disabled={finalizing}
            style={{ padding: '14px 40px', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${qColor}, #007AFF)`, color: '#FFF', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 20px ${qColor}40`, opacity: finalizing ? 0.6 : 1 }}>
            <Icon name="Sparkles" size={15} color="#FFF" /> {finalizing ? 'Finalizando...' : 'Finalizar retrospectiva'}
          </button>
        </div>
      </div>
    </div>
  );
}
