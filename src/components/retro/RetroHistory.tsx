// ═══ RETRO HISTORY — Past retro sessions with metrics comparison ═══
import { useState, useEffect } from 'preact/hooks';
import { loadRetroHistory, loadMetrics } from '../../data/retros';
import { Icon } from '../common/Icon';

interface RetroHistoryProps {
  sala: string;
  onClose: () => void;
}

const fd = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

export function RetroHistory({ sala, onClose }: RetroHistoryProps) {
  const [retros, setRetros] = useState<Array<Record<string, unknown>>>([]);
  const [metrics, setMetrics] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      loadRetroHistory(sala),
      loadMetrics(sala),
    ]).then(([histR, met]) => {
      if (histR.ok) setRetros(histR.data as unknown as Array<Record<string, unknown>>);
      setMetrics(met);
      setLoading(false);
    });
  }, [sala]);

  const getMetric = (retro: Record<string, unknown>) => {
    const retroDate = (retro.created_at as string || '').slice(0, 10);
    return metrics.find(m => (m.date as string || '').slice(0, 10) === retroDate) || null;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', background: '#FFF', borderRadius: 20, width: '90%', maxWidth: 700, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)', padding: 24 }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Historial de retrospectivas</h2>
          <button onClick={onClose} style={{ border: 'none', background: '#F2F2F7', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16, color: '#86868B' }}>
            <Icon name="X" size={16} color="#86868B" />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando historial...</div>
        ) : retros.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>
            <Icon name="Archive" size={36} color="#C7C7CC" />
            <p style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>Sin retrospectivas cerradas</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>El historial se genera al finalizar una retrospectiva.</p>
          </div>
        ) : (
          <div>
            {/* Trend summary */}
            {metrics.length >= 2 && (() => {
              const last = metrics[0];
              const prev = metrics[1];
              const notesDiff = (last.notes as number || 0) - (prev.notes as number || 0);
              const actionsDiff = (last.actions as number || 0) - (prev.actions as number || 0);
              return (
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'Notas', value: last.notes as number, diff: notesDiff, color: '#007AFF' },
                    { label: 'Acciones', value: last.actions as number, diff: actionsDiff, color: '#34C759' },
                    { label: 'Participantes', value: last.participants as number, diff: 0, color: '#5856D6' },
                    { label: 'Votos', value: last.votes as number, diff: 0, color: '#FF9500' },
                  ].map(k => (
                    <div key={k.label} style={{ flex: 1, background: '#F9F9FB', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value || 0}</div>
                      <div style={{ fontSize: 10, color: '#86868B' }}>{k.label}</div>
                      {k.diff !== 0 && (
                        <div style={{ fontSize: 9, color: k.diff > 0 ? '#34C759' : '#FF3B30', fontWeight: 700 }}>
                          {k.diff > 0 ? '+' : ''}{k.diff} vs anterior
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Retro list */}
            {retros.map((retro, i) => {
              const metric = getMetric(retro);
              const data = retro.data as Record<string, unknown> || {};
              const notes = Array.isArray(data.notes) ? data.notes : [];
              const actions = Array.isArray(data.actions) ? data.actions : [];
              const risks = Array.isArray(data.risks) ? data.risks : [];
              const isExpanded = expanded === retro.id as string;

              return (
                <div key={retro.id as string} class="card-hover"
                  style={{ background: '#FFF', borderRadius: 12, border: '1.5px solid #E5E5EA', padding: '12px 16px', marginBottom: 8, cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}
                  onClick={() => setExpanded(isExpanded ? null : retro.id as string)}>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: '#5856D615', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="RotateCcw" size={14} color="#5856D6" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        Retro #{retros.length - i}
                        {metric?.objective && <span style={{ fontSize: 11, fontWeight: 400, color: '#86868B', marginLeft: 8 }}>— {(metric.objective as string).slice(0, 40)}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#86868B' }}>{fd(retro.created_at as string)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#6E6E73' }}>
                      <span><b style={{ color: '#007AFF' }}>{notes.length}</b> notas</span>
                      <span><b style={{ color: '#34C759' }}>{actions.length}</b> acciones</span>
                      <span><b style={{ color: '#FF9500' }}>{risks.length}</b> riesgos</span>
                    </div>
                    <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={14} color="#C7C7CC" />
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F2F2F7' }}>
                      {/* Metric cards */}
                      {metric && (
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                          {[
                            { l: 'Participantes', v: metric.participants, c: '#5856D6' },
                            { l: 'Votos', v: metric.votes, c: '#FF9500' },
                            { l: 'Acciones hechas', v: `${metric.actions_done || 0}/${metric.actions || 0}`, c: '#34C759' },
                            { l: 'Tareas sprint', v: `${metric.tasks_done || 0}/${metric.tasks_total || 0}`, c: '#007AFF' },
                          ].map(k => (
                            <div key={k.l} style={{ flex: 1, minWidth: 80, background: '#F9F9FB', borderRadius: 8, padding: '6px 10px', textAlign: 'center' }}>
                              <div style={{ fontSize: 16, fontWeight: 800, color: k.c as string }}>{k.v as string}</div>
                              <div style={{ fontSize: 9, color: '#86868B' }}>{k.l}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Participants */}
                      {metric?.participant_names && (
                        <div style={{ fontSize: 11, color: '#86868B', marginBottom: 8 }}>
                          <Icon name="Users" size={11} color="#86868B" /> {(metric.participant_names as string[]).join(', ')}
                        </div>
                      )}

                      {/* Actions summary */}
                      {actions.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', textTransform: 'uppercase', marginBottom: 4 }}>Acciones</div>
                          {actions.slice(0, 5).map((a: Record<string, unknown>) => (
                            <div key={a.id as string} style={{ fontSize: 11, padding: '3px 0', display: 'flex', gap: 6, alignItems: 'center' }}>
                              <Icon name={a.status === 'done' ? 'CheckCircle2' : 'Circle'} size={10} color={a.status === 'done' ? '#34C759' : '#C7C7CC'} />
                              <span style={{ color: a.status === 'done' ? '#86868B' : '#1D1D1F', textDecoration: a.status === 'done' ? 'line-through' : 'none' }}>
                                {(a.text as string || '').slice(0, 60)}
                              </span>
                            </div>
                          ))}
                          {actions.length > 5 && <div style={{ fontSize: 10, color: '#C7C7CC', marginTop: 2 }}>+{actions.length - 5} más</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
