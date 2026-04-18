// ═══ RISK DETAIL MODAL — Full risk editing dialog ═══
import { useState } from 'preact/hooks';
import type { Risk, Member, EscalationLevel } from '@app-types/index';
import { riskTitle, riskNumber, RISK_TYPES, ESCALATION_LEVELS } from '@domain/risks';
import { heatColor } from '@domain/criticality';
import { Icon } from '@components/common/Icon';
import { RichEditor } from '@components/common/RichEditor';

// ── Types ──

interface LinkedTask {
  id: string;
  text: string;
  status: string;
  owner?: string;
  date?: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface RiskDetailModalProps {
  risk: Risk;
  allRisks: Risk[];
  teamMembers: Member[];
  linkedTasks?: LinkedTask[];
  tags?: Tag[];
  availableTags?: Tag[];
  readOnly?: boolean;
  onSave: (risk: Risk) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
  onGoToTask?: (task: LinkedTask) => void;
  onLinkTask?: (taskId: string, riskId: string) => void;
  onUnlinkTask?: (taskId: string) => void;
  onToggleTag?: (tagId: string, entityType: string, entityId: string) => void;
  availableTasksToLink?: Array<{ id: string; text: string }>;
}

// ── Constants ──

const TYPE_OPTS = [
  { id: 'riesgo',      label: 'Riesgo',      icon: 'R' },
  { id: 'problema',    label: 'Problema',     icon: 'P' },
  { id: 'oportunidad', label: 'Oportunidad',  icon: 'O' },
] as const;

const IMPACT_OPTS = [
  { id: 'bajo',  label: 'Bajo' },
  { id: 'medio', label: 'Medio' },
  { id: 'alto',  label: 'Alto' },
] as const;

const PROB_OPTS = [
  { id: 'baja',  label: 'Baja' },
  { id: 'media', label: 'Media' },
  { id: 'alta',  label: 'Alta' },
] as const;

const STATUS_OPTS = [
  { id: 'open',      label: 'Abierto',  color: '#FF9500' },
  { id: 'mitigated', label: 'Mitigado', color: '#34C759' },
] as const;

const fd = (iso: string | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: '2-digit' }) : '';

// ── Helpers ──

const fieldStyle = { width: '100%', border: '1.5px solid #E5E5EA', borderRadius: 9, padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const, background: '#FFF' };

