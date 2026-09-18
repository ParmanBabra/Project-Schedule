import { describe, expect, it } from 'vitest'
import { sampleProject } from '@/test/fixtures'
import { countWorkingDays, milestoneTarget, moveTarget, nextWorkingDay, resizeTarget, snapDays } from './drag'

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

  it('a milestone sits at the END of its shown day: moving it sends the next working day as SNET', () => {
    const ms = { ...sampleProject().schedule.tasks.t6, isMilestone: true, duration: 0, start: '2026-10-06', end: '2026-10-06' }
    // +2 days -> shown Thu 8 Oct, so "start no earlier than" must be Fri 9 Oct (its boundary = end of the 8th)
    expect(milestoneTarget(ms, 2, cal)).toEqual({ start: '2026-10-09', shown: '2026-10-08' })
    // dropped on a Saturday -> shows on Friday 9th, SNET the following Monday
    expect(milestoneTarget(ms, 4, cal)).toEqual({ start: '2026-10-12', shown: '2026-10-09' })
    // holiday Tue 13 Oct: dropped there -> shows Mon 12, SNET Wed 14
    expect(milestoneTarget(ms, 7, cal)).toEqual({ start: '2026-10-14', shown: '2026-10-12' })
    expect(milestoneTarget(ms, 0, cal)).toEqual({ start: '2026-10-07', shown: '2026-10-06' })
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
