import { useState, useMemo, useEffect } from 'react'
import { supabase } from '@/data/supabase'
import type { Member } from '@/types'
import {
  TrendingUp, TrendingDown, DollarSign, ChevronLeft, ChevronRight,
  Calculator, BarChart3, Sliders, Download, Plus, X, CalendarRange,
} from 'lucide-react'
import { exportPnLPDF, exportPnLExcel } from '@/lib/exports'

interface OrgEntry { member_id: string; sala: string; dedication: number; start_date: string; end_date: string }
interface Calendario { id: string; convenio_hours?: number; daily_hours_lj: number; daily_hours_v: number; daily_hours_intensive: number; intensive_start: string; intensive_end: string; holidays: Array<{ date: string }> }
interface ServiceContract { id: string; name: string; from: string; to: string; cost: number; margin_pct: number; risk_pct: number }
interface RoomFinance { billing_type: string; budget: number; sell_rate: number; fixed_price: number; planned_hours: number; services?: ServiceContract[] }
interface FinancePanelProps { team: Member[]; sala: string; roomData?: RoomFinance }

function saleFromService(s: ServiceContract): number { const d = 1 - (s.margin_pct / 100) - ((s.risk_pct || 0) / 100); return d > 0 ? Math.round(s.cost / d) : 0 }
function monthlyRevenueFromServices(services: ServiceContract[], yr: number, month: number): number {
  if (!services || services.length === 0) return 0
  let rev = 0
  for (const sv of services) {
    const sale = saleFromService(sv); if (sale <= 0) continue
    const svFrom = sv.from ? new Date(sv.from) : new Date(yr, 0, 1)
    const svTo = sv.to ? new Date(sv.to) : new Date(yr, 11, 31)
    const totalMonths = Math.max(1, (svTo.getFullYear() - svFrom.getFullYear()) * 12 + svTo.getMonth() - svFrom.getMonth() + 1)
    const moStart = new Date(yr, month, 1); const moEnd = new Date(yr, month + 1, 0)
    if (moEnd >= svFrom && moStart <= svTo) rev += Math.round(sale / totalMonths)
  }
  return rev
}

const MO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const fmt = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 })
const fmtD = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (a: number, b: number) => b === 0 ? 0 : Math.round((a / b) * 100)

