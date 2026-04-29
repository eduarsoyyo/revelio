/**
 * Tests para domain/calendar.ts
 *
 * Cumple con CMP-Revelio-v2-Guia-Desarrollo:
 * - Cobertura mínima domain: 90%
 * - AAA pattern: Arrange, Act, Assert
 * - Cada test hace UNA cosa
 * - Nombres descriptivos
 */

import { describe, it, expect } from 'vitest'
import {
  parseDate,
  formatDate,
  isWeekend,
  dayOfWeek,
  getHolidaySet,
  isHoliday,
  holidayCountYear,
  holidayCountInRange,
  isIntensiveDay,
  dailyTheoreticalHours,
  dateRange,
  businessDaysInRange,
  workDaysToDate,
  getTargetHours,
  theoreticalHoursInRange,
  expectedHoursToDate,
  monthlyTheoreticalHours,
  totalVacationDays,
  effectiveTheoreticalHours,
  formatSpanishDate,
  formatSpanishDateShort,
  type Calendar,
} from './calendar'

// ============================================================
// FIXTURES
// ============================================================

const calendarBase: Calendar = {
  id: 'cal-1',
  name: 'Calendario Test 2026',
  year: 2026,
  region: 'Madrid',
  convenio_hours: 1800,
  daily_hours_lj: 8,
  daily_hours_v: 7,
  daily_hours_intensive: 7,
  intensive_start: '07-01',
  intensive_end: '08-31',
  holidays: [
    { date: '2026-01-01', name: 'Año Nuevo' },
    { date: '2026-01-06', name: 'Reyes' },
    { date: '2026-04-03', name: 'Viernes Santo' },
    { date: '2026-05-01', name: 'Día del Trabajador' },
    { date: '2026-08-15', name: 'Asunción' },
    { date: '2026-12-25', name: 'Navidad' },
  ],
}

// ============================================================
// DATE HELPERS
// ============================================================

describe('parseDate', () => {
  it('debería parsear una fecha YYYY-MM-DD a Date local', () => {
    const result = parseDate('2026-04-29')
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(3) // Abril = 3
    expect(result.getDate()).toBe(29)
  })
})

describe('formatDate', () => {
  it('debería formatear Date a YYYY-MM-DD con padding', () => {
    const date = new Date(2026, 0, 5) // 5 enero 2026
    expect(formatDate(date)).toBe('2026-01-05')
  })

  it('debería formatear correctamente meses de doble dígito', () => {
    const date = new Date(2026, 11, 25) // 25 diciembre 2026
    expect(formatDate(date)).toBe('2026-12-25')
  })
})

describe('isWeekend', () => {
  it('debería devolver true para sábado', () => {
    expect(isWeekend('2026-05-02')).toBe(true) // Sábado
  })

  it('debería devolver true para domingo', () => {
    expect(isWeekend('2026-05-03')).toBe(true) // Domingo
  })

  it('debería devolver false para lunes', () => {
    expect(isWeekend('2026-05-04')).toBe(false) // Lunes
  })

  it('debería devolver false para viernes', () => {
    expect(isWeekend('2026-05-01')).toBe(false) // Viernes
  })
})

describe('dayOfWeek', () => {
  it('debería devolver 1 para lunes', () => {
    expect(dayOfWeek('2026-05-04')).toBe(1)
  })

  it('debería devolver 5 para viernes', () => {
    expect(dayOfWeek('2026-05-01')).toBe(5)
  })

  it('debería devolver 0 para domingo', () => {
    expect(dayOfWeek('2026-05-03')).toBe(0)
  })
})

// ============================================================
// HOLIDAYS
// ============================================================

describe('getHolidaySet', () => {
  it('debería convertir array de holidays a Set', () => {
    const set = getHolidaySet(calendarBase.holidays)
    expect(set.size).toBe(6)
    expect(set.has('2026-01-01')).toBe(true)
    expect(set.has('2026-12-25')).toBe(true)
  })

  it('debería devolver Set vacío para array vacío', () => {
    const set = getHolidaySet([])
    expect(set.size).toBe(0)
  })
})

describe('isHoliday', () => {
  it('debería detectar Año Nuevo como festivo', () => {
    expect(isHoliday('2026-01-01', calendarBase)).toBe(true)
  })

  it('debería detectar Navidad como festivo', () => {
    expect(isHoliday('2026-12-25', calendarBase)).toBe(true)
  })

  it('debería devolver false para día normal', () => {
    expect(isHoliday('2026-05-15', calendarBase)).toBe(false)
  })

  it('debería devolver false si calendar es null', () => {
    expect(isHoliday('2026-01-01', null)).toBe(false)
  })

  it('debería devolver false si calendar es undefined', () => {
    expect(isHoliday('2026-01-01', undefined)).toBe(false)
  })
})

