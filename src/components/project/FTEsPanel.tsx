import { useEffect, useState, useMemo } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Clock, Sun, Umbrella } from 'lucide-react'
import { fetchCalendarios } from '@/data/calendarios'
import { fetchOrgChartBySala } from '@/data/orgChart'
import { dedicationAt } from '@/services/team'
import type { Calendario, Member, OrgChartEntry } from '@/types'

const MO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const f1 = (n: number) => {
  const [i, d] = n.toFixed(1).split('.')
  return `${i!.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d}`
}

interface FTEsPanelProps {
  team: Member[]
  sala: string
}

export function FTEsPanel({ team, sala }: FTEsPanelProps) {
  const [orgData, setOrgData] = useState<OrgChartEntry[]>([])
  const [calendarios, setCalendarios] = useState<Calendario[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'anual' | 'mensual'>('anual')
  const now = new Date()
  const [yr, setYr] = useState(now.getFullYear())
  const [mo, setMo] = useState(now.getMonth())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchOrgChartBySala(sala), fetchCalendarios()])
      .then(([org, cals]) => {
        if (cancelled) return
        setOrgData(org)
        setCalendarios(cals)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sala])

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getCal = (m: Member): Calendario | null => {
    const cid = m.calendario_id
    return cid ? calendarios.find((c) => c.id === cid) ?? null : null
  }

  const isWk = (d: Date) => d.getDay() === 0 || d.getDay() === 6

  const isHoliday = (m: Member, ds: string) => {
    const cal = getCal(m)
    return cal ? (cal.holidays || []).some((h) => h.date === ds) : false
  }

  const getHolidayName = (m: Member, ds: string) => {
    const cal = getCal(m)
    if (!cal) return null
    const h = (cal.holidays || []).find((h) => h.date === ds)
    return h?.name || null
  }

  const isIntensive = (cal: Calendario | null, ds: string) => {
    if (!cal) return false
    const mmdd = ds.slice(5)
    const from = cal.intensive_from || '08-01'
    const to = cal.intensive_to || '08-31'
    return mmdd >= from && mmdd <= to
  }

  const baseHoursForDay = (m: Member, ds: string): number => {
    const d = new Date(ds)
    if (isWk(d)) return 0
    if (isHoliday(m, ds)) return 0
    const cal = getCal(m)
    const ded = dedicationAt(orgData, m.id, ds) || (orgData.some((o) => o.member_id === m.id) ? 0 : 1)
    if (ded === 0) return 0
    let baseH = 8
    if (cal) {
      if (isIntensive(cal, ds)) baseH = cal.daily_hours_intensive || 7
      else {
        const dow = d.getDay()
        baseH = dow >= 1 && dow <= 4 ? cal.daily_hours_lj || 8 : cal.daily_hours_v || 8
      }
    }
    return baseH * ded
  }

  const getAbsence = (m: Member, ds: string) =>
    (m.vacations || []).find((v: unknown) => {
      const vr = v as Record<string, string>
      return vr.from && vr.from <= ds && (!vr.to || vr.to >= ds)
    }) as Record<string, string> | undefined

  // ── Vacation stats ────────────────────────────────────────────────────────

  const vacStats = useMemo(
    () =>
      team.map((m) => {
        let usedVac = 0
        let ausCount = 0
        ;(m.vacations || []).forEach((v: unknown) => {
          const vr = v as Record<string, string>
          if (!vr.from) return
          const isVac = (vr.type || 'vacaciones') === 'vacaciones'
          const d = new Date(vr.from)
          const to = new Date(vr.to || vr.from)
          while (d <= to) {
            if (d.getFullYear() === yr && !isWk(d)) {
              if (isVac) usedVac++
              else ausCount++
            }
            d.setDate(d.getDate() + 1)
          }
        })
        const annual = m.annual_vac_days || 22
        const prev = m.prev_year_pending || 0
        const total = annual + prev
        return {
          id: m.id,
          annual,
          prev,
          total,
          used: usedVac,
          remaining: Math.max(0, total - usedVac),
          ausencias: ausCount,
        }
      }),
    [team, yr],
  )

  // ── Monthly hours ─────────────────────────────────────────────────────────

  const monthlyHours = useMemo(() => {
    const result: Record<string, number[]> = {}
    team.forEach((m) => {
      const months: number[] = []
      for (let mi = 0; mi < 12; mi++) {
        const dim = new Date(yr, mi + 1, 0).getDate()
        let h = 0
        for (let d = 1; d <= dim; d++) {
          h += baseHoursForDay(m, `${yr}-${String(mi + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
        }
        months.push(Math.round(h * 10) / 10)
      }
      result[m.id] = months
    })
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team, yr, orgData, calendarios])

  if (loading)
    return (
      <div className="text-xs text-revelio-subtle dark:text-revelio-dark-subtle text-center py-10">
        Cargando FTEs...
      </div>
    )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold dark:text-revelio-dark-text flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-revelio-blue" /> FTEs y Jornada
          </h3>
          <p className="text-[10px] text-revelio-subtle dark:text-revelio-dark-subtle">
            {team.length} personas · Horas según convenio × dedicación
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-revelio-bg dark:bg-revelio-dark-border rounded-lg overflow-hidden">
            {(['anual', 'mensual'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 text-[10px] font-semibold capitalize ${
                  view === v ? 'bg-revelio-blue text-white' : 'text-revelio-subtle dark:text-revelio-dark-subtle'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => (view === 'anual' ? setYr(yr - 1) : setMo(mo > 0 ? mo - 1 : 11))}
              className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span className="text-xs font-semibold dark:text-revelio-dark-text w-16 text-center">
              {view === 'anual' ? yr : `${MO[mo]} ${yr}`}
            </span>
            <button
              onClick={() => (view === 'anual' ? setYr(yr + 1) : setMo(mo < 11 ? mo + 1 : 0))}
              className="w-6 h-6 rounded border border-revelio-border dark:border-revelio-dark-border flex items-center justify-center hover:bg-revelio-bg dark:hover:bg-revelio-dark-border"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ANNUAL VIEW */}
      {view === 'anual' && (
        <div className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card overflow-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-revelio-bg dark:bg-revelio-dark-border">
                <th className="px-3 py-2 text-left font-semibold text-revelio-subtle dark:text-revelio-dark-subtle sticky left-0 bg-revelio-bg dark:bg-revelio-dark-border z-10">
                  Persona
                </th>
                {MO.map((m, i) => (
                  <th
                    key={m}
                    className={`px-1.5 py-2 text-center font-semibold ${
                      i === now.getMonth() && yr === now.getFullYear()
                        ? 'text-revelio-blue'
                        : 'text-revelio-subtle dark:text-revelio-dark-subtle'
                    }`}
                  >
                    {m}
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-semibold text-revelio-text dark:text-revelio-dark-text">
                  Total
                </th>
                <th className="px-2 py-2 text-center font-semibold text-revelio-subtle dark:text-revelio-dark-subtle">
                  Vac
                </th>
              </tr>
            </thead>
            <tbody>
              {team.map((m, idx) => {
                const hours = monthlyHours[m.id] || new Array(12).fill(0)
                const total = hours.reduce((s: number, h: number) => s + h, 0)
                const vs = vacStats.find((v) => v.id === m.id)
                const cal = getCal(m)
                const conv = cal?.convenio_hours || 1800
                return (
                  <tr
                    key={m.id}
                    className={`border-t border-revelio-border/50 dark:border-revelio-dark-border/50 ${
                      idx % 2 ? 'bg-revelio-bg/30 dark:bg-revelio-dark-border/20' : ''
                    }`}
                  >
                    <td className="px-3 py-2 font-medium sticky left-0 bg-white dark:bg-revelio-dark-card z-10">
                      <div className="flex items-center gap-1.5">
                        <span>{m.avatar || '👤'}</span>
                        <span className="dark:text-revelio-dark-text">{m.name.split(' ')[0]}</span>
                        {!cal && <span className="text-[8px] text-revelio-red">Sin cal.</span>}
                      </div>
                    </td>
                    {hours.map((h: number, i: number) => (
                      <td
                        key={i}
                        className={`px-1 py-2 text-center ${
                          i === now.getMonth() && yr === now.getFullYear() ? 'bg-revelio-blue/5' : ''
                        }`}
                      >
                        <span
                          className={`font-semibold ${
                            h > 0 ? 'dark:text-revelio-dark-text' : 'text-revelio-border dark:text-revelio-dark-border'
                          }`}
                        >
                          {h > 0 ? f1(h) : '—'}
                        </span>
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center">
                      <span className={`font-bold ${total >= conv ? 'text-revelio-green' : 'text-revelio-orange'}`}>
                        {f1(total)}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className="text-revelio-blue font-semibold">{vs?.used || 0}</span>
                      <span className="text-revelio-subtle dark:text-revelio-dark-subtle">/{vs?.total || 22}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MONTHLY VIEW — day-by-day calendar */}
      {view === 'mensual' && (
        <div className="space-y-3">
          {team.map((m) => {
            const dim = new Date(yr, mo + 1, 0).getDate()
            const days: Array<{
              ds: string
              d: number
              dow: number
              hours: number
              holiday: string | null
              absence: Record<string, string> | undefined
              intensive: boolean
            }> = []
            for (let d = 1; d <= dim; d++) {
              const ds = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
              const dt = new Date(ds)
              days.push({
                ds,
                d,
                dow: dt.getDay(),
                hours: baseHoursForDay(m, ds),
                holiday: getHolidayName(m, ds),
                absence: getAbsence(m, ds),
                intensive: isIntensive(getCal(m), ds),
              })
            }
            const totalH = days.reduce((s, d) => s + d.hours, 0)
            const absCount = days.filter((d) => d.absence).length
            const holCount = days.filter((d) => d.holiday).length

            return (
              <div
                key={m.id}
                className="rounded-card border border-revelio-border dark:border-revelio-dark-border bg-white dark:bg-revelio-dark-card p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                    style={{ background: m.color || '#007AFF' }}
                  >
                    {m.avatar || '👤'}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold dark:text-revelio-dark-text">{m.name}</p>
                    <p className="text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle">
                      {m.role_label || '—'}
                    </p>
                  </div>
                  <div className="flex gap-3 text-[10px]">
                    <span className="flex items-center gap-0.5 text-revelio-blue font-semibold">
                      <Clock className="w-3 h-3" />
                      {f1(totalH)}h
                    </span>
                    {absCount > 0 && (
                      <span className="flex items-center gap-0.5 text-revelio-orange font-semibold">
                        <Umbrella className="w-3 h-3" />
                        {absCount}d
                      </span>
                    )}
                    {holCount > 0 && (
                      <span className="flex items-center gap-0.5 text-revelio-red font-semibold">{holCount} fest.</span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-0.5 text-[9px]">
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
                    <div
                      key={d}
                      className="text-center font-bold text-revelio-subtle dark:text-revelio-dark-subtle py-0.5"
                    >
                      {d}
                    </div>
                  ))}
                  {Array.from({ length: (new Date(yr, mo, 1).getDay() + 6) % 7 }, (_, i) => (
                    <div key={`e${i}`} />
                  ))}
                  {days.map((d) => {
                    const isWknd = d.dow === 0 || d.dow === 6
                    const bg = d.absence
                      ? 'bg-revelio-orange/15'
                      : d.holiday
                        ? 'bg-revelio-red/10'
                        : d.intensive
                          ? 'bg-revelio-violet/10'
                          : isWknd
                            ? 'bg-revelio-bg dark:bg-revelio-dark-border'
                            : d.hours > 0
                              ? 'bg-revelio-blue/5'
                              : ''
                    return (
                      <div
                        key={d.d}
                        className={`rounded px-0.5 py-1 text-center ${bg}`}
                        title={
                          d.holiday ||
                          (d.absence
                            ? `${d.absence.type}: ${d.absence.label || ''}`
                            : d.intensive
                              ? 'Jornada intensiva'
                              : `${d.hours}h`)
                        }
                      >
                        <div
                          className={`font-semibold ${
                            d.holiday || d.absence
                              ? 'text-revelio-red'
                              : isWknd
                                ? 'text-revelio-subtle dark:text-revelio-dark-subtle'
                                : 'dark:text-revelio-dark-text'
                          }`}
                        >
                          {d.d}
                        </div>
                        {!isWknd && !d.holiday && !d.absence && d.hours > 0 && (
                          <div className="text-revelio-blue font-semibold">{d.hours.toFixed(1)}</div>
                        )}
                        {d.holiday && <div className="text-[7px] text-revelio-red truncate">{d.holiday.slice(0, 6)}</div>}
                        {d.absence && (
                          <div className="text-[7px] text-revelio-orange truncate">{d.absence.type?.slice(0, 3)}</div>
                        )}
                        {d.intensive && !d.holiday && !d.absence && !isWknd && (
                          <Sun className="w-2 h-2 text-revelio-violet mx-auto" />
                        )}
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
      <div className="flex gap-4 mt-3 text-[9px] text-revelio-subtle dark:text-revelio-dark-subtle flex-wrap">
        <span className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded bg-revelio-blue/10" /> Jornada normal
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded bg-revelio-violet/10" />
          <Sun className="w-2 h-2 text-revelio-violet" /> Intensiva
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded bg-revelio-red/10" /> Festivo
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded bg-revelio-orange/15" /> Ausencia/Vacaciones
        </span>
      </div>
    </div>
  )
}
