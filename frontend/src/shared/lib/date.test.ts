import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  diffDays,
  formatThai,
  formatThaiMonth,
  formatThaiRange,
  isoWeekday,
  startOfWeekISO,
} from './date'

describe('date helpers', () => {
  it('formats Thai dates with Buddhist year', () => {
    expect(formatThai('2026-10-06')).toBe('6 ต.ค.')
    expect(formatThai('2026-10-06', { year: true })).toBe('6 ต.ค. 2569')
    expect(formatThai(null)).toBe('—')
    expect(formatThaiMonth('2026-09-14')).toBe('กันยายน 2569')
  })

  it('formats ranges with the year once', () => {
    expect(formatThaiRange('2026-09-14', '2026-10-06')).toBe('14 ก.ย. – 6 ต.ค. 2569')
    expect(formatThaiRange('2026-12-20', '2027-01-05')).toBe('20 ธ.ค. 2569 – 5 ม.ค. 2570')
  })

  it('does calendar arithmetic in UTC', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(diffDays('2026-09-14', '2026-10-06')).toBe(22)
    expect(isoWeekday('2026-09-14')).toBe(1)
    expect(isoWeekday('2026-09-20')).toBe(7)
    expect(startOfWeekISO('2026-09-17')).toBe('2026-09-14')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-01')
  })
})
