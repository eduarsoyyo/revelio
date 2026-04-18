// ═══ PHASE 6: RESUMEN — Complete retro dashboard + finalize ═══
import type { AppUser, Task, Risk } from '@app-types/index';
import { NOTE_CATEGORIES, PHASES } from '../../config/retro';
import { calculateCriticality } from '@domain/criticality';
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

export function P6Summary({ notes, actions, risks, phaseTimes, objective, objectiveStatus, tasks, user, onFinalize, finalizing }: P6SummaryProps) {
  const allNotes = (notes || []) as any[];
  const totalTime = Object.values(phaseTimes).reduce((s, t) => s + t, 0);
  const formatTime = (s: number) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;

  const participants = [...new Set(allNotes.map(n => n.userName))];
  const totalVotes = allNotes.reduce((s: number, n: any) => s + (n.votes?.length || 0), 0);
  const openRisks = risks.filter(r => r.status !== 'mitigated');
  const mitigatedRisks = risks.filter(r => r.status === 'mitigated');
  const criticalRisks = openRisks.filter(r => calculateCriticality(r.prob || 'media', r.impact || 'medio') === 'critical');
  const taskList = (tasks || []) as Array<{ done: boolean; text: string }>;
  const tasksDone = taskList.filter(t => t.done).length;
  const tasksPct = taskList.length > 0 ? Math.round(tasksDone / taskList.length * 100) : 0;
  const objStatus = objectiveStatus ? STATUS_MAP[objectiveStatus] : null;

  // Quality score (0-100)
  const quality = Math.min(100, Math.round(
    (allNotes.length >= 5 ? 20 : allNotes.length * 4) +
    (totalVotes >= 5 ? 15 : totalVotes * 3) +
    (actions.length >= 3 ? 20 : actions.length * 7) +
    (risks.length > 0 ? 10 : 0) +
    (participants.length >= 3 ? 15 : participants.length * 5) +
    (objective ? 10 : 0) +
    (tasksPct >= 80 ? 10 : tasksPct >= 50 ? 5 : 0)
  ));
  const qualityColor = quality >= 80 ? '#34C759' : quality >= 50 ? '#FF9500' : '#FF3B30';
  const qualityLabel = quality >= 80 ? 'Excelente' : quality >= 60 ? 'Buena' : quality >= 40 ? 'Aceptable' : 'Mejorable';

  // Top voted notes
  const topNotes = [...allNotes].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0)).slice(0, 5);

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { v: allNotes.length, l: 'Notas', c: '#007AFF', i: 'StickyNote' },
          { v: totalVotes, l: 'Votos', c: '#FF9500', i: 'ThumbsUp' },
          { v: actions.length, l: 'Acciones', c: '#34C759', i: 'CheckSquare' },
          { v: openRisks.length, l: 'Riesgos abiertos', c: '#FF9500', i: 'AlertTriangle' },
          { v: objStatus ? objStatus.label : 'Sin evaluar', l: 'Objetivo', c: objStatus?.color || '#86868B', i: objStatus?.icon || 'Target', isText: true },
        ].map(k => (
          <div key={k.l} style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: '10px 14px', textAlign: 'center', minWidth: 70 }}>
            <Icon name={k.i} size={18} color={k.c} />
            <div style={{ fontSize: (k as any).isText ? 11 : 20, fontWeight: 800, color: k.c, marginTop: 4 }}>{k.v}</div>
            <div style={{ fontSize: 9, color: '#86868B' }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Two columns: notes by category + progress */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        {/* Notes by category */}
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Notas por categoría</h4>
          {NOTE_CATEGORIES.map(cat => {
            const count = allNotes.filter(n => n.category === cat.id).length;
            const pct = allNotes.length > 0 ? (count / allNotes.length) * 100 : 0;
            return (
              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Icon name={CAT_ICONS[cat.id] || 'Circle'} size={12} color={cat.color} />
                <span style={{ fontSize: 11, fontWeight: 600, minWidth: 40 }}>{cat.label}</span>
                <div style={{ flex: 1, height: 8, background: '#F2F2F7', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: cat.color, borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: cat.color, minWidth: 20, textAlign: 'right' }}>{count}</span>
              </div>
            );
          })}
        </div>

        {/* Progress */}
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Progreso</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div style={{ textAlign: 'center', padding: 10, borderRadius: 10, background: tasksPct >= 80 ? '#34C75910' : '#FF950010' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: tasksPct >= 80 ? '#34C759' : '#FF9500' }}>{tasksDone}/{taskList.length}</div>
              <div style={{ fontSize: 9, color: '#86868B' }}>Checklist</div>
            </div>
            <div style={{ textAlign: 'center', padding: 10, borderRadius: 10, background: '#007AFF08' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#007AFF' }}>{actions.length}</div>
              <div style={{ fontSize: 9, color: '#86868B' }}>Acciones creadas</div>
            </div>
          </div>

          {/* Phase times */}
          <div style={{ borderTop: '1px solid #F2F2F7', paddingTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
              <Icon name="Clock" size={12} color="#007AFF" />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#007AFF' }}>Tiempo real por fase</span>
            </div>
            {PHASES.map((p, i) => {
              const secs = phaseTimes[i] || 0;
              const pct = totalTime > 0 ? (secs / totalTime) * 100 : 0;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, fontSize: 10 }}>
                  <span style={{ minWidth: 14, color: '#86868B', fontWeight: 600 }}>{p.num}</span>
                  <span style={{ minWidth: 70, color: '#6E6E73' }}>{p.label}</span>
                  <div style={{ flex: 1, height: 6, background: '#F2F2F7', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: '#007AFF', borderRadius: 3 }} />
                  </div>
                  <span style={{ minWidth: 50, textAlign: 'right', fontWeight: 700, color: '#007AFF' }}>{formatTime(secs)}</span>
                  <span style={{ minWidth: 30, textAlign: 'right', color: '#86868B' }}>{Math.round(pct)}%</span>
                </div>
              );
            })}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 10, borderTop: '1px solid #F2F2F7', paddingTop: 4 }}>
              <span style={{ minWidth: 84 }} />
              <span style={{ flex: 1 }}>Total sesión</span>
              <span style={{ fontWeight: 800, color: '#007AFF', fontSize: 12 }}>{formatTime(totalTime)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Risks summary */}
      {risks.length > 0 && (
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Icon name="AlertTriangle" size={14} color="#FF9500" />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Riesgos</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 11 }}>
            <span style={{ fontWeight: 700, color: '#FF9500' }}>{openRisks.length} abiertos</span>
            <span style={{ color: '#86868B' }}>{mitigatedRisks.length} mitigados</span>
          </div>
          {openRisks.slice(0, 3).map(r => (
            <div key={r.id} style={{ fontSize: 11, padding: '4px 0', borderBottom: '1px solid #F2F2F7', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 3, height: 16, borderRadius: 2, background: r.type === 'problema' ? '#FF3B30' : r.type === 'oportunidad' ? '#34C759' : '#FF9500' }} />
              <span style={{ fontWeight: 600 }}>{r.title || r.text}</span>
            </div>
          ))}
          {openRisks.length > 3 && <p style={{ fontSize: 10, color: '#86868B', marginTop: 4 }}>+ {openRisks.length - 3} más</p>}
        </div>
      )}

      {/* Top voted notes */}
      {topNotes.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Icon name="Flame" size={14} color="#FF9500" />
            <span style={{ fontSize: 13, fontWeight: 700 }}>Notas más votadas</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {topNotes.map((n: any, i: number) => {
              const cat = NOTE_CATEGORIES.find(c => c.id === n.category);
              return (
                <div key={n.id} style={{ background: cat?.bg || '#F2F2F7', borderRadius: 12, padding: '10px 12px', borderLeft: `3px solid ${cat?.color || '#86868B'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: cat?.color }}>{i + 1}.</span>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{n.text}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#86868B' }}>
                    <Icon name={CAT_ICONS[n.category] || 'Circle'} size={10} color={cat?.color || '#86868B'} />
                    {n.userName}
                    <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#FF9500' }}>
                      <Icon name="ThumbsUp" size={9} color="#FF9500" /> {n.votes?.length || 0}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quality score + Finalize */}
      <div style={{ textAlign: 'center', padding: 20, background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#86868B', marginBottom: 8 }}>CALIDAD DE LA RETRO</div>
        <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 12px' }}>
          <svg viewBox="0 0 100 100" style={{ width: 100, height: 100 }}>
            <circle cx="50" cy="50" r="42" fill="none" stroke="#F2F2F7" strokeWidth="8" />
            <circle cx="50" cy="50" r="42" fill="none" stroke={qualityColor} strokeWidth="8"
              strokeDasharray={`${quality * 2.64} 264`} strokeLinecap="round"
              transform="rotate(-90 50 50)" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: qualityColor }}>{quality}</span>
          </div>
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: qualityColor, marginBottom: 16 }}>{qualityLabel}</div>

        <button onClick={onFinalize} disabled={finalizing}
          style={{
            padding: '16px 48px', borderRadius: 16, border: 'none',
            background: `linear-gradient(135deg, ${qualityColor}, #007AFF)`,
            color: '#FFF', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            boxShadow: `0 4px 24px ${qualityColor}40`,
            opacity: finalizing ? 0.6 : 1,
          }}>
          <Icon name="Sparkles" size={16} color="#FFF" />
          {' '}{finalizing ? 'Finalizando...' : 'Finalizar retrospectiva'}
        </button>
      </div>
    </div>
  );
}
