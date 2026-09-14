import { test, expect } from '@playwright/test'
import { seedSampleProject } from '../shots/seed'

test.skip(({ isMobile }) => isMobile, 'เดสก์ท็อปพอ')

test('ส่งออก JSON/CSV/PNG แล้วนำเข้ากลับเป็นโปรเจกต์ใหม่ (IO-1..IO-4)', async ({ page, request }) => {
  const name = `E2E ส่งออก ${Date.now()}`
  const pid = await seedSampleProject(request, name)
  await page.goto(`/p/${pid}/gantt`)
  await expect(page.getByTestId('chip-critical')).toBeVisible()

  // JSON download
  const [jsonDl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'ส่งออก' }).click().then(() => page.getByRole('menuitem', { name: 'ไฟล์โปรเจกต์ (.json)' }).click()),
  ])
  expect(jsonDl.suggestedFilename()).toBe(`${name}.phaengan.json`)
  const jsonPath = await jsonDl.path()
  const doc = JSON.parse(await (await import('node:fs/promises')).readFile(jsonPath!, 'utf-8'))
  expect(doc.format).toBe('phaengan-project')
  expect(doc.project.tasks).toHaveLength(8)
  expect(doc.resources.length).toBeGreaterThanOrEqual(3)

  // CSV download
  const [csvDl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'ส่งออก' }).click().then(() => page.getByRole('menuitem', { name: 'ตารางงาน (.csv)' }).click()),
  ])
  expect(csvDl.suggestedFilename()).toBe(`${name}.csv`)
  const csv = await (await import('node:fs/promises')).readFile((await csvDl.path())!, 'utf-8')
  expect(csv).toContain('WBS,ชื่องาน')
  expect(csv).toContain('รวบรวมความต้องการ')

  // PNG download (rendered in the browser)
  const [pngDl] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.getByRole('button', { name: 'ส่งออก' }).click().then(() => page.getByRole('menuitem', { name: 'ภาพ Gantt (.png)' }).click()),
  ])
  expect(pngDl.suggestedFilename()).toBe(`${name}.png`)
  await expect(page.getByText('บันทึกภาพ Gantt แล้ว')).toBeVisible()

  // import it back from the projects page with a new name
  doc.name = `${name} (นำเข้า)`
  await page.goto('/')
  await page.getByTestId('import-file').setInputFiles({ name: 'x.phaengan.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) })
  await expect(page).toHaveURL(/\/p\/prj_[0-9a-f]+\/gantt$/)
  await expect(page.getByRole('button', { name: 'สลับโปรเจกต์' })).toContainText(`${name} (นำเข้า)`)
  await expect(page.getByText(/จับคู่ทรัพยากรเดิม \d+ คน/)).toBeVisible()
  await expect(page.getByTestId('chip-critical')).toContainText('Critical 5 งาน')
  await expect(page.getByTestId('chip-overallocation')).toContainText(/เกินกำลัง \d+ คน/) // assignments remapped onto the same people
})

test('โปรเจกต์ใหญ่ 60 งาน: Gantt แสดงครบ เลื่อนได้ และ CSV ครบทุกแถว', async ({ page, request }) => {
  const name = `E2E ใหญ่ ${Date.now()}`
  const project = await (await request.post('/api/projects', { data: { name, startDate: '2026-09-14' } })).json()
  const pid = project.id as string
  // 6 phases × 10 tasks, chained inside a phase, phases linked FS; every 4th task is a milestone-ish short task
  const tasks: Array<{ id: string; name: string; duration: number; progress: number; parentId: string | null; order: number; isMilestone: boolean; collapsed: boolean; color: null; constraint: null; estimate: null }> = []
  const deps: Array<{ id: string; from: string; to: string; type: 'FS' | 'SS'; lag: number }> = []
  let order = 0
  for (let ph = 0; ph < 6; ph++) {
    const gid = `g${ph}`
    tasks.push({ id: gid, name: `เฟส ${ph + 1}`, duration: 1, progress: 0, parentId: null, order: order++, isMilestone: false, collapsed: false, color: null, constraint: null, estimate: null })
    for (let i = 0; i < 10; i++) {
      const tid = `t${ph}_${i}`
      tasks.push({ id: tid, name: `งาน ${ph + 1}.${i + 1}`, duration: 1 + ((ph + i) % 4), progress: ph === 0 ? 100 : ph === 1 ? (i * 10) % 100 : 0, parentId: gid, order: order++, isMilestone: false, collapsed: false, color: null, constraint: null, estimate: null })
      if (i > 0) deps.push({ id: `d${ph}_${i}`, from: `t${ph}_${i - 1}`, to: tid, type: i % 3 === 0 ? 'SS' : 'FS', lag: i % 3 === 0 ? 1 : 0 })
    }
    if (ph > 0) deps.push({ id: `dp${ph}`, from: `t${ph - 1}_9`, to: `t${ph}_0`, type: 'FS', lag: 0 })
  }
  const state = { name, startDate: '2026-09-14', holidays: [], workingDays: [1, 2, 3, 4, 5], tasks, dependencies: deps, assignments: [], buffer: project.buffer, rules: project.rules }
  const put = await request.put(`/api/projects/${pid}`, { data: state })
  expect(put.ok()).toBeTruthy()
  const saved = await put.json()
  expect(saved.schedule.summary.taskCount).toBe(60)

  const t0 = Date.now()
  await page.goto(`/p/${pid}/gantt`)
  await expect(page.getByTestId('chip-critical')).toBeVisible()
  await expect(page.locator('[data-testid^="bar-"]')).toHaveCount(66) // 60 leaves + 6 groups
  expect(Date.now() - t0).toBeLessThan(8_000)

  // collapse a phase from the list -> fewer rows
  await page.getByRole('button', { name: 'ยุบกลุ่ม' }).first().click()
  await expect(page.locator('[data-testid^="bar-"]')).toHaveCount(56)

  const csv = await (await request.get(`/api/projects/${pid}/export.csv`)).text()
  expect(csv.trim().split(/\r?\n/).length).toBe(1 + 66 + 2) // header + rows + blank + buffer line
})
