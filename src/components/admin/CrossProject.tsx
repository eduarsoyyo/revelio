// ═══ CROSS-PROJECT — Overload alerts + resource allocation matrix + consultant view ═══
import { useState, useEffect, useMemo } from 'preact/hooks';
import { loadCrossProjectData, type CrossProjectData, type ConsultantView } from '../../services/crossProject';
import { Icon } from '../common/Icon';

const MO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// Dedication for a project in a specific month (weighted avg of active days)
function dedForMonth(periods: ConsultantView['periods'], sala: string, year: number, month: number): number {
  const projPeriods = periods.filter(p => p.sala === sala);
  if (projPeriods.length === 0) return 0;
  // If single open-ended period, return its dedication
  if (projPeriods.length === 1 && !projPeriods[0].start_date && !projPeriods[0].end_date) return projPeriods[0].dedication;
  // Count business days in month, find active periods
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let totalDed = 0;
  let bDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    if (dt.getDay() === 0 || dt.getDay() === 6) continue;
    bDays++;
    const ds = dt.toISOString().slice(0, 10);
    for (const p of projPeriods) {
      const s = p.start_date || '2000-01-01';
      const e = p.end_date || '2099-12-31';
      if (ds >= s && ds <= e) { totalDed += p.dedication; break; }
    }
  }
  return bDays > 0 ? totalDed / bDays : 0;
}

