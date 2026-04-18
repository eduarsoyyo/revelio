// ═══ ESCALADO PANEL — Risk escalation management by level ═══
import { useState } from 'preact/hooks';
import type { Risk, Member, AppUser } from '@app-types/index';
import { riskTitle, riskNumber, ESCALATION_LEVELS, nextEscalationLevel, prevEscalationLevel } from '@domain/risks';
import { Icon } from '@components/common/Icon';

// ── Types ──

interface AlertBadge {
  type: string;
  label: string;
  color: string;
}

interface EscaladoPanelProps {
  risks: Risk[];
  user: AppUser;
  actions?: Array<{ id: string; riskId?: string | null }>;
  onUpdate: (id: string, patch: Partial<Risk>) => void;
  onOpenDetail: (risk: Risk) => void;
  getAlerts?: (risk: Risk) => AlertBadge[];
}

// ── Helpers ──

const fd = (iso: string | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '';

// ── Component ──

export function EscaladoPanel({
  risks,
  user,
  actions = [],
  onUpdate,
  onOpenDetail,
  getAlerts,
}: EscaladoPanelProps) {
  const isSM = user?._isAdmin || user?.isSuperuser;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const escalateNext = (r: Risk) => {
    const next = nextEscalationLevel(r.escalation?.level);
    if (next) {
      onUpdate(r.id, {
        escalation: {
          ...(r.escalation || {}),
          level: next.id,
          levelLabel: next.label,
          escalatedAt: new Date().toISOString(),
        },
      });
    }
  };

  const deescalate = (r: Risk) => {
    const prev = prevEscalationLevel(r.escalation?.level || 'equipo');
    if (prev) {
      onUpdate(r.id, {
        escalation: { ...(r.escalation || {}), level: prev.id, levelLabel: prev.label },
      });
    } else {
      onUpdate(r.id, { escalation: null });
    }
  };

  const resolveRisk = (r: Risk) => {
    onUpdate(r.id, { status: 'mitigated' });
  };

  return (
    <div>
      {ESCALATION_LEVELS.map(level => {
        const items = risks.filter(
          r => r.status !== 'mitigated' && (r.escalation?.level || 'equipo') === level.id,
        );
        const isCollapsed = collapsed[level.id];

        return (
          <div key={level.id} style={{ marginBottom: 12 }}>
            {/* Level header */}
            <div
              onClick={() => setCollapsed(prev => ({ ...prev, [level.id]: !prev[level.id] }))}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0',
                cursor: 'pointer', borderBottom: `2px solid ${level.color}30`,
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: 5, background: level.color }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: level.color, flex: 1 }}>{level.label}</span>
              <span style={{ fontSize: 11, color: '#86868B' }}>{items.length}</span>
              <span style={{ fontSize: 10, color: '#C7C7CC' }}>{isCollapsed ? '▶' : '▼'}</span>
            </div>

            {/* Level items */}
            {!isCollapsed && (
              <div style={{ paddingTop: 6 }}>
                {items.length === 0 && (
                  <p style={{ fontSize: 11, color: '#C7C7CC', padding: '8px 0', fontStyle: 'italic' }}>
                    Sin elementos
                  </p>
                )}
                {items.map(r => {
                  const num = riskNumber(r, risks);
                  const hasMit = !!(r.mitigation?.trim());
                  const hasLinked = actions.some(a => a.riskId === r.id);
                  const nextLvl = nextEscalationLevel(level.id);
                  const canEdit = isSM || level.id === 'equipo';
                  const alerts = getAlerts ? getAlerts(r) : [];

                  return (
                    <div
                      key={r.id}
                      onClick={() => onOpenDetail({ ...r, _readOnly: !canEdit } as Risk)}
                      style={{
                        background: alerts.length > 0 ? '#FFFBF5' : '#FFF',
                        borderRadius: 12,
                        border: `1.5px solid ${alerts.length > 0 ? '#FF950030' : '#E5E5EA'}`,
                        borderLeft: `4px solid ${level.color}`,
                        padding: '10px 14px',
                        marginBottom: 5,
                        cursor: 'pointer',
                      }}
                    >
                      {/* Risk header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: level.color }}>{num}</span>
                        <span style={{ fontSize: 13, flex: 1, fontWeight: 600 }}>{riskTitle(r)}</span>
                        {hasMit && <span title="Mitigación" style={{ fontSize: 9, background: '#34C75915', color: '#34C759', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}><Icon name="Shield" size={9} color="#34C759" /></span>}
                        {hasLinked && <span title="Tareas vinculadas" style={{ fontSize: 9, background: '#007AFF15', color: '#007AFF', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}><Icon name="Link" size={9} color="#007AFF" /></span>}
                        {level.id !== 'equipo' && <span style={{ fontSize: 9, background: level.color + '15', color: level.color, padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>Escalado</span>}
                      </div>

                      {/* Alerts */}
                      {alerts.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                          {alerts.map(a => (
                            <span key={a.type} style={{ fontSize: 9, fontWeight: 700, color: '#FFF', background: a.color, padding: '2px 7px', borderRadius: 10 }}>
                              {a.label}
                            </span>
                          ))}
                          {nextLvl && canEdit && (
                            <span style={{ fontSize: 9, fontWeight: 600, color: '#FF9500', fontStyle: 'italic' }}>Se sugiere escalar</span>
                          )}
                        </div>
                      )}

                      {/* Actions row */}
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 10 }}>
                        {r.escalation?.escalatedAt && <span style={{ color: '#86868B' }}>Escalado {fd(r.escalation.escalatedAt)}</span>}
                        {r.owner && r.owner !== 'Sin asignar' && <span style={{ color: '#007AFF', fontWeight: 600 }}>{r.owner}</span>}
                        {canEdit && (
                          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                            <button
                              onClick={e => { e.stopPropagation(); resolveRisk(r); }}
                              style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, border: '1px solid #34C75930', background: '#34C75910', color: '#34C759', cursor: 'pointer' }}
                            >
                              Resolver
                            </button>
                            {nextLvl && (
                              <button
                                onClick={e => { e.stopPropagation(); escalateNext(r); }}
                                style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, border: `1px solid ${nextLvl.color}30`, background: nextLvl.color + '10', color: nextLvl.color, cursor: 'pointer' }}
                              >
                                ↑ {nextLvl.label}
                              </button>
                            )}
                            {level.id !== 'equipo' && (
                              <button
                                onClick={e => { e.stopPropagation(); deescalate(r); }}
                                style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6, border: '1px solid #E5E5EA', background: '#F9F9FB', color: '#86868B', cursor: 'pointer' }}
                              >
                                ↓
                              </button>
                            )}
                          </div>
                        )}
                        {!canEdit && <span style={{ marginLeft: 'auto', fontSize: 9, color: '#C7C7CC', fontStyle: 'italic' }}>Solo lectura</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
