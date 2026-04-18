// ═══ GAMIFICATION — Leaderboard, achievements, house points ═══
import { useState, useMemo } from 'preact/hooks';
import type { Task, Risk, Member } from '../../types/index';
import { calculateUserStats, ACHIEVEMENTS, HOUSES, POINTS, type House } from '../../domain/gamification';
import { Icon } from '../common/Icon';

interface GamificationProps {
  actions: Task[];
  risks: Risk[];
  teamMembers: Member[];
  retroMetrics: Array<Record<string, unknown>>;
  currentUser: string;
}

export function Gamification({ actions, risks, teamMembers, retroMetrics, currentUser }: GamificationProps) {
  const [tab, setTab] = useState<'leaderboard' | 'achievements' | 'houses'>('leaderboard');

  const leaderboard = useMemo(() => {
    return teamMembers.map(m => {
      const stats = calculateUserStats(m.name, actions as Array<Record<string, unknown>>, risks as Array<Record<string, unknown>>, retroMetrics);
      const unlocked = ACHIEVEMENTS.filter(a => a.condition(stats));
      return { member: m, stats, unlocked, house: (m as Record<string, unknown>).house as House | undefined };
    }).sort((a, b) => b.stats.totalPoints - a.stats.totalPoints);
  }, [actions, risks, teamMembers, retroMetrics]);

  // House totals
  const houseTotals = useMemo(() => {
    const totals: Record<string, number> = { gryffindor: 0, slytherin: 0, ravenclaw: 0, hufflepuff: 0 };
    leaderboard.forEach(e => {
      if (e.house && totals[e.house] !== undefined) totals[e.house] += e.stats.totalPoints;
    });
    return Object.entries(totals).sort(([, a], [, b]) => b - a);
  }, [leaderboard]);

  const currentStats = leaderboard.find(e => e.member.name === currentUser);

  const TABS = [
    { id: 'leaderboard', label: 'Clasificación', icon: 'Trophy' },
    { id: 'achievements', label: 'Logros', icon: 'Award' },
    { id: 'houses', label: 'Casas', icon: 'Castle' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Libro de Hechizos</h3>
          <p style={{ fontSize: 12, color: '#86868B' }}>Gamificación del equipo · {leaderboard.length} magos</p>
        </div>
        <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '1.5px solid #E5E5EA' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
              style={{ padding: '5px 12px', fontSize: 11, fontWeight: tab === t.id ? 700 : 500, background: tab === t.id ? '#1D1D1F' : '#FFF', color: tab === t.id ? '#FFF' : '#6E6E73', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Icon name={t.icon} size={12} color={tab === t.id ? '#FFF' : '#86868B'} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Points summary */}
      {currentStats && (
        <div style={{ background: 'linear-gradient(135deg, #5856D610, #007AFF10)', borderRadius: 14, border: '1.5px solid #5856D620', padding: 16, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: currentStats.member.color || '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
            {currentStats.member.avatar || '🧙'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{currentUser}</div>
            <div style={{ fontSize: 11, color: '#86868B' }}>
              {currentStats.house ? `${HOUSES[currentStats.house].emoji} ${HOUSES[currentStats.house].name}` : 'Sin casa'}
              {' · '}{currentStats.unlocked.length}/{ACHIEVEMENTS.length} logros
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#5856D6' }}>{currentStats.stats.totalPoints}</div>
            <div style={{ fontSize: 9, color: '#86868B' }}>puntos</div>
          </div>
        </div>
      )}

      {/* Scoring legend */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { label: 'Acción completada', pts: POINTS.taskComplete, color: '#34C759' },
          { label: 'Riesgo identificado', pts: POINTS.riskCreate, color: '#FF9500' },
          { label: 'Riesgo mitigado', pts: POINTS.riskMitigate, color: '#007AFF' },
        ].map(p => (
          <span key={p.label} style={{ fontSize: 9, color: '#86868B', background: '#F9F9FB', padding: '3px 8px', borderRadius: 6 }}>
            <b style={{ color: p.color }}>+{p.pts}</b> {p.label}
          </span>
        ))}
      </div>

      {/* ── LEADERBOARD ── */}
      {tab === 'leaderboard' && (
        <div style={{ background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', overflow: 'hidden' }}>
          {leaderboard.map((entry, i) => {
            const isMe = entry.member.name === currentUser;
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
            return (
              <div key={entry.member.id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid #F9F9FB', background: isMe ? '#007AFF05' : undefined }}>
                <span style={{ fontSize: i < 3 ? 18 : 12, minWidth: 28, textAlign: 'center', fontWeight: 700, color: i >= 3 ? '#86868B' : undefined }}>{medal}</span>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: entry.member.color || '#007AFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                  {entry.member.avatar || '🧙'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: isMe ? 700 : 500 }}>{entry.member.name}{isMe ? ' (tú)' : ''}</div>
                  <div style={{ fontSize: 10, color: '#86868B' }}>
                    {entry.stats.tasksCompleted} accionables · {entry.unlocked.length} logros
                    {entry.house ? ` · ${HOUSES[entry.house].emoji}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  {entry.unlocked.slice(0, 4).map(a => <span key={a.id} title={a.name} style={{ fontSize: 14 }}>{a.emoji}</span>)}
                </div>
                <div style={{ textAlign: 'right', minWidth: 50 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#5856D6' }}>{entry.stats.totalPoints}</div>
                  <div style={{ fontSize: 8, color: '#86868B' }}>pts</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── ACHIEVEMENTS ── */}
      {tab === 'achievements' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {ACHIEVEMENTS.map(ach => {
            const unlocked = currentStats?.unlocked.some(a => a.id === ach.id);
            return (
              <div key={ach.id} class="card-hover"
                style={{ background: unlocked ? '#FFF' : '#F9F9FB', borderRadius: 12, border: `1.5px solid ${unlocked ? '#5856D6' : '#E5E5EA'}`, padding: 14, opacity: unlocked ? 1 : 0.6, boxShadow: unlocked ? '0 2px 8px rgba(88,86,214,.1)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 28 }}>{ach.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: unlocked ? '#1D1D1F' : '#86868B' }}>{ach.name}</div>
                    <div style={{ fontSize: 10, color: '#86868B' }}>{ach.description}</div>
                  </div>
                  {unlocked && <Icon name="CheckCircle2" size={16} color="#5856D6" />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── HOUSES ── */}
      {tab === 'houses' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
            {houseTotals.map(([house, points], i) => {
              const h = HOUSES[house as House];
              const members = leaderboard.filter(e => e.house === house);
              return (
                <div key={house} class="card-hover"
                  style={{ background: '#FFF', borderRadius: 14, border: `1.5px solid ${h.color}30`, padding: 16, textAlign: 'center', boxShadow: i === 0 ? `0 4px 16px ${h.color}15` : 'none' }}>
                  <div style={{ fontSize: 36 }}>{h.emoji}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: h.color, marginTop: 4 }}>{h.name}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: h.color, marginTop: 4 }}>{points}</div>
                  <div style={{ fontSize: 9, color: '#86868B' }}>puntos · {members.length} magos</div>
                  {i === 0 && points > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: '#FF9500', marginTop: 4 }}>Copa de las Casas</div>}
                  <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 6 }}>
                    {members.slice(0, 5).map(m => <span key={m.member.id} style={{ fontSize: 14 }} title={m.member.name}>{m.member.avatar || '🧙'}</span>)}
                  </div>
                </div>
              );
            })}
          </div>

          <p style={{ fontSize: 11, color: '#86868B', textAlign: 'center' }}>Elige tu casa desde tu perfil</p>
        </div>
      )}
    </div>
  );
}
