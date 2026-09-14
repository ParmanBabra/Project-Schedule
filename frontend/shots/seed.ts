import type { APIRequestContext } from '@playwright/test'

const SAMPLE_NAME = 'ระบบจองห้องประชุม (ตัวอย่าง)'

/**
 * Creates (once) the documented sample project through the API and returns its id.
 * Used by screenshot capture and visual regression so screens show real data.
 */
export async function seedSampleProject(request: APIRequestContext, name: string = SAMPLE_NAME): Promise<string> {
  const resourceSuffix = name === SAMPLE_NAME ? '' : ` (${name.replace(/^E2E /, '')})`
  const list = (await (await request.get('/api/projects')).json()) as Array<{ id: string; name: string; taskCount: number }>
  const existing = list.find((p) => p.name === name)
  if (existing) {
    // another worker may still be seeding it – wait until the sample is complete (7 tasks + group)
    for (let i = 0; i < 60; i++) {
      const p = await (await request.get(`/api/projects/${existing.id}`)).json()
      if (p.tasks?.length >= 8 && p.dependencies?.length >= 7 && p.assignments?.length >= 7) return existing.id
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
export async function seedResources(request: APIRequestContext, suffix = ''): Promise<Record<string, string>> {
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
