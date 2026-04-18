// ═══ ADMIN DASHBOARD — Centro de Control global view ═══
// KPIs + project table + team summary + risk summary + vacations

import { useState, useEffect, useMemo } from 'preact/hooks';
import type { Room, Member } from '@app-types/index';
import { loadDashboardData, type DashboardData } from '@services/dashboard';
import { Loading, ErrorCard } from '@components/common/Feedback';
import { Tooltip } from '@components/common/Tooltip';
import { Icon } from '@components/common/Icon';
import { ANNUAL_VAC_DAYS } from '../../config/absenceTypes';

interface AdminDashboardProps {
  rooms: Room[];
  filterProject: string[];
  onGoToRoom?: (slug: string, tipo: string) => void;
}

const cardS = { background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA' } as const;
const thS = { padding: '8px 10px', fontSize: 10, fontWeight: 700 as number, color: '#86868B', textTransform: 'uppercase' as const, borderBottom: '2px solid #E5E5EA', whiteSpace: 'nowrap' as const };

export function AdminDashboard({ rooms, filterProject, onGoToRoom }: AdminDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const slugs = filterProject.length > 0 ? filterProject : undefined;
    loadDashboardData(slugs).then(result => {
      setData(result);
      setError(null);
      setLoading(false);
    }).catch(() => {
      setError('Error cargando dashboard');
      setLoading(false);
    });
  }, [filterProject.join(',')]);

  // Compute vacation stats per member
  const vacStats = useMemo(() => {
    if (!data) return { onVacToday: 0, avgPctUsed: 0, totalPending: 0 };
    const today = new Date().toISOString().slice(0, 10);
    const yr = new Date().getFullYear();
    let onVac = 0, totalPct = 0, totalPend = 0, counted = 0;
    data.members.forEach(m => {
      const vacs = m.vacations || [];
      const isOnVac = vacs.some(v => v.from <= today && (!v.to || v.to >= today));
      if (isOnVac) onVac++;
      // Count vac days used this year
      let used = 0;
      vacs.filter(v => (v.type || 'vacaciones') === 'vacaciones' && v.from).forEach(v => {
        let d = new Date(v.from); const to = new Date(v.to || v.from);
        while (d <= to) { if (d.getFullYear() === yr && d.getDay() !== 0 && d.getDay() !== 6) used++; d.setDate(d.getDate() + 1); }
      });
      const total = (m.annual_vac_days || ANNUAL_VAC_DAYS) + (m.prev_year_pending || 0);
      if (total > 0) { totalPct += (used / total) * 100; counted++; }
      totalPend += Math.max(0, total - used);
    });
    return { onVacToday: onVac, avgPctUsed: counted > 0 ? Math.round(totalPct / counted) : 0, totalPending: totalPend };
  }, [data]);

  // Per-project vacation %
  const projectVacPct = useMemo(() => {
    if (!data) return {} as Record<string, number>;
    const yr = new Date().getFullYear();
    const result: Record<string, number> = {};
    data.projectMetrics.forEach(p => {
      const pMembers = data.members.filter(m => (m.rooms || []).includes(p.slug));
      if (pMembers.length === 0) { result[p.slug] = 0; return; }
      let totalPct = 0;
      pMembers.forEach(m => {
        const vacs = (m.vacations || []).filter(v => (v.type || 'vacaciones') === 'vacaciones' && v.from);
        let used = 0;
        vacs.forEach(v => {
          let d = new Date(v.from); const to = new Date(v.to || v.from);
          while (d <= to) { if (d.getFullYear() === yr && d.getDay() !== 0 && d.getDay() !== 6) used++; d.setDate(d.getDate() + 1); }
        });
        const total = (m.annual_vac_days || ANNUAL_VAC_DAYS) + (m.prev_year_pending || 0);
        totalPct += total > 0 ? (used / total) * 100 : 0;
      });
      result[p.slug] = Math.round(totalPct / pMembers.length);
    });
    return result;
  }, [data]);

  if (loading) return <Loading message="Cargando dashboard..." />;
  if (error) return <ErrorCard message={error} />;
  if (!data) return null;

  const { health, projectMetrics } = data;
  const totalTasks = projectMetrics.reduce((s, p) => s + p.tasks.total, 0);
  const totalOverdue = projectMetrics.reduce((s, p) => s + p.tasks.overdue, 0);
  const totalRisksOpen = projectMetrics.reduce((s, p) => s + p.risks.open, 0);
  const totalEscalated = projectMetrics.reduce((s, p) => s + p.risks.escalated, 0);
  const totalCritical = projectMetrics.reduce((s, p) => s + p.risks.critical, 0);
  const totalMembers = data.members.length;

  return (
    <div>
      {/* ── KPI Row 1: Portfolio ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 14 }}>
        {([
          { icon: 'Activity', value: `${health.score}%`, label: 'Salud global', color: health.color },
          { icon: 'FolderOpen', value: `${projectMetrics.length}`, label: 'Proyectos', color: '#007AFF' },
          { icon: 'Users', value: `${totalMembers}`, label: 'Personas', color: '#1D1D1F' },
          { icon: 'CheckCircle', value: `${totalTasks}`, label: 'Accionables', color: '#34C759' },
          { icon: 'AlertTriangle', value: `${totalRisksOpen}`, label: 'Riesgos abiertos', color: totalRisksOpen > 0 ? '#FF9500' : '#34C759' },
          { icon: 'TrendingUp', value: `${totalEscalated}`, label: 'Escalados', color: totalEscalated > 0 ? '#FF3B30' : '#34C759' },
        ] as const).map(k => (
          <div key={k.label} style={{ ...cardS, padding: '14px 10px', textAlign: 'center' }}>
            <Icon name={k.icon as string} size={16} color={k.color} />
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color, marginTop: 4 }}>{k.value}</div>
            <div style={{ fontSize: 9, color: '#86868B', marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── KPI Row 2: Equipo + Vacaciones ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{ ...cardS, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#007AFF10', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="Briefcase" size={18} color="#007AFF" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#007AFF' }}>{data.skillSummary.totalFte || totalMembers.toFixed(1)}</div>
            <div style={{ fontSize: 10, color: '#86868B' }}>FTEs</div>
          </div>
        </div>
        <div style={{ ...cardS, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FF950010', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="Sun" size={18} color="#FF9500" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#FF9500' }}>{vacStats.onVacToday}</div>
            <div style={{ fontSize: 10, color: '#86868B' }}>De vacaciones hoy</div>
          </div>
        </div>
        <div style={{ ...cardS, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#34C75910', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="PieChart" size={18} color="#34C759" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#34C759' }}>{vacStats.avgPctUsed}%</div>
            <div style={{ fontSize: 10, color: '#86868B' }}>Vac. consumidas (media)</div>
          </div>
        </div>
        <div style={{ ...cardS, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: totalOverdue > 0 ? '#FF3B3010' : '#34C75910', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="AlertCircle" size={18} color={totalOverdue > 0 ? '#FF3B30' : '#34C759'} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: totalOverdue > 0 ? '#FF3B30' : '#34C759' }}>{totalOverdue}</div>
            <div style={{ fontSize: 10, color: '#86868B' }}>Tareas vencidas</div>
          </div>
        </div>
      </div>

      {/* ── Project Table ── */}
      <div style={{ ...cardS, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="Table" size={14} color="#007AFF" /> Portfolio de proyectos
          </h3>
          <span style={{ fontSize: 10, color: '#86868B' }}>{projectMetrics.length} proyectos</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#FAFAFA' }}>
                {['Proyecto', 'Estado', 'Equipo', 'Tareas', 'Vencidas', 'Riesgos', 'Escalados', '% Hecho', '% Vac.', 'Encaje'].map(h => (
                  <th key={h} style={{ ...thS, textAlign: h === 'Proyecto' ? 'left' : 'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projectMetrics.map((p, i) => {
                const room = rooms.find(r => r.slug === p.slug);
                const status = (room?.metadata as Record<string, unknown>)?.status as string || 'active';
                const vacPct = projectVacPct[p.slug] || 0;
                const encaje = p.team.avgFit !== null ? p.team.avgFit : (data.skillSummary.avgFit || 0);
                const statusLabel = status === 'closed' ? 'Cerrado' : status === 'paused' ? 'Parado' : 'Activo';
                const statusColor = status === 'closed' ? '#86868B' : status === 'paused' ? '#FF9500' : '#34C759';
                return (
                  <tr key={p.slug} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA', cursor: onGoToRoom ? 'pointer' : 'default' }}
                    onClick={() => onGoToRoom?.(p.slug, room?.tipo || 'agile')}
                    onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = '#007AFF08'; }}
                    onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? '#FFF' : '#FAFAFA'; }}>
                    <td style={{ padding: '10px', borderBottom: '1px solid #F2F2F7', fontWeight: 700, color: '#007AFF' }}>{p.name}</td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: statusColor, background: statusColor + '12', padding: '2px 8px', borderRadius: 6 }}>{statusLabel}</span>
                    </td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontWeight: 600 }}>{p.team.total}</td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center', fontWeight: 700 }}>{p.tasks.total || '—'}</td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                      {p.tasks.overdue > 0 ? <span style={{ fontWeight: 700, color: '#FF3B30' }}>{p.tasks.overdue}</span> : <span style={{ color: '#D1D1D6' }}>0</span>}
                    </td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                      {p.risks.open > 0 ? <span style={{ fontWeight: 700, color: '#FF9500' }}>{p.risks.open}</span> : <span style={{ color: '#D1D1D6' }}>0</span>}
                    </td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                      {p.risks.escalated > 0 ? <span style={{ fontWeight: 800, color: '#FF3B30', background: '#FF3B3012', padding: '2px 7px', borderRadius: 6 }}>{p.risks.escalated}</span> : <span style={{ color: '#D1D1D6' }}>0</span>}
                    </td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                        <div style={{ width: 36, height: 5, borderRadius: 3, background: '#F2F2F7', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 3, width: `${p.tasks.pctDone}%`, background: p.tasks.pctDone >= 75 ? '#34C759' : p.tasks.pctDone >= 40 ? '#FF9500' : '#FF3B30' }} />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: 10, color: p.tasks.pctDone >= 75 ? '#34C759' : p.tasks.pctDone >= 40 ? '#FF9500' : '#FF3B30' }}>{p.tasks.pctDone}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                      <span style={{ fontWeight: 600, color: vacPct < 50 ? '#FF3B30' : vacPct < 80 ? '#FF9500' : '#34C759' }}>{vacPct}%</span>
                    </td>
                    <td style={{ padding: '10px 6px', borderBottom: '1px solid #F2F2F7', textAlign: 'center' }}>
                      <span style={{ fontWeight: 600, color: encaje >= 70 ? '#34C759' : encaje >= 40 ? '#FF9500' : '#FF3B30' }}>{encaje > 0 ? `${Math.round(encaje)}%` : '—'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Risk summary (compact) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
        <div style={{ ...cardS, padding: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="AlertTriangle" size={14} color="#FF9500" /> Riesgos y problemas
          </h3>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            {([
              { v: totalRisksOpen, l: 'Abiertos', c: '#FF9500' },
              { v: totalCritical, l: 'Críticos', c: '#FF3B30' },
              { v: totalEscalated, l: 'Escalados', c: '#5856D6' },
            ] as const).map(k => (
              <div key={k.l} style={{ flex: 1, textAlign: 'center', padding: 8, borderRadius: 8, background: k.c + '08' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: k.c }}>{k.v}</div>
                <div style={{ fontSize: 9, color: '#86868B' }}>{k.l}</div>
              </div>
            ))}
          </div>
          {/* Per-project risk bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {projectMetrics.filter(p => p.risks.open > 0).sort((a, b) => b.risks.open - a.risks.open).map(p => (
              <div key={p.slug} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                <span style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <div style={{ width: 60, height: 5, borderRadius: 3, background: '#F2F2F7', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: p.risks.critical > 0 ? '#FF3B30' : '#FF9500', width: `${Math.min(100, p.risks.open * 20)}%` }} />
                </div>
                <span style={{ fontWeight: 700, color: p.risks.critical > 0 ? '#FF3B30' : '#FF9500', width: 20, textAlign: 'right' }}>{p.risks.open}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...cardS, padding: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="Users" size={14} color="#007AFF" /> Equipo y vacaciones
          </h3>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            {([
              { v: totalMembers, l: 'Personas', c: '#1D1D1F' },
              { v: vacStats.onVacToday, l: 'De vacaciones', c: '#FF9500' },
              { v: `${vacStats.avgPctUsed}%`, l: 'Media vac. usadas', c: '#34C759' },
            ] as const).map(k => (
              <div key={k.l} style={{ flex: 1, textAlign: 'center', padding: 8, borderRadius: 8, background: '#F9F9FB' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: k.c }}>{k.v}</div>
                <div style={{ fontSize: 9, color: '#86868B' }}>{k.l}</div>
              </div>
            ))}
          </div>
          {/* Per-project team bars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {projectMetrics.filter(p => p.team.total > 0).sort((a, b) => b.team.total - a.team.total).map(p => (
              <div key={p.slug} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                <span style={{ flex: 1, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <div style={{ width: 60, height: 5, borderRadius: 3, background: '#F2F2F7', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: '#007AFF', width: `${Math.min(100, p.team.total * 15)}%` }} />
                </div>
                <span style={{ fontWeight: 700, color: '#007AFF', width: 20, textAlign: 'right' }}>{p.team.total}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
