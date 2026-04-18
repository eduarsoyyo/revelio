// ═══ PHASE 5: RIESGOS — Heatmap + register + notes-to-risk conversion ═══
import { useState } from 'preact/hooks';
import type { AppUser, Risk } from '@app-types/index';
import type { RetroNote } from '../../types/index';
import { RISK_TYPES, riskNumber } from '@domain/risks';
import { calculateCriticality } from '@domain/criticality';
import { NOTE_CATEGORIES } from '../../config/retro';
import { Heatmap } from '@components/risks/Heatmap';
import { RiskDetailModal } from '@components/risks/RiskDetailModal';
import { Icon } from '@components/common/Icon';

interface P5RisksProps {
  risks: Risk[];
  onUpdateRisks: (risks: Risk[]) => void;
  notes: unknown[];
  user: AppUser;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const CAT_ICONS: Record<string, string> = { good: 'ThumbsUp', bad: 'ThumbsDown', start: 'Rocket', stop: 'Square' };

export function P5Risks({ risks, onUpdateRisks, notes, user }: P5RisksProps) {
  const [detailRisk, setDetailRisk] = useState<Risk | null>(null);

  const allNotes = (notes as RetroNote[]) || [];
  // Notes that could become risks (bad/stop without linked risk)
  const riskableNotes = allNotes
    .filter(n => n.category === 'bad' || n.category === 'stop')
    .filter(n => !risks.some(r => (r as any).fromNote === n.id));

  const openRisks = risks.filter(r => r.status !== 'mitigated');
  const mitigated = risks.filter(r => r.status === 'mitigated').length;
  const critical = openRisks.filter(r => calculateCriticality(r.prob || 'media', r.impact || 'medio') === 'critical').length;

  const createRisk = (type: string, fromNote?: RetroNote) => {
    const risk: Risk = {
      id: uid(),
      title: fromNote?.text || '',
      text: fromNote?.text || '',
      description: '',
      type: type as Risk['type'],
      impact: 'medio',
      prob: 'media',
      mitigation: '',
      owner: user.name,
      status: 'open',
      escalation: null,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      fromNote: fromNote?.id,
    } as Risk;
    setDetailRisk(risk);
  };

  const saveRisk = (risk: Risk) => {
    const exists = risks.some(r => r.id === risk.id);
    if (exists) onUpdateRisks(risks.map(r => r.id === risk.id ? risk : r));
    else onUpdateRisks([...risks, risk]);
  };

  const deleteRisk = (id: string) => {
    onUpdateRisks(risks.filter(r => r.id !== id));
  };

  const updateRisk = (id: string, patch: Partial<Risk>) => {
    onUpdateRisks(risks.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  return (
    <div>
      {/* KPIs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { v: openRisks.length, l: 'Abiertos', c: '#FF9500' },
          { v: mitigated, l: 'Mitigados', c: '#34C759' },
          { v: critical, l: 'Críticos', c: critical > 0 ? '#FF3B30' : '#86868B' },
        ].map(k => (
          <div key={k.l} style={{ padding: '6px 12px', background: '#FFF', borderRadius: 10, border: '1.5px solid #E5E5EA', textAlign: 'center', minWidth: 50 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: k.c }}>{k.v}</div>
            <div style={{ fontSize: 9, color: '#86868B' }}>{k.l}</div>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {RISK_TYPES.map(t => (
            <button key={t.id} onClick={() => createRisk(t.id)}
              style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${t.color}30`, background: '#FFF', fontSize: 11, fontWeight: 600, color: t.color, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name="Plus" size={10} color={t.color} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main layout: heatmap left + register right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        {/* Heatmap */}
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 }}>
          <Heatmap risks={risks} onClickRisk={r => setDetailRisk({ ...r })} />
        </div>

        {/* Risk register */}
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Registro ({risks.length})</h4>
          {risks.length === 0 && <p style={{ fontSize: 11, color: '#C7C7CC', textAlign: 'center', padding: 16 }}>Sin riesgos. Crea uno o convierte una nota.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflowY: 'auto' }}>
            {risks.map(r => {
              const tc = RISK_TYPES.find(t => t.id === r.type);
              return (
                <div key={r.id} onClick={() => setDetailRisk({ ...r })}
                  style={{ padding: '8px 10px', borderRadius: 8, borderLeft: `3px solid ${tc?.color || '#FF9500'}`, background: '#FAFAFA', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: tc?.color }}>{riskNumber(r, risks)}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{r.title || r.text}</span>
                    {r.owner && r.owner !== 'Sin asignar' && <span style={{ fontSize: 9, color: '#007AFF' }}>{r.owner}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                    {['alto', 'medio', 'bajo'].map(imp => (
                      <button key={imp} onClick={e => { e.stopPropagation(); updateRisk(r.id, { impact: imp as Risk['impact'] }); }}
                        style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, fontWeight: 600, border: r.impact === imp ? 'none' : '1px solid #E5E5EA', background: r.impact === imp ? (imp === 'alto' ? '#FF3B30' : imp === 'medio' ? '#FF9500' : '#34C759') : '#FFF', color: r.impact === imp ? '#FFF' : '#86868B', cursor: 'pointer' }}>
                        {imp.charAt(0).toUpperCase() + imp.slice(1)}{r.impact === imp ? ` ${r.impact === 'alto' ? 1 : r.impact === 'medio' ? 2 : 3}` : ''}
                      </button>
                    ))}
                    {r.type !== 'problema' && <>
                      <span style={{ fontSize: 8, color: '#C7C7CC', alignSelf: 'center' }}>|</span>
                      {['alta', 'media', 'baja'].map(prob => (
                        <button key={prob} onClick={e => { e.stopPropagation(); updateRisk(r.id, { prob: prob as Risk['prob'] }); }}
                          style={{ padding: '2px 6px', borderRadius: 4, fontSize: 8, fontWeight: 600, border: r.prob === prob ? 'none' : '1px solid #E5E5EA', background: r.prob === prob ? (prob === 'alta' ? '#FF3B30' : prob === 'media' ? '#FF9500' : '#34C759') : '#FFF', color: r.prob === prob ? '#FFF' : '#86868B', cursor: 'pointer' }}>
                          {prob.charAt(0).toUpperCase() + prob.slice(1)}{r.prob === prob ? ` ${r.prob === 'alta' ? 1 : r.prob === 'media' ? 2 : 3}` : ''}
                        </button>
                      ))}
                    </>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Notes to convert */}
      <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Notas de la retro</h4>
        <p style={{ fontSize: 10, color: '#86868B', marginBottom: 10 }}>Clic para convertir en riesgo, oportunidad o problema</p>
        {riskableNotes.length === 0 && allNotes.length > 0 && <p style={{ fontSize: 11, color: '#34C759', textAlign: 'center', padding: 8 }}>Todas las notas negativas ya tienen riesgo asociado</p>}
        {riskableNotes.length === 0 && allNotes.length === 0 && <p style={{ fontSize: 11, color: '#C7C7CC', textAlign: 'center', padding: 8 }}>Sin notas de la retro</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {allNotes.map((n: RetroNote) => {
            const cat = NOTE_CATEGORIES.find(c => c.id === n.category);
            const hasRisk = risks.some(r => (r as any).fromNote === n.id);
            return (
              <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: hasRisk ? '#F0FFF4' : '#FAFAFA', border: `1px solid ${hasRisk ? '#34C75920' : '#E5E5EA'}` }}>
                <Icon name={CAT_ICONS[n.category] || 'Circle'} size={12} color={cat?.color || '#86868B'} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12 }}>{n.text}</div>
                  <div style={{ fontSize: 9, color: '#86868B' }}>{n.userName}</div>
                </div>
                <span style={{ fontSize: 10, color: '#86868B' }}>{n.votes?.length || 0}</span>
                <Icon name="ThumbsUp" size={10} color="#C7C7CC" />
                {hasRisk ? (
                  <span style={{ fontSize: 9, color: '#34C759', fontWeight: 600 }}>Vinculada</span>
                ) : (
                  <div style={{ display: 'flex', gap: 2 }}>
                    {RISK_TYPES.map(t => (
                      <button key={t.id} onClick={() => createRisk(t.id, n)}
                        title={`Crear ${t.label}`}
                        style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${t.color}30`, background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="Plus" size={9} color={t.color} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Modal (same as risks section) */}
      {detailRisk && (
        <RiskDetailModal
          risk={detailRisk}
          allRisks={risks}
          teamMembers={[]}
          readOnly={false}
          onSave={r => { saveRisk(r); setDetailRisk(null); }}
          onClose={() => setDetailRisk(null)}
          onDelete={id => { deleteRisk(id); setDetailRisk(null); }}
        />
      )}
    </div>
  );
}
