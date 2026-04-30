// ═══ FINANCE SERVICE — Integration tests ═══
// We mock the data layer (data/*) and let domain/finance run for real,
// because domain is pure logic — mocking it would test mocks, not behavior.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Member, Room } from '@/types'
import type { CalendarData } from '@/domain/finance'
import type { TimeEntry } from '@/data/time-entries'

// ── Mocks ────────────────────────────────────────────────────────────────────
// Hoist-friendly mock state. We'll reset before each test.
let mockRooms: Room[] = []
let mockMembers: Member[] = []
let mockEntries: TimeEntry[] = []
let mockCalendars: Record<string, CalendarData> = {}

vi.mock('@/data/team', () => ({
  fetchTeamMembers: vi.fn(async (sala?: string) => {
    if (!sala) return mockMembers
    return mockMembers.filter((m) => (m.rooms ?? []).includes(sala))
  }),
  updateMember: vi.fn(),
}))

vi.mock('@/data/rooms', () => ({
  fetchRooms: vi.fn(async () => mockRooms),
  createRoom: vi.fn(),
  deleteRoom: vi.fn(),
}))

vi.mock('@/data/time-entries', async () => {
  // Re-export real helpers but mock the network call
  const actual = await vi.importActual<typeof import('@/data/time-entries')>('@/data/time-entries')
  return {
    ...actual,
    fetchTimeEntries: vi.fn(async (filter: { sala?: string; memberId?: string; year?: number } = {}) => {
      return mockEntries.filter((e) => {
        if (filter.sala && e.sala !== filter.sala) return false
        if (filter.memberId && e.member_id !== filter.memberId) return false
        if (filter.year !== undefined) {
          const y = String(filter.year)
          if (!e.date.startsWith(y)) return false
        }
        return true
      })
    }),
  }
})

vi.mock('@/data/calendarios', () => ({
  fetchCalendarios: vi.fn(async () => Object.values(mockCalendars)),
  fetchCalendariosIndexed: vi.fn(async () => mockCalendars),
  indexCalendarios: vi.fn(),
}))

// ── Fixtures ─────────────────────────────────────────────────────────────────
const stdCalendar: CalendarData = {
  id: 'cal-std',
  name: 'Convenio TIC 2026',
  convenio_hours: 1800,
  daily_hours_lj: 8,
  daily_hours_v: 7,
  daily_hours_intensive: 7,
  intensive_start: '07-01',
  intensive_end: '08-31',
  holidays: [
    { date: '2026-01-01', name: 'Año Nuevo' },
    { date: '2026-01-06', name: 'Reyes' },
    { date: '2026-12-25', name: 'Navidad' },
  ],
}

function makeMember(id: string, name: string, rooms: string[], salary = 36000): Member {
  return {
    id,
    name,
    rooms,
    calendario_id: 'cal-std',
    cost_rates: [{ from: '2026-01', salary, multiplier: 1.33 }],
    cost_rate: 25, // legacy fallback
    vacations: [],
  } as Member
}

function makeEntry(id: string, member_id: string, sala: string, date: string, hours: number): TimeEntry {
  return { id, member_id, sala, date, hours, status: 'aprobado' }
}

// ── Setup ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
  mockCalendars = { 'cal-std': stdCalendar }
  mockMembers = []
  mockRooms = []
  mockEntries = []
})

// ═════════════════════════════════════════════════════════════════════════════
// loadProjectFinance
// ═════════════════════════════════════════════════════════════════════════════

