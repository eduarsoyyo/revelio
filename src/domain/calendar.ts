/**
 * domain/calendar.ts
 *
 * Lógica pura de calendarios, jornada laboral y festivos.
 *
 * Este módulo NO importa de data/, services/ ni components/.
 * Solo recibe datos como parámetros y devuelve resultados.
 *
 * Cumple con CMP-Revelio-v2-Guia-Desarrollo:
 * - Domain layer: lógica pura sin dependencias externas
 * - TypeScript estricto
 * - Funciones < 40 líneas
 * - Nombres descriptivos
 */

// ============================================================
// TYPES
// ============================================================

export interface Holiday {
  date: string // YYYY-MM-DD
  name: string
}

export interface Calendar {
  id: string
  name: string
  year?: number
  region?: string
  convenio_hours: number
  daily_hours_lj: number // Lunes a Jueves
  daily_hours_v: number // Viernes
  daily_hours_intensive: number // Jornada intensiva (verano)
  intensive_start: string // MM-DD (ej: '08-01')
  intensive_end: string // MM-DD (ej: '08-31')
  holidays: Holiday[]
  weekly_hours_normal?: number
  vacation_days?: number
  adjustment_days?: number
  adjustment_hours?: number
  free_days?: number
}

// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_DAILY_HOURS = 8
const DEFAULT_INTENSIVE_HOURS = 7
const DEFAULT_INTENSIVE_START = '08-01'
const DEFAULT_INTENSIVE_END = '08-31'
const DEFAULT_VACATION_DAYS = 22

// ============================================================
// PURE FUNCTIONS — DATE HELPERS
// ============================================================

/**
 * Parsea una fecha en formato YYYY-MM-DD a Date local.
 * Evita problemas de timezone usando new Date(y, m-1, d).
 */
