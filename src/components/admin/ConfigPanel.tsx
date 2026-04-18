// ═══ CONFIG PANEL — Editable global settings ═══
import { useState, useEffect } from 'preact/hooks';
import { Icon } from '@components/common/Icon';
import { playCelebration } from '../retro/Celebration';
import { TIER_CONFIG, type RetroTier } from '@domain/gamification';
import { PHASES, DEFAULT_TASKS, NOTE_CATEGORIES } from '../../config/retro';

// Settings storage (localStorage + future Supabase)
const SETTINGS_KEY = 'revelio-settings';
function loadSettings(): Record<string, unknown> {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
}
function saveSettings(s: Record<string, unknown>) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

const cardS = { background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 };
const inputS = { padding: '6px 10px', borderRadius: 8, border: '1.5px solid #E5E5EA', fontSize: 12, outline: 'none', fontFamily: 'inherit', background: '#F9F9FB', width: '100%', boxSizing: 'border-box' as const };
const labelS = { fontSize: 9, fontWeight: 700 as number, color: '#86868B', textTransform: 'uppercase' as const, marginBottom: 2, display: 'block' };

type Section = 'retro' | 'project' | 'display' | 'notifications';

export function ConfigPanel() {
  const [section, setSection] = useState<Section>('retro');
  const [playing, setPlaying] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, unknown>>(loadSettings);
  const [saved, setSaved] = useState(false);

  const get = (key: string, def: unknown) => settings[key] ?? def;
  const set = (key: string, val: unknown) => {
    const next = { ...settings, [key]: val };
    setSettings(next);
    saveSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const sections: Array<{ id: Section; label: string; icon: string }> = [
    { id: 'retro', label: 'Retrospectivas', icon: 'RotateCcw' },
    { id: 'project', label: 'Proyectos', icon: 'FolderOpen' },
    { id: 'display', label: 'Visualización', icon: 'Monitor' },
    { id: 'notifications', label: 'Notificaciones', icon: 'Bell' },
  ];

  const previewTier = (tier: RetroTier) => {
    setPlaying(tier);
    playCelebration(tier);
    setTimeout(() => setPlaying(null), tier === 'nox' ? 1500 : tier === 'lumos' ? 3000 : 9000);
  };

  const phaseTimers = (get('phaseTimers', [5, 8, 10, 10, 10, 5]) as number[]);
  const maxVotes = get('maxVotesPerPerson', 0) as number; // 0 = unlimited
  const blindMode = get('blindMode', true) as boolean;
  const autoAdvance = get('autoAdvance', false) as boolean;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Configuración</h2>
        {saved && <span style={{ fontSize: 11, color: '#34C759', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="Check" size={12} color="#34C759" /> Guardado</span>}
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: section === s.id ? '#1D1D1F' : '#F2F2F7', color: section === s.id ? '#FFF' : '#6E6E73', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name={s.icon} size={12} color={section === s.id ? '#FFF' : '#86868B'} />
            {s.label}
          </button>
        ))}
      </div>

      {/* ═══ RETROSPECTIVAS ═══ */}
      {section === 'retro' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Celebration tiers */}
          <div style={cardS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Icon name="Sparkles" size={14} color="#5856D6" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Finales de retrospectiva</span>
            </div>
            <p style={{ fontSize: 11, color: '#86868B', marginBottom: 10 }}>Click para previsualizar cada nivel de celebración.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {(['nox', 'lumos', 'revelio', 'patronum'] as RetroTier[]).map(tier => {
                const cfg = TIER_CONFIG[tier];
                return (
                  <button key={tier} onClick={() => previewTier(tier)} disabled={playing !== null}
                    style={{ padding: 12, borderRadius: 12, border: `2px solid ${cfg.color}30`, background: playing === tier ? cfg.color + '15' : '#FFF', cursor: playing ? 'wait' : 'pointer', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: cfg.color, textTransform: 'uppercase' }}>{cfg.name}</div>
                    <div style={{ fontSize: 9, color: '#86868B', marginTop: 2 }}>{cfg.spell}</div>
                    <div style={{ fontSize: 9, color: cfg.color, marginTop: 4, fontWeight: 600 }}>Score {cfg.minScore}+</div>
                    <div style={{ marginTop: 6, padding: '3px 8px', borderRadius: 6, background: cfg.color + '12', color: cfg.color, fontSize: 9, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <Icon name="Play" size={8} color={cfg.color} /> Preview
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 10, padding: 8, background: '#F9F9FB', borderRadius: 8, fontSize: 10, color: '#6E6E73' }}>
              <strong>Criterios:</strong> Participación ≥80% → 25pts · ≥3 notas/persona → 25pts · ≥5 acciones → 20pts · Votos ≥2×participantes → 15pts · Riesgos → 10pts · Objetivo → 5pts
            </div>
          </div>

          {/* Phase timers */}
          <div style={cardS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Icon name="Clock" size={14} color="#007AFF" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Temporizadores por fase (minutos)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
              {PHASES.map((p, i) => (
                <div key={i}>
                  <label style={labelS}>{p.label}</label>
                  <input type="number" min="1" max="60" value={phaseTimers[i] || 5}
                    onInput={e => { const v = [...phaseTimers]; v[i] = parseInt((e.target as HTMLInputElement).value) || 5; set('phaseTimers', v); }}
                    style={{ ...inputS, textAlign: 'center', fontWeight: 700 }} />
                </div>
              ))}
            </div>
          </div>

          {/* Voting & behavior */}
          <div style={cardS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Icon name="Settings" size={14} color="#34C759" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Comportamiento</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelS}>Max votos/persona</label>
                <input type="number" min="0" max="20" value={maxVotes}
                  onInput={e => set('maxVotesPerPerson', parseInt((e.target as HTMLInputElement).value) || 0)}
                  style={inputS} />
                <div style={{ fontSize: 9, color: '#86868B', marginTop: 2 }}>0 = ilimitados</div>
              </div>
              <div>
                <label style={labelS}>Modo Blind (Fase 2)</label>
                <button onClick={() => set('blindMode', !blindMode)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1.5px solid #E5E5EA', background: blindMode ? '#34C75915' : '#F9F9FB', fontSize: 12, fontWeight: 600, color: blindMode ? '#34C759' : '#86868B', cursor: 'pointer' }}>
                  {blindMode ? 'Activo' : 'Desactivado'}
                </button>
              </div>
              <div>
                <label style={labelS}>Auto-avance fases</label>
                <button onClick={() => set('autoAdvance', !autoAdvance)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1.5px solid #E5E5EA', background: autoAdvance ? '#34C75915' : '#F9F9FB', fontSize: 12, fontWeight: 600, color: autoAdvance ? '#34C759' : '#86868B', cursor: 'pointer' }}>
                  {autoAdvance ? 'Activo' : 'Desactivado'}
                </button>
              </div>
            </div>
          </div>

          {/* Default tasks per methodology */}
          <div style={cardS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Icon name="ListChecks" size={14} color="#FF9500" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Tareas por metodología</span>
            </div>
            {Object.entries(DEFAULT_TASKS).map(([tipo, tasks]) => (
              <div key={tipo} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#5856D6', marginBottom: 3 }}>{tipo.charAt(0).toUpperCase() + tipo.slice(1)} ({tasks.length})</div>
                {tasks.map((t, i) => <div key={i} style={{ fontSize: 10, color: '#6E6E73', padding: '2px 8px', borderRadius: 4, background: '#F9F9FB', marginBottom: 2 }}>{t.text}</div>)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ PROYECTOS ═══ */}
      {section === 'project' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Escalation thresholds */}
          <div style={cardS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Icon name="AlertTriangle" size={14} color="#FF9500" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Umbrales de escalado (días sin respuesta)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { key: 'esc_jp', label: 'Jefe de Proyecto', def: 5 },
                { key: 'esc_sm', label: 'Service Manager', def: 3 },
                { key: 'esc_dt', label: 'Dirección Técnica', def: 2 },
              ].map(l => (
                <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, background: '#F9F9FB' }}>
                  <span style={{ fontWeight: 600, fontSize: 12, flex: 1 }}>{l.label}</span>
                  <input type="number" min="1" max="30" value={get(l.key, l.def) as number}
                    onInput={e => set(l.key, parseInt((e.target as HTMLInputElement).value) || l.def)}
                    style={{ width: 60, textAlign: 'center', padding: '4px 6px', borderRadius: 6, border: '1.5px solid #E5E5EA', fontSize: 12, fontWeight: 700, outline: 'none' }} />
                  <span style={{ fontSize: 10, color: '#86868B' }}>días</span>
                </div>
              ))}
            </div>
          </div>

          {/* KPI targets */}
          <div style={cardS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Icon name="BarChart3" size={14} color="#5856D6" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>KPIs objetivo</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { key: 'kpi_tasks_green', label: 'Accionables al día (%)', def: 80 },
                { key: 'kpi_risks_max', label: 'Max riesgos críticos', def: 2 },
                { key: 'kpi_escalated_pct', label: 'Escalados resueltos (%)', def: 90 },
              ].map(k => (
                <div key={k.key}>
                  <label style={labelS}>{k.label}</label>
                  <input type="number" min="0" max="100" value={get(k.key, k.def) as number}
                    onInput={e => set(k.key, parseInt((e.target as HTMLInputElement).value) || k.def)}
                    style={inputS} />
                </div>
              ))}
            </div>
          </div>

          {/* Sprint length */}
          <div style={cardS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Icon name="Calendar" size={14} color="#007AFF" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Iteración</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelS}>Duración (semanas)</label>
                <input type="number" min="1" max="8" value={get('sprintWeeks', 2) as number}
                  onInput={e => set('sprintWeeks', parseInt((e.target as HTMLInputElement).value) || 2)}
                  style={inputS} />
              </div>
              <div>
                <label style={labelS}>WIP limit (Kanban)</label>
                <input type="number" min="0" max="20" value={get('wipLimit', 0) as number}
                  onInput={e => set('wipLimit', parseInt((e.target as HTMLInputElement).value) || 0)}
                  style={inputS} />
                <div style={{ fontSize: 9, color: '#86868B', marginTop: 2 }}>0 = sin límite</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ VISUALIZACIÓN ═══ */}
      {section === 'display' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={cardS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Icon name="Palette" size={14} color="#AF52DE" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Tema</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { id: 'hogwarts', label: 'Hogwarts', desc: 'Casas, hechizos, patronus' },
                { id: 'corporate', label: 'Corporate', desc: 'Sin gamificación' },
                { id: 'minimal', label: 'Minimal', desc: 'Solo datos' },
              ].map(t => {
                const active = (get('theme', 'hogwarts') as string) === t.id;
                return (
                  <button key={t.id} onClick={() => set('theme', t.id)}
                    style={{ flex: 1, padding: '10px', borderRadius: 10, background: active ? '#5856D610' : '#F9F9FB', border: active ? '2px solid #5856D6' : '1.5px solid #E5E5EA', textAlign: 'center', cursor: 'pointer' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: active ? '#5856D6' : '#6E6E73' }}>{t.label}</div>
                    <div style={{ fontSize: 9, color: '#86868B', marginTop: 2 }}>{t.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={cardS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Icon name="Languages" size={14} color="#007AFF" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Idioma y formato</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div>
                <label style={labelS}>Idioma</label>
                <select value={get('lang', 'es') as string} onChange={e => set('lang', (e.target as HTMLSelectElement).value)} style={inputS}>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <label style={labelS}>Formato números</label>
                <select value={get('numFormat', 'es') as string} onChange={e => set('numFormat', (e.target as HTMLSelectElement).value)} style={inputS}>
                  <option value="es">1.234,5</option>
                  <option value="en">1,234.5</option>
                </select>
              </div>
              <div>
                <label style={labelS}>Formato fecha</label>
                <select value={get('dateFormat', 'dd/mm/yyyy') as string} onChange={e => set('dateFormat', (e.target as HTMLSelectElement).value)} style={inputS}>
                  <option value="dd/mm/yyyy">dd/mm/yyyy</option>
                  <option value="mm/dd/yyyy">mm/dd/yyyy</option>
                  <option value="yyyy-mm-dd">yyyy-mm-dd</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ NOTIFICACIONES ═══ */}
      {section === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={cardS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Icon name="Bell" size={14} color="#FF9500" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Alertas automáticas</span>
            </div>
            {[
              { key: 'alert_risk_stale', label: 'Riesgo escalado sin respuesta', desc: 'Notifica al nivel superior tras X días' },
              { key: 'alert_action_due', label: 'Accionable vencido', desc: 'Notifica al responsable y al SM' },
              { key: 'alert_retro_missing', label: 'Iteración sin retro', desc: 'Recuerda al SM que falta la retrospectiva' },
              { key: 'alert_skill_eval', label: 'Evaluación de skills pendiente', desc: 'Cuando llega la fecha target de reevaluación' },
              { key: 'alert_vac_pending', label: 'Vacaciones no aprobadas', desc: 'Alerta al manager si hay solicitudes pendientes' },
              { key: 'alert_fte_low', label: 'FTE bajo en proyecto', desc: 'Dedicación cae por debajo de umbral' },
            ].map(a => {
              const active = get(a.key, a.key === 'alert_risk_stale' || a.key === 'alert_action_due' || a.key === 'alert_skill_eval') as boolean;
              return (
                <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: '#F9F9FB', marginBottom: 4 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{a.label}</div>
                    <div style={{ fontSize: 10, color: '#86868B' }}>{a.desc}</div>
                  </div>
                  <button onClick={() => set(a.key, !active)}
                    style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: active ? '#34C759' : '#E5E5EA', color: '#FFF', fontSize: 10, fontWeight: 700, cursor: 'pointer', minWidth: 40 }}>
                    {active ? 'ON' : 'OFF'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
