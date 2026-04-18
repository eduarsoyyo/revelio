// ═══ CONFIG PANEL — Global settings for Revelio ═══
import { useState, useEffect } from 'preact/hooks';
import { Icon } from '@components/common/Icon';
import { playCelebration } from '../retro/Celebration';
import { TIER_CONFIG, type RetroTier } from '@domain/gamification';
import { PHASES, DEFAULT_TASKS, NOTE_CATEGORIES } from '../../config/retro';

async function sb() { return (await import('../../data/supabase')).supabase; }

// Load/save settings from rooms.metadata or a settings table
async function loadSettings(): Promise<Record<string, unknown>> {
  try { const s = await sb(); const { data } = await s.from('app_settings').select('*').limit(1).single(); return data || {}; } catch { return {}; }
}
async function saveSetting(key: string, value: unknown) {
  try { const s = await sb(); await s.from('app_settings').upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' }); } catch {}
}

const cardS = { background: '#FFF', borderRadius: 14, border: '1.5px solid #E5E5EA', padding: 16 };
const labelS = { fontSize: 10, fontWeight: 700 as number, color: '#86868B', display: 'block', marginBottom: 4, textTransform: 'uppercase' as const };

type Section = 'retro' | 'project' | 'display' | 'notifications';

export function ConfigPanel() {
  const [section, setSection] = useState<Section>('retro');
  const [playing, setPlaying] = useState<string | null>(null);

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

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14 }}>Configuración</h2>

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Icon name="Sparkles" size={14} color="#5856D6" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Finales de retrospectiva</span>
            </div>
            <p style={{ fontSize: 11, color: '#86868B', marginBottom: 12 }}>4 niveles de celebración según la calidad de la retro. Click para previsualizar.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {(['nox', 'lumos', 'revelio', 'patronum'] as RetroTier[]).map(tier => {
                const cfg = TIER_CONFIG[tier];
                return (
                  <button key={tier} onClick={() => previewTier(tier)} disabled={playing !== null}
                    style={{ padding: 14, borderRadius: 12, border: `2px solid ${cfg.color}30`, background: playing === tier ? cfg.color + '15' : '#FFF', cursor: playing ? 'wait' : 'pointer', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: cfg.color, textTransform: 'uppercase', letterSpacing: 0.5 }}>{cfg.name}</div>
                    <div style={{ fontSize: 9, color: '#86868B', marginTop: 2 }}>{cfg.spell}</div>
                    <div style={{ fontSize: 9, color: '#86868B', marginTop: 4 }}>Score: {cfg.minScore}+</div>
                    <div style={{ marginTop: 6, padding: '3px 8px', borderRadius: 6, background: cfg.color + '12', color: cfg.color, fontSize: 9, fontWeight: 600, display: 'inline-block' }}>
                      <Icon name="Play" size={8} color={cfg.color} /> Preview
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 10, padding: 10, background: '#F9F9FB', borderRadius: 8, fontSize: 10, color: '#6E6E73' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Criterios de puntuación (max 100):</div>
              <div>Participación ≥80% del equipo → 25pts · ≥3 notas/persona → 25pts · ≥5 acciones → 20pts</div>
              <div>Votos ≥2×participantes → 15pts · Riesgos revisados → 10pts · Objetivo cumplido → 5pts</div>
            </div>
          </div>

          {/* Phase timers */}
          <div style={cardS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Icon name="Clock" size={14} color="#007AFF" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Temporizadores por fase</span>
            </div>
            <p style={{ fontSize: 11, color: '#86868B', marginBottom: 10 }}>Tiempo sugerido para cada fase (en minutos). El facilitador puede ajustarlo durante la sesión.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {PHASES.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: '#F9F9FB' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#86868B', minWidth: 14 }}>{p.num}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{p.label}</span>
                  <span style={{ fontSize: 11, color: '#007AFF', fontWeight: 600 }}>{i === 0 ? '5' : i === 1 ? '8' : i === 2 ? '10' : i === 3 ? '10' : i === 4 ? '10' : '5'} min</span>
                </div>
              ))}
            </div>
          </div>

          {/* Note categories */}
          <div style={cardS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Icon name="Layers" size={14} color="#34C759" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Categorías de notas</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {NOTE_CATEGORIES.map(c => (
                <div key={c.id} style={{ flex: 1, textAlign: 'center', padding: '10px 6px', borderRadius: 10, background: c.bg, border: `1.5px solid ${c.color}20` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.label}</div>
                  <div style={{ fontSize: 9, color: '#86868B', marginTop: 2 }}>Predefinida</div>
                </div>
              ))}
            </div>
          </div>

          {/* Default tasks by methodology */}
          <div style={cardS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Icon name="ListChecks" size={14} color="#FF9500" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Tareas por metodología</span>
            </div>
            <p style={{ fontSize: 11, color: '#86868B', marginBottom: 10 }}>Checklist predefinido que se carga en la Fase 1 según el tipo de proyecto.</p>
            {Object.entries(DEFAULT_TASKS).map(([tipo, tasks]) => (
              <div key={tipo} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#5856D6', marginBottom: 4 }}>{tipo.charAt(0).toUpperCase() + tipo.slice(1)} ({tasks.length} tareas)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {tasks.map((t, i) => (
                    <div key={i} style={{ fontSize: 10, color: '#6E6E73', padding: '2px 8px', borderRadius: 4, background: '#F9F9FB' }}>
                      {t.text}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Voting config */}
          <div style={cardS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Icon name="ThumbsUp" size={14} color="#007AFF" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Votación</span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: '#F9F9FB' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B' }}>VOTOS POR PERSONA</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#007AFF', marginTop: 2 }}>Ilimitados</div>
              </div>
              <div style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: '#F9F9FB' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B' }}>MODO BLIND</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#34C759', marginTop: 2 }}>Activo (Fase 2)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PROYECTOS ═══ */}
      {section === 'project' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={cardS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Icon name="Settings" size={14} color="#007AFF" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Metodologías disponibles</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Agile', 'Waterfall', 'ITIL', 'Kanban'].map(m => (
                <div key={m} style={{ flex: 1, padding: '10px', borderRadius: 10, background: '#F9F9FB', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{m}</div>
                  <div style={{ fontSize: 9, color: '#34C759', marginTop: 2 }}>Activa</div>
                </div>
              ))}
            </div>
          </div>

          <div style={cardS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Icon name="AlertTriangle" size={14} color="#FF9500" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Umbrales de escalado</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11 }}>
              {[
                { level: 'Equipo', days: '—', desc: 'Gestión interna del equipo' },
                { level: 'Jefe de Proyecto', days: '5 días', desc: 'Se escala si no se resuelve en el equipo' },
                { level: 'Service Manager', days: '3 días', desc: 'Riesgo alto sin respuesta del JP' },
                { level: 'Dirección Técnica', days: '2 días', desc: 'Crítico sin respuesta del SM' },
              ].map(l => (
                <div key={l.level} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, background: '#F9F9FB' }}>
                  <span style={{ fontWeight: 700, minWidth: 120 }}>{l.level}</span>
                  <span style={{ color: '#007AFF', fontWeight: 600, minWidth: 50 }}>{l.days}</span>
                  <span style={{ color: '#86868B' }}>{l.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={cardS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Icon name="BarChart3" size={14} color="#5856D6" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>KPIs objetivo</span>
            </div>
            <p style={{ fontSize: 11, color: '#86868B', marginBottom: 8 }}>Targets para el semáforo del dashboard.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: 'Tareas al día', green: '≥80%', yellow: '50-79%', red: '<50%' },
                { label: 'Riesgos controlados', green: '0 críticos', yellow: '1-2', red: '≥3' },
                { label: 'Escalados resueltos', green: '≥90%', yellow: '70-89%', red: '<70%' },
              ].map(k => (
                <div key={k.label} style={{ flex: 1, padding: '8px', borderRadius: 8, background: '#F9F9FB', fontSize: 10 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{k.label}</div>
                  <div style={{ color: '#34C759' }}>{k.green}</div>
                  <div style={{ color: '#FF9500' }}>{k.yellow}</div>
                  <div style={{ color: '#FF3B30' }}>{k.red}</div>
                </div>
              ))}
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
              <span style={{ fontSize: 14, fontWeight: 700 }}>Tema visual</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { label: 'Hogwarts', desc: 'Casas, hechizos, patronus', active: true },
                { label: 'Corporate', desc: 'Sin gamificación', active: false },
                { label: 'Minimal', desc: 'Solo datos', active: false },
              ].map(t => (
                <div key={t.label} style={{ flex: 1, padding: '10px', borderRadius: 10, background: t.active ? '#5856D610' : '#F9F9FB', border: t.active ? '2px solid #5856D6' : '1.5px solid #E5E5EA', textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: t.active ? '#5856D6' : '#6E6E73' }}>{t.label}</div>
                  <div style={{ fontSize: 9, color: '#86868B', marginTop: 2 }}>{t.desc}</div>
                  {t.active && <div style={{ fontSize: 8, fontWeight: 700, color: '#34C759', marginTop: 4 }}>ACTIVO</div>}
                </div>
              ))}
            </div>
          </div>

          <div style={cardS}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Icon name="Languages" size={14} color="#007AFF" />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Idioma y formato</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: '#F9F9FB' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B' }}>IDIOMA</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>Español</div>
              </div>
              <div style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: '#F9F9FB' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B' }}>FORMATO NÚMEROS</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>1.234,5</div>
              </div>
              <div style={{ flex: 1, padding: '8px 12px', borderRadius: 8, background: '#F9F9FB' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#86868B' }}>FORMATO FECHA</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>dd/mm/yyyy</div>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Riesgo escalado sin respuesta', desc: 'Notifica al nivel superior tras X días', active: true },
                { label: 'Accionable vencido', desc: 'Notifica al responsable y al SM', active: true },
                { label: 'Sprint/iteración sin retro', desc: 'Recuerda al SM que falta la retrospectiva', active: false },
                { label: 'Evaluación de skills pendiente', desc: 'Recuerda reevaluación cuando llega la fecha target', active: true },
                { label: 'Vacaciones no aprobadas', desc: 'Alerta al manager si hay solicitudes pendientes', active: false },
                { label: 'FTE bajo en proyecto', desc: 'Alerta si la dedicación cae por debajo de umbral', active: false },
              ].map(a => (
                <div key={a.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: '#F9F9FB' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: a.active ? '#34C759' : '#E5E5EA' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{a.label}</div>
                    <div style={{ fontSize: 10, color: '#86868B' }}>{a.desc}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: a.active ? '#34C759' : '#C7C7CC' }}>{a.active ? 'ON' : 'OFF'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
