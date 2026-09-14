import { describe, expect, it } from 'vitest'
import { sampleProject } from '@/test/fixtures'
import { countWorkingDays, moveTarget, nextWorkingDay, resizeTarget, snapDays } from './drag'

const cal = { workingDays: [1, 2, 3, 4, 5], holidays: ['2026-10-13'] }

describe('drag helpers', () => {
  it('snaps pixel deltas to whole days', () => {
    expect(snapDays(17, 36)).toBe(0)
    expect(snapDays(19, 36)).toBe(1)
    expect(snapDays(-55, 36)).toBe(-2)
  })

  it('skips weekends and holidays', () => {
    expect(nextWorkingDay('2026-09-19', cal)).toBe('2026-09-21')
    expect(nextWorkingDay('2026-10-13', cal)).toBe('2026-10-14')
    expect(countWorkingDays('2026-09-14', '2026-09-25', cal)).toBe(10)
    expect(countWorkingDays('2026-10-12', '2026-10-16', cal)).toBe(4)
  })

  it('computes move and resize targets from the current schedule', () => {
    const t2 = sampleProject().schedule.tasks.t2 // 17–23 Sep
    expect(moveTarget(t2, 2, cal)).toBe('2026-09-21') // Sat 19 -> Mon 21
    expect(moveTarget(t2, -3, cal)).toBe('2026-09-14')
    expect(resizeTarget(t2, 2, cal)).toBe(7) // end Fri 25 -> 7 working days
    expect(resizeTarget(t2, -10, cal)).toBe(1) // never below 1
    expect(resizeTarget(t2, 3, cal)).toBe(7) // Sat 26 snaps back to Fri 25
  })
})
