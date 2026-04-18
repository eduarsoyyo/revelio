// ═══ HEATMAP — Risk matrix with bubble dots + tooltips + escalation ═══
import { useState } from 'preact/hooks';
import type { Risk } from '@app-types/index';
import { calculateCriticality, CRIT_COLORS } from '@domain/criticality';
import { riskTitle, riskNumber } from '@domain/risks';

interface HeatmapProps {
  risks: Risk[];
  onClickRisk?: (risk: Risk) => void;
}

const PROBS = ['alta', 'media', 'baja'] as const;
const IMPACTS = ['bajo', 'medio', 'alto'] as const;
const TYPE_COLORS: Record<string, string> = { riesgo: '#FF9500', problema: '#FF3B30', oportunidad: '#34C759' };
const TYPE_PREFIX: Record<string, string> = { riesgo: 'R', problema: 'P', oportunidad: 'O' };
const ESC_COLORS: Record<string, string> = { jp: '#FF9500', sm: '#FF3B30', dt: '#5856D6' };

export function Heatmap({ risks, onClickRisk }: HeatmapProps) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const openRisks = risks.filter(r => r.status !== 'mitigated');

  const getCell = (prob: string, impact: string) =>
    openRisks.filter(r => (r.prob || 'media') === prob && (r.impact || 'medio') === impact);

  const ROW_LABELS: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };

  return (
    <div>
      <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Mapa de calor de riesgos</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '24px 36px repeat(3, 1fr)', gap: 3 }}>
        {/* Y-axis label */}
        <div style={{ gridColumn: '1', gridRow: '1 / 5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 9, color: '#86868B', writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: 700 }}>PROBABILIDAD</span>
        </div>

        {/* Empty top-left corner */}
        <div style={{ gridColumn: '2', gridRow: '1' }} />

        {/* Column headers (Impacto) */}
        {['Bajo', 'Medio', 'Alto'].map(h => (
          <div key={h} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#86868B', paddingBottom: 4 }}>{h}</div>
        ))}

        {/* Cells with row labels */}
        {PROBS.flatMap((prob, pi) => [
          /* Row label */
          <div key={`label-${prob}`} style={{ gridColumn: '2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: prob === 'alta' ? '#FF3B30' : prob === 'media' ? '#FF9500' : '#34C759' }}>{ROW_LABELS[prob]}</span>
          </div>,
          /* 3 cells for this probability row */
          ...IMPACTS.map(impact => {
            const sector = calculateCriticality(prob, impact);
            const hc = CRIT_COLORS[sector];
            const cellRisks = getCell(prob, impact);
            return (
              <div key={`${prob}-${impact}`}
                style={{ background: hc + '18', border: `1.5px solid ${hc}30`, borderRadius: 10, minHeight: 90, padding: 8, display: 'flex', flexWrap: 'wrap', gap: 4, alignContent: 'flex-start' }}>
                {cellRisks.map(r => {
                  const rn = riskNumber(r, risks);
                  const type = r.type || 'riesgo';
                  const prefix = TYPE_PREFIX[type] || 'R';
                  const dc = TYPE_COLORS[type] || '#FF9500';
                  const hasMit = !!(r.mitigation?.trim());
                  const escLevel = r.escalation?.level;
                  const escColor = escLevel && escLevel !== 'equipo' ? ESC_COLORS[escLevel] || '#FF9500' : null;
                  const isHovered = hoverId === r.id;

                  return (
                    <div key={r.id} style={{ position: 'relative' }}
                      onMouseEnter={() => setHoverId(r.id)}
                      onMouseLeave={() => setHoverId(null)}>
                      <div onClick={() => onClickRisk?.({ ...r })}
                        style={{
                          width: 30, height: 30, borderRadius: '50%', background: dc, color: '#FFF',
                          fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: '2.5px solid #FFF', boxShadow: `0 2px 8px ${dc}40`, cursor: 'pointer',
                          outline: escColor ? `2.5px dashed ${escColor}` : 'none', outlineOffset: '2px',
                        }}>
                        {rn}
                      </div>
                      {isHovered && (
                        <div style={{
                          position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
                          background: '#FFF', color: '#1D1D1F', borderRadius: 12, padding: '10px 12px', fontSize: 11,
                          zIndex: 9999, width: 210, boxShadow: '0 8px 28px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.05)',
                          pointerEvents: 'none', lineHeight: 1.5,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                            <div style={{ width: 14, height: 14, borderRadius: 7, background: dc, color: '#FFF', fontSize: 7, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{prefix}</div>
                            <span style={{ fontWeight: 700, color: dc }}>{rn}</span>
                            <span style={{ fontSize: 10, color: '#86868B' }}>{type === 'oportunidad' ? 'Oportunidad' : type === 'problema' ? 'Problema' : 'Riesgo'}</span>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2, color: '#1D1D1F' }}>{riskTitle(r)}</div>
                          {r.description && <div style={{ fontSize: 10, color: '#6E6E73', marginBottom: 4 }}>{r.description.slice(0, 80)}</div>}
                          {r.owner && r.owner !== 'Sin asignar' && <div style={{ fontSize: 10, color: '#007AFF' }}>👤 {r.owner}</div>}
                          {hasMit && <div style={{ fontSize: 10, color: '#34C759' }}>🛡️ Mitigación definida</div>}
                          {r.escalation?.levelLabel && <div style={{ fontSize: 10, color: '#FF9500' }}>↑ Escalado: {r.escalation.levelLabel}</div>}
                          <div style={{ position: 'absolute', bottom: -6, left: '50%', width: 12, height: 12, background: '#FFF', borderRadius: 2, transform: 'translateX(-50%) rotate(45deg)', boxShadow: '2px 2px 4px rgba(0,0,0,.05)' }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          }),
        ])}

        {/* X-axis label */}
        <div style={{ gridColumn: '3 / 6', textAlign: 'center', paddingTop: 4 }}>
          <span style={{ fontSize: 9, color: '#86868B', fontWeight: 700 }}>IMPACTO</span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12 }}>
        {[
          { label: 'Riesgo', color: '#FF9500' },
          { label: 'Problema', color: '#FF3B30' },
          { label: 'Oportunidad', color: '#34C759' },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: l.color }} />
            <span style={{ fontSize: 10, color: '#86868B' }}>{l.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 12, height: 12, borderRadius: 6, border: '2px dashed #FF9500' }} />
          <span style={{ fontSize: 10, color: '#86868B' }}>Escalado</span>
        </div>
      </div>
    </div>
  );
}