function FieldLabel({ text }: { text: string }) {
  return (
    <label style={{ fontSize: 10, color: '#86868B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 4 }}>
      {text}
    </label>
  );
}

// ── Component ──

export function RiskDetailModal({
  risk, allRisks, teamMembers, linkedTasks = [], tags = [], availableTags = [],
  readOnly = false, onSave, onClose, onDelete, onGoToTask, onLinkTask, onUnlinkTask,
  onToggleTag, availableTasksToLink = [],
}: RiskDetailModalProps) {
  const [f, setF] = useState<Risk>({ ...risk });

  // Domain calculations
  const typeKey = f.type || 'riesgo';
  const num = riskNumber(f as Risk, allRisks);
  const color = typeKey === 'problema' ? '#FF3B30' : heatColor(f.impact || 'medio', f.prob || 'media');

  const handleSave = () => {
    const saved = { ...f, text: f.title || f.text };
    onSave(saved);
    onClose();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.18)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} />
      <div style={{ position: 'relative', background: '#FFF', borderRadius: 20, width: '90%', maxWidth: 720, maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 12px 48px rgba(0,0,0,.12)', animation: 'fadeIn .2s ease', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #F2F2F7', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: '#FAFAFA' }}>
          <span style={{ fontSize: 14, fontWeight: 800, color, background: color + '15', padding: '4px 10px', borderRadius: 8 }}>{num}</span>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color, background: color + '12', padding: '2px 8px', borderRadius: 6 }}>
              {TYPE_OPTS.find(t => t.id === typeKey)?.icon} {TYPE_OPTS.find(t => t.id === typeKey)?.label}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: f.status === 'mitigated' ? '#34C759' : '#FF9500', background: f.status === 'mitigated' ? '#F0FFF4' : '#FFF8EB', padding: '2px 8px', borderRadius: 6 }}>
              {f.status === 'mitigated' ? 'Mitigado' : 'Abierto'}
            </span>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: '#F2F2F7', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: '#86868B' }}>✕</button>
        </div>

        {/* Body: 2 columns */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.7 : 1 }}>

          {/* Left: editable fields */}
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <FieldLabel text="Título" />
              <input value={f.title || f.text || ''} onInput={e => setF({ ...f, title: (e.target as HTMLInputElement).value })}
                placeholder="Título breve del registro"
                style={{ ...fieldStyle, fontSize: 15, fontWeight: 700, padding: '10px 14px', borderRadius: 10 }} />
            </div>
            <div>
              <FieldLabel text="Descripción" />
              <RichEditor value={f.description || ''} onChange={v => setF({ ...f, description: v })} placeholder="Descripción detallada, contexto e impacto..." />
            </div>
            <div>
              <FieldLabel text={typeKey === 'oportunidad' ? 'Plan de explotación' : 'Plan de mitigación'} />
              <RichEditor value={f.mitigation || ''} onChange={v => setF({ ...f, mitigation: v })} placeholder={typeKey === 'oportunidad' ? '¿Cómo aprovechar esta oportunidad?' : '¿Cómo se va a mitigar este riesgo?'} />
            </div>

            {/* Linked tasks */}
            <div>
              <FieldLabel text="Tareas vinculadas" />
              {linkedTasks.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                  {linkedTasks.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: '#F9F9FB', border: '1.5px solid #E5E5EA' }}>
                      <div onClick={() => { if (onGoToTask) onGoToTask(a); onClose(); }} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, textDecoration: a.status === 'done' ? 'line-through' : 'none', color: '#007AFF' }}>{a.text}</div>
                        <div style={{ fontSize: 10, color: '#86868B', marginTop: 1 }}>{a.owner || 'Sin asignar'}{a.date ? ` · ${fd(a.date)}` : ''}</div>
                      </div>
                      {onUnlinkTask && (
                        <button onClick={e => { e.stopPropagation(); onUnlinkTask(a.id); }}
                          style={{ border: 'none', background: '#FF3B3010', color: '#FF3B30', fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 6, cursor: 'pointer' }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {onLinkTask && availableTasksToLink.length > 0 && (
                <select
                  onChange={e => { const v = (e.target as HTMLSelectElement).value; if (v) { onLinkTask(v, risk.id); (e.target as HTMLSelectElement).value = ''; } }}
                  style={{ ...fieldStyle, border: '1.5px dashed #007AFF40', color: '#007AFF', background: '#F0F7FF', cursor: 'pointer', borderRadius: 9 }}
                >
                  <option value="">+ Vincular tarea existente…</option>
                  {availableTasksToLink.map(a => <option key={a.id} value={a.id}>{a.text.slice(0, 50)}</option>)}
                </select>
              )}
            </div>

            {/* Tags */}
            {onToggleTag && (tags.length > 0 || availableTags.length > 0) && (
              <div>
                <FieldLabel text="Etiquetas" />
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {tags.map(t => (
                    <span key={t.id} onClick={() => onToggleTag(t.id, 'risk', risk.id)}
                      style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: t.color + '15', color: t.color, border: `1.5px solid ${t.color}40`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {t.name} <span style={{ fontSize: 9, opacity: 0.6 }}>✕</span>
                    </span>
                  ))}
                  {availableTags.map(t => (
                    <span key={t.id} onClick={() => onToggleTag(t.id, 'risk', risk.id)}
                      style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, border: `1.5px dashed ${t.color}50`, color: t.color, cursor: 'pointer' }}>
                      + {t.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div style={{ fontSize: 10, color: '#C7C7CC', display: 'flex', gap: 16, paddingTop: 8, borderTop: '1px solid #F2F2F7' }}>
              {f.createdAt && <span>Identificado: {fd(f.createdAt)}</span>}
              {f.deadline && <span>Resolución: {fd(f.deadline)}</span>}
            </div>
          </div>

          {/* Right sidebar: metadata selectors */}
          <div style={{ width: 220, borderLeft: '1px solid #E5E5EA', padding: '16px', overflowY: 'auto', background: '#FAFAFA', display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
            <div>
              <FieldLabel text="Estado" />
              <select value={f.status || 'open'} onChange={e => setF({ ...f, status: (e.target as HTMLSelectElement).value as 'open' | 'mitigated' })} style={fieldStyle}>
                {STATUS_OPTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel text="Tipo" />
              <select value={f.type || 'riesgo'} onChange={e => setF({ ...f, type: (e.target as HTMLSelectElement).value as Risk['type'] })} style={fieldStyle}>
                {TYPE_OPTS.map(t => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel text="Responsable" />
              <select value={f.owner || ''} onChange={e => setF({ ...f, owner: (e.target as HTMLSelectElement).value })} style={fieldStyle}>
                <option value="">— Sin asignar —</option>
                {f.owner && !teamMembers.some(m => m.name === f.owner) && <option value={f.owner}>{f.owner}</option>}
                {teamMembers.map(m => <option key={m.id} value={m.name}>{m.avatar || '👤'} {m.name}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel text="Impacto" />
              <select value={f.impact || 'medio'} onChange={e => setF({ ...f, impact: (e.target as HTMLSelectElement).value as Risk['impact'] })} style={fieldStyle}>
                {IMPACT_OPTS.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
              </select>
            </div>
            {typeKey !== 'problema' && (
              <div>
                <FieldLabel text="Probabilidad" />
                <select value={f.prob || 'media'} onChange={e => setF({ ...f, prob: (e.target as HTMLSelectElement).value as Risk['prob'] })} style={fieldStyle}>
                  {PROB_OPTS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            )}
            <div>
              <FieldLabel text="Fecha identificación" />
              <input type="date" value={(f.createdAt || '').slice(0, 10)} onInput={e => setF({ ...f, createdAt: (e.target as HTMLInputElement).value })} style={fieldStyle} />
            </div>
            <div>
              <FieldLabel text="Fecha resolución" />
              <input type="date" value={f.deadline || ''} onInput={e => setF({ ...f, deadline: (e.target as HTMLInputElement).value })} style={fieldStyle} />
            </div>
            <div style={{ borderTop: '1px solid #E5E5EA', paddingTop: 10 }}>
              <FieldLabel text="Escalado" />
              <select
                value={f.escalation?.level || 'equipo'}
                onChange={e => {
                  const lvl = (e.target as HTMLSelectElement).value as EscalationLevel;
                  const label = ESCALATION_LEVELS.find(l => l.id === lvl)?.label || lvl;
                  setF({ ...f, escalation: { ...(f.escalation || {}), level: lvl, levelLabel: label, escalatedAt: lvl !== 'equipo' ? (f.escalation?.escalatedAt || new Date().toISOString()) : undefined } });
                }}
                style={fieldStyle}
              >
                {ESCALATION_LEVELS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
              {(f.escalation?.level || 'equipo') !== 'equipo' && (
                <>
                  <div style={{ marginTop: 6 }}>
                    <FieldLabel text="Fecha escalado" />
                    <input type="date" value={(f.escalation?.escalatedAt || '').slice(0, 10)}
                      onInput={e => setF({ ...f, escalation: { ...(f.escalation || {}), escalatedAt: (e.target as HTMLInputElement).value } })}
                      style={fieldStyle} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #F2F2F7', display: 'flex', gap: 8, justifyContent: 'space-between', flexShrink: 0, background: '#FAFAFA' }}>
          {readOnly ? (
            <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#86868B', fontStyle: 'italic', padding: '8px 0' }}>
              Solo lectura — no tienes permisos en este nivel de escalado
            </div>
          ) : (
            <>
              <button onClick={() => onDelete(risk.id)}
                style={{ padding: '8px 16px', borderRadius: 10, border: '1.5px solid #FF3B3015', background: '#FFF5F5', color: '#FF3B30', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Eliminar
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose}
                  style={{ padding: '8px 20px', borderRadius: 10, border: '1.5px solid #E5E5EA', background: '#FFF', fontSize: 12, fontWeight: 500, cursor: 'pointer', color: '#6E6E73' }}>
                  Cancelar
                </button>
                <button onClick={handleSave}
                  style={{ padding: '8px 24px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#007AFF,#5856D6)', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Guardar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
