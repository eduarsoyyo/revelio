import { useState, useMemo } from 'react'
import { Umbrella, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Member } from '@/types'

const MO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DY = ['L','M','X','J','V','S','D']

const ABSENCE_TYPES: Record<string, { label: string; initial: string; color: string; bg: string }> = {
  vacaciones:       { label: 'Vacaciones',       initial: 'V', color: '#FF9500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  baja_medica:      { label: 'Baja médica',      initial: 'B', color: '#FF3B30', bg: 'bg-red-100 dark:bg-red-900/30' },
  asuntos_propios:  { label: 'Asuntos propios',  initial: 'A', color: '#5856D6', bg: 'bg-violet-100 dark:bg-violet-900/30' },
  formacion:        { label: 'Formación',         initial: 'F', color: '#007AFF', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  permiso_retribuido: { label: 'Permiso retrib.', initial: 'P', color: '#34C759', bg: 'bg-green-100 dark:bg-green-900/30' },
  matrimonio:       { label: 'Matrimonio',        initial: 'M', color: '#AF52DE', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  nacimiento:       { label: 'Nacimiento',        initial: 'N', color: '#FF2D55', bg: 'bg-pink-100 dark:bg-pink-900/30' },
  fallecimiento_1g: { label: 'Fallecimiento 1º',  initial: '†', color: '#1D1D1F', bg: 'bg-gray-200 dark:bg-gray-700' },
  fallecimiento_2g: { label: 'Fallecimiento 2º',  initial: '†', color: '#3A3A3C', bg: 'bg-gray-200 dark:bg-gray-700' },
  mudanza:          { label: 'Mudanza',            initial: 'U', color: '#8E8E93', bg: 'bg-gray-100 dark:bg-gray-800' },
}

interface VacEntry { id?: string; from: string; to?: string; type?: string; label?: string; note?: string }
interface VacationsPanelProps { team: Member[] }

export function VacationsPanel({ team }: VacationsPanelProps) {
  const now = new Date()
  const [yr, setYr] = useState(now.getFullYear())
  const [view, setView] = useState<'resumen' | 'calendario'>('resumen')
  const [mo, setMo] = useState(now.getMonth())
  const [expanded, setExpanded] = useState<string | null>(null)

  const isWk = (d: Date) => d.getDay() === 0 || d.getDay() === 6

  // Per-member stats
  const stats = useMemo(() => team.map(m => {
    const vacs = (m.vacations || []) as unknown as VacEntry[]
    let usedVac = 0; let ausDays = 0
    const byType: Record<string, number> = {}
    vacs.forEach(v => {
      if (!v.from) return
      const type = v.type || 'vacaciones'
      const d = new Date(v.from); const to = new Date(v.to || v.from)
      while (d <= to) {
        if (d.getFullYear() === yr && !isWk(d)) {
          if (type === 'vacaciones') usedVac++; else ausDays++
          byType[type] = (byType[type] || 0) + 1
        }
        d.setDate(d.getDate() + 1)
      }
    })
    const annual = m.annual_vac_days || 22; const prev = m.prev_year_pending || 0
    const total = annual + prev; const remaining = Math.max(0, total - usedVac)
    return { id: m.id, name: m.name, avatar: m.avatar, color: m.color, usedVac, ausDays, annual, prev, total, remaining, byType, vacs }
  }), [team, yr])

  // Monthly calendar data for a member
  const getMonthDays = (memberId: string) => {
    const m = team.find(t => t.id === memberId)
    if (!m) return []
    const vacs = (m.vacations || []) as unknown as VacEntry[]
    const dim = new Date(yr, mo + 1, 0).getDate()
    const days: Array<{ d: number; ds: string; wk: boolean; vac: VacEntry | null }> = []
    for (let d = 1; d <= dim; d++) {
      const ds = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dt = new Date(ds)
      const vac = vacs.find(v => v.from && v.from <= ds && (!v.to || v.to >= ds)) || null
      days.push({ d, ds, wk: isWk(dt), vac })
    }
    return days
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold dark:text-revelio-dark-text flex items-center gap-1.5">
            <Umbrella className="w-4 h-4 text-revelio-orange" /> Vacaciones y Ausencias
          </h3>
          <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">{team.length} personas · {yr}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-revelio-bg dark:bg-revelio-dark-border rounded-lg overflow-hidden">
            {(['resumen', 'calendario'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className={`px-3 py-1 text-[10px] font-semibold capitalize ${view === v ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'}`}>{v}</button>
            ))}
          </div>
          {view === 'calendario' && (
            <div className="flex items-center gap-1">
              <button onClick={() => mo > 0 ? setMo(mo - 1) : (setMo(11), setYr(yr - 1))} className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><ChevronLeft className="w-3 h-3" /></button>
              <span className="text-xs font-semibold dark:text-revelio-dark-text w-24 text-center">{MO[mo]} {yr}</span>
              <button onClick={() => mo < 11 ? setMo(mo + 1) : (setMo(0), setYr(yr + 1))} className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><ChevronRight className="w-3 h-3" /></button>
            </div>
          )}
          {view === 'resumen' && (
            <div className="flex items-center gap-1">
              <button onClick={() => setYr(yr - 1)} className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><ChevronLeft className="w-3 h-3" /></button>
              <span className="text-xs font-semibold dark:text-revelio-dark-text w-12 text-center">{yr}</span>
              <button onClick={() => setYr(yr + 1)} className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"><ChevronRight className="w-3 h-3" /></button>
            </div>
          )}
        </div>
      </div>

      {/* RESUMEN VIEW — table with bars */}
      {view === 'resumen' && (
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card overflow-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-revelio-bg dark:bg-revelio-dark-border">
                <th className="px-3 py-2 text-left font-semibold text-revelio-subtle dark:text-revelio-dark-subtle">Persona</th>
                <th className="px-2 py-2 text-center font-semibold text-revelio-subtle dark:text-revelio-dark-subtle">Disponible</th>
                <th className="px-2 py-2 text-center font-semibold text-revelio-subtle dark:text-revelio-dark-subtle">Usados</th>
                <th className="px-2 py-2 text-center font-semibold text-revelio-subtle dark:text-revelio-dark-subtle">Restantes</th>
                <th className="px-2 py-2 text-center font-semibold text-revelio-subtle dark:text-revelio-dark-subtle">Ausencias</th>
                <th className="px-3 py-2 text-left font-semibold text-revelio-subtle dark:text-revelio-dark-subtle w-48">Progreso</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s, i) => {
                const pct = s.total > 0 ? Math.round(s.usedVac / s.total * 100) : 0
                return (
                  <tr key={s.id} className={`border-t border-revelio-border/50 dark:border-revelio-dark-border/50 cursor-pointer hover:bg-revelio-bg/50 dark:hover:bg-revelio-dark-border/30 ${i % 2 ? 'bg-revelio-bg/20 dark:bg-revelio-dark-border/10' : ''}`}
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span>{s.avatar || '👤'}</span>
                        <span className="font-medium dark:text-revelio-dark-text">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-center font-semibold dark:text-revelio-dark-text">{s.total}<span className="text-revelio-subtle dark:text-revelio-dark-subtle font-normal"> d</span></td>
                    <td className="px-2 py-2.5 text-center font-semibold text-revelio-orange">{s.usedVac}</td>
                    <td className="px-2 py-2.5 text-center font-semibold text-revelio-green">{s.remaining}</td>
                    <td className="px-2 py-2.5 text-center font-semibold text-revelio-red">{s.ausDays > 0 ? s.ausDays : '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-revelio-bg dark:bg-revelio-dark-border rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct > 80 ? '#FF3B30' : pct > 50 ? '#FF9500' : '#34C759' }} />
                        </div>
                        <span className="text-[9px] font-bold dark:text-revelio-dark-text w-8">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Expanded detail */}
          {expanded && (() => {
            const s = stats.find(x => x.id === expanded)
            if (!s) return null
            const entries = s.vacs.filter((v: VacEntry) => {
              if (!v.from) return false
              return v.from.startsWith(String(yr)) || (v.to && v.to.startsWith(String(yr)))
            })
            return (
              <div className="border-t border-revelio-border dark:border-revelio-dark-border px-4 py-3 bg-revelio-bg/30 dark:bg-revelio-dark-border/20">
                <div className="flex gap-3 mb-2 flex-wrap">
                  {Object.entries(s.byType).map(([type, days]) => {
                    const t = ABSENCE_TYPES[type] || { label: type, initial: '?', color: '#86868B' }
                    return (
                      <span key={type} className="text-[9px] font-semibold flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
                        {t.label}: {days}d
                      </span>
                    )
                  })}
                </div>
                {entries.length > 0 ? (
                  <div className="space-y-1">
                    {entries.map((v: VacEntry, i: number) => {
                      const t = ABSENCE_TYPES[v.type || 'vacaciones'] || ABSENCE_TYPES['vacaciones']!
                      const from = new Date(v.from).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
                      const to = v.to ? new Date(v.to).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : from
                      return (
                        <div key={i} className="flex items-center gap-2 text-[10px]">
                          <span className="w-4 h-4 rounded flex items-center justify-center text-white text-[8px] font-bold" style={{ background: t.color }}>{t.initial}</span>
                          <span className="font-medium dark:text-revelio-dark-text">{from}{v.to && v.to !== v.from ? ` → ${to}` : ''}</span>
                          <span className="text-revelio-subtle dark:text-revelio-dark-subtle">{t.label}</span>
                          {v.label && <span className="text-revelio-subtle dark:text-revelio-dark-subtle italic">({v.label})</span>}
                          {v.note && <span className="text-revelio-subtle dark:text-revelio-dark-subtle italic">({v.note})</span>}
                        </div>
                      )
                    })}
                  </div>
                ) : <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">Sin registros en {yr}</p>}
              </div>
            )
          })()}
        </div>
      )}

      {/* CALENDARIO VIEW — monthly grid per person */}
      {view === 'calendario' && (
        <div className="space-y-3">
          {team.map(m => {
            const days = getMonthDays(m.id)
            const offset = (new Date(yr, mo, 1).getDay() + 6) % 7
            const vacDays = days.filter(d => d.vac && !d.wk).length

            return (
              <div key={m.id} className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: m.color || '#007AFF' }}>{m.avatar || '👤'}</div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold dark:text-revelio-dark-text">{m.name}</p>
                    <p className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">{m.role_label || '—'}</p>
                  </div>
                  {vacDays > 0 && <span className="text-[10px] font-semibold text-revelio-orange">{vacDays} días</span>}
                </div>

                <div className="grid grid-cols-7 gap-0.5 text-[9px]">
                  {DY.map(d => <div key={d} className="text-center font-bold text-revelio-subtle dark:text-revelio-dark-subtle py-0.5">{d}</div>)}
                  {Array.from({ length: offset }, (_, i) => <div key={`e${i}`} />)}
                  {days.map(d => {
                    const t = d.vac ? (ABSENCE_TYPES[d.vac.type || 'vacaciones'] || ABSENCE_TYPES['vacaciones']!) : null
                    return (
                      <div key={d.d}
                        title={d.vac ? `${t?.label}: ${d.vac.label || d.vac.note || ''}` : ''}
                        className={`rounded px-0.5 py-1 text-center ${d.wk ? 'bg-revelio-bg dark:bg-revelio-dark-border' : d.vac ? (t?.bg || 'bg-orange-100') : ''}`}>
                        <div className={`font-semibold ${d.vac ? '' : d.wk ? 'text-revelio-subtle dark:text-revelio-dark-subtle' : 'dark:text-revelio-dark-text'}`}
                          style={d.vac ? { color: t?.color } : undefined}>
                          {d.d}
                        </div>
                        {d.vac && !d.wk && <div className="text-[7px] font-bold" style={{ color: t?.color }}>{t?.initial}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-3 mt-3 text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle flex-wrap">
        {Object.entries(ABSENCE_TYPES).slice(0, 5).map(([id, t]) => (
          <span key={id} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />{t.label}
          </span>
        ))}
      </div>
    </div>
  )
}
