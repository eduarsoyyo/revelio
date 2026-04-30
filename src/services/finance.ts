// ═══ FINANCE SERVICE — Orchestrates domain/finance + data layer ═══
// Use case: components ask the service for finance data; the service loads
// from data/* and runs pure calculations from domain/finance.
//
// Layer rules (Clean Architecture):
//   - This file is the ONLY place that combines data + domain for finance.
//   - Components NEVER call data/* or domain/finance directly for project P&L.
//   - This file does NOT import from components/ or hooks/.
//   - Calculations live in domain/finance — services only call them.

import { fetchTeamMembers } from '@/data/team'
import { fetchRooms } from '@/data/rooms'
import {
  fetchTimeEntries,
  hoursByMember,
  hoursByMonth,
  sumHours,
  type TimeEntry,
} from '@/data/time-entries'
import { fetchCalendariosIndexed } from '@/data/calendarios'
import {
  // Cost rates
  migrateCostRates,
  costRateFromSalary,
  memberCostHour,
  // Service contracts (revenue)
  monthlyRevenueFromServices,
  totalSaleFromServices,
  totalEstCostFromServices,
  avgMarginFromServices,
  // Calendar / hours
  effectiveTheoreticalHoursYear,
  // Helpers
  pct,
  type CostRate,
  type LegacyCostRate,
  type ServiceContract,
  type CalendarData,
  type AbsenceData,
} from '@/domain/finance'
import type { Member, MemberAssign } from '@/types'

// ═════════════════════════════════════════════════════════════════════════════
// Public types — what the components consume
// ═════════════════════════════════════════════════════════════════════════════

export type CostMode = 'actual' | 'theoretical'

export interface MonthlyPnL {
  /** 0-indexed month (0 = January) */
  month: number
  revenue: number
  cost: number
  margin: number
  marginPct: number
}

export interface ProjectFinance {
  slug: string
  name: string
  year: number
  mode: CostMode
  /** Total invoiced revenue from contracted services */
  totalRevenue: number
  /** Total real cost (based on `mode`) */
  totalCost: number
  /** totalRevenue - totalCost */
  margin: number
  /** Margin as percentage of revenue (0..100) */
  marginPct: number
  /** Per-month breakdown — always 12 entries (Jan..Dec) */
  months: MonthlyPnL[]
  /** Members included in the cost calculation, with their contribution */
  members: ProjectMemberCost[]
}

export interface ProjectMemberCost {
  memberId: string
  memberName: string
  /** Cost/hour vigente al cierre del periodo (solo informativo) */
  currentCostHour: number
  /** Horas usadas para el cálculo (reales si mode=actual; teóricas si mode=theoretical) */
  hours: number
  /** Coste imputado al proyecto */
  cost: number
}

export interface MemberCostSummary {
  memberId: string
  memberName: string
  year: number
  /** Coste/hora vigente al final del año */
  currentCostHour: number
  /** Horas teóricas efectivas en el año (calendario - vacaciones - ausencias) */
  effectiveTheoreticalHours: number
  /** Total horas reales fichadas en el año (todos los proyectos) */
  totalHoursLogged: number
  /** Coste empresa real total: sum(time_entries.hours × cost/hora vigente en la fecha) */
  totalCost: number
  /** Coste por proyecto */
  byProject: Array<{ sala: string; hours: number; cost: number }>
}

export interface PortfolioPnL {
  year: number
  mode: CostMode
  totalRevenue: number
  totalCost: number
  margin: number
  marginPct: number
  projects: Array<Pick<ProjectFinance, 'slug' | 'name' | 'totalRevenue' | 'totalCost' | 'margin' | 'marginPct'>>
}

// ═════════════════════════════════════════════════════════════════════════════
// Internal helpers — local to this service.
// If any of these grow or get reused, promote them to domain/finance.
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Find the CostRate active on a specific date (yyyy-mm-dd).
 * A rate is active when `from <= date` and (`to` is unset OR `to >= date`).
 * If multiple match, the one with the latest `from` wins.
 * Returns null if member has no rates or none cover the date.
 */
function costRateAt(rates: CostRate[], date: string): CostRate | null {
  if (!rates || rates.length === 0) return null
  const ym = date.slice(0, 7) // CostRate stores yyyy-mm boundaries
  const sorted = [...rates].sort((a, b) => b.from.localeCompare(a.from))
  return sorted.find((r) => r.from <= ym && (!r.to || r.to >= ym)) ?? null
}

