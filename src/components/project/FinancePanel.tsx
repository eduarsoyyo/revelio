import { useState, useMemo, useEffect } from 'react'
import { supabase } from '@/data/supabase'
import type { Member } from '@/types'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { exportPnLPDF, exportPnLExcel } from '@/lib/exports'
import {
  monthlyRevenueFromServices, memberCostHour,
  fmtEur, fmt, pct, type ServiceContract, type CalendarData,
} from '@/domain/finance'

interface OrgEntry { member_id: string; sala: string; dedication: number; start_date: string; end_date: string }
interface RoomFinance { billing_type: string; budget: number; sell_rate: number; fixed_price: number; planned_hours: number; services?: ServiceContract[] }
interface FinancePanelProps { team: Member[]; sala: string; roomData?: RoomFinance }

const MO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export function FinancePanel({ team, sala, roomData }: FinancePanelProps) {
  const [view, setView] = useState<'pnl' | 'simulator' | 'forecast'>('pnl')
  const [period, setPeriod] = useState<'mensual' | 'anual'>('mensual')
  const [yr, setYr] = useState(new Date().getFullYear())
  const [orgData, setOrgData] = useState<OrgEntry[]>([])
  const [calendarios, setCalendarios] = useState<CalendarData[]>([])
  const [loading, setLoading] = useState(true)

  const services = roomData?.services || []

  useEffect(() => {
    Promise.all([
      supabase.from('org_chart').select('member_id, sala, dedication, start_date, end_date').eq('sala', sala),
      supabase.from('calendarios').select('*'),
    ]).then(([oR, cR]) => {
      if (oR.data) setOrgData(oR.data as OrgEntry[])
      if (cR.data) setCalendarios(cR.data as CalendarData[])
      setLoading(false)
    })
  }, [sala])

  const getCostRate = (m: Member): number => {
    const rx2 = m as unknown as Record<string, unknown>
    const crArr = rx2.cost_rates as any[] | undefined
    const calId2 = rx2.calendario_id as string
    const mCal = calId2 ? calendarios.find(c => c.id === calId2) : null
    const convH = (mCal as unknown as Record<string, unknown>)?.convenio_hours as number || 1800
    return memberCostHour(crArr || [], convH, rx2.cost_rate as number)
  }

  const monthlyData = useMemo(() => {
    const result: Array<{ id: string; name: string; avatar?: string; costRate: number; months: Array<{ hours: number; cost: number }> }> = []
    team.forEach(m => {
      const costRate = getCostRate(m)
      const calId = (m as unknown as Record<string, unknown>).calendario_id as string
      const cal = calId ? calendarios.find(c => c.id === calId) : null
      const months: Array<{ hours: number; cost: number }> = []
      for (let mi = 0; mi < 12; mi++) {
        const dim = new Date(yr, mi + 1, 0).getDate()
        let hours = 0
        for (let d = 1; d <= dim; d++) {
          const ds = `${yr}-${String(mi + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const dt = new Date(ds)
          const dow = dt.getDay()
          if (dow === 0 || dow === 6) continue
          if (cal && (cal.holidays || []).some(h => (h as { date: string }).date === ds)) continue
          const entries = orgData.filter(o => o.member_id === m.id)
          let ded = 0
          if (entries.length === 1 && !entries[0]!.start_date && !entries[0]!.end_date) ded = entries[0]!.dedication
          else {
            const match = entries.find(e => {
              const s = e.start_date || '2000-01-01'
              const ed = e.end_date || '2099-12-31'
              return ds >= s && ds <= ed
            })
            ded = match ? match.dedication : (entries.find(e => !e.start_date && !e.end_date)?.dedication || 0)
          }
          if (ded === 0) continue
          const mmdd = ds.slice(5)
          const isInt = cal && mmdd >= (cal.intensive_start || '08-01') && mmdd <= (cal.intensive_end || '08-31')
          let baseH = 8
          if (cal) {
            if (isInt) baseH = cal.daily_hours_intensive || 7
            else baseH = (dow >= 1 && dow <= 4) ? (cal.daily_hours_lj || 8) : (cal.daily_hours_v || 8)
          }
          hours += baseH * ded
        }
        months.push({ hours: Math.round(hours * 10) / 10, cost: Math.round(hours * costRate * 100) / 100 })
      }
      if (months.some(mo => mo.hours > 0)) result.push({ id: m.id, name: m.name, avatar: m.avatar, costRate, months })
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
    return { months, totRev, totCost, totMargin: totRev - totCost, totMarginPct: pct(totRev - totCost, totRev), totHours }
  }, [monthlyData, services, yr])

  const forecast = useMemo(() => {
    const cm = new Date().getMonth()
    const ytdRev = pnl.months.slice(0, cm).reduce((s, m) => s + m.revenue, 0)
    const ytdCost = pnl.months.slice(0, cm).reduce((s, m) => s + m.cost, 0)
    const remRev = pnl.months.slice(cm).reduce((s, m) => s + m.revenue, 0)
    const remCost = pnl.months.slice(cm).reduce((s, m) => s + m.cost, 0)
    return {
      ytdRev, ytdCost, ytdMargin: ytdRev - ytdCost,
      remRev, remCost, remMargin: remRev - remCost,
      eoyRev: ytdRev + remRev, eoyCost: ytdCost + remCost, eoyMargin: (ytdRev + remRev) - (ytdCost + remCost),
    }
  }, [pnl])

  if (loading) return <div className="p-6 text-center text-text-secondary text-sm">Cargando datos financieros...</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">💰 Financiero</h1>
        <div className="flex gap-2">
          {view === 'pnl' && (
            <>
              <button onClick={() => exportPnLPDF(sala, yr, pnl.months, monthlyData)} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-xs">
                <Download className="w-4 h-4" /> PDF
              </button>
              <button onClick={() => exportPnLExcel(sala, yr, pnl.months, monthlyData)} className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-xs">
                <Download className="w-4 h-4" /> Excel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {(['pnl', 'simulator', 'forecast'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 text-sm border-b-2 transition ${view === v ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-800'}`}
          >
            {v === 'pnl' && '📊 P&L'}
            {v === 'simulator' && '🎛️ Simulador'}
            {v === 'forecast' && '🔮 Forecast'}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setYr(yr - 1)} className="p-2 hover:bg-gray-200 rounded text-xs">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <input type="number" value={yr} onChange={e => setYr(Number(e.target.value))} className="w-20 px-2 py-1 border border-gray-200 rounded text-sm text-center" />
        <button onClick={() => setYr(yr + 1)} className="p-2 hover:bg-gray-200 rounded text-xs">
          <ChevronRight className="w-4 h-4" />
        </button>
        <button onClick={() => setPeriod(period === 'mensual' ? 'anual' : 'mensual')} className={`px-3 py-1 rounded text-xs ${period === 'mensual' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'}`}>
          {period === 'mensual' ? 'Mensual' : 'Anual'}
        </button>
      </div>

      {view === 'pnl' && (
        <div className="space-y-4">
          {period === 'mensual' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold">Mes</th>
                    <th className="px-3 py-2 text-right">Horas</th>
                    <th className="px-3 py-2 text-right">Venta</th>
                    <th className="px-3 py-2 text-right">Coste real</th>
                    <th className="px-3 py-2 text-right">Margen real</th>
                    <th className="px-3 py-2 text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {pnl.months.map((m, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2">{MO[i]}</td>
                      <td className="px-3 py-2 text-right">{fmt(m.hours)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-green-600">{fmtEur(m.revenue)}</td>
                      <td className="px-3 py-2 text-right text-red-600">{fmtEur(m.cost)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmtEur(m.margin)}</td>
                      <td className="px-3 py-2 text-right">{m.marginPct}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                    <td className="px-3 py-2">TOTAL</td>
                    <td className="px-3 py-2 text-right">{fmt(pnl.totHours)}</td>
                    <td className="px-3 py-2 text-right text-green-600">{fmtEur(pnl.totRev)}</td>
                    <td className="px-3 py-2 text-right text-red-600">{fmtEur(pnl.totCost)}</td>
                    <td className="px-3 py-2 text-right">{fmtEur(pnl.totMargin)}</td>
                    <td className="px-3 py-2 text-right">{pnl.totMarginPct}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {period === 'anual' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-xs text-text-secondary mb-1">Venta Total</div>
                <div className="text-2xl font-bold text-green-600">{fmtEur(pnl.totRev)}</div>
              </div>
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-xs text-text-secondary mb-1">Coste real</div>
                <div className="text-2xl font-bold text-red-600">{fmtEur(pnl.totCost)}</div>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-xs text-text-secondary mb-1">Margen real</div>
                <div className="text-2xl font-bold text-blue-600">{fmtEur(pnl.totMargin)}</div>
              </div>
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="text-xs text-text-secondary mb-1">Margen %</div>
                <div className="text-2xl font-bold text-purple-600">{pnl.totMarginPct}%</div>
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'simulator' && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center text-text-secondary text-sm">
          Simulador: Feature en desarrollo. Próxima sesión.
        </div>
      )}

      {view === 'forecast' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="text-xs font-semibold text-text-secondary mb-3">YTD (Ejecutado)</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs"><span>Venta:</span><span className="font-semibold text-green-600">{fmtEur(forecast.ytdRev)}</span></div>
              <div className="flex justify-between text-xs"><span>Coste:</span><span className="font-semibold text-red-600">{fmtEur(forecast.ytdCost)}</span></div>
              <div className="flex justify-between text-xs border-t pt-2"><span>Margen:</span><span className="font-semibold text-blue-600">{fmtEur(forecast.ytdMargin)}</span></div>
            </div>
          </div>
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h3 className="text-xs font-semibold text-text-secondary mb-3">Restante (Forecast)</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs"><span>Venta:</span><span className="font-semibold text-green-600">{fmtEur(forecast.remRev)}</span></div>
              <div className="flex justify-between text-xs"><span>Coste:</span><span className="font-semibold text-red-600">{fmtEur(forecast.remCost)}</span></div>
              <div className="flex justify-between text-xs border-t pt-2"><span>Margen:</span><span className="font-semibold text-blue-600">{fmtEur(forecast.remMargin)}</span></div>
            </div>
          </div>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-xs font-semibold text-text-secondary mb-3">Cierre año (EOY)</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs"><span>Venta:</span><span className="font-semibold text-green-600">{fmtEur(forecast.eoyRev)}</span></div>
              <div className="flex justify-between text-xs"><span>Coste:</span><span className="font-semibold text-red-600">{fmtEur(forecast.eoyCost)}</span></div>
              <div className="flex justify-between text-xs border-t pt-2"><span>Margen:</span><span className="font-semibold text-blue-600">{fmtEur(forecast.eoyMargin)}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
