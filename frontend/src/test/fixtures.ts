import type { ProjectOut, Task, TaskSchedule } from '@/features/projects/types'

function task(id: string, name: string, duration: number, order: number, extra: Partial<Task> = {}): Task {
  return { id, name, duration, progress: 0, isMilestone: false, constraint: null, color: null, parentId: null, collapsed: false, order, estimate: null, ...extra }
}

function sched(id: string, wbs: string, start: string, end: string, extra: Partial<TaskSchedule> = {}): TaskSchedule {
  return {
    id,
    wbs,
    isSummary: false,
    isMilestone: false,
    duration: 1,
    start,
    end,
    earlyStart: start,
    earlyFinish: end,
    lateStart: start,
    lateFinish: end,
    es: 0,
    ef: 0,
    ls: 0,
    lf: 0,
    totalFloat: 0,
    freeFloat: 0,
    isCritical: true,
    isNearCritical: false,
    progress: 0,
    depth: 0,
    health: 'not_started',
    expectedProgress: 0,
    ...extra,
  }
}

/** The documented sample project (docs/features.md) with the schedule the backend produces for it. */
export function sampleProject(): ProjectOut {
  return {
    id: 'prj_sample',
    name: 'ระบบจองห้องประชุม',
    startDate: '2026-09-14',
    holidays: [],
    workingDays: [1, 2, 3, 4, 5],
    tasks: [
      task('t1', 'รวบรวมความต้องการ', 3, 1, { progress: 100 }),
      task('t2', 'ออกแบบระบบ', 5, 2, { progress: 40 }),
      task('t3', 'ออกแบบ UI', 4, 3, { progress: 25 }),
      task('t4', 'พัฒนา Backend', 6, 4),
      task('t5', 'พัฒนา Frontend', 5, 5),
      task('t6', 'ทดสอบระบบ', 3, 6),
    ],
    dependencies: [
      { id: 'd1', from: 't1', to: 't2', type: 'FS', lag: 0 },
      { id: 'd2', from: 't1', to: 't3', type: 'FS', lag: 0 },
      { id: 'd3', from: 't2', to: 't4', type: 'FS', lag: 0 },
      { id: 'd4', from: 't3', to: 't5', type: 'FS', lag: 0 },
      { id: 'd5', from: 't4', to: 't6', type: 'FS', lag: 0 },
      { id: 'd6', from: 't5', to: 't6', type: 'FS', lag: 0 },
    ],
    assignments: [],
    buffer: { method: 'ccpm', ccpmRatio: 50, riskLevel: 'medium', percent: null, pertConfidence: 84, days: null, managementReservePercent: 5 },
    rules: {
      nearCriticalFloatDays: 0,
      progressRollup: 'duration',
      lateDetection: 'linear',
      overallocationThreshold: 100,
      lagUnit: 'working',
      defaultDependency: { type: 'FS', lag: 0 },
      schedulingMode: 'auto',
      bufferZones: { yellow: 100, red: 120 },
    },
    baseline: null,
    createdAt: '2026-09-14T09:00:00Z',
    updatedAt: '2026-09-14T09:00:00Z',
    schedule: {
      tasks: {
        t1: sched('t1', '1', '2026-09-14', '2026-09-16', { duration: 3, progress: 100 }),
        t2: sched('t2', '2', '2026-09-17', '2026-09-23', { duration: 5, progress: 40 }),
        t3: sched('t3', '3', '2026-09-17', '2026-09-22', { duration: 4, progress: 25, totalFloat: 2, freeFloat: 0, isCritical: false, lateFinish: '2026-09-24', lateStart: '2026-09-21' }),
        t4: sched('t4', '4', '2026-09-24', '2026-10-01', { duration: 6 }),
        t5: sched('t5', '5', '2026-09-23', '2026-09-29', { duration: 5, totalFloat: 2, freeFloat: 2, isCritical: false, lateFinish: '2026-10-01', lateStart: '2026-09-25' }),
        t6: sched('t6', '6', '2026-10-02', '2026-10-06', { duration: 3 }),
      },
      criticalPath: ['t1', 't2', 't4', 't6'],
      summary: { taskCount: 6, criticalCount: 4, nearCriticalCount: 0, progress: 32, chainDays: 17, plannedEnd: '2026-10-06', committedEnd: '2026-10-19', lateCount: 0, baselinePlannedEnd: null },
      buffer: { method: 'ccpm', chainDays: 17, days: 9, start: '2026-10-06', end: '2026-10-19', managementReserveDays: 1, managementReserveEnd: '2026-10-20', percentUsed: 50, note: null, consumedPercent: null, status: null, chainProgress: 32, consumedDays: null },
    },
  }
}

export function mockFetch(handlers: Record<string, (init?: RequestInit, url?: string) => unknown | Response>) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const path = url.replace(/^\/api/, '').split('?')[0]
    const key = `${init?.method ?? 'GET'} ${path}`
    const handler = handlers[key]
    if (!handler) return new Response(JSON.stringify({ error: { code: 'not_found', message: key } }), { status: 404 })
    const out = handler(init, url)
    return out instanceof Response ? out : new Response(JSON.stringify(out), { status: 200 })
  }
}