/**
 * Resolve cost/hour for a given member at a given date.
 * Falls back to legacy `cost_rate` column if no rates array, then 0.
 */
function memberCostHourAt(member: Member, calendar: CalendarData | null, date: string): number {
  const rates = migrateCostRates(member.cost_rates ?? [])
  const convH = calendar?.convenio_hours || 1800
  const active = costRateAt(rates, date)
  if (active && active.salary > 0) {
    return costRateFromSalary(active.salary, active.multiplier, convH)
  }
  return member.cost_rate ?? 0
}

/**
 * Build month-level cost from real time entries, applying the cost/hour
 * that was active on each entry's date. This is the "actual" mode.
 */
function actualCostByMonth(
  entries: TimeEntry[],
  member: Member,
  calendar: CalendarData | null,
): { byMonth: number[]; total: number; totalHours: number } {
  const byMonth = new Array<number>(12).fill(0)
  let total = 0
  let totalHours = 0
  for (const e of entries) {
    if (!e.date || !e.hours) continue
    const m = Number.parseInt(e.date.slice(5, 7), 10) - 1
    if (m < 0 || m > 11) continue
    const ch = memberCostHourAt(member, calendar, e.date)
    const c = e.hours * ch
    byMonth[m]! += c
    total += c
    totalHours += e.hours
  }
  return { byMonth, total, totalHours }
}

/**
 * Compute theoretical full-year cost for a member on a project.
 * Used when mode='theoretical' or as a forecast anchor.
 *   cost = effective_hours × dedication × current_cost_hour
 * Returns 0 if member has no calendar or no rate.
 */
function theoreticalCost(
  member: Member,
  calendar: CalendarData | null,
  dedication: number,
  year: number,
): { hours: number; cost: number; costHour: number } {
  if (!calendar) return { hours: 0, cost: 0, costHour: 0 }
  const absences: AbsenceData[] = (member.vacations ?? []) as AbsenceData[]
  const effHours = effectiveTheoreticalHoursYear(calendar, year, absences, member.id)
  const hours = effHours * dedication
  const convH = calendar.convenio_hours || 1800
  const ch = memberCostHour((member.cost_rates ?? []) as LegacyCostRate[], convH, member.cost_rate ?? 0)
  return { hours, cost: hours * ch, costHour: ch }
}

/**
 * Resolve the dedication of a member on a project for a given year.
 * Reads rooms.member_assigns (jsonb) and intersects periods with the year.
 * If multiple periods overlap, sums their dedications (matches v1 behavior).
 */
function dedicationFor(memberId: string, assigns: MemberAssign[] | undefined, year: number): number {
  if (!assigns || assigns.length === 0) return 0
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  let total = 0
  for (const a of assigns) {
    if (a.member_id !== memberId) continue
    const from = a.from ?? '0000-01-01'
    const to = a.to ?? '9999-12-31'
    if (to < yearStart || from > yearEnd) continue
    total += a.dedication ?? 1
  }
  return total
}

// ═════════════════════════════════════════════════════════════════════════════
// Public API — use cases
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Load complete P&L for a single project for a given year.
 *
 * @param slug - Room slug (e.g. 'vwfs', 'endesa')
 * @param year - Calendar year
 * @param mode - 'actual' uses real time_entries (default); 'theoretical' uses calendar × dedication
 *
 * Throws if the room doesn't exist.
 */
