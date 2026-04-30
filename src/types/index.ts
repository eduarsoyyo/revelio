// ─── Core entities ───
export interface Member {
  id: string
  name: string
  username: string
  email: string
  avatar: string
  color: string
  role_label: string
  company: string
  phone: string
  rooms: string[]
  is_superuser: boolean
  house: string | null
  dedication: number
  start_date: string | null
  end_date: string | null
  calendario_id: string | null
  convenio_id: string | null
  vacations: VacationEntry[]
  annual_vac_days: number
  prev_year_pending: number
  created_at: string
  // ─── Finance & status fields (jsonb / optional columns) ───
  cost_rate?: number | null
  cost_rates?: CostRateEntry[] | null
  sell_rate?: number | null
  contract_type?: string | null
  convenio?: string | null
  preferences?: Record<string, unknown> | null
  manager_id?: string | null
  responsable_id?: string | null
  hire_date?: string | null
  status?: string | null
  vacation_carryover?: number | null
}
export interface VacationEntry {
  date: string
  type: string
  half?: 'morning' | 'afternoon'
  // ─── Optional fields used by absence-aware calculations ───
  member_id?: string
  date_from?: string
  date_to?: string
  days?: number
  status?: string
}
export interface Room {
  slug: string
  name: string
  tipo: RoomType
  metadata: Record<string, unknown>
  // ─── Project lifecycle & finance (optional jsonb / columns) ───
  status?: string | null
  billing_type?: string | null
  budget?: number | null
  sell_rate?: number | null
  fixed_price?: number | null
  planned_hours?: number | null
  planned_start?: string | null
  planned_end?: string | null
  actual_start?: string | null
  actual_end?: string | null
  start_date?: string | null
  end_date?: string | null
  description?: string | null
  target_margin?: number | null
  risk_pct?: number | null
  cost_profiles?: CostProfile[] | null
  member_rates?: MemberRate[] | null
  member_assigns?: MemberAssign[] | null
  member_sell_rates?: MemberRate[] | null
  services?: ServiceContractEntry[] | null
  created_at?: string | null
}
export type RoomType = 'agile' | 'waterfall' | 'itil' | 'kanban'
export interface Retro {
  id: string
  sala: string
  tipo: string
  status: 'active' | 'closed'
  data: RetroData
  created_by: string | null
  created_at: string
  updated_at: string
}
export interface RetroData {
  objective?: string
  notes?: RetroNote[]
  risks?: Risk[]
  tasks?: RetroTask[]
  actions?: RetroAction[]
}
export interface RetroNote {
  id: string
  text: string
  category: 'good' | 'bad' | 'start' | 'stop'
  author: string
  votes: string[]
  reactions: Record<string, string[]>
}
export interface RetroTask {
  id: string
  text: string
  status: 'done' | 'partial' | 'not'
}
export interface RetroAction {
  id: string
  title: string
  description?: string
  owner?: string
  status: string
  priority: string
  source?: string
}
export interface Risk {
  id: string
  title: string
  description?: string
  probability: number
  impact: number
  criticality: number
  status: string
  owner?: string
  mitigation?: string
  sala?: string
}
export interface Tag {
  id: string
  sala: string
  name: string
  color: string
}
export interface OrgChartEntry {
  id: string
  sala: string
  member_id: string
  manager_id: string | null
  role: string
  level: number
  dedication?: number
  start_date?: string
  end_date?: string
}
export interface SkillProfile {
  id: string
  sala: string
  name: string
  description: string
  fte: number
  color: string
  icon: string
  sort_order: number
}
export interface Skill {
  id: string
  sala: string
  name: string
  category: string
  icon: string
  description: string
}
export interface Calendario {
  id: string
  name: string
  year: number
  region: string
  holidays: CalendarHoliday[]
  daily_hours_lj: number
  daily_hours_v: number
  daily_hours_intensive: number
  intensive_from: string | null
  intensive_to: string | null
  // ─── Optional finance / hours fields ───
  convenio_hours?: number | null
}
export interface CalendarHoliday {
  date: string
  name: string
}
export interface Convenio {
  id: string
  name: string
  vac_days: number
  extra_days: unknown[]
  notes: string
}
// ─── Auth ───
export interface AuthUser {
  id: string
  name: string
  username: string
  email: string
  avatar: string
  color: string
  role_label: string
  is_superuser: boolean
  rooms: string[]
}
// ─── Retro Metrics ───
export interface RetroMetric {
  id: string
  sala: string
  tipo: string
  date: string
  notes: number
  actions: number
  risks: number
  participants: number
  participant_names: string[]
  objective: string
  tasks: RetroTask[]
  phase_times: Record<string, number>
  total_time: number
  tier: string
  score: number
  created_at: string
}
// ═════════════════════════════════════════════════════════════════════════════
// Finance / cost-tracking jsonb shapes — referenced from Member and Room
// ═════════════════════════════════════════════════════════════════════════════
/** Single salary entry on team_members.cost_rates (jsonb array). */
export interface CostRateEntry {
  /** First month of validity, format yyyy-mm */
  from: string
  /** Last month of validity (inclusive), yyyy-mm. Open-ended if undefined. */
  to?: string
  /** Annual gross salary in euros (preferred field) */
  salary?: number
  /** Multiplier on top of salary to estimate company cost (default 1.33) */
  multiplier?: number
  /** Legacy €/hour stored directly (pre-migration) */
  rate?: number
}

/** Member rate override on rooms.member_rates (jsonb array). */
export interface MemberRate {
  member_id: string
  from?: string
  to?: string
  rate: number
}

/** Project assignment with dedication on rooms.member_assigns (jsonb array). */
export interface MemberAssign {
  member_id: string
  /** 0..1 (1 = full time) */
  dedication: number
  from?: string
  to?: string
}

/** Cost profile bucket on rooms.cost_profiles (jsonb array). */
export interface CostProfile {
  id: string
  name: string
  rate: number
}

/** Contracted service on rooms.services (jsonb array). */
export interface ServiceContractEntry {
  id: string
  name: string
  from: string
  to: string
  cost: number
  margin_pct: number
  risk_pct: number
}
