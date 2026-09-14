import { describe, expect, it } from 'vitest'
import type { ProjectOut, TaskSchedule } from '@/features/projects/types'
import { buildOutline, rowIndexMap } from './outline'
import { arrowPath, barGeometry, computeAxis, headerRows, nonWorkingShades, xOfDate } from './timeline'

function sched(partial: Partial<TaskSchedule> & { id: string; start: string; end: string }): TaskSchedule {
  return {
    wbs: '1',
    isSummary: false,
    isMilestone: false,
    duration: 1,
    earlyStart: partial.start,
    earlyFinish: partial.end,
    lateStart: partial.start,
    lateFinish: partial.end,
    es: 0,
    ef: 1,
    ls: 0,
    lf: 1,
    totalFloat: 0,
    freeFloat: 0,
    isCritical: true,
    isNearCritical: false,
    progress: 0,
    depth: 0,
    health: 'not_started',
    expectedProgress: 0,
    ...partial,
  }
}

const project = {
  id: 'p',
  name: 'p',
  startDate: '2026-09-14',
  holidays: ['2026-10-13'],
  workingDays: [1, 2, 3, 4, 5],
  tasks: [
    { id: 'a', name: 'A', duration: 3, progress: 0, isMilestone: false, constraint: null, color: null, parentId: null, collapsed: false, order: 1, estimate: null },
    { id: 's', name: 'S', duration: 0, progress: 0, isMilestone: false, constraint: null, color: null, parentId: null, collapsed: false, order: 2, estimate: null },
    { id: 'b', name: 'B', duration: 5, progress: 0, isMilestone: false, constraint: null, color: null, parentId: 's', collapsed: false, order: 1, estimate: null },
    { id: 'm', name: 'M', duration: 0, progress: 0, isMilestone: true, constraint: null, color: null, parentId: null, collapsed: false, order: 3, estimate: null },
  ],
  dependencies: [],
  assignments: [],
  buffer: {} as ProjectOut['buffer'],
  rules: {} as ProjectOut['rules'],
  baseline: null,
  createdAt: '',
  updatedAt: '',
  schedule: {
    tasks: {
      a: sched({ id: 'a', start: '2026-09-14', end: '2026-09-16', wbs: '1' }),
      s: sched({ id: 's', start: '2026-09-17', end: '2026-09-23', wbs: '2', isSummary: true }),
      b: sched({ id: 'b', start: '2026-09-17', end: '2026-09-23', wbs: '2.1', depth: 1, totalFloat: 2, lateFinish: '2026-09-25', isCritical: false }),
      m: sched({ id: 'm', start: '2026-09-23', end: '2026-09-23', wbs: '3', isMilestone: true }),
    },
    criticalPath: ['a'],
    summary: { taskCount: 3, criticalCount: 1, nearCriticalCount: 0, progress: 0, chainDays: 8, plannedEnd: '2026-09-23', committedEnd: '2026-10-05', lateCount: 0, baselinePlannedEnd: null },
    buffer: { method: 'ccpm', chainDays: 8, days: 4, start: '2026-09-23', end: '2026-09-29', managementReserveDays: 1, managementReserveEnd: '2026-09-30', percentUsed: 50, note: null, consumedPercent: null, status: null, chainProgress: 0, consumedDays: null },
  },
} satisfies ProjectOut

describe('timeline axis', () => {
  it('starts a week before the earliest date, on a Monday, and covers the buffer', () => {
    const axis = computeAxis(project, 'day')
    expect(axis.origin).toBe('2026-09-07')
    expect(axis.end > '2026-09-30').toBe(true)
    expect(axis.pxPerDay).toBe(36)
    expect(xOfDate(axis, '2026-09-14')).toBe(7 * 36)
  })

  it('grows to fill the minimum width', () => {
    const axis = computeAxis(project, 'month', 1200)
    expect(axis.width).toBeGreaterThanOrEqual(1200)
  })

  it('places bars from start to end-of-day and float up to the late finish', () => {
    const axis = computeAxis(project, 'day')
    const a = barGeometry(axis, project.schedule.tasks.a)
    expect(a.x).toBe(7 * 36)
    expect(a.width).toBe(3 * 36)
    const b = barGeometry(axis, project.schedule.tasks.b)
    expect(b.floatX).toBe(b.endX)
    expect(b.floatWidth).toBe(2 * 36)
    const m = barGeometry(axis, project.schedule.tasks.m)
    expect(m.width).toBe(0)
    expect(m.x).toBe(xOfDate(axis, '2026-09-24') - 8)
    expect(m.endX).toBe(xOfDate(axis, '2026-09-24') + 8)
  })

  it('builds week/day headers for day zoom and month/week headers for week zoom', () => {
    const axis = computeAxis(project, 'day')
    const { top, bottom } = headerRows(axis, 'day')
    expect(top[1]).toMatchObject({ x: 7 * 36, width: 7 * 36, label: '14 – 20 ก.ย. 2569' })
    expect(bottom[7]).toMatchObject({ label: '14', muted: false })
    expect(bottom[12].muted).toBe(true) // Saturday
    const week = headerRows(computeAxis(project, 'week'), 'week')
    expect(week.top[0].label).toBe('ก.ย. 2569')
    expect(week.bottom[1].label).toBe('14')
  })

  it('shades weekends and holidays as merged runs', () => {
    const axis = computeAxis(project, 'day')
    const shades = nonWorkingShades(axis, project.workingDays, project.holidays)
    expect(shades[0]).toMatchObject({ x: 5 * 36, width: 2 * 36, kind: 'weekend' })
    expect(shades.some((s) => s.kind === 'holiday' && s.x === xOfDate(axis, '2026-10-13'))).toBe(true)
  })

  it('routes arrows straight when there is room and around when not', () => {
    expect(arrowPath({ x: 100, y: 22 }, { x: 200, y: 66 })).toBe('M100 22 H150 V66 H200')
    expect(arrowPath({ x: 100, y: 22 }, { x: 100, y: 66 })).toBe('M100 22 h8 V44 H92 V66 H100')
  })
})

describe('outline', () => {
  it('lists rows in WBS order with depth and hides collapsed children', () => {
    const rows = buildOutline(project)
    expect(rows.map((r) => r.task.id)).toEqual(['a', 's', 'b', 'm'])
    expect(rows[2].depth).toBe(1)
    expect(rows[1].hasChildren).toBe(true)
    const collapsed = { ...project, tasks: project.tasks.map((t) => (t.id === 's' ? { ...t, collapsed: true } : t)) }
    const rows2 = buildOutline(collapsed)
    expect(rows2.map((r) => r.task.id)).toEqual(['a', 's', 'm'])
    expect(rowIndexMap(collapsed, rows2).get('b')).toBe(1) // hidden child maps to its summary row
  })
})
