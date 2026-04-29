import { useState, useMemo, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { supabase } from '@/data/supabase'
import { dailyTheoreticalHours, type Calendar } from '@/domain/calendar'
import { monthlyRevenueFromServices, memberCostHour, fmtEur, fmt, pct } from '@/domain/finance'
import type { ServiceContract } from '@/domain/finance'
import { exportPnLPDF, exportPnLExcel } from '@/lib/exports'
import type { Member } from '@/types'

interface OrgEntry {
  member_id: string
  sala: string
  dedication: number
  start_date: string
  end_date: string
}

interface RoomFinance {
  billing_type: string
  budget: number
  sell_rate: number
  fixed_price: number
  planned_hours: number
  services?: ServiceContract[]
}

interface FinancePanelProps {
  team: Member[]
  sala: string
  roomData?: RoomFinance
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export function FinancePanel({ team, sala, roomData }: FinancePanelProps) {
  const [view, setView] = useState<'pnl' | 'simulator' | 'forecast'>('pnl')
  const [period, setPeriod] = useState<'mensual' | 'anual'>('mensual')
  const [yr, setYr] = useState(new Date().getFullYear())
  const [orgData, setOrgData] = useState<OrgEntry[]>([])
  const [calendarios, setCalendarios] = useState<Calendar[]>([])
  const [loading, setLoading] = useState(true)

  const services = roomData?.services || []

  useEffect(() => {
    Promise.all([
      supabase.from('org_chart').select('member_id, sala, dedication, start_date, end_date').eq('sala', sala),
      supabase.from('calendarios').select('*'),
    ]).then(([oR, cR]) => {
      if (oR.data) setOrgData(oR.data as OrgEntry[])
      if (cR.data) setCalendarios(cR.data as Calendar[])
      setLoading(false)
    })
  }, [sala])

  const getCostRate = (m: Member): number => {
    const rx2 = m as unknown as Record<string, unknown>
    const crArr = rx2.cost_rates as any[] | undefined
    const calId2 = rx2.calendario_id as string
    const mCal = calId2 ? calendarios.find((c) => c.id === calId2) : null
    const convH = (mCal as unknown as Record<string, unknown>)?.convenio_hours as number || 1800
    return memberCostHour(crArr || [], convH, rx2.cost_rate as number)
  }

  /**
   * Devuelve la dedicación de un miembro en una fecha concreta.
   * Busca en orgData según el rango de fechas activo.
   */
  const getDedicationForDate = (memberId: string, ds: string): number => {
    const entries = orgData.filter((o) => o.member_id === memberId)
    if (entries.length === 0) return 0

    // Caso simple: una sola entrada sin rango → aplica siempre
    const firstEntry = entries[0]
    if (entries.length === 1 && firstEntry && !firstEntry.start_date && !firstEntry.end_date) {
      return firstEntry.dedication
    }

    // Buscar entrada activa para esa fecha
    const match = entries.find((e) => {
      const s = e.start_date || '2000-01-01'
      const ed = e.end_date || '2099-12-31'
      return ds >= s && ds <= ed
    })

    if (match) return match.dedication

    // Fallback: entrada global sin rango
    return entries.find((e) => !e.start_date && !e.end_date)?.dedication || 0
  }

  /**
   * Calcula horas y coste mensual para un miembro en un mes específico.
   * Usa dailyTheoreticalHours del domain para el cálculo de jornada.
   */
  const computeMemberMonthHours = (
    memberId: string,
    cal: Calendar | null,
    costRate: number,
    year: number,
    monthIdx: number,
  ): { hours: number; cost: number } => {
    const lastDay = new Date(year, monthIdx + 1, 0).getDate()
    let hours = 0

    for (let d = 1; d <= lastDay; d++) {
      const ds = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const ded = getDedicationForDate(memberId, ds)
      if (ded === 0) continue

      const baseH = dailyTheoreticalHours(ds, cal)
      hours += baseH * ded
    }

    return {
      hours: Math.round(hours * 10) / 10,
      cost: Math.round(hours * costRate * 100) / 100,
    }
  }

  const monthlyData = useMemo(() => {
    const result: Array<{
      id: string
      name: string
      avatar?: string
      costRate: number
      months: Array<{ hours: number; cost: number }>
    }> = []

    team.forEach((m) => {
      const costRate = getCostRate(m)
      const calId = (m as unknown as Record<string, unknown>).calendario_id as string
      const cal = calId ? calendarios.find((c) => c.id === calId) || null : null

      const months = Array.from({ length: 12 }, (_, mi) =>
        computeMemberMonthHours(m.id, cal, costRate, yr, mi),
      )

      if (months.some((mo) => mo.hours > 0)) {
        result.push({ id: m.id, name: m.name, avatar: m.avatar, costRate, months })
      }
    })

    return result
  }, [team, yr, orgData, calendarios])

  const pnl = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const rev = monthlyRevenueFromServices(services, yr, i)
      const cost = monthlyData.reduce((s, p) => s + p.months[i]!.cost, 0)
      return {
        revenue: rev,
        cost,
        margin: rev - cost,
        marginPct: pct(rev - cost, rev),
        hours: monthlyData.reduce((s, p) => s + p.months[i]!.hours, 0),
      }
    })

    const totRev = months.reduce((s, m) => s + m.revenue, 0)
    const totCost = months.reduce((s, m) => s + m.cost, 0)
    const totHours = months.reduce((s, m) => s + m.hours, 0)

    return {
      months,
      totRev,
      totCost,
      totMargin: totRev - totCost,
      totMarginPct: pct(totRev - totCost, totRev),
      totHours,
    }
  }, [monthlyData, services, yr])

  const forecast = useMemo(() => {
    const cm = new Date().getMonth()
    const ytdRev = pnl.months.slice(0, cm).reduce((s, m) => s + m.revenue, 0)
    const ytdCost = pnl.months.slice(0, cm).reduce((s, m) => s + m.cost, 0)
    const remRev = pnl.months.slice(cm).reduce((s, m) => s + m.revenue, 0)
    const remCost = pnl.months.slice(cm).reduce((s, m) => s + m.cost, 0)

    return {
      ytdRev,
      ytdCost,
      ytdMargin: ytdRev - ytdCost,
      remRev,
      remCost,
      remMargin: remRev - remCost,
      eoyRev: ytdRev + remRev,
      eoyCost: ytdCost + remCost,
      eoyMargin: ytdRev + remRev - (ytdCost + remCost),
    }
  }, [pnl])

  if (loading)
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-text-secondary text-sm">Cargando datos financieros...</div>
      </div>
    )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Análisis Financiero</h1>
        <div className="flex gap-2">
          {view === 'pnl' && (
            <>
              <button
                onClick={() => exportPnLPDF(sala, yr, pnl.months, monthlyData)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 text-xs font-medium transition"
                title="Descargar PDF"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
              <button
                onClick={() => exportPnLExcel(sala, yr, pnl.months, monthlyData)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 text-xs font-medium transition"
                title="Descargar Excel"
              >
                <Download className="w-4 h-4" />
                Excel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['pnl', 'simulator', 'forecast'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              view === v
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
            }`}
          >
            {v === 'pnl' && 'P&L Mensual'}
            {v === 'simulator' && 'Simulador'}
            {v === 'forecast' && 'Proyección'}
          </button>
        ))}
      </div>

      {/* Period Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setYr(yr - 1)}
          className="p-2 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-800 transition"
          title="Año anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <input
          type="number"
          value={yr}
          onChange={(e) => setYr(Number(e.target.value))}
          className="w-20 px-3 py-1 border border-gray-200 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          onClick={() => setYr(yr + 1)}
          className="p-2 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-800 transition"
          title="Año siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => setPeriod(period === 'mensual' ? 'anual' : 'mensual')}
          className={`px-3 py-1 rounded text-xs font-medium transition ${
            period === 'mensual' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
          }`}
        >
          {period === 'mensual' ? 'Mensual' : 'Anual'}
        </button>
      </div>

      {/* P&L View */}
      {view === 'pnl' && (
        <div className="space-y-4">
          {period === 'mensual' && (
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-text-primary">Mes</th>
                    <th className="px-4 py-3 text-right font-semibold text-text-primary">Horas</th>
                    <th className="px-4 py-3 text-right font-semibold text-green-600">Venta</th>
                    <th className="px-4 py-3 text-right font-semibold text-red-600">Coste real</th>
                    <th className="px-4 py-3 text-right font-semibold text-text-primary">Margen real</th>
                    <th className="px-4 py-3 text-right font-semibold text-text-primary">%</th>
                  </tr>
                </thead>
                <tbody>
                  {pnl.months.map((m, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-text-primary">{MONTHS[i]}</td>
                      <td className="px-4 py-3 text-right text-text-secondary">{fmt(m.hours)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">{fmtEur(m.revenue)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">{fmtEur(m.cost)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-text-primary">{fmtEur(m.margin)}</td>
                      <td className="px-4 py-3 text-right text-text-secondary">{m.marginPct}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-bold">
                  <tr>
                    <td className="px-4 py-3 text-text-primary">TOTAL</td>
                    <td className="px-4 py-3 text-right text-text-primary">{fmt(pnl.totHours)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{fmtEur(pnl.totRev)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{fmtEur(pnl.totCost)}</td>
                    <td className="px-4 py-3 text-right text-text-primary">{fmtEur(pnl.totMargin)}</td>
                    <td className="px-4 py-3 text-right text-text-primary">{pnl.totMarginPct}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {period === 'anual' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-xs font-semibold text-text-secondary mb-2">Venta Total</div>
                <div className="text-2xl font-bold text-green-600">{fmtEur(pnl.totRev)}</div>
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-xs font-semibold text-text-secondary mb-2">Coste real</div>
                <div className="text-2xl font-bold text-red-600">{fmtEur(pnl.totCost)}</div>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-xs font-semibold text-text-secondary mb-2">Margen real</div>
                <div className="text-2xl font-bold text-blue-600">{fmtEur(pnl.totMargin)}</div>
              </div>
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="text-xs font-semibold text-text-secondary mb-2">Margen %</div>
                <div className="text-2xl font-bold text-purple-600">{pnl.totMarginPct}%</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Simulator View */}
      {view === 'simulator' && (
        <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg text-center">
          <p className="text-text-secondary text-sm">Simulador: Feature en desarrollo</p>
        </div>
      )}

      {/* Forecast View */}
      {view === 'forecast' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="text-xs font-semibold text-text-secondary mb-3">Ejecutado (YTD)</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Venta:</span>
                <span className="font-semibold text-green-600">{fmtEur(forecast.ytdRev)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Coste:</span>
                <span className="font-semibold text-red-600">{fmtEur(forecast.ytdCost)}</span>
              </div>
              <div className="flex justify-between text-xs border-t pt-2">
                <span className="text-text-secondary">Margen:</span>
                <span className="font-semibold text-blue-600">{fmtEur(forecast.ytdMargin)}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="text-xs font-semibold text-text-secondary mb-3">Proyección (Restante)</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Venta:</span>
                <span className="font-semibold text-green-600">{fmtEur(forecast.remRev)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Coste:</span>
                <span className="font-semibold text-red-600">{fmtEur(forecast.remCost)}</span>
              </div>
              <div className="flex justify-between text-xs border-t pt-2">
                <span className="text-text-secondary">Margen:</span>
                <span className="font-semibold text-blue-600">{fmtEur(forecast.remMargin)}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-xs font-semibold text-text-secondary mb-3">Cierre Anual (EOY)</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Venta:</span>
                <span className="font-semibold text-green-600">{fmtEur(forecast.eoyRev)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary">Coste:</span>
                <span className="font-semibold text-red-600">{fmtEur(forecast.eoyCost)}</span>
              </div>
              <div className="flex justify-between text-xs border-t pt-2">
                <span className="text-text-secondary">Margen:</span>
                <span className="font-semibold text-blue-600">{fmtEur(forecast.eoyMargin)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
