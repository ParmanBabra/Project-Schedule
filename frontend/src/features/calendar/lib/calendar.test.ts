import { describe, expect, it } from 'vitest'
import { monthGrid, overflowPerDay, weekDays, weekSegments } from './calendar'

describe('calendar layout', () => {
  it('builds a 6x7 month grid starting on the Monday before the 1st', () => {
    const grid = monthGrid('2026-09-14')
    expect(grid).toHaveLength(6)
    expect(grid[0][0]).toBe('2026-08-31') // Monday
    expect(grid[0][1]).toBe('2026-09-01')
    expect(grid[5][6]).toBe('2026-10-11')
    expect(weekDays('2026-09-14')[6]).toBe('2026-09-20')
  })

  it('cuts items to the week, packs lanes and flags clipping', () => {
    const segs = weekSegments('2026-09-14', [
      { id: 'a', start: '2026-09-10', end: '2026-09-15' }, // clipped start
      { id: 'b', start: '2026-09-14', end: '2026-09-14' },
      { id: 'c', start: '2026-09-16', end: '2026-09-23' }, // clipped end
      { id: 'd', start: '2026-09-28', end: '2026-09-30' }, // outside
    ])
    const byId = Object.fromEntries(segs.map((s) => [s.item.id, s]))
    expect(Object.keys(byId).sort()).toEqual(['a', 'b', 'c'])
    expect(byId.a).toMatchObject({ col: 0, span: 2, lane: 0, clippedStart: true, clippedEnd: false })
    expect(byId.b).toMatchObject({ col: 0, span: 1, lane: 1 })
    expect(byId.c).toMatchObject({ col: 2, span: 5, lane: 0, clippedEnd: true }) // lane 0 free again after col 1
  })

  it('counts overflow beyond the visible lanes per day', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, start: '2026-09-15', end: '2026-09-16' }))
    const segs = weekSegments('2026-09-14', items)
    expect(overflowPerDay(segs)).toEqual([0, 2, 2, 0, 0, 0, 0])
  })
})
