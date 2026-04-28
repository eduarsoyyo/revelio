import { useState, useMemo, useEffect } from 'react'
import { supabase } from '@/data/supabase'
import type { Member } from '@/types'
import {
  TrendingUp, TrendingDown, DollarSign, ChevronLeft, ChevronRight,
  Calculator, BarChart3, Sliders, Download,
} from 'lucide-react'
import { exportPnLPDF, exportPnLExcel } from '@/lib/exports'

interface OrgEntry { member_id: string; sala: string; dedication: number; start_date: string; end_date: string }
interface Calendario { id: string; daily_hours_lj: number; daily_hours_v: number; daily_hours_intensive: number; intensive_start: string; intensive_end: string; holidays: Array<{ date: string }> }
interface RoomFinance { billing_type: string; budget: number; sell_rate: number; fixed_price: number; planned_hours: number }

interface FinancePanelProps { team: Member[]; sala: string; roomData?: RoomFinance }

const MO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const fmt = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmtD = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (a: number, b: number) => b === 0 ? 0 : Math.round((a / b) * 100)

export function FinancePanel({ team, sala, roomData }: FinancePanelProps) {
  const [view, setView] = useState<'pnl' | 'simulator' | 'forecast'>('pnl')
  const [period, setPeriod] = useState<'mensual' | 'anual'>('mensual')
  const [yr, setYr] = useState(new Date().getFullYear())
  const [orgData, setOrgData] = useState<OrgEntry[]>([])
  const [calendarios, setCalendarios] = useState<Calendario[]>([])
  const [loading, setLoading] = useState(true)

  // Simulator overrides
  const [simSellRate, setSimSellRate] = useState<number | null>(null)
  const [simCostOverrides, setSimCostOverrides] = useState<Record<string, number>>({})

  const billing = roomData?.billing_type || 'tm'
  const baseSellRate = roomData?.sell_rate || 0
  const fixedPrice = roomData?.fixed_price || 0
  const effectiveSellRate = simSellRate ?? baseSellRate

  useEffect(() => {
    Promise.all([
      supabase.from('org_chart').select('member_id, sala, dedication, start_date, end_date').eq('sala', sala),
      supabase.from('calendarios').select('*'),
    ]).then(([oR, cR]) => {
      if (oR.data) setOrgData(oR.data as OrgEntry[])
      if (cR.data) setCalendarios(cR.data as Calendario[])
      setLoading(false)
    })
  }, [sala])

  // ── Calculate working hours per person per month ──
  const monthlyData = useMemo(() => {
    const result: Array<{
      id: string; name: string; avatar?: string; costRate: number; sellRate: number
      months: Array<{ hours: number; cost: number; revenue: number }>
    }> = []

    team.forEach(m => {
      // Cost rate from salary model: salary * multiplier / convenio_hours
      const rx = m as unknown as Record<string, unknown>
      const crArr = rx.cost_rates as Array<{ from: string; to?: string; salary?: number; rate?: number; multiplier?: number }> | undefined
      let baseCostRate = (rx.cost_rate as number) || 0
      if (crArr && crArr.length > 0) {
        const now = new Date().toISOString().slice(0, 7)
        const sorted = [...crArr].sort((a, b) => b.from.localeCompare(a.from))
        const cur = sorted.find(r => r.from <= now && (!r.to || r.to >= now)) || sorted[0]
        if (cur?.salary) {
          const calId2 = rx.calendario_id as string
          const mCal = calId2 ? calendarios.find(c => c.id === calId2) : null
          const convH = (mCal as unknown as Record<string, unknown>)?.convenio_hours as number || 1800
          baseCostRate = Math.round(((cur.salary * (cur.multiplier || 1.33)) / convH) * 100) / 100
        } else if (cur?.rate) { baseCostRate = cur.rate }
      }
      const costRate = simCostOverrides[m.id] ?? baseCostRate
      const memberSellRate = ((m as unknown as Record<string, unknown>).sell_rate as number) || effectiveSellRate
      const calId = (m as unknown as Record<string, unknown>).calendario_id as string
      const cal = calId ? calendarios.find(c => c.id === calId) : null

      const months: Array<{ hours: number; cost: number; revenue: number }> = []

      for (let mi = 0; mi < 12; mi++) {
        const dim = new Date(yr, mi + 1, 0).getDate()
        let hours = 0

        for (let d = 1; d <= dim; d++) {
          const ds = `${yr}-${String(mi + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const dt = new Date(ds)
          const dow = dt.getDay()
          if (dow === 0 || dow === 6) continue // Weekend

          // Check holiday
          if (cal && (cal.holidays || []).some(h => h.date === ds)) continue

          // Check absence
          const isAbsent = (m.vacations || []).some((v: unknown) => {
            const vr = v as Record<string, string>
            return vr.from && vr.from <= ds && (!vr.to || vr.to >= ds)
          })
          if (isAbsent) continue

          // Get dedication for this date
          const entries = orgData.filter(o => o.member_id === m.id)
          let ded = 0
          if (entries.length === 0) ded = 0
          else if (entries.length === 1 && !entries[0]!.start_date && !entries[0]!.end_date) ded = entries[0]!.dedication
          else {
            const match = entries.find(e => { const s = e.start_date || '2000-01-01'; const ed = e.end_date || '2099-12-31'; return ds >= s && ds <= ed })
            ded = match ? match.dedication : (entries.find(e => !e.start_date && !e.end_date)?.dedication || 0)
          }

          if (ded === 0) continue

          // Hours
          const mmdd = ds.slice(5)
          const isIntensive = cal && mmdd >= (cal.intensive_start || '08-01') && mmdd <= (cal.intensive_end || '08-31')
          let baseH = 8
          if (cal) {
            if (isIntensive) baseH = cal.daily_hours_intensive || 7
            else baseH = (dow >= 1 && dow <= 4) ? (cal.daily_hours_lj || 8) : (cal.daily_hours_v || 8)
          }

          hours += baseH * ded
        }

        const cost = Math.round(hours * costRate * 100) / 100
        const revenue = billing === 'fixed'
          ? Math.round((fixedPrice / 12) * 100) / 100 // Prorrateo mensual
          : Math.round(hours * memberSellRate * 100) / 100

        months.push({ hours: Math.round(hours * 10) / 10, cost, revenue })
      }

      if (months.some(m => m.hours > 0)) {
        result.push({ id: m.id, name: m.name, avatar: m.avatar, costRate, sellRate: memberSellRate, months })
      }
    })

    return result
  }, [team, yr, orgData, calendarios, billing, effectiveSellRate, fixedPrice, simCostOverrides])

  // ── Aggregated P&L ──
  const pnl = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const rev = monthlyData.reduce((s, p) => s + p.months[i]!.revenue, 0)
      const cost = monthlyData.reduce((s, p) => s + p.months[i]!.cost, 0)
      return { revenue: rev, cost, margin: rev - cost, marginPct: pct(rev - cost, rev), hours: monthlyData.reduce((s, p) => s + p.months[i]!.hours, 0) }
    })
    const totRev = months.reduce((s, m) => s + m.revenue, 0)
    const totCost = months.reduce((s, m) => s + m.cost, 0)
    const totHours = months.reduce((s, m) => s + m.hours, 0)
    return { months, totRev, totCost, totMargin: totRev - totCost, totMarginPct: pct(totRev - totCost, totRev), totHours }
  }, [monthlyData])

  // ── Forecast (remaining months) ──
  const forecast = useMemo(() => {
    const currentMonth = new Date().getMonth()
    const remaining = pnl.months.slice(currentMonth)
    const forecastRev = remaining.reduce((s, m) => s + m.revenue, 0)
    const forecastCost = remaining.reduce((s, m) => s + m.cost, 0)
    const ytdRev = pnl.months.slice(0, currentMonth).reduce((s, m) => s + m.revenue, 0)
    const ytdCost = pnl.months.slice(0, currentMonth).reduce((s, m) => s + m.cost, 0)
    return { forecastRev, forecastCost, forecastMargin: forecastRev - forecastCost, ytdRev, ytdCost, ytdMargin: ytdRev - ytdCost, eoyRev: ytdRev + forecastRev, eoyCost: ytdCost + forecastCost, eoyMargin: (ytdRev + forecastRev) - (ytdCost + forecastCost) }
  }, [pnl])

  if (loading) return <div className="text-[10px] text-[#8E8E93] text-center py-8">Cargando datos financieros...</div>

  const now = new Date()
  const isCurrentYear = yr === now.getFullYear()

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-0.5 bg-[#F2F2F7] dark:bg-[#3A3A3C] rounded-lg overflow-hidden">
          {([
            { id: 'pnl' as const, label: 'P&L' },
            { id: 'simulator' as const, label: 'Simulador' },
            { id: 'forecast' as const, label: 'Forecast' },
          ]).map(v => (
            <button key={v.id} onClick={() => setView(v.id)} className={`px-3 py-1 text-[9px] font-semibold ${view === v.id ? 'bg-[#007AFF] text-white' : 'text-[#8E8E93]'}`}>{v.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {view === 'pnl' && (
            <div className="flex gap-0.5 bg-[#F2F2F7] dark:bg-[#3A3A3C] rounded-lg overflow-hidden">
              <button onClick={() => setPeriod('mensual')} className={`px-2 py-0.5 text-[8px] font-semibold ${period === 'mensual' ? 'bg-[#007AFF] text-white' : 'text-[#8E8E93]'}`}>Mensual</button>
              <button onClick={() => setPeriod('anual')} className={`px-2 py-0.5 text-[8px] font-semibold ${period === 'anual' ? 'bg-[#007AFF] text-white' : 'text-[#8E8E93]'}`}>Anual</button>
            </div>
          )}
          <div className="flex items-center gap-1">
            <button onClick={() => setYr(yr - 1)} className="w-5 h-5 rounded border border-[#E5E5EA] dark:border-[#3A3A3C] flex items-center justify-center"><ChevronLeft className="w-3 h-3 text-[#8E8E93]" /></button>
            <span className="text-[10px] font-semibold dark:text-[#F5F5F7] w-10 text-center">{yr}</span>
            <button onClick={() => setYr(yr + 1)} className="w-5 h-5 rounded border border-[#E5E5EA] dark:border-[#3A3A3C] flex items-center justify-center"><ChevronRight className="w-3 h-3 text-[#8E8E93]" /></button>
          </div>
          {view === 'pnl' && (
            <div className="flex gap-1">
              <button onClick={() => exportPnLPDF(sala, yr, pnl.months, monthlyData.map(p => ({ name: p.name, months: p.months })))} className="w-6 h-6 rounded border border-[#E5E5EA] dark:border-[#3A3A3C] flex items-center justify-center hover:bg-[#FF3B30]/5" title="Exportar PDF"><Download className="w-3 h-3 text-[#FF3B30]" /></button>
              <button onClick={() => exportPnLExcel(sala, yr, pnl.months, monthlyData.map(p => ({ name: p.name, months: p.months })))} className="w-6 h-6 rounded border border-[#E5E5EA] dark:border-[#3A3A3C] flex items-center justify-center hover:bg-[#34C759]/5" title="Exportar Excel"><Download className="w-3 h-3 text-[#34C759]" /></button>
            </div>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {[
          { l: 'Ingresos', v: `${fmt(pnl.totRev)}€`, c: '#007AFF', I: DollarSign },
          { l: 'Costes', v: `${fmt(pnl.totCost)}€`, c: '#FF9500', I: TrendingDown },
          { l: 'Margen', v: `${fmt(pnl.totMargin)}€`, c: pnl.totMargin >= 0 ? '#34C759' : '#FF3B30', I: TrendingUp },
          { l: 'Margen %', v: `${pnl.totMarginPct}%`, c: pnl.totMarginPct >= 20 ? '#34C759' : pnl.totMarginPct >= 10 ? '#FF9500' : '#FF3B30', I: BarChart3 },
          { l: 'Horas', v: fmt(pnl.totHours), c: '#8E8E93', I: Calculator },
        ].map(k => (
          <div key={k.l} className="rounded-card border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] p-3">
            <k.I className="w-4 h-4 mb-1" style={{ color: k.c }} />
            <p className="text-base font-bold" style={{ color: k.c }}>{k.v}</p>
            <p className="text-[7px] text-[#8E8E93] uppercase tracking-wide">{k.l} {yr}</p>
          </div>
        ))}
      </div>

      {/* ═══ P&L VIEW ═══ */}
      {view === 'pnl' && period === 'mensual' && (
        <div className="rounded-card border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] overflow-auto">
          <table className="w-full text-[9px]">
            <thead>
              <tr className="bg-[#F2F2F7] dark:bg-[#2C2C2E]">
                <th className="px-3 py-2 text-left font-semibold text-[#8E8E93] sticky left-0 bg-[#F2F2F7] dark:bg-[#2C2C2E] z-10">Concepto</th>
                {MO.map((m, i) => <th key={m} className={`px-1.5 py-2 text-center font-semibold ${i === now.getMonth() && isCurrentYear ? 'text-[#007AFF]' : 'text-[#8E8E93]'}`}>{m}</th>)}
                <th className="px-2 py-2 text-center font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">Total</th>
              </tr>
            </thead>
            <tbody>
              {/* Revenue row */}
              <tr className="border-t border-[#F2F2F7] dark:border-[#2C2C2E]">
                <td className="px-3 py-2 font-semibold text-[#007AFF] sticky left-0 bg-white dark:bg-[#1C1C1E] z-10">Ingresos</td>
                {pnl.months.map((m, i) => <td key={i} className={`px-1 py-2 text-center font-medium ${i === now.getMonth() && isCurrentYear ? 'bg-[#007AFF]/3' : ''}`}><span className="text-[#007AFF]">{fmt(m.revenue)}</span></td>)}
                <td className="px-2 py-2 text-center font-bold text-[#007AFF]">{fmt(pnl.totRev)}</td>
              </tr>
              {/* Cost row */}
              <tr className="border-t border-[#F2F2F7]/50 dark:border-[#2C2C2E]/50">
                <td className="px-3 py-2 font-semibold text-[#FF9500] sticky left-0 bg-white dark:bg-[#1C1C1E] z-10">Costes</td>
                {pnl.months.map((m, i) => <td key={i} className={`px-1 py-2 text-center ${i === now.getMonth() && isCurrentYear ? 'bg-[#007AFF]/3' : ''}`}><span className="text-[#FF9500]">{fmt(m.cost)}</span></td>)}
                <td className="px-2 py-2 text-center font-bold text-[#FF9500]">{fmt(pnl.totCost)}</td>
              </tr>
              {/* Margin row */}
              <tr className="border-t-2 border-[#E5E5EA] dark:border-[#3A3A3C] bg-[#F9F9FB] dark:bg-[#2C2C2E]">
                <td className="px-3 py-2 font-bold sticky left-0 bg-[#F9F9FB] dark:bg-[#2C2C2E] z-10" style={{ color: pnl.totMargin >= 0 ? '#34C759' : '#FF3B30' }}>Margen</td>
                {pnl.months.map((m, i) => <td key={i} className={`px-1 py-2 text-center font-bold ${i === now.getMonth() && isCurrentYear ? 'bg-[#007AFF]/3' : ''}`}><span style={{ color: m.margin >= 0 ? '#34C759' : '#FF3B30' }}>{fmt(m.margin)}</span></td>)}
                <td className="px-2 py-2 text-center font-bold" style={{ color: pnl.totMargin >= 0 ? '#34C759' : '#FF3B30' }}>{fmt(pnl.totMargin)}</td>
              </tr>
              {/* Margin % row */}
              <tr className="border-t border-[#F2F2F7]/50 dark:border-[#2C2C2E]/50">
                <td className="px-3 py-1.5 text-[#8E8E93] sticky left-0 bg-white dark:bg-[#1C1C1E] z-10">Margen %</td>
                {pnl.months.map((m, i) => <td key={i} className={`px-1 py-1.5 text-center ${i === now.getMonth() && isCurrentYear ? 'bg-[#007AFF]/3' : ''}`}><span style={{ color: m.marginPct >= 20 ? '#34C759' : m.marginPct >= 10 ? '#FF9500' : '#FF3B30' }}>{m.marginPct}%</span></td>)}
                <td className="px-2 py-1.5 text-center font-bold" style={{ color: pnl.totMarginPct >= 20 ? '#34C759' : pnl.totMarginPct >= 10 ? '#FF9500' : '#FF3B30' }}>{pnl.totMarginPct}%</td>
              </tr>
              {/* Hours row */}
              <tr className="border-t border-[#F2F2F7]/50 dark:border-[#2C2C2E]/50">
                <td className="px-3 py-1.5 text-[#8E8E93] sticky left-0 bg-white dark:bg-[#1C1C1E] z-10">Horas</td>
                {pnl.months.map((m, i) => <td key={i} className={`px-1 py-1.5 text-center text-[#8E8E93] ${i === now.getMonth() && isCurrentYear ? 'bg-[#007AFF]/3' : ''}`}>{fmt(m.hours)}</td>)}
                <td className="px-2 py-1.5 text-center font-semibold text-[#8E8E93]">{fmt(pnl.totHours)}</td>
              </tr>
              {/* Separator */}
              <tr><td colSpan={14} className="h-2 bg-[#F2F2F7]/30 dark:bg-[#2C2C2E]/30" /></tr>
              {/* Per-person breakdown */}
              {monthlyData.map(p => (
                <tr key={p.id} className="border-t border-[#F2F2F7]/30 dark:border-[#2C2C2E]/30 hover:bg-[#F2F2F7]/30 dark:hover:bg-[#2C2C2E]/30">
                  <td className="px-3 py-1.5 sticky left-0 bg-white dark:bg-[#1C1C1E] z-10">
                    <span className="dark:text-[#F5F5F7]">{p.avatar || '·'} {p.name.split(' ')[0]}</span>
                    <span className="text-[7px] text-[#8E8E93] ml-1">{fmtD(p.costRate)}€/h</span>
                  </td>
                  {p.months.map((m, i) => <td key={i} className={`px-1 py-1.5 text-center text-[#8E8E93] ${i === now.getMonth() && isCurrentYear ? 'bg-[#007AFF]/3' : ''}`}>{m.hours > 0 ? fmt(m.cost) : '—'}</td>)}
                  <td className="px-2 py-1.5 text-center font-semibold dark:text-[#F5F5F7]">{fmt(p.months.reduce((s, m) => s + m.cost, 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* P&L ANNUAL */}
      {view === 'pnl' && period === 'anual' && (
        <div className="rounded-card border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] p-5">
          <div className="space-y-4">
            {/* Annual summary bars */}
            {[
              { l: 'Ingresos', v: pnl.totRev, c: '#007AFF' },
              { l: 'Costes', v: pnl.totCost, c: '#FF9500' },
              { l: 'Margen', v: pnl.totMargin, c: pnl.totMargin >= 0 ? '#34C759' : '#FF3B30' },
            ].map(r => {
              const maxV = Math.max(pnl.totRev, pnl.totCost, 1)
              return (
                <div key={r.l}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold dark:text-[#F5F5F7]">{r.l}</span>
                    <span className="text-sm font-bold" style={{ color: r.c }}>{fmt(r.v)}€</span>
                  </div>
                  <div className="h-3 bg-[#F2F2F7] dark:bg-[#3A3A3C] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.abs(r.v) / maxV * 100}%`, background: r.c }} />
                  </div>
                </div>
              )
            })}

            {/* Margin % highlight */}
            <div className="text-center pt-3 border-t border-[#F2F2F7] dark:border-[#3A3A3C]">
              <p className="text-3xl font-bold" style={{ color: pnl.totMarginPct >= 20 ? '#34C759' : pnl.totMarginPct >= 10 ? '#FF9500' : '#FF3B30' }}>{pnl.totMarginPct}%</p>
              <p className="text-[9px] text-[#8E8E93]">Margen {yr}</p>
            </div>

            {/* Per-person annual */}
            <div className="pt-3 border-t border-[#F2F2F7] dark:border-[#3A3A3C]">
              <p className="text-[9px] font-bold text-[#8E8E93] uppercase mb-2">Desglose por persona</p>
              {monthlyData.map(p => {
                const totCost = p.months.reduce((s, m) => s + m.cost, 0)
                const totRev = p.months.reduce((s, m) => s + m.revenue, 0)
                const totH = p.months.reduce((s, m) => s + m.hours, 0)
                const margin = totRev - totCost
                return (
                  <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-[#F2F2F7]/50 dark:border-[#2C2C2E]/50 last:border-0">
                    <span className="text-[10px] w-4">{p.avatar || '·'}</span>
                    <span className="text-[9px] font-medium w-20 truncate dark:text-[#F5F5F7]">{p.name.split(' ')[0]}</span>
                    <span className="text-[8px] text-[#8E8E93] w-12 text-right">{fmt(totH)}h</span>
                    <span className="text-[8px] text-[#007AFF] w-16 text-right">{fmt(totRev)}€</span>
                    <span className="text-[8px] text-[#FF9500] w-16 text-right">{fmt(totCost)}€</span>
                    <span className="text-[8px] font-bold w-16 text-right" style={{ color: margin >= 0 ? '#34C759' : '#FF3B30' }}>{fmt(margin)}€</span>
                    <span className="text-[7px] font-bold w-8 text-right" style={{ color: pct(margin, totRev) >= 20 ? '#34C759' : '#FF9500' }}>{pct(margin, totRev)}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SIMULATOR ═══ */}
      {view === 'simulator' && (
        <div className="space-y-4">
          <div className="rounded-card border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] p-4">
            <h4 className="text-[10px] font-semibold dark:text-[#F5F5F7] flex items-center gap-1 mb-3"><Sliders className="w-3 h-3 text-[#5856D6]" /> Ajustar parámetros</h4>

            {/* Sell rate */}
            <div className="mb-4">
              <label className="text-[8px] font-bold text-[#8E8E93] uppercase">Tarifa venta (€/hora)</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" value={simSellRate ?? baseSellRate} onChange={e => setSimSellRate(Number(e.target.value))}
                  className="w-24 rounded border border-[#E5E5EA] dark:border-[#3A3A3C] px-2 py-1 text-xs outline-none dark:bg-[#2C2C2E] dark:text-[#F5F5F7]" step={1} />
                {simSellRate !== null && simSellRate !== baseSellRate && (
                  <span className="text-[8px]" style={{ color: simSellRate > baseSellRate ? '#34C759' : '#FF3B30' }}>
                    {simSellRate > baseSellRate ? '+' : ''}{fmt(simSellRate - baseSellRate)}€ vs base
                  </span>
                )}
                {simSellRate !== null && <button onClick={() => setSimSellRate(null)} className="text-[8px] text-[#007AFF] hover:underline">Reset</button>}
              </div>
            </div>

            {/* Cost rates per person */}
            <label className="text-[8px] font-bold text-[#8E8E93] uppercase">Coste por persona (€/hora)</label>
            <div className="space-y-1 mt-1">
              {team.filter(m => monthlyData.some(d => d.id === m.id)).map(m => {
                const baseCost = ((m as unknown as Record<string, unknown>).cost_rate as number) || 0
                const simCost = simCostOverrides[m.id]
                return (
                  <div key={m.id} className="flex items-center gap-2">
                    <span className="text-[9px] w-24 truncate dark:text-[#F5F5F7]">{m.avatar || '·'} {m.name.split(' ')[0]}</span>
                    <input type="number" value={simCost ?? baseCost} onChange={e => setSimCostOverrides(prev => ({ ...prev, [m.id]: Number(e.target.value) }))}
                      className="w-20 rounded border border-[#E5E5EA] dark:border-[#3A3A3C] px-2 py-0.5 text-[10px] outline-none dark:bg-[#2C2C2E] dark:text-[#F5F5F7]" step={0.5} />
                    {simCost !== undefined && simCost !== baseCost && (
                      <span className="text-[8px]" style={{ color: simCost < baseCost ? '#34C759' : '#FF3B30' }}>
                        {simCost < baseCost ? '' : '+'}{fmtD(simCost - baseCost)}€
                      </span>
                    )}
                  </div>
                )
              })}
              {Object.keys(simCostOverrides).length > 0 && (
                <button onClick={() => setSimCostOverrides({})} className="text-[8px] text-[#007AFF] hover:underline mt-1">Reset todos</button>
              )}
            </div>
          </div>

          {/* Simulated result */}
          <div className="rounded-card border-2 border-[#5856D6]/20 bg-[#5856D6]/3 dark:bg-[#5856D6]/5 p-4">
            <h4 className="text-[10px] font-semibold text-[#5856D6] mb-2 flex items-center gap-1"><Calculator className="w-3 h-3" /> Resultado simulado {yr}</h4>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="text-lg font-bold text-[#007AFF]">{fmt(pnl.totRev)}€</p><p className="text-[7px] text-[#8E8E93]">Ingresos</p></div>
              <div><p className="text-lg font-bold text-[#FF9500]">{fmt(pnl.totCost)}€</p><p className="text-[7px] text-[#8E8E93]">Costes</p></div>
              <div><p className="text-lg font-bold" style={{ color: pnl.totMargin >= 0 ? '#34C759' : '#FF3B30' }}>{fmt(pnl.totMargin)}€ ({pnl.totMarginPct}%)</p><p className="text-[7px] text-[#8E8E93]">Margen</p></div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ FORECAST ═══ */}
      {view === 'forecast' && isCurrentYear && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { l: 'YTD (real)', rev: forecast.ytdRev, cost: forecast.ytdCost, margin: forecast.ytdMargin },
              { l: `Restante (${12 - now.getMonth()} meses)`, rev: forecast.forecastRev, cost: forecast.forecastCost, margin: forecast.forecastMargin },
              { l: `Cierre ${yr}`, rev: forecast.eoyRev, cost: forecast.eoyCost, margin: forecast.eoyMargin },
            ].map(b => (
              <div key={b.l} className="rounded-card border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] p-4">
                <p className="text-[9px] font-semibold text-[#8E8E93] uppercase mb-2">{b.l}</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between"><span className="text-[9px] text-[#8E8E93]">Ingresos</span><span className="text-[10px] font-bold text-[#007AFF]">{fmt(b.rev)}€</span></div>
                  <div className="flex justify-between"><span className="text-[9px] text-[#8E8E93]">Costes</span><span className="text-[10px] font-bold text-[#FF9500]">{fmt(b.cost)}€</span></div>
                  <div className="flex justify-between border-t border-[#F2F2F7] dark:border-[#3A3A3C] pt-1"><span className="text-[9px] font-semibold dark:text-[#F5F5F7]">Margen</span><span className="text-[10px] font-bold" style={{ color: b.margin >= 0 ? '#34C759' : '#FF3B30' }}>{fmt(b.margin)}€ ({pct(b.margin, b.rev)}%)</span></div>
                </div>
              </div>
            ))}
          </div>

          {/* Monthly forecast bars */}
          <div className="rounded-card border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] p-4">
            <h4 className="text-[9px] font-semibold dark:text-[#F5F5F7] mb-3 flex items-center gap-1"><BarChart3 className="w-3 h-3 text-[#007AFF]" /> Facturación mensual {yr}</h4>
            <div className="flex items-end gap-1" style={{ height: 120 }}>
              {pnl.months.map((m, i) => {
                const maxV = Math.max(...pnl.months.map(x => Math.max(x.revenue, x.cost)), 1)
                const isPast = isCurrentYear && i < now.getMonth()
                const isCurrent = isCurrentYear && i === now.getMonth()
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full flex gap-px" style={{ height: 100 }}>
                      <div className="flex-1 flex flex-col justify-end">
                        <div className="rounded-t-sm" style={{ height: `${(m.revenue / maxV) * 100}%`, background: '#007AFF', opacity: isPast ? 1 : 0.4 }} />
                      </div>
                      <div className="flex-1 flex flex-col justify-end">
                        <div className="rounded-t-sm" style={{ height: `${(m.cost / maxV) * 100}%`, background: '#FF9500', opacity: isPast ? 1 : 0.4 }} />
                      </div>
                    </div>
                    <span className={`text-[7px] font-semibold ${isCurrent ? 'text-[#007AFF]' : 'text-[#8E8E93]'}`}>{MO[i]}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-3 mt-2 text-[7px] text-[#8E8E93]">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#007AFF]" />Ingresos</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#FF9500]" />Costes</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#007AFF] opacity-40" />Proyección</span>
            </div>
          </div>
        </div>
      )}

      {view === 'forecast' && !isCurrentYear && (
        <div className="text-center py-8 text-[10px] text-[#8E8E93]">Forecast solo disponible para el año actual ({now.getFullYear()})</div>
      )}

      {/* Setup notice */}
      {baseSellRate === 0 && (
        <div className="mt-3 rounded-lg border border-[#FF9500]/20 bg-[#FF9500]/5 px-3 py-2 text-[9px] text-[#FF9500]">
          Configura la tarifa de venta y costes por persona para ver datos reales. Edita el proyecto en CdC → Proyectos.
        </div>
      )}
    </div>
  )
}