export async function loadProjectFinance(
  slug: string,
  year: number,
  mode: CostMode = 'actual',
): Promise<ProjectFinance> {
  // 1. Load all data needed in parallel
  const [rooms, members, calendarios] = await Promise.all([
    fetchRooms(),
    fetchTeamMembers(slug),
    fetchCalendariosIndexed(),
  ])

  const room = rooms.find((r) => r.slug === slug)
  if (!room) throw new Error(`Project not found: ${slug}`)

  const services: ServiceContract[] = (room.services ?? []) as ServiceContract[]
  const assigns: MemberAssign[] = (room.member_assigns ?? []) as MemberAssign[]

  // 2. Revenue (always from services — same in actual & theoretical mode)
  const monthlyRevenue: number[] = []
  for (let m = 0; m < 12; m++) {
    monthlyRevenue.push(monthlyRevenueFromServices(services, year, m))
  }
  const totalRevenue = monthlyRevenue.reduce((s, x) => s + x, 0)

  // 3. Cost — branch on mode
  const monthlyCost = new Array<number>(12).fill(0)
  const memberCosts: ProjectMemberCost[] = []
  let totalCost = 0

  if (mode === 'actual') {
    // Load real time entries for the project & year
    const entries = await fetchTimeEntries({ sala: slug, year })
    const entriesByMember: Record<string, TimeEntry[]> = {}
    for (const e of entries) {
      ;(entriesByMember[e.member_id] ??= []).push(e)
    }

    for (const m of members) {
      const cal = m.calendario_id ? (calendarios[m.calendario_id] ?? null) : null
      const memEntries = entriesByMember[m.id] ?? []
      if (memEntries.length === 0) continue
      const { byMonth, total, totalHours } = actualCostByMonth(memEntries, m, cal)
      for (let i = 0; i < 12; i++) monthlyCost[i]! += byMonth[i]!
      totalCost += total
      memberCosts.push({
        memberId: m.id,
        memberName: m.name,
        currentCostHour: memberCostHourAt(m, cal, `${year}-12-31`),
        hours: totalHours,
        cost: total,
      })
    }
  } else {
    // theoretical: calendar × dedication × current cost hour
    for (const m of members) {
      const cal = m.calendario_id ? (calendarios[m.calendario_id] ?? null) : null
      const ded = dedicationFor(m.id, assigns, year)
      if (ded <= 0) continue
      const { hours, cost, costHour } = theoreticalCost(m, cal, ded, year)
      if (cost <= 0) continue
      // Distribute evenly across 12 months for theoretical mode
      const perMonth = cost / 12
      for (let i = 0; i < 12; i++) monthlyCost[i]! += perMonth
      totalCost += cost
      memberCosts.push({
        memberId: m.id,
        memberName: m.name,
        currentCostHour: costHour,
        hours,
        cost,
      })
    }
  }

  const margin = totalRevenue - totalCost
  const marginPct = pct(margin, totalRevenue)

  const months: MonthlyPnL[] = []
  for (let i = 0; i < 12; i++) {
    const rev = monthlyRevenue[i]!
    const cost = Math.round(monthlyCost[i]!)
    const mar = rev - cost
    months.push({
      month: i,
      revenue: rev,
      cost,
      margin: mar,
      marginPct: pct(mar, rev),
    })
  }

  return {
    slug: room.slug,
    name: room.name,
    year,
    mode,
    totalRevenue,
    totalCost: Math.round(totalCost),
    margin: Math.round(margin),
    marginPct,
    months,
    members: memberCosts.sort((a, b) => b.cost - a.cost),
  }
}

/**
 * Forecast for a project — full-year projection using theoretical hours.
 * Equivalent to loadProjectFinance(slug, year, 'theoretical') but with
 * extra fields useful for forecasting dashboards.
 */
export async function loadProjectForecast(slug: string, year: number): Promise<ProjectFinance & {
  contractedRevenue: number
  contractedCost: number
  contractedMarginPct: number
}> {
  const base = await loadProjectFinance(slug, year, 'theoretical')

  // Pull contracted (= invoiced regardless of when work happens) figures from services
  const rooms = await fetchRooms()
  const room = rooms.find((r) => r.slug === slug)
  const services: ServiceContract[] = (room?.services ?? []) as ServiceContract[]

  return {
    ...base,
    contractedRevenue: totalSaleFromServices(services),
    contractedCost: totalEstCostFromServices(services),
    contractedMarginPct: avgMarginFromServices(services),
  }
}

/**
 * Cost summary for a single member across all their projects in a year.
 * Uses real time_entries for cost (actual mode).
 */
export async function loadMemberCostSummary(memberId: string, year: number): Promise<MemberCostSummary> {
  const [members, calendarios, entries] = await Promise.all([
    fetchTeamMembers(),
    fetchCalendariosIndexed(),
    fetchTimeEntries({ memberId, year }),
  ])

  const member = members.find((m) => m.id === memberId)
  if (!member) throw new Error(`Member not found: ${memberId}`)

  const cal = member.calendario_id ? (calendarios[member.calendario_id] ?? null) : null
  const absences: AbsenceData[] = (member.vacations ?? []) as AbsenceData[]
  const effHours = cal ? effectiveTheoreticalHoursYear(cal, year, absences, member.id) : 0

  // Group entries by sala for breakdown, computing cost with date-aware rates
  const totalsBySala: Record<string, { hours: number; cost: number }> = {}
  let totalCost = 0
  for (const e of entries) {
    if (!e.date || !e.hours) continue
    const ch = memberCostHourAt(member, cal, e.date)
    const c = e.hours * ch
    const sala = e.sala || 'unknown'
    const cur = (totalsBySala[sala] ??= { hours: 0, cost: 0 })
    cur.hours += e.hours
    cur.cost += c
    totalCost += c
  }

  const byProject = Object.entries(totalsBySala)
    .map(([sala, v]) => ({ sala, hours: v.hours, cost: Math.round(v.cost) }))
    .sort((a, b) => b.cost - a.cost)

  return {
    memberId: member.id,
    memberName: member.name,
    year,
    currentCostHour: memberCostHourAt(member, cal, `${year}-12-31`),
    effectiveTheoreticalHours: effHours,
    totalHoursLogged: sumHours(entries),
    totalCost: Math.round(totalCost),
    byProject,
  }
}

