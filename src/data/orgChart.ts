// ═══ ORG CHART DATA ═══ Pure DB access for the org_chart table.
// One row = one assignment of a member to a project (sala).
// A member can have multiple rows in the same sala for multi-period dedication.

import { supabase } from './supabase'
import { handleSupabaseError } from '@/lib/errors'
import type { OrgChartEntry } from '@/types'

const COLS = 'id, sala, member_id, manager_id, dedication, start_date, end_date'

/**
 * Load all org_chart rows for a single sala.
 * Returns [] on Supabase error after delegating to handleSupabaseError
 * (which throws RevelioError, so callers will normally catch upstream).
 */
export async function fetchOrgChartBySala(sala: string): Promise<OrgChartEntry[]> {
  const { data, error } = await supabase.from('org_chart').select(COLS).eq('sala', sala)
  if (error) handleSupabaseError(error)
  return (data ?? []) as OrgChartEntry[]
}

/**
 * Load org_chart rows for several salas in a single round-trip.
 * Returns a map { sala -> entries } so callers can index by project.
 */
export async function fetchOrgChartBySalas(salas: string[]): Promise<Record<string, OrgChartEntry[]>> {
  if (salas.length === 0) return {}
  const { data, error } = await supabase.from('org_chart').select(COLS).in('sala', salas)
  if (error) handleSupabaseError(error)

  const grouped: Record<string, OrgChartEntry[]> = {}
  for (const row of (data ?? []) as OrgChartEntry[]) {
    const list = grouped[row.sala]
    if (list) {
      list.push(row)
    } else {
      grouped[row.sala] = [row]
    }
  }
  return grouped
}