describe('holidayCountYear', () => {
  it('debería contar 6 festivos en 2026', () => {
    expect(holidayCountYear(calendarBase, 2026)).toBe(6)
  })

  it('debería devolver 0 para año sin festivos', () => {
    expect(holidayCountYear(calendarBase, 2025)).toBe(0)
  })

  it('debería devolver 0 si calendar es null', () => {
    expect(holidayCountYear(null, 2026)).toBe(0)
  })
})

describe('holidayCountInRange', () => {
  it('debería contar festivos en un rango específico', () => {
    expect(holidayCountInRange(calendarBase, '2026-01-01', '2026-01-31')).toBe(2) // Año Nuevo + Reyes
  })

  it('debería devolver 0 si no hay festivos en el rango', () => {
    expect(holidayCountInRange(calendarBase, '2026-02-01', '2026-02-28')).toBe(0)
  })

  it('debería incluir el día inicial y final del rango', () => {
    expect(holidayCountInRange(calendarBase, '2026-01-01', '2026-01-01')).toBe(1)
  })
})

// ============================================================
// JORNADA INTENSIVA
// ============================================================

describe('isIntensiveDay', () => {
  it('debería detectar día en jornada intensiva (julio)', () => {
    expect(isIntensiveDay('2026-07-15', calendarBase)).toBe(true)
  })

  it('debería detectar último día de jornada intensiva', () => {
    expect(isIntensiveDay('2026-08-31', calendarBase)).toBe(true)
  })

  it('debería devolver false antes del inicio', () => {
    expect(isIntensiveDay('2026-06-30', calendarBase)).toBe(false)
  })

  it('debería devolver false después del fin', () => {
    expect(isIntensiveDay('2026-09-01', calendarBase)).toBe(false)
  })

  it('debería devolver false si calendar es null', () => {
    expect(isIntensiveDay('2026-07-15', null)).toBe(false)
  })
})

// ============================================================
// HORAS TEÓRICAS DIARIAS
// ============================================================

describe('dailyTheoreticalHours', () => {
  it('debería devolver 0 para fin de semana', () => {
    expect(dailyTheoreticalHours('2026-05-02', calendarBase)).toBe(0) // Sábado
    expect(dailyTheoreticalHours('2026-05-03', calendarBase)).toBe(0) // Domingo
  })

  it('debería devolver 0 para festivo', () => {
    expect(dailyTheoreticalHours('2026-01-01', calendarBase)).toBe(0)
  })

  it('debería devolver daily_hours_lj para lunes-jueves', () => {
    expect(dailyTheoreticalHours('2026-05-04', calendarBase)).toBe(8) // Lunes
    expect(dailyTheoreticalHours('2026-05-07', calendarBase)).toBe(8) // Jueves
  })

  it('debería devolver daily_hours_v para viernes', () => {
    expect(dailyTheoreticalHours('2026-05-08', calendarBase)).toBe(7) // Viernes
  })

  it('debería devolver daily_hours_intensive durante jornada intensiva', () => {
    expect(dailyTheoreticalHours('2026-07-15', calendarBase)).toBe(7) // Miércoles intensivo
  })

  it('debería devolver 8h por defecto si calendar es null en día laborable', () => {
    expect(dailyTheoreticalHours('2026-05-04', null)).toBe(8) // Lunes sin calendario
  })

  it('debería devolver 0 en fin de semana incluso sin calendario', () => {
    expect(dailyTheoreticalHours('2026-05-02', null)).toBe(0) // Sábado
  })
})

// ============================================================
// DÍAS LABORABLES
// ============================================================

describe('dateRange', () => {
  it('debería generar todos los días entre from y to', () => {
    const range = dateRange('2026-05-01', '2026-05-05')
    expect(range).toEqual(['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05'])
  })

  it('debería devolver un solo día si from === to', () => {
    const range = dateRange('2026-05-01', '2026-05-01')
    expect(range).toEqual(['2026-05-01'])
  })

  it('debería manejar cambio de mes', () => {
    const range = dateRange('2026-04-30', '2026-05-02')
    expect(range).toEqual(['2026-04-30', '2026-05-01', '2026-05-02'])
  })
})

describe('businessDaysInRange', () => {
  it('debería contar 5 días laborables en una semana sin festivos', () => {
    // Semana del 4 al 10 mayo 2026 (lunes-domingo)
    expect(businessDaysInRange('2026-05-04', '2026-05-10', calendarBase)).toBe(5)
  })

  it('debería excluir festivos', () => {
    // Enero 1-9: Año Nuevo (jueves) + Reyes (martes) son festivos
    // Lab: 2(vie),5(lun),7(mié),8(jue),9(vie) = 5 días
    expect(businessDaysInRange('2026-01-01', '2026-01-09', calendarBase)).toBe(5)
  })

  it('debería devolver 0 si solo hay fin de semana', () => {
    expect(businessDaysInRange('2026-05-02', '2026-05-03', calendarBase)).toBe(0)
  })

  it('debería funcionar sin calendario (sin festivos)', () => {
    expect(businessDaysInRange('2026-05-04', '2026-05-08', null)).toBe(5)
  })
})

