import type { APIRequestContext } from '@playwright/test'
import { mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SAMPLE_NAME = 'ระบบจองห้องประชุม (ตัวอย่าง)'
const LOCK_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '../.auth/locks')

/**
 * Cross-process mutex: Playwright runs desktop and mobile in separate workers, and both
 * may try to seed the same shared project at once. `mkdirSync` is atomic on every OS.
 */
async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  mkdirSync(LOCK_DIR, { recursive: true })
  const dir = resolve(LOCK_DIR, encodeURIComponent(key))
  const started = Date.now()
  for (;;) {
    try {
      mkdirSync(dir)
      break
    } catch {
      if (Date.now() - started > 15_000) { // seeding takes ~2 s; anything longer is a leftover
        rmSync(dir, { recursive: true, force: true }) // stale lock from a crashed run
        continue
      }
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  try {
    return await fn()
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * Creates (once) the documented sample project through the API and returns its id.
 * Used by screenshot capture and visual regression so screens show real data.
 */
export function seedSampleProject(request: APIRequestContext, name: string = SAMPLE_NAME, opts: { assignments?: boolean } = {}): Promise<string> {
  return withLock(`project:${name}`, () => seedSampleProjectUnlocked(request, name, opts))
}

async function seedSampleProjectUnlocked(request: APIRequestContext, name: string, opts: { assignments?: boolean }): Promise<string> {
  const withAssignments = opts.assignments ?? true
  const resourceSuffix = name === SAMPLE_NAME ? '' : ` (${name.replace(/^E2E /, '')})`
  const list = (await (await request.get('/api/projects')).json()) as Array<{ id: string; name: string; taskCount: number }>
  const existing = list.find((p) => p.name === name)
  if (existing) {
    // another worker may still be seeding it – wait until the sample is complete (7 tasks + group)
    for (let i = 0; i < 60; i++) {
      const p = await (await request.get(`/api/projects/${existing.id}`)).json()
      if (p.tasks?.length >= 8 && p.dependencies?.length >= 7 && (!withAssignments || p.assignments?.length >= 7)) return existing.id
      await new Promise((r) => setTimeout(r, 250))
    }
    return existing.id
  }

  const project = await (await request.post('/api/projects', { data: { name, startDate: '2026-09-14' } })).json()
  const pid = project.id as string
  const ids: Record<string, string> = {}
  const tasks: Array<[string, number, number, string | null]> = [
    ['รวบรวมความต้องการ', 3, 100, null],
    ['ออกแบบระบบ', 5, 40, null],
    ['ออกแบบ UI', 4, 25, null],
    ['พัฒนา Backend', 6, 0, null],
    ['พัฒนา Frontend', 5, 0, null],
    ['ทดสอบระบบ', 3, 0, null],
  ]
  for (const [name, duration, progress] of tasks) {
    const res = await (await request.post(`/api/projects/${pid}/tasks`, { data: { name, duration, progress } })).json()
    ids[name] = res.tasks.find((t: { name: string }) => t.name === name).id
  }
  const ms = await (await request.post(`/api/projects/${pid}/tasks`, { data: { name: 'ส่งมอบ', duration: 0, isMilestone: true } })).json()
  ids['ส่งมอบ'] = ms.tasks.find((t: { name: string }) => t.name === 'ส่งมอบ').id
  const links: Array<[string, string]> = [
    ['รวบรวมความต้องการ', 'ออกแบบระบบ'],
    ['รวบรวมความต้องการ', 'ออกแบบ UI'],
    ['ออกแบบระบบ', 'พัฒนา Backend'],
    ['ออกแบบ UI', 'พัฒนา Frontend'],
    ['พัฒนา Backend', 'ทดสอบระบบ'],
    ['พัฒนา Frontend', 'ทดสอบระบบ'],
    ['ทดสอบระบบ', 'ส่งมอบ'],
  ]
  for (const [a, b] of links) await request.post(`/api/projects/${pid}/dependencies`, { data: { from: ids[a], to: ids[b] } })
  // group design tasks so the WBS rollup shows
  await request.post(`/api/projects/${pid}/tasks/group`, { data: { name: 'ออกแบบ', taskIds: [ids['ออกแบบระบบ'], ids['ออกแบบ UI']] } })
  if (!withAssignments) return pid // no resources at all: keeps the resources page / workload baselines untouched
  // resources: สุดา is deliberately over-allocated (UI + Frontend overlap on 21–22 Sep)
  const res = await seedResources(request, resourceSuffix)
  const assign = (task: string, resource: string, units = 100) =>
    request.post(`/api/projects/${pid}/assignments`, { data: { taskId: ids[task], resourceId: res[resource], units } })
  await assign('รวบรวมความต้องการ', 'สมชาย')
  await assign('ออกแบบระบบ', 'สุดา') // double-booked with ออกแบบ UI on 17–22 Sep
  await assign('ออกแบบ UI', 'สุดา')
  await assign('พัฒนา Frontend', 'สุดา')
  await assign('พัฒนา Backend', 'วิชัย')
  await assign('ทดสอบระบบ', 'สมชาย', 50)
  await assign('ทดสอบระบบ', 'Server A', 30)
  return pid
}

const RESOURCES: Array<{ name: string; type: 'person' | 'equipment'; color: string }> = [
  { name: 'สมชาย', type: 'person', color: '#6a4fd8' },
  { name: 'สุดา', type: 'person', color: '#e0457b' },
  { name: 'วิชัย', type: 'person', color: '#1f9e89' },
  { name: 'Server A', type: 'equipment', color: '#8a83a8' },
]

/** Creates the shared sample resources once; returns name -> id. */
export function seedResources(request: APIRequestContext, suffix = ''): Promise<Record<string, string>> {
  return withLock(`resources:${suffix}`, () => seedResourcesUnlocked(request, suffix))
}

async function seedResourcesUnlocked(request: APIRequestContext, suffix: string): Promise<Record<string, string>> {
  const existing = (await (await request.get('/api/resources')).json()) as Array<{ id: string; name: string }>
  const out: Record<string, string> = {}
  for (const r of RESOURCES) {
    const name = r.name + suffix
    const found = existing.find((e) => e.name === name)
    if (found) out[r.name] = found.id
    else {
      const created = await (await request.post('/api/resources', { data: { ...r, name } })).json()
      out[r.name] = created.id
    }
  }
  return out
}

/** A project with three Epics (matches the design mockups); reused across runs. */
export function seedEpics(request: APIRequestContext, name = 'ระบบ WMS (Epics)'): Promise<string> {
  return withLock(`project:${name}`, () => seedEpicsUnlocked(request, name))
}

async function seedEpicsUnlocked(request: APIRequestContext, name: string): Promise<string> {
  const list = (await (await request.get('/api/projects')).json()) as Array<{ id: string; name: string }>
  const existing = list.find((p) => p.name === name)
  if (existing) return existing.id
  const project = await (await request.post('/api/projects', { data: { name, startDate: '2026-09-14' } })).json()
  const pid = project.id as string
  await request.post(`/api/projects/${pid}/epics/bulk`, {
    data: {
      linkEpics: true,
      epics: [
        { name: 'Visualization', color: '#6a4fd8', description: 'แผนที่สต๊อก รายงานตำแหน่ง และ dashboard งาน', tasks: [{ name: 'Stock visualization and Editor (Map)', duration: 4 }, { name: 'Report Stock Location', duration: 3 }, { name: 'Dashboard (confirm job / Delay)', duration: 2 }] },
        { name: 'Picking list', color: '#e0457b', description: 'พนักงานหยิบสินค้าตาม picking list บนมือถือ ยืนยันแล้วส่งผลกลับ LMS', tasks: [{ name: 'Picking list', duration: 3 }, { name: 'Plant Route (Mobile)', duration: 5 }, { name: 'Confirm', duration: 2 }, { name: 'Import LMS', duration: 3 }, { name: 'Import Due list', duration: 2 }] },
        { name: 'Master for Standalone (Juno)', color: '#f28c28', description: 'Integration module และ master data', tasks: [{ name: 'Integration Module ERP/Other legacy', duration: 5 }, { name: 'Master Data (Cost center, Storage)', duration: 4, checklist: ['Create', 'Edit', 'Upload Manual (Validate)', 'Display', 'Export Excel'] }] },
      ],
    },
  })
  // some progress so the cards differ
  const p = await (await request.get(`/api/projects/${pid}`)).json()
  const byName = Object.fromEntries(p.tasks.map((t: { name: string; id: string }) => [t.name, t.id]))
  await request.patch(`/api/projects/${pid}/tasks/${byName['Stock visualization and Editor (Map)']}`, { data: { progress: 100 } })
  await request.patch(`/api/projects/${pid}/tasks/${byName['Report Stock Location']}`, { data: { progress: 60 } })
  return pid
}

/** The sample project split into two delivery points (BUF-8); reused across runs. */
export function seedReleases(request: APIRequestContext, name = 'ระบบจองห้องประชุม (จุดส่งมอบ)'): Promise<string> {
  return withLock(`project:${name}`, () => seedReleasesUnlocked(request, name))
}

async function seedReleasesUnlocked(request: APIRequestContext, name: string): Promise<string> {
  const pid = await seedSampleProjectUnlocked(request, name, { assignments: false })
  const p = await (await request.get(`/api/projects/${pid}`)).json()
  if (p.releases?.length >= 2) return pid
  const byName = Object.fromEntries(p.tasks.map((t: { name: string; id: string }) => [t.name, t.id]))
  const milestone = async (label: string, after: string) => {
    const body = await (await request.post(`/api/projects/${pid}/tasks`, { data: { name: label, duration: 0, isMilestone: true } })).json()
    const id = body.tasks.find((t: { name: string }) => t.name === label).id as string
    await request.post(`/api/projects/${pid}/dependencies`, { data: { from: byName[after], to: id } })
    return id
  }
  const m1 = await milestone('ส่งมอบเฟส 1', 'ออกแบบ UI')
  const m2 = await milestone('ส่งมอบเฟส 2', 'ทดสอบระบบ')
  await request.post(`/api/projects/${pid}/releases`, { data: { name: 'เฟส 1 · ออกแบบ', milestoneTaskId: m1 } })
  await request.post(`/api/projects/${pid}/releases`, { data: { name: 'เฟส 2 · ส่งมอบระบบ', milestoneTaskId: m2 } })
  return pid
}
