// ═══ TIME ENTRIES — Data access for fichajes ═══
// Lee horas reales fichadas desde la tabla time_entries de Supabase.
// Sigue el patrón del repo: throw on error vía handleSupabaseError.

import { handleSupabaseError } from '@/lib/errors'
import { supabase } from './supabase'

export interface TimeEntry {
  id: string
  member_id: string
  sala: string
  date: string
  hours: number
  category?: string | null
  description?: string | null
  auto_distributed?: boolean | null
  status?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface TimeEntriesFilter {
  /** Filter by project slug (rooms.slug). Optional. */
  sala?: string
  /** Filter by member id. Optional. */
  memberId?: string
  /** Inclusive lower bound for `date` (yyyy-mm-dd). Optional. */
  dateFrom?: string
  /** Inclusive upper bound for `date` (yyyy-mm-dd). Optional. */
  dateTo?: string
  /** Filter by year — shortcut for dateFrom/dateTo of that year. */
  year?: number
  /** Only count fichajes with these statuses. Defaults to all. */
  statuses?: string[]
}

/**
 * Load time entries with optional filters.
 * Returns entries ordered by date ascending.
 *
 * Examples:
 *   fetchTimeEntries({ sala: 'vwfs', year: 2026 })
 *   fetchTimeEntries({ memberId: 'abc', dateFrom: '2026-01-01', dateTo: '2026-03-31' })
 */
export async function fetchTimeEntries(filter: TimeEntriesFilter = {}): Promise<TimeEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase.from('time_entries').select('*').order('date', { ascending: true })

  if (filter.sala) query = query.eq('sala', filter.sala)
  if (filter.memberId) query = query.eq('member_id', filter.memberId)

  // Resolve year shortcut (only if no explicit dateFrom/dateTo).
  let dateFrom = filter.dateFrom
  let dateTo = filter.dateTo
  if (filter.year !== undefined && !dateFrom && !dateTo) {
    dateFrom = `${filter.year}-01-01`
    dateTo = `${filter.year}-12-31`
  }
  if (dateFrom) query = query.gte('date', dateFrom)
  if (dateTo) query = query.lte('date', dateTo)

  if (filter.statuses && filter.statuses.length > 0) {
    query = query.in('status', filter.statuses)
  }

  const { data, error } = await query
  if (error) handleSupabaseError(error)
  return (data ?? []) as TimeEntry[]
}

/**
 * Sum hours from a list of TimeEntry. Pure helper, no DB access.
 */
export function sumHours(entries: TimeEntry[]): number {
  return entries.reduce((s, e) => s + (e.hours || 0), 0)
}

/**
 * Group time entries by member id, returning total hours per member.
 */
export function hoursByMember(entries: TimeEntry[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of entries) {
    if (!e.member_id) continue
    out[e.member_id] = (out[e.member_id] || 0) + (e.hours || 0)
  }
  return out
}

/**
 * Group time entries by month (yyyy-mm), returning total hours per month.
 */
export function hoursByMonth(entries: TimeEntry[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const e of entries) {
    const ym = (e.date ?? '').slice(0, 7)
    if (!ym) continue
    out[ym] = (out[ym] || 0) + (e.hours || 0)
  }
  return out
}