export function CrossProject() {
  const [data, setData] = useState<CrossProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [matrixMode, setMatrixMode] = useState<'pct' | 'fte' | 'hours'>('pct');
  const yr = new Date().getFullYear();
  const MONTHLY_BASE_HOURS = 176; // ~22 days × 8h

  useEffect(() => {
    loadCrossProjectData().then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#86868B' }}>Cargando datos cross-proyecto...</div>;
  if (!data) return null;

  const { overloads, crossRisks, memberProjects, consultants } = data;
  const allProjects = [...new Set(memberProjects.flatMap(mp => mp.projects.map(p => p.sala)))];
  const projectNames: Record<string, string> = {};
  memberProjects.forEach(mp => mp.projects.forEach(p => { projectNames[p.sala] = p.name; }));

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Cross-proyecto</h3>
      <p style={{ fontSize: 12, color: '#86868B', marginBottom: 16 }}>Alertas de sobrecarga y riesgos cruzados entre proyectos</p>

      {/* Overload alerts */}
      {overloads.length > 0 && (
        <div style={{ background: '#FFF5F5', borderRadius: 14, border: '1.5px solid #FF3B3020', padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Icon name="AlertTriangle" size={16} color="#FF3B30" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#FF3B30' }}>Sobrecarga detectada ({overloads.length})</span>
          </div>
          {overloads.map(o => (
            <div key={o.memberId} class="card-hover" style={{ background: '#FFF', borderRadius: 10, padding: '10px 14px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
              <span style={{ fontSize: 20 }}>{o.avatar}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{o.memberName}</div>
                <div style={{ fontSize: 11, color: '#86868B' }}>
                  {o.projects.map(p => `${p.name} (${Math.round(p.dedication * 100)}%)`).join(' + ')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: o.totalDedication > 1.2 ? '#FF3B30' : '#FF9500' }}>
                  {Math.round(o.totalDedication * 100)}%
                </div>
                <div style={{ fontSize: 9, color: '#FF3B30' }}>Asignación total</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {overloads.length === 0 && (
        <div style={{ background: '#F0FFF4', borderRadius: 14, border: '1.5px solid #34C75920', padding: 16, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="CheckCircle2" size={16} color="#34C759" />
          <span style={{ fontSize: 13, color: '#34C759', fontWeight: 600 }}>Sin sobrecargas — equipo equilibrado</span>
        </div>
      )}

      {/* Cross-risk alerts */}
      {crossRisks.length > 0 && (
        <div style={{ background: '#FFF8EB', borderRadius: 14, border: '1.5px solid #FF950020', padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Icon name="TrendingUp" size={16} color="#FF9500" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#FF9500' }}>Riesgos cruzados ({crossRisks.length})</span>
          </div>
          <p style={{ fontSize: 11, color: '#86868B', marginBottom: 10 }}>Personas con riesgos escalados en más de un proyecto</p>
          {crossRisks.map(cr => (
            <div key={cr.memberName} style={{ background: '#FFF', borderRadius: 10, padding: '10px 14px', marginBottom: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{cr.memberName}</div>
              {cr.risks.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 11 }}>
                  <span style={{ fontWeight: 600, color: '#007AFF', minWidth: 80 }}>{r.roomName}</span>
                  <span style={{ color: '#6E6E73', flex: 1 }}>{r.riskText}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#FF9500', background: '#FF950015', padding: '2px 6px', borderRadius: 4 }}>{r.level}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Resource allocation matrix */}
      <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16, overflow: 'auto', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Icon name="Grid3X3" size={16} color="#5856D6" />
          <span style={{ fontSize: 14, fontWeight: 700 }}>Matriz de asignación</span>
          <div style={{ marginLeft: 'auto', display: 'flex', background: '#F2F2F7', borderRadius: 8, overflow: 'hidden' }}>
            {([['pct', '%'], ['fte', 'FTEs'], ['hours', 'Horas']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setMatrixMode(key)}
                style={{ padding: '4px 12px', fontSize: 10, fontWeight: 700, border: 'none', cursor: 'pointer', background: matrixMode === key ? '#007AFF' : 'transparent', color: matrixMode === key ? '#FFF' : '#86868B', transition: 'all .15s' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #E5E5EA', fontSize: 11, color: '#86868B', fontWeight: 700 }}>Persona</th>
              {allProjects.map(p => (
                <th key={p} style={{ textAlign: 'center', padding: '8px 6px', borderBottom: '2px solid #E5E5EA', fontSize: 10, color: '#86868B', fontWeight: 700, maxWidth: 100 }}>
                  {projectNames[p] || p}
                </th>
              ))}
              <th style={{ textAlign: 'center', padding: '8px 10px', borderBottom: '2px solid #E5E5EA', fontSize: 11, color: '#86868B', fontWeight: 700 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {memberProjects.map((mp, ri) => {
              const total = mp.projects.reduce((s, p) => s + p.dedication, 0);
              const isOver = total > 1.05;
              const fmtVal = (ded: number) => {
                if (matrixMode === 'pct') return `${Math.round(ded * 100)}%`;
                if (matrixMode === 'fte') return ded.toFixed(2);
                return `${Math.round(ded * MONTHLY_BASE_HOURS)}h`;
              };
              return (
                <tr key={mp.member.id} style={{ background: isOver ? '#FFF5F5' : ri % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #F2F2F7', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    <span style={{ marginRight: 6 }}>{mp.member.avatar || '👤'}</span>
                    {mp.member.name}
                  </td>
                  {allProjects.map(sala => {
                    const proj = mp.projects.find(p => p.sala === sala);
                    const ded = proj ? proj.dedication : 0;
                    return (
                      <td key={sala} style={{ textAlign: 'center', padding: '6px', borderBottom: '1px solid #F2F2F7' }}>
                        {ded > 0 ? (
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                            background: ded >= 1 ? '#007AFF15' : ded >= 0.5 ? '#34C75915' : '#F2F2F7',
                            color: ded >= 1 ? '#007AFF' : ded >= 0.5 ? '#34C759' : '#86868B',
                          }}>
                            {fmtVal(ded)}
                          </span>
                        ) : (
                          <span style={{ color: '#E5E5EA' }}>—</span>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '1px solid #F2F2F7', fontWeight: 800, color: isOver ? '#FF3B30' : total >= 1 ? '#34C759' : '#FF9500' }}>
                    {fmtVal(total)}
                  </td>
                </tr>
              );
            })}
            {/* ── Totals row ── */}
            <tr style={{ background: '#F2F2F7' }}>
              <td style={{ padding: '8px 10px', fontWeight: 800, fontSize: 11, borderTop: '2px solid #E5E5EA' }}>
                Total por proyecto
              </td>
              {allProjects.map(sala => {
                const projTotal = memberProjects.reduce((s, mp) => {
                  const p = mp.projects.find(p => p.sala === sala);
                  return s + (p ? p.dedication : 0);
                }, 0);
                const fmtTotal = matrixMode === 'pct' ? `${Math.round(projTotal * 100)}%` : matrixMode === 'fte' ? projTotal.toFixed(2) : `${Math.round(projTotal * MONTHLY_BASE_HOURS)}h`;
                return (
                  <td key={sala} style={{ textAlign: 'center', padding: '8px 6px', borderTop: '2px solid #E5E5EA', fontWeight: 800, fontSize: 12, color: '#5856D6' }}>
                    {fmtTotal}
                  </td>
                );
              })}
              <td style={{ textAlign: 'center', padding: '8px 10px', borderTop: '2px solid #E5E5EA', fontWeight: 800, fontSize: 12, color: '#1D1D1F' }}>
                {(() => {
                  const gt = memberProjects.reduce((s, mp) => s + mp.projects.reduce((sp, p) => sp + p.dedication, 0), 0);
                  return matrixMode === 'pct' ? `${Math.round(gt * 100)}%` : matrixMode === 'fte' ? gt.toFixed(2) : `${Math.round(gt * MONTHLY_BASE_HOURS)}h`;
                })()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Consultant View (collapsible) ── */}
      <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Icon name="Users" size={16} color="#007AFF" />
          <span style={{ fontSize: 14, fontWeight: 700 }}>Vista por consultor — {yr}</span>
        </div>
        {consultants.map(c => {
          const isOpen = expanded.has(c.member.id);
          const uniqueProjects = [...new Set(c.periods.map(p => p.sala))];
          const interPct = Math.round(c.intercontrato * 100);
          return (
            <div key={c.member.id} style={{ marginBottom: 4 }}>
              {/* Header row */}
              <div onClick={() => { const s = new Set(expanded); isOpen ? s.delete(c.member.id) : s.add(c.member.id); setExpanded(s); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, background: isOpen ? '#007AFF08' : '#FAFAFA', cursor: 'pointer', border: isOpen ? '1px solid #007AFF20' : '1px solid transparent' }}>
                <Icon name={isOpen ? 'ChevronDown' : 'ChevronRight'} size={12} color="#86868B" />
                <span style={{ fontSize: 16 }}>{c.member.avatar || '👤'}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{c.member.name}</span>
                  <span style={{ fontSize: 10, color: '#86868B', marginLeft: 8 }}>{c.member.role_label}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: c.totalDedToday >= 1 ? '#34C759' : c.totalDedToday > 0 ? '#007AFF' : '#FF3B30' }}>
                  {Math.round(c.totalDedToday * 100)}%
                </span>
                {interPct > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: interPct > 50 ? '#FF3B30' : '#FF9500', background: interPct > 50 ? '#FF3B3010' : '#FF950010', padding: '2px 6px', borderRadius: 5 }}>
                    IC {interPct}%
                  </span>
                )}
              </div>
              {/* Expanded: monthly breakdown */}
              {isOpen && (
                <div style={{ padding: '8px 12px 8px 36px', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '4px 6px', borderBottom: '2px solid #E5E5EA', color: '#86868B', fontWeight: 700, fontSize: 9 }}>Proyecto</th>
                        {MO.map((m, i) => {
                          const isNow = i === new Date().getMonth();
                          return <th key={m} style={{ textAlign: 'center', padding: '4px 3px', borderBottom: '2px solid #E5E5EA', color: isNow ? '#007AFF' : '#86868B', fontWeight: 700, fontSize: 9, background: isNow ? '#007AFF08' : undefined }}>{m}</th>;
                        })}
                        <th style={{ textAlign: 'center', padding: '4px 6px', borderBottom: '2px solid #E5E5EA', color: '#1D1D1F', fontWeight: 700, fontSize: 9 }}>Anual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uniqueProjects.map(sala => {
                        const pName = c.periods.find(p => p.sala === sala)?.name || sala;
                        const monthly = MO.map((_, mi) => dedForMonth(c.periods, sala, yr, mi));
                        const annual = monthly.reduce((s, v) => s + v, 0) / 12;
                        return (
                          <tr key={sala}>
                            <td style={{ padding: '4px 6px', borderBottom: '1px solid #F2F2F7', fontWeight: 600, color: '#007AFF', whiteSpace: 'nowrap' }}>{pName}</td>
                            {monthly.map((v, mi) => {
                              const isNow = mi === new Date().getMonth();
                              const pct = Math.round(v * 100);
                              return (
                                <td key={mi} style={{ textAlign: 'center', padding: '3px 2px', borderBottom: '1px solid #F2F2F7', background: isNow ? '#007AFF06' : undefined }}>
                                  {pct > 0 ? (
                                    <span style={{ fontWeight: 700, fontSize: 10, color: pct >= 100 ? '#007AFF' : pct >= 50 ? '#34C759' : '#86868B' }}>{pct}%</span>
                                  ) : (
                                    <span style={{ color: '#E5E5EA', fontSize: 9 }}>—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td style={{ textAlign: 'center', padding: '3px 6px', borderBottom: '1px solid #F2F2F7', fontWeight: 800, color: '#5856D6', fontSize: 11 }}>
                              {Math.round(annual * 100)}%
                            </td>
                          </tr>
                        );
                      })}
                      {/* Total row */}
                      <tr style={{ background: '#F9F9FB' }}>
                        <td style={{ padding: '4px 6px', fontWeight: 700, fontSize: 10 }}>Total</td>
                        {MO.map((_, mi) => {
                          const total = uniqueProjects.reduce((s, sala) => s + dedForMonth(c.periods, sala, yr, mi), 0);
                          const pct = Math.round(total * 100);
                          const isNow = mi === new Date().getMonth();
                          return (
                            <td key={mi} style={{ textAlign: 'center', padding: '3px 2px', fontWeight: 800, fontSize: 10, color: pct > 100 ? '#FF3B30' : pct === 100 ? '#34C759' : '#FF9500', background: isNow ? '#007AFF06' : undefined }}>
                              {pct}%
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'center', padding: '3px 6px', fontWeight: 800, fontSize: 11, color: '#1D1D1F' }}>
                          {Math.round(uniqueProjects.reduce((s, sala) => s + MO.reduce((sm, _, mi) => sm + dedForMonth(c.periods, sala, yr, mi), 0) / 12, 0) * 100)}%
                        </td>
                      </tr>
                      {/* IC row */}
                      <tr>
                        <td style={{ padding: '4px 6px', fontWeight: 600, color: '#FF9500', fontSize: 10 }}>Intercontrato</td>
                        {MO.map((_, mi) => {
                          const total = uniqueProjects.reduce((s, sala) => s + dedForMonth(c.periods, sala, yr, mi), 0);
                          const ic = Math.round(Math.max(0, 1 - total) * 100);
                          const isNow = mi === new Date().getMonth();
                          return (
                            <td key={mi} style={{ textAlign: 'center', padding: '3px 2px', fontWeight: 700, fontSize: 10, color: ic > 50 ? '#FF3B30' : ic > 0 ? '#FF9500' : '#34C759', background: isNow ? '#007AFF06' : undefined }}>
                              {ic > 0 ? `${ic}%` : <span style={{ color: '#34C759' }}>0%</span>}
                            </td>
                          );
                        })}
                        <td style={{ textAlign: 'center', padding: '3px 6px', fontWeight: 800, fontSize: 11, color: interPct > 50 ? '#FF3B30' : interPct > 0 ? '#FF9500' : '#34C759' }}>
                          {interPct}%
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {/* Periods detail */}
                  <div style={{ marginTop: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#86868B', textTransform: 'uppercase' }}>Periodos ({c.periods.length})</span>
                    {c.periods.map((p, i) => {
                      const unconfigured = !p.start_date && !p.end_date && p.dedication === 0;
                      return (
                        <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 10, marginTop: 4 }}>
                          <span style={{ fontSize: 9, fontWeight: 600, color: unconfigured ? '#C7C7CC' : '#007AFF' }}>{p.name}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: unconfigured ? '#C7C7CC' : undefined }}>{Math.round(p.dedication * 100)}%</span>
                          <span style={{ fontSize: 8, color: '#86868B' }}>
                            {p.start_date ? `${p.start_date.slice(8,10)}/${p.start_date.slice(5,7)}/${p.start_date.slice(0,4)}` : '∞'}
                            {' → '}
                            {p.end_date ? `${p.end_date.slice(8,10)}/${p.end_date.slice(5,7)}/${p.end_date.slice(0,4)}` : '∞'}
                          </span>
                          {unconfigured && <span style={{ fontSize: 7, color: '#FF9500', fontWeight: 700 }}>SIN CONFIGURAR</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