describe('loadProjectFinance — actual mode', () => {
  it('throws if project does not exist', async () => {
    const { loadProjectFinance } = await import('@/services/finance')
    await expect(loadProjectFinance('ghost', 2026)).rejects.toThrow(/not found/i)
  })

  it('returns zeros when project has no services and no entries', async () => {
    mockRooms = [{ slug: 'empty', name: 'Empty', services: [], member_assigns: [] }]
    const { loadProjectFinance } = await import('@/services/finance')
    const r = await loadProjectFinance('empty', 2026)
    expect(r.totalRevenue).toBe(0)
    expect(r.totalCost).toBe(0)
    expect(r.margin).toBe(0)
    expect(r.marginPct).toBe(0)
    expect(r.months).toHaveLength(12)
    expect(r.members).toEqual([])
  })

  it('computes revenue from a 12-month service prorated equally', async () => {
    mockRooms = [
      {
        slug: 'vwfs',
        name: 'VWFS',
        services: [
          {
            id: 's1',
            name: 'Service A',
            from: '2026-01-01',
            to: '2026-12-31',
            cost: 60_000,
            margin_pct: 25,
            risk_pct: 0,
          },
        ],
        member_assigns: [],
      },
    ]
    const { loadProjectFinance } = await import('@/services/finance')
    const r = await loadProjectFinance('vwfs', 2026)
    // sale = 60_000 / (1 - 0.25) = 80_000 → ~6_667/month
    expect(r.totalRevenue).toBeGreaterThan(79_900)
    expect(r.totalRevenue).toBeLessThan(80_100)
    r.months.forEach((m) => expect(m.revenue).toBeGreaterThan(0))
  })

  it('costs each time entry at the cost/hour vigente at its date', async () => {
    // Member with a salary bump from July
    const m = makeMember('u1', 'Eva', ['vwfs'], 30_000)
    m.cost_rates = [
      { from: '2026-01', to: '2026-06', salary: 30_000, multiplier: 1.33 },
      { from: '2026-07', salary: 36_000, multiplier: 1.33 },
    ]
    mockMembers = [m]
    mockRooms = [{ slug: 'vwfs', name: 'VWFS', services: [], member_assigns: [] }]
    mockEntries = [
      makeEntry('e1', 'u1', 'vwfs', '2026-03-15', 8), // pre-bump rate
      makeEntry('e2', 'u1', 'vwfs', '2026-09-15', 8), // post-bump rate
    ]
    const { loadProjectFinance } = await import('@/services/finance')
    const r = await loadProjectFinance('vwfs', 2026, 'actual')

    // pre-bump: 30000 * 1.33 / 1800 = 22.17 €/h → 8h ≈ 177€
    // post-bump: 36000 * 1.33 / 1800 = 26.6 €/h → 8h ≈ 213€
    // total ≈ 390€
    expect(r.totalCost).toBeGreaterThan(380)
    expect(r.totalCost).toBeLessThan(400)
    expect(r.members).toHaveLength(1)
    expect(r.members[0]!.hours).toBe(16)
  })

  it('skips members with no entries in actual mode', async () => {
    mockMembers = [makeMember('u1', 'Eva', ['vwfs']), makeMember('u2', 'Tom', ['vwfs'])]
    mockRooms = [{ slug: 'vwfs', name: 'VWFS', services: [], member_assigns: [] }]
    mockEntries = [makeEntry('e1', 'u1', 'vwfs', '2026-03-15', 8)] // only u1 fichó
    const { loadProjectFinance } = await import('@/services/finance')
    const r = await loadProjectFinance('vwfs', 2026)
    expect(r.members).toHaveLength(1)
    expect(r.members[0]!.memberId).toBe('u1')
  })

  it('does not load time_entries in theoretical mode', async () => {
    mockMembers = [makeMember('u1', 'Eva', ['vwfs'])]
    mockRooms = [
      {
        slug: 'vwfs',
        name: 'VWFS',
        services: [],
        member_assigns: [{ member_id: 'u1', dedication: 1, from: '2026-01-01', to: '2026-12-31' }],
      },
    ]
    const { loadProjectFinance } = await import('@/services/finance')
    const dataModule = await import('@/data/time-entries')
    const r = await loadProjectFinance('vwfs', 2026, 'theoretical')
    expect(dataModule.fetchTimeEntries).not.toHaveBeenCalled()
    expect(r.totalCost).toBeGreaterThan(0)
  })

  it('theoretical mode: cost ≈ effective_hours × dedication × cost_hour', async () => {
    const m = makeMember('u1', 'Eva', ['vwfs'], 36_000) // cost/h ≈ 26.6
    mockMembers = [m]
    mockRooms = [
      {
        slug: 'vwfs',
        name: 'VWFS',
        services: [],
        member_assigns: [{ member_id: 'u1', dedication: 0.5, from: '2026-01-01', to: '2026-12-31' }],
      },
    ]
    const { loadProjectFinance } = await import('@/services/finance')
    const r = await loadProjectFinance('vwfs', 2026, 'theoretical')
    // ~1700 effective hours * 0.5 ded * 26.6 €/h ≈ 22_500€ (rough)
    expect(r.totalCost).toBeGreaterThan(15_000)
    expect(r.totalCost).toBeLessThan(35_000)
    // Distributed across 12 months
    const monthsWithCost = r.months.filter((mm) => mm.cost > 0).length
    expect(monthsWithCost).toBe(12)
  })

  it('aggregates margin and pct correctly', async () => {
    mockRooms = [
      {
        slug: 'vwfs',
        name: 'VWFS',
        services: [
          {
            id: 's1',
            name: 'A',
            from: '2026-01-01',
            to: '2026-12-31',
            cost: 75_000,
            margin_pct: 25,
            risk_pct: 0,
          },
        ],
        member_assigns: [],
      },
    ]
    mockMembers = [makeMember('u1', 'Eva', ['vwfs'])]
    mockEntries = [makeEntry('e1', 'u1', 'vwfs', '2026-06-15', 100)]
    const { loadProjectFinance } = await import('@/services/finance')
    const r = await loadProjectFinance('vwfs', 2026)
    expect(r.margin).toBe(r.totalRevenue - r.totalCost)
    if (r.totalRevenue > 0) {
      expect(r.marginPct).toBe(Math.round((r.margin / r.totalRevenue) * 100))
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// loadProjectForecast
// ═════════════════════════════════════════════════════════════════════════════

describe('loadProjectForecast', () => {
  it('returns contracted figures alongside the theoretical P&L', async () => {
    mockRooms = [
      {
        slug: 'vwfs',
        name: 'VWFS',
        services: [
          {
            id: 's1',
            name: 'A',
            from: '2026-01-01',
            to: '2026-12-31',
            cost: 60_000,
            margin_pct: 25,
            risk_pct: 0,
          },
        ],
        member_assigns: [],
      },
    ]
    mockMembers = []
    const { loadProjectForecast } = await import('@/services/finance')
    const r = await loadProjectForecast('vwfs', 2026)
    expect(r.contractedRevenue).toBe(80_000) // 60k / (1-0.25)
    expect(r.contractedCost).toBe(60_000)
    expect(r.contractedMarginPct).toBe(25)
    expect(r.mode).toBe('theoretical')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// loadMemberCostSummary
// ═════════════════════════════════════════════════════════════════════════════

describe('loadMemberCostSummary', () => {
  it('throws when member does not exist', async () => {
    const { loadMemberCostSummary } = await import('@/services/finance')
    await expect(loadMemberCostSummary('ghost', 2026)).rejects.toThrow(/not found/i)
  })

  it('breaks down cost by project', async () => {
    mockMembers = [makeMember('u1', 'Eva', ['vwfs', 'endesa'], 36_000)]
    mockEntries = [
      makeEntry('e1', 'u1', 'vwfs', '2026-03-01', 100),
      makeEntry('e2', 'u1', 'endesa', '2026-04-01', 50),
    ]
    const { loadMemberCostSummary } = await import('@/services/finance')
    const r = await loadMemberCostSummary('u1', 2026)
    expect(r.totalHoursLogged).toBe(150)
    expect(r.byProject).toHaveLength(2)
    expect(r.byProject[0]!.sala).toBe('vwfs') // sorted by cost desc
    expect(r.byProject[0]!.hours).toBe(100)
    expect(r.totalCost).toBeGreaterThan(0)
  })

  it('uses date-aware cost rates for total cost', async () => {
    const m = makeMember('u1', 'Eva', ['vwfs'])
    m.cost_rates = [
      { from: '2026-01', to: '2026-06', salary: 30_000, multiplier: 1.33 },
      { from: '2026-07', salary: 50_000, multiplier: 1.33 },
    ]
    mockMembers = [m]
    mockEntries = [
      makeEntry('e1', 'u1', 'vwfs', '2026-02-01', 10),
      makeEntry('e2', 'u1', 'vwfs', '2026-08-01', 10),
    ]
    const { loadMemberCostSummary } = await import('@/services/finance')
    const r = await loadMemberCostSummary('u1', 2026)
    // Pre: 30000*1.33/1800 ≈ 22.17 → 10h ≈ 222€
    // Post: 50000*1.33/1800 ≈ 36.94 → 10h ≈ 369€
    // Total ≈ 591€
    expect(r.totalCost).toBeGreaterThan(580)
    expect(r.totalCost).toBeLessThan(600)
  })

  it('reports effective theoretical hours from calendar', async () => {
    mockMembers = [makeMember('u1', 'Eva', ['vwfs'])]
    const { loadMemberCostSummary } = await import('@/services/finance')
    const r = await loadMemberCostSummary('u1', 2026)
    // Should be ~1900-2100h for a normal full year (no vacations)
    expect(r.effectiveTheoreticalHours).toBeGreaterThan(1700)
    expect(r.effectiveTheoreticalHours).toBeLessThan(2100)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// loadAllProjectsPnL
// ═════════════════════════════════════════════════════════════════════════════

describe('loadAllProjectsPnL', () => {
  it('skips archived & cancelled projects', async () => {
    mockRooms = [
      { slug: 'live', name: 'Live', status: 'active', services: [], member_assigns: [] },
      { slug: 'old', name: 'Old', status: 'archived', services: [], member_assigns: [] },
      { slug: 'dead', name: 'Dead', status: 'cancelled', services: [], member_assigns: [] },
    ]
    const { loadAllProjectsPnL } = await import('@/services/finance')
    const r = await loadAllProjectsPnL(2026)
    expect(r.projects).toHaveLength(1)
    expect(r.projects[0]!.slug).toBe('live')
  })

  it('aggregates revenue across all projects, sorted by revenue desc', async () => {
    mockRooms = [
      {
        slug: 'big',
        name: 'Big',
        services: [{ id: 's1', name: 'X', from: '2026-01-01', to: '2026-12-31', cost: 200_000, margin_pct: 25, risk_pct: 0 }],
        member_assigns: [],
      },
      {
        slug: 'small',
        name: 'Small',
        services: [{ id: 's2', name: 'Y', from: '2026-01-01', to: '2026-12-31', cost: 30_000, margin_pct: 25, risk_pct: 0 }],
        member_assigns: [],
      },
    ]
    const { loadAllProjectsPnL } = await import('@/services/finance')
    const r = await loadAllProjectsPnL(2026)
    expect(r.projects).toHaveLength(2)
    expect(r.projects[0]!.slug).toBe('big')
    expect(r.totalRevenue).toBeGreaterThan(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// loadMemberHours
// ═════════════════════════════════════════════════════════════════════════════

describe('loadMemberHours', () => {
  it('reports balance = logged - theoretical', async () => {
    mockMembers = [makeMember('u1', 'Eva', ['vwfs'])]
    mockEntries = [
      makeEntry('e1', 'u1', 'vwfs', '2026-01-15', 8),
      makeEntry('e2', 'u1', 'vwfs', '2026-02-15', 8),
    ]
    const { loadMemberHours } = await import('@/services/finance')
    const r = await loadMemberHours('u1', 2026)
    expect(r.loggedHours).toBe(16)
    expect(r.theoreticalHours).toBeGreaterThan(0)
    expect(r.balance).toBe(r.loggedHours - r.theoreticalHours)
  })

  it('groups logged hours by month', async () => {
    mockMembers = [makeMember('u1', 'Eva', ['vwfs'])]
    mockEntries = [
      makeEntry('e1', 'u1', 'vwfs', '2026-01-15', 8),
      makeEntry('e2', 'u1', 'vwfs', '2026-01-16', 8),
      makeEntry('e3', 'u1', 'vwfs', '2026-03-01', 4),
    ]
    const { loadMemberHours } = await import('@/services/finance')
    const r = await loadMemberHours('u1', 2026)
    expect(r.byMonth['2026-01']).toBe(16)
    expect(r.byMonth['2026-03']).toBe(4)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// loadProjectMembers
// ═════════════════════════════════════════════════════════════════════════════

describe('loadProjectMembers', () => {
  it('returns members with dedication and hours, sorted by dedication desc', async () => {
    mockMembers = [
      makeMember('u1', 'Eva', ['vwfs']),
      makeMember('u2', 'Tom', ['vwfs']),
    ]
    mockRooms = [
      {
        slug: 'vwfs',
        name: 'VWFS',
        services: [],
        member_assigns: [
          { member_id: 'u1', dedication: 0.5, from: '2026-01-01', to: '2026-12-31' },
          { member_id: 'u2', dedication: 1, from: '2026-01-01', to: '2026-12-31' },
        ],
      },
    ]
    mockEntries = [makeEntry('e1', 'u1', 'vwfs', '2026-03-01', 40)]
    const { loadProjectMembers } = await import('@/services/finance')
    const r = await loadProjectMembers('vwfs', 2026)
    expect(r).toHaveLength(2)
    expect(r[0]!.memberId).toBe('u2') // higher dedication first
    expect(r[1]!.hoursLogged).toBe(40)
  })

  it('throws when project does not exist', async () => {
    const { loadProjectMembers } = await import('@/services/finance')
    await expect(loadProjectMembers('ghost', 2026)).rejects.toThrow(/not found/i)
  })
})