/**
 * Portfolio-wide P&L: aggregates every active project for the given year.
 * Useful for the org-level dashboard.
 */
export async function loadAllProjectsPnL(year: number, mode: CostMode = 'actual'): Promise<PortfolioPnL> {
  const rooms = await fetchRooms()
  const projects: PortfolioPnL['projects'] = []
  let totalRevenue = 0
  let totalCost = 0

  for (const r of rooms) {
    if (r.status === 'archived' || r.status === 'cancelled') continue
    try {
      const p = await loadProjectFinance(r.slug, year, mode)
      projects.push({
        slug: p.slug,
        name: p.name,
        totalRevenue: p.totalRevenue,
        totalCost: p.totalCost,
        margin: p.margin,
        marginPct: p.marginPct,
      })
      totalRevenue += p.totalRevenue
      totalCost += p.totalCost
    } catch {
      // Skip projects that fail to load (e.g. missing config)
      continue
    }
  }

  const margin = totalRevenue - totalCost
  return {
    year,
    mode,
    totalRevenue,
    totalCost,
    margin,
    marginPct: pct(margin, totalRevenue),
    projects: projects.sort((a, b) => b.totalRevenue - a.totalRevenue),
  }
}

/**
 * Hours-only summary for a member: theoretical vs logged, by month.
 * No costs — just hours. Useful for balance/jornada widgets.
 */
export async function loadMemberHours(memberId: string, year: number): Promise<{
  memberId: string
  memberName: string
  year: number
  theoreticalHours: number
  loggedHours: number
  balance: number
  byMonth: Record<string, number>
}> {
  const [members, calendarios, entries] = await Promise.all([
    fetchTeamMembers(),
    fetchCalendariosIndexed(),
    fetchTimeEntries({ memberId, year }),
  ])

  const member = members.find((m) => m.id === memberId)
  if (!member) throw new Error(`Member not found: ${memberId}`)

  const cal = member.calendario_id ? (calendarios[member.calendario_id] ?? null) : null
  const absences: AbsenceData[] = (member.vacations ?? []) as AbsenceData[]
  const theoreticalHours = cal ? effectiveTheoreticalHoursYear(cal, year, absences, member.id) : 0
  const loggedHours = sumHours(entries)

  return {
    memberId: member.id,
    memberName: member.name,
    year,
    theoreticalHours,
    loggedHours,
    balance: loggedHours - theoreticalHours,
    byMonth: hoursByMonth(entries),
  }
}

/**
 * Members assigned to a project, with their dedication and logged hours for the year.
 */
export async function loadProjectMembers(slug: string, year: number): Promise<Array<{
  memberId: string
  memberName: string
  dedication: number
  hoursLogged: number
  costHour: number
}>> {
  const [rooms, members, entries, calendarios] = await Promise.all([
    fetchRooms(),
    fetchTeamMembers(slug),
    fetchTimeEntries({ sala: slug, year }),
    fetchCalendariosIndexed(),
  ])

  const room = rooms.find((r) => r.slug === slug)
  if (!room) throw new Error(`Project not found: ${slug}`)
  const assigns: MemberAssign[] = (room.member_assigns ?? []) as MemberAssign[]
  const hoursMap = hoursByMember(entries)

  return members
    .map((m) => {
      const cal = m.calendario_id ? (calendarios[m.calendario_id] ?? null) : null
      return {
        memberId: m.id,
        memberName: m.name,
        dedication: dedicationFor(m.id, assigns, year),
        hoursLogged: hoursMap[m.id] ?? 0,
        costHour: memberCostHourAt(m, cal, `${year}-12-31`),
      }
    })
    .sort((a, b) => b.dedication - a.dedication)
}