export function FinancePanel({ team, sala, roomData }: FinancePanelProps) {
  const [view, setView] = useState<'pnl' | 'simulator' | 'forecast'>('pnl')
  const [period, setPeriod] = useState<'mensual' | 'anual'>('mensual')
  const [yr, setYr] = useState(new Date().getFullYear())
  const [orgData, setOrgData] = useState<OrgEntry[]>([])
  const [calendarios, setCalendarios] = useState<Calendario[]>([])
  const [loading, setLoading] = useState(true)
  // Simulator
  const [simSellRate, setSimSellRate] = useState<number | null>(null)
  const [simDedOverrides, setSimDedOverrides] = useState<Record<string, number>>({})
  const [simSalaryOverrides, setSimSalaryOverrides] = useState<Record<string, number>>({})
  const [simExtraPersons, setSimExtraPersons] = useState<Array<{ id: string; name: string; salary: number; multiplier: number; dedication: number; from: string; to: string }>>([])
  const [simFrom, setSimFrom] = useState('')
  const [simTo, setSimTo] = useState('')

  const services = roomData?.services || []
  const totalEstCost = services.reduce((s, sv) => s + sv.cost, 0)

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

  // Cost rate from salary model
  const getCostRate = (m: Member): number => {
    const rx2 = m as unknown as Record<string, unknown>
    const crArr = rx2.cost_rates as Array<{ salary?: number; multiplier?: number; rate?: number; from: string; to?: string }> | undefined
    let costRate = (rx2.cost_rate as number) || 0
    if (crArr && crArr.length > 0) {
      const now = new Date().toISOString().slice(0, 7)
      const sorted = [...crArr].sort((a, b) => b.from.localeCompare(a.from))
      const cur = sorted.find(r => r.from <= now && (!r.to || r.to >= now)) || sorted[0]
      if (cur?.salary) {
        const calId2 = rx2.calendario_id as string
        const mCal = calId2 ? calendarios.find(c => c.id === calId2) : null
        const convH = (mCal as unknown as Record<string, unknown>)?.convenio_hours as number || 1800
        costRate = Math.round(((cur.salary * (cur.multiplier || 1.33)) / convH) * 100) / 100
      } else if (cur?.rate) costRate = cur.rate
    }
    return costRate
  }

  const getSalaryInfo = (m: Member): { salary: number; multiplier: number } => {
    const rx2 = m as unknown as Record<string, unknown>
    const crArr = rx2.cost_rates as Array<{ salary?: number; multiplier?: number; rate?: number; from: string; to?: string }> | undefined
    if (crArr && crArr.length > 0) {
      const now = new Date().toISOString().slice(0, 7)
      const sorted = [...crArr].sort((a, b) => b.from.localeCompare(a.from))
      const cur = sorted.find(r => r.from <= now && (!r.to || r.to >= now)) || sorted[0]
      if (cur?.salary) return { salary: cur.salary, multiplier: cur.multiplier || 1.33 }
      if (cur?.rate) return { salary: Math.round((cur.rate * 1800) / 1.33), multiplier: 1.33 }
    }
    return { salary: 0, multiplier: 1.33 }
  }

  // Monthly data per person (cost only — revenue is from services)
  const monthlyData = useMemo(() => {
    const result: Array<{ id: string; name: string; avatar?: string; costRate: number; months: Array<{ hours: number; cost: number }> }> = []
    team.forEach(m => {
      const costRate = getCostRate(m)
      const calId = (m as unknown as Record<string, unknown>).calendario_id as string
      const cal = calId ? calendarios.find(c => c.id === calId) : null
      const months: Array<{ hours: number; cost: number }> = []
      for (let mi = 0; mi < 12; mi++) {
        const dim = new Date(yr, mi + 1, 0).getDate(); let hours = 0
        for (let d = 1; d <= dim; d++) {
          const ds = `${yr}-${String(mi + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const dt = new Date(ds); const dow = dt.getDay()
          if (dow === 0 || dow === 6) continue
          if (cal && (cal.holidays || []).some(h => (h as { date: string }).date === ds)) continue
          const entries = orgData.filter(o => o.member_id === m.id)
          let ded = 0
          if (entries.length === 1 && !entries[0]!.start_date && !entries[0]!.end_date) ded = entries[0]!.dedication
          else { const match = entries.find(e => { const s = e.start_date || '2000-01-01'; const ed = e.end_date || '2099-12-31'; return ds >= s && ds <= ed }); ded = match ? match.dedication : (entries.find(e => !e.start_date && !e.end_date)?.dedication || 0) }
          if (ded === 0) continue
          const mmdd = ds.slice(5); const isInt = cal && mmdd >= (cal.intensive_start || '08-01') && mmdd <= (cal.intensive_end || '08-31')
          let baseH = 8
          if (cal) { if (isInt) baseH = cal.daily_hours_intensive || 7; else baseH = (dow >= 1 && dow <= 4) ? (cal.daily_hours_lj || 8) : (cal.daily_hours_v || 8) }
          hours += baseH * ded
        }
        months.push({ hours: Math.round(hours * 10) / 10, cost: Math.round(hours * costRate * 100) / 100 })
      }
      if (months.some(mo => mo.hours > 0)) result.push({ id: m.id, name: m.name, avatar: m.avatar, costRate, months })
    })
    return result
  }, [team, yr, orgData, calendarios])

  // Aggregated P&L
  const pnl = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => {
      const rev = monthlyRevenueFromServices(services, yr, i)
      const cost = monthlyData.reduce((s, p) => s + p.months[i]!.cost, 0)
      return { revenue: rev, cost, margin: rev - cost, marginPct: pct(rev - cost, rev), hours: monthlyData.reduce((s, p) => s + p.months[i]!.hours, 0) }
    })
    const totRev = months.reduce((s, m) => s + m.revenue, 0)
    const totCost = months.reduce((s, m) => s + m.cost, 0)
    const totHours = months.reduce((s, m) => s + m.hours, 0)
    return { months, totRev, totCost, totMargin: totRev - totCost, totMarginPct: pct(totRev - totCost, totRev), totHours }
  }, [monthlyData, services, yr])

  // Forecast
  const forecast = useMemo(() => {
    const cm = new Date().getMonth()
    const ytdRev = pnl.months.slice(0, cm).reduce((s, m) => s + m.revenue, 0)
    const ytdCost = pnl.months.slice(0, cm).reduce((s, m) => s + m.cost, 0)
    const remRev = pnl.months.slice(cm).reduce((s, m) => s + m.revenue, 0)
    const remCost = pnl.months.slice(cm).reduce((s, m) => s + m.cost, 0)
    return { ytdRev, ytdCost, ytdMargin: ytdRev - ytdCost, remRev, remCost, remMargin: remRev - remCost, eoyRev: ytdRev + remRev, eoyCost: ytdCost + remCost, eoyMargin: (ytdRev + remRev) - (ytdCost + remCost) }
  }, [pnl])

  if (loading) return <div className="text-[10px] text-[#8E8E93] text-center py-8">Cargando datos financieros...</div>
  const now = new Date(); const isCurrentYear = yr === now.getFullYear()

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex gap-0.5 bg-[#F2F2F7] dark:bg-[#3A3A3C] rounded-lg overflow-hidden">
          {[{ id: 'pnl' as const, label: 'P&L' }, { id: 'simulator' as const, label: 'Simulador' }, { id: 'forecast' as const, label: 'Forecast' }].map(v => (
            <button key={v.id} onClick={() => setView(v.id)} className={`px-3 py-1 text-[9px] font-semibold ${view === v.id ? 'bg-[#007AFF] text-white' : 'text-[#8E8E93]'}`}>{v.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {view === 'pnl' && <div className="flex gap-0.5 bg-[#F2F2F7] dark:bg-[#3A3A3C] rounded-lg overflow-hidden"><button onClick={() => setPeriod('mensual')} className={`px-2 py-0.5 text-[8px] font-semibold ${period === 'mensual' ? 'bg-[#007AFF] text-white' : 'text-[#8E8E93]'}`}>Mensual</button><button onClick={() => setPeriod('anual')} className={`px-2 py-0.5 text-[8px] font-semibold ${period === 'anual' ? 'bg-[#007AFF] text-white' : 'text-[#8E8E93]'}`}>Anual</button></div>}
          <div className="flex items-center gap-1"><button onClick={() => setYr(yr - 1)} className="w-5 h-5 rounded border border-[#E5E5EA] dark:border-[#3A3A3C] flex items-center justify-center"><ChevronLeft className="w-3 h-3 text-[#8E8E93]" /></button><span className="text-[10px] font-semibold dark:text-[#F5F5F7] w-10 text-center">{yr}</span><button onClick={() => setYr(yr + 1)} className="w-5 h-5 rounded border border-[#E5E5EA] dark:border-[#3A3A3C] flex items-center justify-center"><ChevronRight className="w-3 h-3 text-[#8E8E93]" /></button></div>
          {view === 'pnl' && <div className="flex gap-1"><button onClick={() => exportPnLPDF(sala, yr, pnl.months, monthlyData.map(p => ({ name: p.name, months: p.months.map(mo => ({ ...mo, revenue: 0 })) })))} className="w-6 h-6 rounded border border-[#E5E5EA] dark:border-[#3A3A3C] flex items-center justify-center hover:bg-[#FF3B30]/5" title="PDF"><Download className="w-3 h-3 text-[#FF3B30]" /></button><button onClick={() => exportPnLExcel(sala, yr, pnl.months, monthlyData.map(p => ({ name: p.name, months: p.months.map(mo => ({ ...mo, revenue: 0 })) })))} className="w-6 h-6 rounded border border-[#E5E5EA] dark:border-[#3A3A3C] flex items-center justify-center hover:bg-[#34C759]/5" title="Excel"><Download className="w-3 h-3 text-[#34C759]" /></button></div>}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {[
          { l: 'Venta', v: `${fmt(pnl.totRev)}\u20AC`, c: '#007AFF', I: DollarSign },
          { l: 'Coste real', v: `${fmt(pnl.totCost)}\u20AC`, c: '#FF9500', I: TrendingDown },
          { l: 'Margen real', v: `${fmt(pnl.totMargin)}\u20AC`, c: pnl.totMargin >= 0 ? '#34C759' : '#FF3B30', I: TrendingUp },
          { l: 'Margen %', v: `${pnl.totMarginPct}%`, c: pnl.totMarginPct >= 20 ? '#34C759' : pnl.totMarginPct >= 10 ? '#FF9500' : '#FF3B30', I: BarChart3 },
          { l: 'Horas', v: fmt(pnl.totHours), c: '#8E8E93', I: Calculator },
        ].map(k => (
          <div key={k.l} className="rounded-card border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] p-3">
            <k.I className="w-4 h-4 mb-1" style={{ color: k.c }} /><p className="text-base font-bold" style={{ color: k.c }}>{k.v}</p><p className="text-[7px] text-[#8E8E93] uppercase tracking-wide">{k.l} {yr}</p>
          </div>
        ))}
      </div>

      {/* P&L MENSUAL */}
      {view === 'pnl' && period === 'mensual' && (
        <div className="rounded-card border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] overflow-auto">
          <table className="w-full text-[9px]">
            <thead><tr className="bg-[#F2F2F7] dark:bg-[#2C2C2E]"><th className="px-3 py-2 text-left font-semibold text-[#8E8E93] sticky left-0 bg-[#F2F2F7] dark:bg-[#2C2C2E] z-10">Concepto</th>{MO.map((m, i) => <th key={m} className={`px-1.5 py-2 text-center font-semibold ${i === now.getMonth() && isCurrentYear ? 'text-[#007AFF]' : 'text-[#8E8E93]'}`}>{m}</th>)}<th className="px-2 py-2 text-center font-bold text-[#1D1D1F] dark:text-[#F5F5F7]">Total</th></tr></thead>
            <tbody>
              <tr className="border-t border-[#F2F2F7] dark:border-[#2C2C2E]"><td className="px-3 py-2 font-semibold text-[#007AFF] sticky left-0 bg-white dark:bg-[#1C1C1E] z-10">Venta</td>{pnl.months.map((m, i) => <td key={i} className={`px-1 py-2 text-center font-medium ${i === now.getMonth() && isCurrentYear ? 'bg-[#007AFF]/3' : ''}`}><span className="text-[#007AFF]">{fmt(m.revenue)}</span></td>)}<td className="px-2 py-2 text-center font-bold text-[#007AFF]">{fmt(pnl.totRev)}</td></tr>
              <tr className="border-t border-[#F2F2F7]/50"><td className="px-3 py-2 font-semibold text-[#8E8E93] sticky left-0 bg-white dark:bg-[#1C1C1E] z-10">Coste est.</td>{pnl.months.map((_, i) => <td key={i} className={`px-1 py-2 text-center text-[#8E8E93] ${i === now.getMonth() && isCurrentYear ? 'bg-[#007AFF]/3' : ''}`}>{totalEstCost > 0 ? fmt(Math.round(totalEstCost / 12)) : '\u2014'}</td>)}<td className="px-2 py-2 text-center font-semibold text-[#8E8E93]">{totalEstCost > 0 ? fmt(totalEstCost) : '\u2014'}</td></tr>
              <tr className="border-t border-[#F2F2F7]/50"><td className="px-3 py-2 font-semibold text-[#FF9500] sticky left-0 bg-white dark:bg-[#1C1C1E] z-10">Coste real</td>{pnl.months.map((m, i) => <td key={i} className={`px-1 py-2 text-center ${i === now.getMonth() && isCurrentYear ? 'bg-[#007AFF]/3' : ''}`}><span className="text-[#FF9500]">{fmt(m.cost)}</span></td>)}<td className="px-2 py-2 text-center font-bold text-[#FF9500]">{fmt(pnl.totCost)}</td></tr>
              <tr className="border-t-2 border-[#E5E5EA] dark:border-[#3A3A3C] bg-[#F9F9FB] dark:bg-[#2C2C2E]"><td className="px-3 py-2 font-bold sticky left-0 bg-[#F9F9FB] dark:bg-[#2C2C2E] z-10" style={{ color: pnl.totMargin >= 0 ? '#34C759' : '#FF3B30' }}>Margen real</td>{pnl.months.map((m, i) => <td key={i} className={`px-1 py-2 text-center font-bold ${i === now.getMonth() && isCurrentYear ? 'bg-[#007AFF]/3' : ''}`}><span style={{ color: m.margin >= 0 ? '#34C759' : '#FF3B30' }}>{fmt(m.margin)}</span></td>)}<td className="px-2 py-2 text-center font-bold" style={{ color: pnl.totMargin >= 0 ? '#34C759' : '#FF3B30' }}>{fmt(pnl.totMargin)}</td></tr>
              <tr className="border-t border-[#F2F2F7]/50"><td className="px-3 py-1.5 text-[#8E8E93] sticky left-0 bg-white dark:bg-[#1C1C1E] z-10">Margen %</td>{pnl.months.map((m, i) => <td key={i} className={`px-1 py-1.5 text-center ${i === now.getMonth() && isCurrentYear ? 'bg-[#007AFF]/3' : ''}`}><span style={{ color: m.marginPct >= 20 ? '#34C759' : m.marginPct >= 10 ? '#FF9500' : '#FF3B30' }}>{m.marginPct}%</span></td>)}<td className="px-2 py-1.5 text-center font-bold" style={{ color: pnl.totMarginPct >= 20 ? '#34C759' : pnl.totMarginPct >= 10 ? '#FF9500' : '#FF3B30' }}>{pnl.totMarginPct}%</td></tr>
              <tr className="border-t border-[#F2F2F7]/50"><td className="px-3 py-1.5 text-[#8E8E93] sticky left-0 bg-white dark:bg-[#1C1C1E] z-10">Horas</td>{pnl.months.map((m, i) => <td key={i} className={`px-1 py-1.5 text-center text-[#8E8E93] ${i === now.getMonth() && isCurrentYear ? 'bg-[#007AFF]/3' : ''}`}>{fmt(m.hours)}</td>)}<td className="px-2 py-1.5 text-center font-semibold text-[#8E8E93]">{fmt(pnl.totHours)}</td></tr>
              <tr><td colSpan={14} className="h-2 bg-[#F2F2F7]/30 dark:bg-[#2C2C2E]/30" /></tr>
              {monthlyData.map(p => (<tr key={p.id} className="border-t border-[#F2F2F7]/30 hover:bg-[#F2F2F7]/30"><td className="px-3 py-1.5 sticky left-0 bg-white dark:bg-[#1C1C1E] z-10"><span className="dark:text-[#F5F5F7]">{p.avatar || '\u00B7'} {p.name.split(' ')[0]}</span> <span className="text-[7px] text-[#8E8E93]">{fmtD(p.costRate)}\u20AC/h</span></td>{p.months.map((m, i) => <td key={i} className={`px-1 py-1.5 text-center text-[#8E8E93] ${i === now.getMonth() && isCurrentYear ? 'bg-[#007AFF]/3' : ''}`}>{m.hours > 0 ? fmt(m.cost) : '\u2014'}</td>)}<td className="px-2 py-1.5 text-center font-semibold dark:text-[#F5F5F7]">{fmt(p.months.reduce((s, m) => s + m.cost, 0))}</td></tr>))}
            </tbody>
          </table>
        </div>
      )}

      {/* P&L ANUAL */}
      {view === 'pnl' && period === 'anual' && (
        <div className="rounded-card border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] p-5">
          <div className="space-y-4">
            {[{ l: 'Venta', v: pnl.totRev, c: '#007AFF' }, { l: 'Coste real', v: pnl.totCost, c: '#FF9500' }, { l: 'Margen real', v: pnl.totMargin, c: pnl.totMargin >= 0 ? '#34C759' : '#FF3B30' }].map(r => { const maxV = Math.max(pnl.totRev, pnl.totCost, 1); return (<div key={r.l}><div className="flex items-center justify-between mb-1"><span className="text-[10px] font-semibold dark:text-[#F5F5F7]">{r.l}</span><span className="text-sm font-bold" style={{ color: r.c }}>{fmt(r.v)}\u20AC</span></div><div className="h-3 bg-[#F2F2F7] dark:bg-[#3A3A3C] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.abs(r.v) / maxV * 100}%`, background: r.c }} /></div></div>) })}
            <div className="text-center pt-3 border-t border-[#F2F2F7] dark:border-[#3A3A3C]"><p className="text-3xl font-bold" style={{ color: pnl.totMarginPct >= 20 ? '#34C759' : pnl.totMarginPct >= 10 ? '#FF9500' : '#FF3B30' }}>{pnl.totMarginPct}%</p><p className="text-[9px] text-[#8E8E93]">Margen real {yr}</p></div>
            <div className="pt-3 border-t border-[#F2F2F7] dark:border-[#3A3A3C]"><p className="text-[9px] font-bold text-[#8E8E93] uppercase mb-2">Desglose por persona</p>{monthlyData.map(p => { const totCost = p.months.reduce((s, m) => s + m.cost, 0); const totH = p.months.reduce((s, m) => s + m.hours, 0); return (<div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-[#F2F2F7]/50 last:border-0"><span className="text-[10px] w-4">{p.avatar || '\u00B7'}</span><span className="text-[9px] font-medium w-24 truncate dark:text-[#F5F5F7]">{p.name.split(' ')[0]}</span><span className="text-[8px] text-[#8E8E93] w-12 text-right">{fmt(totH)}h</span><span className="text-[8px] text-[#FF9500] w-16 text-right font-semibold">{fmt(totCost)}\u20AC</span></div>) })}</div>
          </div>
        </div>
      )}

      {/* SIMULATOR */}
      {view === 'simulator' && (
        <div className="space-y-4">
          <div className="rounded-card border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-[10px] font-semibold dark:text-[#F5F5F7] flex items-center gap-1"><Sliders className="w-3 h-3 text-[#5856D6]" /> Simulador</h4>
              {(Object.keys(simDedOverrides).length > 0 || Object.keys(simSalaryOverrides).length > 0 || simSellRate !== null || simExtraPersons.length > 0 || simFrom || simTo) && <button onClick={() => { setSimDedOverrides({}); setSimSalaryOverrides({}); setSimSellRate(null); setSimExtraPersons([]); setSimFrom(''); setSimTo('') }} className="text-[8px] text-[#007AFF] hover:underline">Reset todo</button>}
            </div>

            {/* Period filter */}
            <div className="flex items-center gap-3 mb-3 pb-3 border-b border-[#F2F2F7] dark:border-[#2C2C2E]">
              <CalendarRange className="w-3.5 h-3.5 text-[#5856D6]" />
              <div className="flex items-center gap-1"><label className="text-[8px] text-[#8E8E93] font-bold uppercase">Desde</label><input type="date" value={simFrom} onChange={e => setSimFrom(e.target.value)} className="rounded border border-[#E5E5EA] dark:border-[#3A3A3C] px-2 py-0.5 text-[10px] outline-none dark:bg-[#2C2C2E] dark:text-[#F5F5F7]" /></div>
              <div className="flex items-center gap-1"><label className="text-[8px] text-[#8E8E93] font-bold uppercase">Hasta</label><input type="date" value={simTo} onChange={e => setSimTo(e.target.value)} className="rounded border border-[#E5E5EA] dark:border-[#3A3A3C] px-2 py-0.5 text-[10px] outline-none dark:bg-[#2C2C2E] dark:text-[#F5F5F7]" /></div>
              {!simFrom && !simTo && <span className="text-[8px] text-[#8E8E93]">Sin filtro = a\u00F1o completo {yr}</span>}
            </div>

            {/* Table header */}
            <div className="grid grid-cols-[1fr_70px_55px_70px_60px] gap-1 text-[7px] font-bold text-[#8E8E93] uppercase px-1 mb-1"><span>Persona</span><span className="text-right">Salario</span><span className="text-right">Ded. %</span><span className="text-right">Coste/h</span><span className="text-right">Coste periodo</span></div>

            {/* Existing team */}
            {team.filter(m => monthlyData.some(d => d.id === m.id)).map(m => {
              const si = getSalaryInfo(m); const simSal = simSalaryOverrides[m.id]; const effSal = simSal ?? si.salary
              const calId2 = (m as unknown as Record<string, unknown>).calendario_id as string
              const mCal = calId2 ? calendarios.find(c => c.id === calId2) : null
              const convH = (mCal as unknown as Record<string, unknown>)?.convenio_hours as number || 1800
              const costH = convH > 0 ? Math.round(((effSal * si.multiplier) / convH) * 100) / 100 : 0
              const orgDed = orgData.find(o => o.member_id === m.id)?.dedication || 0
              const simDed = simDedOverrides[m.id]; const effDed = simDed !== undefined ? simDed / 100 : orgDed
              // Calculate hours in period
              const pd = monthlyData.find(d => d.id === m.id); const baseH = pd ? pd.months.reduce((s, mo) => s + mo.hours, 0) : 0
              const adjH = orgDed > 0 ? baseH * (effDed / orgDed) : 0
              // If date filter, approximate by fraction of year
              let periodH = adjH
              if (simFrom || simTo) {
                const sf = simFrom ? new Date(simFrom) : new Date(yr, 0, 1); const st = simTo ? new Date(simTo) : new Date(yr, 11, 31)
                const totalDays = (new Date(yr, 11, 31).getTime() - new Date(yr, 0, 1).getTime()) / 86400000
                const periodDays = Math.max(0, (st.getTime() - sf.getTime()) / 86400000)
                periodH = totalDays > 0 ? adjH * (periodDays / totalDays) : 0
              }
              const costPeriod = Math.round(periodH * costH)
              const changed = simSal !== undefined || simDed !== undefined
              return (
                <div key={m.id} className={`grid grid-cols-[1fr_70px_55px_70px_60px] gap-1 items-center py-1 px-1 rounded ${changed ? 'bg-[#5856D6]/5' : ''}`}>
                  <span className="text-[9px] truncate dark:text-[#F5F5F7]">{m.avatar || '\u00B7'} {m.name.split(' ')[0]} <span className="text-[7px] text-[#8E8E93]">{m.role_label}</span></span>
                  <input type="number" value={effSal || ''} onChange={e => setSimSalaryOverrides(p => ({ ...p, [m.id]: Number(e.target.value) }))} className="rounded border border-[#E5E5EA] dark:border-[#3A3A3C] px-1 py-0.5 text-[9px] outline-none text-right dark:bg-[#2C2C2E] dark:text-[#F5F5F7]" step={500} />
                  <input type="number" value={Math.round(effDed * 100)} onChange={e => setSimDedOverrides(p => ({ ...p, [m.id]: Number(e.target.value) }))} className="rounded border border-[#E5E5EA] dark:border-[#3A3A3C] px-1 py-0.5 text-[9px] outline-none text-right dark:bg-[#2C2C2E] dark:text-[#F5F5F7]" min={0} max={100} step={5} />
                  <span className="text-[9px] text-right dark:text-[#F5F5F7]">{costH > 0 ? `${costH.toFixed(2).replace('.', ',')}\u20AC` : '\u2014'}</span>
                  <span className="text-[9px] text-right font-semibold" style={{ color: costPeriod > 0 ? '#FF9500' : '#8E8E93' }}>{costPeriod > 0 ? `${fmt(costPeriod)}\u20AC` : '\u2014'}</span>
                </div>
              )
            })}

            {/* Extra persons */}
            {simExtraPersons.map((ep, ei) => {
              const convH = 1800; const costH = convH > 0 ? Math.round(((ep.salary * ep.multiplier) / convH) * 100) / 100 : 0
              let periodH = convH * (ep.dedication / 100)
              if (simFrom || simTo) {
                const sf = simFrom || `${yr}-01-01`; const st = simTo || `${yr}-12-31`
                // Use ep.from/to if set, intersect with sim period
                const epFrom = ep.from || sf; const epTo = ep.to || st
                const effFrom = epFrom > sf ? epFrom : sf; const effTo = epTo < st ? epTo : st
                const totalDays = (new Date(`${yr}-12-31`).getTime() - new Date(`${yr}-01-01`).getTime()) / 86400000
                const periodDays = Math.max(0, (new Date(effTo).getTime() - new Date(effFrom).getTime()) / 86400000)
                periodH = totalDays > 0 ? periodH * (periodDays / totalDays) : 0
              }
              const costPeriod = Math.round(periodH * costH)
              return (
                <div key={ep.id} className="grid grid-cols-[1fr_70px_55px_70px_60px_20px] gap-1 items-center py-1 px-1 rounded bg-[#34C759]/5">
                  <div className="flex flex-col gap-0.5">
                    <input value={ep.name} onChange={e => { const n = [...simExtraPersons]; n[ei] = { ...n[ei]!, name: e.target.value }; setSimExtraPersons(n) }} placeholder="Nombre" className="rounded border border-[#E5E5EA] dark:border-[#3A3A3C] px-1 py-0.5 text-[9px] outline-none dark:bg-[#2C2C2E] dark:text-[#F5F5F7]" />
                    <div className="flex gap-1"><input type="date" value={ep.from} onChange={e => { const n = [...simExtraPersons]; n[ei] = { ...n[ei]!, from: e.target.value }; setSimExtraPersons(n) }} className="rounded border border-[#E5E5EA] dark:border-[#3A3A3C] px-1 py-0.5 text-[8px] outline-none dark:bg-[#2C2C2E] dark:text-[#F5F5F7] flex-1" /><input type="date" value={ep.to} onChange={e => { const n = [...simExtraPersons]; n[ei] = { ...n[ei]!, to: e.target.value }; setSimExtraPersons(n) }} className="rounded border border-[#E5E5EA] dark:border-[#3A3A3C] px-1 py-0.5 text-[8px] outline-none dark:bg-[#2C2C2E] dark:text-[#F5F5F7] flex-1" /></div>
                  </div>
                  <input type="number" value={ep.salary || ''} onChange={e => { const n = [...simExtraPersons]; n[ei] = { ...n[ei]!, salary: Number(e.target.value) }; setSimExtraPersons(n) }} className="rounded border border-[#E5E5EA] dark:border-[#3A3A3C] px-1 py-0.5 text-[9px] outline-none text-right dark:bg-[#2C2C2E] dark:text-[#F5F5F7]" step={500} />
                  <input type="number" value={ep.dedication} onChange={e => { const n = [...simExtraPersons]; n[ei] = { ...n[ei]!, dedication: Number(e.target.value) }; setSimExtraPersons(n) }} className="rounded border border-[#E5E5EA] dark:border-[#3A3A3C] px-1 py-0.5 text-[9px] outline-none text-right dark:bg-[#2C2C2E] dark:text-[#F5F5F7]" min={0} max={100} step={5} />
                  <span className="text-[9px] text-right dark:text-[#F5F5F7]">{costH > 0 ? `${costH.toFixed(2).replace('.', ',')}\u20AC` : '\u2014'}</span>
                  <span className="text-[9px] text-right font-semibold text-[#FF9500]">{costPeriod > 0 ? `${fmt(costPeriod)}\u20AC` : '\u2014'}</span>
                  <button onClick={() => setSimExtraPersons(simExtraPersons.filter((_, i) => i !== ei))} className="text-[#8E8E93] hover:text-[#FF3B30]"><X className="w-3 h-3" /></button>
                </div>
              )
            })}
            <button onClick={() => setSimExtraPersons([...simExtraPersons, { id: String(Date.now()), name: '', salary: 25000, multiplier: 1.33, dedication: 100, from: simFrom || '', to: simTo || '' }])} className="text-[9px] text-[#34C759] font-medium flex items-center gap-0.5 mt-2"><Plus className="w-3 h-3" /> A\u00F1adir persona ficticia</button>
          </div>

          {/* Simulated result */}
          {(() => {
            let simTotCost = 0
            team.filter(m => monthlyData.some(d => d.id === m.id)).forEach(m => {
              const si2 = getSalaryInfo(m); const eSal = simSalaryOverrides[m.id] ?? si2.salary
              const calId2 = (m as unknown as Record<string, unknown>).calendario_id as string
              const mCal = calId2 ? calendarios.find(c => c.id === calId2) : null
              const convH = (mCal as unknown as Record<string, unknown>)?.convenio_hours as number || 1800
              const cH = convH > 0 ? (eSal * si2.multiplier) / convH : 0
              const orgDed = orgData.find(o => o.member_id === m.id)?.dedication || 0
              const eDed = simDedOverrides[m.id] !== undefined ? simDedOverrides[m.id]! / 100 : orgDed
              const pd = monthlyData.find(d => d.id === m.id); const baseH = pd ? pd.months.reduce((s, mo) => s + mo.hours, 0) : 0
              let adjH = orgDed > 0 ? baseH * (eDed / orgDed) : 0
              if (simFrom || simTo) { const sf = simFrom ? new Date(simFrom) : new Date(yr, 0, 1); const st = simTo ? new Date(simTo) : new Date(yr, 11, 31); const td = (new Date(yr, 11, 31).getTime() - new Date(yr, 0, 1).getTime()) / 86400000; const pd2 = Math.max(0, (st.getTime() - sf.getTime()) / 86400000); adjH = td > 0 ? adjH * (pd2 / td) : 0 }
              simTotCost += Math.round(adjH * cH)
            })
            simExtraPersons.forEach(ep => {
              const cH = ep.salary > 0 ? (ep.salary * ep.multiplier) / 1800 : 0; let pH = 1800 * (ep.dedication / 100)
              if (simFrom || simTo) { const sf = simFrom || `${yr}-01-01`; const st = simTo || `${yr}-12-31`; const epF = ep.from || sf; const epT = ep.to || st; const eF = epF > sf ? epF : sf; const eT = epT < st ? epT : st; const td = (new Date(`${yr}-12-31`).getTime() - new Date(`${yr}-01-01`).getTime()) / 86400000; const pd2 = Math.max(0, (new Date(eT).getTime() - new Date(eF).getTime()) / 86400000); pH = td > 0 ? pH * (pd2 / td) : 0 }
              simTotCost += Math.round(pH * cH)
            })
            // Revenue: from services, filtered by sim period
            let simTotRev = 0
            for (let mi = 0; mi < 12; mi++) {
              if (simFrom || simTo) { const moStart = new Date(yr, mi, 1); const moEnd = new Date(yr, mi + 1, 0); const sf = simFrom ? new Date(simFrom) : new Date(yr, 0, 1); const st = simTo ? new Date(simTo) : new Date(yr, 11, 31); if (moEnd < sf || moStart > st) continue }
              simTotRev += monthlyRevenueFromServices(services, yr, mi)
            }
            const simMargin = simTotRev - simTotCost; const simPct = simTotRev > 0 ? Math.round((simMargin / simTotRev) * 100) : 0
            return (
              <div className="rounded-card border-2 border-[#5856D6]/20 bg-[#5856D6]/3 dark:bg-[#5856D6]/5 p-4">
                <h4 className="text-[10px] font-semibold text-[#5856D6] mb-2 flex items-center gap-1"><Calculator className="w-3 h-3" /> Resultado simulado{simFrom || simTo ? ` (${simFrom || 'inicio'} \u2192 ${simTo || 'fin'})` : ` ${yr}`}</h4>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div><p className="text-lg font-bold text-[#007AFF]">{fmt(simTotRev)}\u20AC</p><p className="text-[7px] text-[#8E8E93]">Venta</p></div>
                  <div><p className="text-lg font-bold text-[#FF9500]">{fmt(simTotCost)}\u20AC</p><p className="text-[7px] text-[#8E8E93]">Coste</p></div>
                  <div><p className="text-lg font-bold" style={{ color: simMargin >= 0 ? '#34C759' : '#FF3B30' }}>{fmt(simMargin)}\u20AC ({simPct}%)</p><p className="text-[7px] text-[#8E8E93]">Margen</p></div>
                </div>
                <div className="mt-2 pt-2 border-t border-[#5856D6]/10 flex justify-center gap-4 text-[8px]">
                  <span className="text-[#8E8E93]">vs Base: Venta <span style={{ color: simTotRev >= pnl.totRev ? '#34C759' : '#FF3B30' }}>{simTotRev >= pnl.totRev ? '+' : ''}{fmt(simTotRev - pnl.totRev)}\u20AC</span></span>
                  <span className="text-[#8E8E93]">Coste <span style={{ color: simTotCost <= pnl.totCost ? '#34C759' : '#FF3B30' }}>{simTotCost <= pnl.totCost ? '' : '+'}{fmt(simTotCost - pnl.totCost)}\u20AC</span></span>
                  <span className="text-[#8E8E93]">Margen <span style={{ color: simPct >= pnl.totMarginPct ? '#34C759' : '#FF3B30' }}>{simPct >= pnl.totMarginPct ? '+' : ''}{simPct - pnl.totMarginPct}pp</span></span>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* FORECAST */}
      {view === 'forecast' && isCurrentYear && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            {[{ l: 'YTD (real)', rev: forecast.ytdRev, cost: forecast.ytdCost, margin: forecast.ytdMargin }, { l: `Restante (${12 - now.getMonth()} meses)`, rev: forecast.remRev, cost: forecast.remCost, margin: forecast.remMargin }, { l: `Cierre ${yr}`, rev: forecast.eoyRev, cost: forecast.eoyCost, margin: forecast.eoyMargin }].map(b => (
              <div key={b.l} className="rounded-card border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#2C2C2E] p-4">
                <p className="text-[9px] font-semibold text-[#8E8E93] uppercase mb-2">{b.l}</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between"><span className="text-[9px] text-[#8E8E93]">Venta</span><span className="text-[10px] font-bold text-[#007AFF]">{fmt(b.rev)}\u20AC</span></div>
                  <div className="flex justify-between"><span className="text-[9px] text-[#8E8E93]">Coste real</span><span className="text-[10px] font-bold text-[#FF9500]">{fmt(b.cost)}\u20AC</span></div>
                  <div className="flex justify-between border-t border-[#F2F2F7] dark:border-[#3A3A3C] pt-1"><span className="text-[9px] font-semibold dark:text-[#F5F5F7]">Margen real</span><span className="text-[10px] font-bold" style={{ color: b.margin >= 0 ? '#34C759' : '#FF3B30' }}>{fmt(b.margin)}\u20AC ({pct(b.margin, b.rev)}%)</span></div>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-card border border-[#E5E5EA] dark:border-[#3A3A3C] bg-white dark:bg-[#1C1C1E] p-4">
            <h4 className="text-[9px] font-semibold dark:text-[#F5F5F7] mb-3 flex items-center gap-1"><BarChart3 className="w-3 h-3 text-[#007AFF]" /> Mensual {yr}</h4>
            <div className="flex items-end gap-1" style={{ height: 120 }}>
              {pnl.months.map((m, i) => {
                const maxV = Math.max(...pnl.months.map(x => Math.max(x.revenue, x.cost)), 1)
                const isPast = isCurrentYear && i < now.getMonth(); const isCurrent = isCurrentYear && i === now.getMonth()
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                    <div className="w-full flex gap-px" style={{ height: 100 }}>
                      <div className="flex-1 flex flex-col justify-end"><div className="rounded-t-sm" style={{ height: `${(m.revenue / maxV) * 100}%`, background: '#007AFF', opacity: isPast ? 1 : 0.4 }} /></div>
                      <div className="flex-1 flex flex-col justify-end"><div className="rounded-t-sm" style={{ height: `${(m.cost / maxV) * 100}%`, background: '#FF9500', opacity: isPast ? 1 : 0.4 }} /></div>
                    </div>
                    <span className={`text-[7px] font-semibold ${isCurrent ? 'text-[#007AFF]' : 'text-[#8E8E93]'}`}>{MO[i]}</span>
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[#1D1D1F] text-white rounded-lg px-2 py-1.5 text-[8px] whitespace-nowrap z-20 shadow-lg">
                      <p className="font-bold mb-0.5">{MO[i]} {yr}</p>
                      <p>Venta: <span className="text-[#5AC8FA]">{fmt(m.revenue)}\u20AC</span></p>
                      <p>Coste: <span className="text-[#FF9500]">{fmt(m.cost)}\u20AC</span></p>
                      <p>Margen: <span style={{ color: m.margin >= 0 ? '#34C759' : '#FF3B30' }}>{fmt(m.margin)}\u20AC ({m.marginPct}%)</span></p>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-3 mt-2 text-[7px] text-[#8E8E93]">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#007AFF]" />Venta</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#FF9500]" />Coste real</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#007AFF] opacity-40" />Proyecci\u00F3n</span>
            </div>
          </div>
        </div>
      )}
      {view === 'forecast' && !isCurrentYear && <div className="text-center py-8 text-[10px] text-[#8E8E93]">Forecast solo disponible para {now.getFullYear()}</div>}

      {/* Setup notice */}
      {services.length === 0 && <div className="mt-3 rounded-lg border border-[#FF9500]/20 bg-[#FF9500]/5 px-3 py-2 text-[9px] text-[#FF9500]">Configura servicios/contratos en CdC \u2192 Proyectos para ver venta y margen.</div>}
    </div>
  )
}