export function parseDate(ds: string): Date {
  const [y, m, d] = ds.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

/**
 * Formatea una fecha a YYYY-MM-DD.
 */
export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Devuelve true si la fecha es fin de semana (sábado o domingo).
 */
export function isWeekend(ds: string): boolean {
  const dow = parseDate(ds).getDay()
  return dow === 0 || dow === 6
}

/**
 * Devuelve el día de la semana (0=domingo, 6=sábado).
 */
export function dayOfWeek(ds: string): number {
  return parseDate(ds).getDay()
}

// ============================================================
// PURE FUNCTIONS — HOLIDAYS
// ============================================================

/**
 * Convierte un array de Holiday a un Set de strings YYYY-MM-DD para búsqueda O(1).
 */
export function getHolidaySet(holidays: Holiday[]): Set<string> {
  return new Set(holidays.map((h) => h.date))
}

/**
 * Devuelve true si la fecha ds (YYYY-MM-DD) es festivo según el calendario.
 */
export function isHoliday(ds: string, calendar: Calendar | null | undefined): boolean {
  if (!calendar) return false
  return calendar.holidays.some((h) => h.date === ds)
}

/**
 * Cuenta el número de festivos en un año dado.
 */
export function holidayCountYear(calendar: Calendar | null | undefined, year: number): number {
  if (!calendar) return 0
  const yearStr = String(year)
  return calendar.holidays.filter((h) => h.date.startsWith(yearStr)).length
}

/**
 * Cuenta festivos en un rango de fechas [from, to] inclusive.
 */
export function holidayCountInRange(
  calendar: Calendar | null | undefined,
  from: string,
  to: string,
): number {
  if (!calendar) return 0
  return calendar.holidays.filter((h) => h.date >= from && h.date <= to).length
}

// ============================================================
// PURE FUNCTIONS — JORNADA INTENSIVA
// ============================================================

/**
 * Devuelve true si la fecha cae dentro del periodo de jornada intensiva.
 * Compara solo MM-DD (sin año) para que funcione cualquier año.
 */
export function isIntensiveDay(ds: string, calendar: Calendar | null | undefined): boolean {
  if (!calendar) return false
  const mmdd = ds.slice(5) // 'MM-DD'
  const start = calendar.intensive_start || DEFAULT_INTENSIVE_START
  const end = calendar.intensive_end || DEFAULT_INTENSIVE_END
  return mmdd >= start && mmdd <= end
}

/**
 * Devuelve las horas teóricas para un día específico según el calendario.
 *
 * Reglas:
 * - Fin de semana: 0 horas
 * - Festivo: 0 horas
 * - Jornada intensiva: daily_hours_intensive
 * - Lunes a jueves (dow 1-4): daily_hours_lj
 * - Viernes (dow 5): daily_hours_v
 *
 * Si calendar es null/undefined, devuelve 8h en días laborables.
 */
export function dailyTheoreticalHours(ds: string, calendar: Calendar | null | undefined): number {
  if (isWeekend(ds)) return 0
  if (isHoliday(ds, calendar)) return 0

  if (!calendar) return DEFAULT_DAILY_HOURS

  if (isIntensiveDay(ds, calendar)) {
    return calendar.daily_hours_intensive || DEFAULT_INTENSIVE_HOURS
  }

  const dow = dayOfWeek(ds)
  if (dow >= 1 && dow <= 4) return calendar.daily_hours_lj || DEFAULT_DAILY_HOURS
  if (dow === 5) return calendar.daily_hours_v || DEFAULT_DAILY_HOURS

  return DEFAULT_DAILY_HOURS
}

// ============================================================
// PURE FUNCTIONS — DÍAS LABORABLES
// ============================================================

/**
 * Devuelve un array de fechas YYYY-MM-DD entre from y to (inclusive).
 */
export function dateRange(from: string, to: string): string[] {
  const start = parseDate(from)
  const end = parseDate(to)
  const result: string[] = []

  const current = new Date(start)
  while (current <= end) {
    result.push(formatDate(current))
    current.setDate(current.getDate() + 1)
  }

  return result
}

/**
 * Cuenta los días laborables (no fin de semana, no festivo) en un rango.
 */
export function businessDaysInRange(
  from: string,
  to: string,
  calendar: Calendar | null | undefined,
): number {
  return dateRange(from, to).filter((ds) => !isWeekend(ds) && !isHoliday(ds, calendar)).length
}

/**
 * Cuenta los días laborables transcurridos desde el inicio del año hasta hoy.
 */
export function workDaysToDate(calendar: Calendar | null | undefined, today: Date = new Date()): number {
  const year = today.getFullYear()
  const start = `${year}-01-01`
  const end = formatDate(today)
  return businessDaysInRange(start, end, calendar)
}

// ============================================================
// PURE FUNCTIONS — HORAS TEÓRICAS / ESPERADAS
// ============================================================

/**
 * Devuelve el total de horas teóricas anuales según el convenio.
 * Si calendar tiene convenio_hours, lo usa. Si no, calcula 1800h.
 */
export function getTargetHours(calendar: Calendar | null | undefined): number {
  return calendar?.convenio_hours || 1800
}

/**
 * Suma las horas teóricas en un rango de fechas.
 */
export function theoreticalHoursInRange(
  from: string,
  to: string,
  calendar: Calendar | null | undefined,
): number {
  return dateRange(from, to).reduce((sum, ds) => sum + dailyTheoreticalHours(ds, calendar), 0)
}

/**
 * Calcula las horas que el empleado debería haber trabajado YTD.
 * Útil para comparar con horas fichadas reales.
 */
export function expectedHoursToDate(
  calendar: Calendar | null | undefined,
  today: Date = new Date(),
): number {
  const year = today.getFullYear()
  const start = `${year}-01-01`
  const end = formatDate(today)
  return theoreticalHoursInRange(start, end, calendar)
}

/**
 * Calcula las horas teóricas mensuales.
 * Útil para distribuir el target anual por meses.
 */
export function monthlyTheoreticalHours(
  calendar: Calendar | null | undefined,
  year: number,
  month: number, // 0-11
): number {
  const lastDay = new Date(year, month + 1, 0).getDate()
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return theoreticalHoursInRange(start, end, calendar)
}

// ============================================================
// PURE FUNCTIONS — VACACIONES Y DEDUCCIONES
// ============================================================

/**
 * Devuelve el número total de días de vacaciones disponibles para un empleado.
 * Suma anual + carryover del año anterior.
 */
export function totalVacationDays(annualDays: number, prevYearPending: number, carryover: number = 0): number {
  return (annualDays || DEFAULT_VACATION_DAYS) + (prevYearPending || 0) + (carryover || 0)
}

/**
 * Calcula las horas teóricas efectivas restando vacaciones y ausencias.
 *
 * @param targetHours - Horas teóricas según convenio (ej: 1800)
 * @param vacationDays - Días de vacaciones aprobados
 * @param absenceDays - Días de ausencia aprobados
 * @param calendar - Calendario del empleado
 */
export function effectiveTheoreticalHours(
  targetHours: number,
  vacationDays: number,
  absenceDays: number,
  calendar: Calendar | null | undefined,
): number {
  const dailyHours = calendar?.daily_hours_lj || DEFAULT_DAILY_HOURS
  return Math.max(0, targetHours - (vacationDays + absenceDays) * dailyHours)
}

// ============================================================
// PURE FUNCTIONS — FORMATO ESPAÑOL
// ============================================================

/**
 * Formatea fecha YYYY-MM-DD a dd/mm/yyyy.
 */
export function formatSpanishDate(ds: string): string {
  if (!ds) return ''
  const [y, m, d] = ds.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Formatea fecha YYYY-MM-DD a dd/mm (corto).
 */
export function formatSpanishDateShort(ds: string): string {
  if (!ds) return ''
  const [, m, d] = ds.split('-')
  return `${d}/${m}`
}
