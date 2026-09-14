import type { APIRequestContext } from '@playwright/test'

const SAMPLE_NAME = 'ระบบจองห้องประชุม (ตัวอย่าง)'

/**
 * Creates (once) the documented sample project through the API and returns its id.
 * Used by screenshot capture and visual regression so screens show real data.
 */
export async function seedSampleProject(request: APIRequestContext, name: string = SAMPLE_NAME): Promise<string> {
  const list = (await (await request.get('/api/projects')).json()) as Array<{ id: string; name: string; taskCount: number }>
  const existing = list.find((p) => p.name === name)
  if (existing) {
    // another worker may still be seeding it – wait until the sample is complete (7 tasks + group)
    for (let i = 0; i < 60; i++) {
      const p = await (await request.get(`/api/projects/${existing.id}`)).json()
      if (p.tasks?.length >= 8 && p.dependencies?.length >= 7) return existing.id
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
  return pid
}
