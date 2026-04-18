// ═══ STATUS REPORT — Auto-generated project metrics ═══
import { useMemo } from 'preact/hooks';
import type { Task, Risk, Member } from '../../types/index';
import { generateStatusReport } from '../../services/metrics';
import { Icon } from '../common/Icon';

interface StatusReportProps {
  actions: Task[];
  risks: Risk[];
  teamMembers: Member[];
}

const fd = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function StatusReportView({ actions, risks, teamMembers }: StatusReportProps) {
  const report = useMemo(() => generateStatusReport(actions, risks, teamMembers), [actions, risks, teamMembers]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Status Report</h3>
          <p style={{ fontSize: 12, color: '#86868B' }}>Generado: {fd(report.generatedAt)} · Periodo: {report.period}</p>
        </div>
      </div>

      {/* Health score + highlights/warnings */}
      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 1fr', gap: 12, marginBottom: 14 }}>
        {/* Health gauge */}
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
          <svg viewBox="0 0 100 60" style={{ width: '100%', maxWidth: 110 }}>
            <path d="M10 55 A40 40 0 0 1 90 55" fill="none" stroke="#F2F2F7" strokeWidth="8" strokeLinecap="round" />
            <path d="M10 55 A40 40 0 0 1 90 55" fill="none" stroke={report.healthColor} strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${report.healthScore * 1.26} 200`} />
            <text x="50" y="48" textAnchor="middle" fontSize="20" fontWeight="800" fill={report.healthColor}>{report.healthScore}</text>
          </svg>
          <div style={{ fontSize: 12, fontWeight: 700, color: report.healthColor, marginTop: 4 }}>{report.healthLabel}</div>
        </div>

        {/* Highlights */}
        <div style={{ background: '#F0FFF4', borderRadius: 14, border: '1.5px solid #34C75920', padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Icon name="CheckCircle2" size={14} color="#34C759" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#34C759' }}>Logros</span>
          </div>
          {report.highlights.length === 0 ? (
            <p style={{ fontSize: 11, color: '#86868B' }}>Sin logros destacables esta semana</p>
          ) : report.highlights.map((h, i) => (
            <div key={i} style={{ fontSize: 11, color: '#1D1D1F', padding: '3px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 4, height: 4, borderRadius: 2, background: '#34C759', flexShrink: 0 }} />
              {h}
            </div>
          ))}
        </div>

        {/* Warnings */}
        <div style={{ background: report.warnings.length > 0 ? '#FFF5F5' : '#F9F9FB', borderRadius: 14, border: `1.5px solid ${report.warnings.length > 0 ? '#FF3B3020' : '#E5E5EA'}`, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Icon name="AlertTriangle" size={14} color={report.warnings.length > 0 ? '#FF3B30' : '#86868B'} />
            <span style={{ fontSize: 12, fontWeight: 700, color: report.warnings.length > 0 ? '#FF3B30' : '#86868B' }}>Alertas</span>
          </div>
          {report.warnings.length === 0 ? (
            <p style={{ fontSize: 11, color: '#86868B' }}>Sin alertas — todo bajo control</p>
          ) : report.warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 11, color: '#1D1D1F', padding: '3px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 4, height: 4, borderRadius: 2, background: '#FF3B30', flexShrink: 0 }} />
              {w}
            </div>
          ))}
        </div>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Total tareas', value: report.totalTasks, color: '#1D1D1F', icon: 'ClipboardList' },
          { label: 'Completadas', value: `${report.completionPct}%`, color: report.completionPct >= 75 ? '#34C759' : '#FF9500', icon: 'CheckCircle2' },
          { label: 'En curso', value: report.inProgress, color: '#007AFF', icon: 'Loader' },
          { label: 'Bloqueadas', value: report.blocked, color: report.blocked > 0 ? '#FF3B30' : '#34C759', icon: 'Lock' },
          { label: 'Vencidas', value: report.overdue, color: report.overdue > 0 ? '#FF3B30' : '#34C759', icon: 'Clock' },
        ].map(k => (
          <div key={k.label} class="card-hover" style={{ background: '#FFF', borderRadius: 12, border: '1.5px solid #E5E5EA', padding: 12, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.04)' }}>
            <Icon name={k.icon} size={16} color={k.color} />
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color, marginTop: 4 }}>{k.value}</div>
            <div style={{ fontSize: 9, color: '#86868B' }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        {/* Velocity */}
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="TrendingUp" size={14} color="#007AFF" /> Flujo semanal
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#34C759' }}>+{report.tasksCompletedThisWeek}</div>
              <div style={{ fontSize: 9, color: '#86868B' }}>Completadas</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#007AFF' }}>+{report.tasksCreatedThisWeek}</div>
              <div style={{ fontSize: 9, color: '#86868B' }}>Creadas</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: report.netFlow > 0 ? '#FF9500' : '#34C759' }}>
                {report.netFlow > 0 ? '+' : ''}{report.netFlow}
              </div>
              <div style={{ fontSize: 9, color: '#86868B' }}>Flujo neto</div>
            </div>
          </div>
          {report.netFlow > 0 && (
            <div style={{ fontSize: 10, color: '#FF9500', marginTop: 8, textAlign: 'center' }}>
              El backlog está creciendo
            </div>
          )}
        </div>

        {/* Risks */}
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="AlertTriangle" size={14} color="#FF9500" /> Riesgos
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
            {[
              { v: report.totalRisks, l: 'Activos', c: '#FF9500' },
              { v: report.criticalRisks, l: 'Críticos', c: '#FF3B30' },
              { v: report.escalatedRisks, l: 'Escalados', c: '#AF52DE' },
              { v: report.mitigatedRisks, l: 'Mitigados', c: '#34C759' },
            ].map(k => (
              <div key={k.l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: k.c }}>{k.v}</div>
                <div style={{ fontSize: 9, color: '#86868B' }}>{k.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Team */}
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="Users" size={14} color="#5856D6" /> Equipo
          </h4>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#5856D6' }}>{report.teamSize}</div>
              <div style={{ fontSize: 9, color: '#86868B' }}>Personas</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#007AFF' }}>{report.avgLoadPerPerson}</div>
              <div style={{ fontSize: 9, color: '#86868B' }}>Tareas/persona</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: report.unassignedTasks > 3 ? '#FF3B30' : '#86868B' }}>{report.unassignedTasks}</div>
              <div style={{ fontSize: 9, color: '#86868B' }}>Sin asignar</div>
            </div>
          </div>
          {report.topContributors.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B', marginBottom: 4 }}>TOP CONTRIBUIDORES</div>
              {report.topContributors.map((c, i) => (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 11 }}>
                  <span style={{ fontWeight: 700, color: i === 0 ? '#FF9500' : '#86868B', minWidth: 14 }}>{i + 1}.</span>
                  <span style={{ flex: 1 }}>{c.name}</span>
                  <span style={{ fontWeight: 700, color: '#34C759' }}>{c.completed}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Epics */}
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="Layers" size={14} color="#AF52DE" /> Épicas
          </h4>
          {report.epics.length === 0 ? (
            <p style={{ fontSize: 11, color: '#86868B' }}>Sin épicas definidas</p>
          ) : report.epics.map(e => (
            <div key={e.name} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 11, fontWeight: 600 }}>{e.name}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: e.pct === 100 ? '#34C759' : '#86868B' }}>{e.pct}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: '#F2F2F7' }}>
                <div style={{ width: `${e.pct}%`, height: 4, borderRadius: 2, background: e.pct === 100 ? '#34C759' : '#007AFF', transition: 'width .3s' }} />
              </div>
              <div style={{ fontSize: 9, color: '#86868B', marginTop: 2 }}>{e.done}/{e.total} acc. · {e.points} h</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
