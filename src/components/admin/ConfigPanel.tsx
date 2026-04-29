import { useState } from 'react'
import { Settings, Clock, Eye, AlertTriangle, Bell, Palette } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'

const SETTINGS_KEY = 'revelio-settings'
function loadSettings(): Record<string, unknown> { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') } catch { return {} } }
function saveSettingsToStorage(s: Record<string, unknown>) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) }

type Section = 'retro' | 'project' | 'display'

const DEFAULT_TASKS: Record<string, string[]> = {
  agile: ['Revisión del Sprint Backlog', 'Demo de funcionalidades', 'Revisión de criterios de aceptación', 'Actualización del Product Backlog', 'Velocity y métricas del sprint'],
  waterfall: ['Revisión de entregables', 'Verificación de criterios de salida', 'Revisión de riesgos', 'Actualización del cronograma', 'Validación de calidad'],
  itil: ['Revisión de incidencias', 'Estado de problemas abiertos', 'Revisión de cambios', 'Cumplimiento de SLAs', 'Disponibilidad del servicio'],
  kanban: ['Revisión del tablero', 'WIP limits check', 'Cycle time analysis', 'Bloqueantes activos', 'Mejoras de flujo'],
}

export function ConfigPanel() {
  const [section, setSection] = useState<Section>('retro')
  const { mode, setMode, schedule, setSchedule } = useTheme()
  const [settings, setSettings] = useState<Record<string, unknown>>(loadSettings)
  const [saved, setSaved] = useState(false)

  const get = (key: string, def: unknown) => settings[key] ?? def
  const set = (key: string, val: unknown) => {
    const next = { ...settings, [key]: val }
    setSettings(next)
    saveSettingsToStorage(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const timerDefault = get('timerDefault', 300) as number
  const blindMode = get('blindMode', false) as boolean
  const autoAdvance = get('autoAdvance', false) as boolean
  const celebration = get('celebration', true) as boolean
  const margins = {
    critical: get('margin_critical', 3) as number,
    moderate: get('margin_moderate', 5) as number,
    low: get('margin_low', 7) as number,
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-revelio-text dark:text-revelio-dark-text flex items-center gap-2"><Settings className="w-5 h-5 text-revelio-subtle dark:text-revelio-dark-subtle" /> Configuración</h2>
          <p className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">Ajustes globales de la plataforma</p>
        </div>
        {saved && <span className="text-xs text-revelio-green font-medium bg-revelio-green/10 px-2.5 py-1 rounded-lg">Guardado</span>}
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 mb-5">
        {([
          { id: 'retro' as Section, label: 'Retrospectiva', icon: Clock },
          { id: 'project' as Section, label: 'Proyectos', icon: AlertTriangle },
          { id: 'display' as Section, label: 'Apariencia', icon: Palette },
        ]).map(s => (
          <button key={s.id} onClick={() => setSection(s.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${section === s.id ? 'bg-revelio-text text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle hover:bg-revelio-border/50'}`}>
            <s.icon className="w-3.5 h-3.5" /> {s.label}
          </button>
        ))}
      </div>

      {/* RETRO */}
      {section === 'retro' && (
        <div className="space-y-4">
          <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-5">
            <h3 className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text mb-3 flex items-center gap-1.5"><Clock className="w-4 h-4 text-revelio-blue" /> Timer por defecto</h3>
            <div className="flex gap-2">
              {[3, 5, 10, 15].map(m => (
                <button key={m} onClick={() => set('timerDefault', m * 60)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${timerDefault === m * 60 ? 'bg-revelio-blue text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle hover:bg-revelio-border/50'}`}>
                  {m} min
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-5">
            <h3 className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text mb-3 flex items-center gap-1.5"><Eye className="w-4 h-4 text-revelio-violet" /> Modo de las retros</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase block mb-1.5">Blind mode</label>
                <button onClick={() => set('blindMode', !blindMode)}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors ${blindMode ? 'bg-revelio-green/15 text-revelio-green' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}>
                  {blindMode ? 'Activo' : 'Desactivado'}
                </button>
                <p className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle mt-1">Notas con colores anónimos</p>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-revelio-subtle dark:text-revelio-dark-subtle uppercase block mb-1.5">Auto-avance fases</label>
                <button onClick={() => set('autoAdvance', !autoAdvance)}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors ${autoAdvance ? 'bg-revelio-green/15 text-revelio-green' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}>
                  {autoAdvance ? 'Activo' : 'Desactivado'}
                </button>
                <p className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle mt-1">Avanza fase al acabar timer</p>
              </div>
            </div>
          </div>

          <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-5">
            <h3 className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text mb-3">Celebración al finalizar</h3>
            <button onClick={() => set('celebration', !celebration)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${celebration ? 'bg-revelio-green/15 text-revelio-green' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle'}`}>
              {celebration ? 'Activa' : 'Desactivada'}
            </button>
          </div>

          <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-5">
            <h3 className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text mb-3">Tareas por metodología</h3>
            {Object.entries(DEFAULT_TASKS).map(([tipo, tasks]) => (
              <div key={tipo} className="mb-3">
                <h4 className="text-xs font-semibold text-revelio-violet capitalize mb-1">{tipo} ({tasks.length})</h4>
                <div className="space-y-0.5">
                  {tasks.map((t, i) => <p key={i} className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle bg-revelio-bg dark:bg-revelio-dark-border rounded px-2 py-1">{t}</p>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PROJECT */}
      {section === 'project' && (
        <div className="space-y-4">
          <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-5">
            <h3 className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text mb-3 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-revelio-orange" /> Umbrales de escalado (días sin respuesta)</h3>
            <div className="grid grid-cols-3 gap-3">
              {([
                { key: 'critical' as const, label: 'Crítico', color: 'revelio-red' },
                { key: 'moderate' as const, label: 'Moderado', color: 'revelio-orange' },
                { key: 'low' as const, label: 'Bajo', color: 'revelio-green' },
              ]).map(m => (
                <div key={m.key} className={`rounded-lg border border-${m.color}/20 bg-${m.color}/5 p-3`}>
                  <label className={`text-[10px] font-semibold text-${m.color} block mb-1.5`}>{m.label}</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min={1} max={30} value={margins[m.key]}
                      onChange={e => set(`margin_${m.key}`, parseInt(e.target.value) || 1)}
                      className="w-16 rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1.5 text-sm font-semibold text-center outline-none" />
                    <span className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle">días</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-5">
            <h3 className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text mb-3 flex items-center gap-1.5"><Bell className="w-4 h-4 text-revelio-blue" /> Notificaciones</h3>
            {['Accionables vencidos', 'Riesgos escalados', 'Nuevas asignaciones'].map(n => (
              <label key={n} className="flex items-center gap-2.5 py-2 border-b border-revelio-border dark:border-revelio-dark-border/50 last:border-0 text-xs cursor-pointer">
                <input type="checkbox" defaultChecked className="accent-revelio-blue" /> {n}
              </label>
            ))}
            <p className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle mt-2">Las notificaciones se implementarán con Supabase Edge Functions</p>
          </div>
        </div>
      )}

      {/* DISPLAY */}
      {section === 'display' && (
        <div className="space-y-4">
          <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-5">
            <h3 className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text mb-3 flex items-center gap-1.5"><Palette className="w-4 h-4 text-revelio-violet" /> Tema</h3>
            <div className="flex gap-2 flex-wrap">
              {([
                { id: 'light' as const, label: 'Claro', icon: '☀️' },
                { id: 'dark' as const, label: 'Oscuro', icon: '🌙' },
                { id: 'auto' as const, label: 'Automático', icon: '🖥️' },
                { id: 'schedule' as const, label: 'Programado', icon: '🕐' },
              ]).map(t => (
                <button key={t.id} onClick={() => setMode(t.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${mode === t.id ? 'bg-revelio-blue text-white' : 'bg-revelio-bg dark:bg-revelio-dark-border text-revelio-subtle dark:text-revelio-dark-subtle hover:bg-revelio-border dark:hover:bg-revelio-dark-bg'}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            {mode === 'auto' && <p className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle mt-2">Sigue la preferencia de tu sistema operativo</p>}
            {mode === 'schedule' && (
              <div className="mt-3 flex items-center gap-3 text-xs">
                <span className="text-revelio-subtle dark:text-revelio-dark-subtle">Oscuro de</span>
                <input type="time" value={schedule.darkFrom} onChange={e => setSchedule({ ...schedule, darkFrom: e.target.value })} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" />
                <span className="text-revelio-subtle dark:text-revelio-dark-subtle">a</span>
                <input type="time" value={schedule.darkTo} onChange={e => setSchedule({ ...schedule, darkTo: e.target.value })} className="rounded-lg border border-revelio-border dark:border-revelio-dark-border px-2 py-1 text-xs outline-none dark:bg-revelio-dark-bg dark:text-revelio-dark-text" />
              </div>
            )}
          </div>

          <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-5">
            <h3 className="text-sm font-semibold text-revelio-text dark:text-revelio-dark-text mb-3">Formato</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div><span className="text-revelio-subtle dark:text-revelio-dark-subtle">Números:</span> <span className="font-semibold dark:text-revelio-dark-text">1.234,5 (español)</span></div>
              <div><span className="text-revelio-subtle dark:text-revelio-dark-subtle">Fechas:</span> <span className="font-semibold dark:text-revelio-dark-text">dd/mm/yyyy</span></div>
              <div><span className="text-revelio-subtle dark:text-revelio-dark-subtle">Idioma:</span> <span className="font-semibold dark:text-revelio-dark-text">Español</span></div>
              <div><span className="text-revelio-subtle dark:text-revelio-dark-subtle">Zona horaria:</span> <span className="font-semibold dark:text-revelio-dark-text">Europe/Madrid</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