describe('workDaysToDate', () => {
  it('debería contar días laborables YTD', () => {
    const today = new Date(2026, 0, 9) // 9 enero 2026 (viernes)
    const result = workDaysToDate(calendarBase, today)
    // Enero 1-9: lab=2,5,7,8,9 (festivos: 1,6) = 5
    expect(result).toBe(5)
  })
})

// ============================================================
// HORAS TEÓRICAS / ESPERADAS
// ============================================================

describe('getTargetHours', () => {
  it('debería devolver convenio_hours del calendario', () => {
    expect(getTargetHours(calendarBase)).toBe(1800)
  })

  it('debería devolver 1800 si calendar es null', () => {
    expect(getTargetHours(null)).toBe(1800)
  })

  it('debería devolver 1800 si convenio_hours es 0', () => {
    expect(getTargetHours({ ...calendarBase, convenio_hours: 0 })).toBe(1800)
  })
})

describe('theoreticalHoursInRange', () => {
  it('debería sumar horas teóricas de una semana laborable', () => {
    // Lunes-Viernes: 8+8+8+8+7 = 39h
    expect(theoreticalHoursInRange('2026-05-04', '2026-05-08', calendarBase)).toBe(39)
  })

  it('debería excluir festivos', () => {
    // Enero 1 (jueves, festivo) - Enero 2 (viernes): 0 + 7 = 7
    expect(theoreticalHoursInRange('2026-01-01', '2026-01-02', calendarBase)).toBe(7)
  })

  it('debería usar horas intensivas en julio-agosto', () => {
    // Julio 6-10 (lunes-viernes intensivo): 7+7+7+7+7 = 35
    expect(theoreticalHoursInRange('2026-07-06', '2026-07-10', calendarBase)).toBe(35)
  })
})

describe('expectedHoursToDate', () => {
  it('debería calcular horas esperadas YTD', () => {
    const today = new Date(2026, 0, 9) // 9 enero 2026 (viernes)
    const result = expectedHoursToDate(calendarBase, today)
    // Lab: 2(vie=7),5(lun=8),7(mié=8),8(jue=8),9(vie=7) = 38h
    expect(result).toBe(38)
  })
})

describe('monthlyTheoreticalHours', () => {
  it('debería calcular horas teóricas del mes de mayo 2026', () => {
    // Mayo 2026: 1=festivo, 31 días
    // L-J: 4,5,6,7,11,12,13,14,18,19,20,21,25,26,27,28 = 16 días × 8 = 128
    // V: 8,15,22,29 = 4 días × 7 = 28
    // Total: 156h
    expect(monthlyTheoreticalHours(calendarBase, 2026, 4)).toBe(156)
  })

  it('debería excluir festivos del mes', () => {
    // Enero 2026: festivos 1 y 6
    const result = monthlyTheoreticalHours(calendarBase, 2026, 0)
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(176) // sin festivos serían 22 días * 8h max
  })
})

// ============================================================
// VACACIONES Y DEDUCCIONES
// ============================================================

describe('totalVacationDays', () => {
  it('debería sumar días anuales + pendientes + carryover', () => {
    expect(totalVacationDays(22, 3, 2)).toBe(27)
  })

  it('debería usar 22 si annualDays es 0', () => {
    expect(totalVacationDays(0, 0, 0)).toBe(22)
  })

  it('debería manejar valores undefined como 0', () => {
    expect(totalVacationDays(22, 0)).toBe(22)
  })
})

describe('effectiveTheoreticalHours', () => {
  it('debería restar vacaciones y ausencias del target', () => {
    // 1800 - (22 vac + 5 aus) * 8 = 1800 - 216 = 1584
    expect(effectiveTheoreticalHours(1800, 22, 5, calendarBase)).toBe(1584)
  })

  it('debería usar 8h por defecto sin calendario', () => {
    expect(effectiveTheoreticalHours(1800, 22, 0, null)).toBe(1624)
  })

  it('no debería devolver valores negativos', () => {
    expect(effectiveTheoreticalHours(100, 50, 0, calendarBase)).toBe(0)
  })
})

// ============================================================
// FORMATO ESPAÑOL
// ============================================================

describe('formatSpanishDate', () => {
  it('debería convertir YYYY-MM-DD a dd/mm/yyyy', () => {
    expect(formatSpanishDate('2026-04-29')).toBe('29/04/2026')
  })

  it('debería devolver vacío si ds es vacío', () => {
    expect(formatSpanishDate('')).toBe('')
  })
})

describe('formatSpanishDateShort', () => {
  it('debería convertir YYYY-MM-DD a dd/mm', () => {
    expect(formatSpanishDateShort('2026-04-29')).toBe('29/04')
  })

  it('debería devolver vacío si ds es vacío', () => {
    expect(formatSpanishDateShort('')).toBe('')
  })
})
