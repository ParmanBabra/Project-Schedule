import { test, expect } from '@playwright/test'
import { seedSampleProject } from '../shots/seed'

test('จุดส่งมอบ: เปิดจากแผง milestone → เห็นเผื่อสองก้อน ชิปสองใบ → ปรับวันเอง → ปิด', async ({ page, request }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E releases ${testInfo.project.name} ${Date.now()}`, { assignments: false })
  const p = await (await request.get(`/api/projects/${pid}`)).json()
  const byName = Object.fromEntries(p.tasks.map((t: { name: string; id: string }) => [t.name, t.id]))
  const milestone = async (label: string, after: string) => {
    const body = await (await request.post(`/api/projects/${pid}/tasks`, { data: { name: label, duration: 0, isMilestone: true } })).json()
    const id = body.tasks.find((t: { name: string }) => t.name === label).id as string
    await request.post(`/api/projects/${pid}/dependencies`, { data: { from: byName[after], to: id } })
    return id
  }
  const m1 = await milestone('ส่งมอบเฟส 1', 'ออกแบบ UI')
  const m2 = await milestone('ส่งมอบเฟส 2', 'ทดสอบระบบ')
  // the second release is created through the API; the first through the panel toggle
  await request.post(`/api/projects/${pid}/releases`, { data: { name: 'เฟส 2', milestoneTaskId: m2 } })

  await page.goto(`/p/${pid}/gantt?task=${m1}`)
  const panel = page.getByTestId('task-panel')
  await expect(panel.getByTestId('release-section')).toBeVisible()
  await panel.getByText('จุดส่งมอบ มีเวลาเผื่อของตัวเอง').click()
  await expect(panel.getByLabel('ชื่อจุดส่งมอบ')).toHaveValue('ส่งมอบเฟส 1')
  // phase 1 = รวบรวม (3) + ออกแบบ UI (4) + milestone: chain 7 working days -> 50% = 4 days
  await expect(panel.getByTestId('release-summary')).toContainText('3 งาน')
  await expect(panel.getByText('คำนวณให้ 4 วัน จากสายงาน 7 วัน')).toBeVisible()

  const chips = page.locator('[data-testid^="chip-release-"]')
  await expect(chips).toHaveCount(2)
  await expect(chips.first()).toContainText('ส่งมอบเฟส 1 · ส่ง 28 ก.ย. · เผื่อ 4 วัน')
  await expect(chips.nth(1)).toContainText('เฟส 2 · ส่ง 15 ต.ค. · เผื่อ 7 วัน')
  await expect(page.locator('[data-testid^="release-buffer-"]')).toHaveCount(2)
  await expect(page.locator('[data-testid^="release-deliver-"]')).toHaveCount(2)
  await expect(page.getByTestId('buffer-bar')).toHaveCount(0)

  // override the buffer size, then turn the delivery point off again
  await panel.getByLabel('เวลาเผื่อ', { exact: true }).fill('2')
  await panel.getByLabel('เวลาเผื่อ', { exact: true }).blur()
  await expect(chips.first()).toContainText('เผื่อ 2 วัน')
  await panel.getByText('จุดส่งมอบ มีเวลาเผื่อของตัวเอง').click()
  await expect(chips).toHaveCount(1)
  const after = await (await request.get(`/api/projects/${pid}`)).json()
  expect(after.releases.map((r: { name: string }) => r.name)).toEqual(['เฟส 2'])
})

test('กติกา "รอให้พ้นเวลาเผื่อก่อน" เลื่อนเฉพาะงานที่ต่อจาก milestone จุดส่งมอบ', async ({ page, request }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E gate ${testInfo.project.name} ${Date.now()}`, { assignments: false })
  const p = await (await request.get(`/api/projects/${pid}`)).json()
  const byName = Object.fromEntries(p.tasks.map((t: { name: string; id: string }) => [t.name, t.id]))
  const ms = (await (await request.post(`/api/projects/${pid}/tasks`, { data: { name: 'ส่งมอบเฟส 1', duration: 0, isMilestone: true } })).json()).tasks.find((t: { name: string }) => t.name === 'ส่งมอบเฟส 1').id
  await request.post(`/api/projects/${pid}/dependencies`, { data: { from: byName['ออกแบบ UI'], to: ms } })
  const acc = (await (await request.post(`/api/projects/${pid}/tasks`, { data: { name: 'ลูกค้าตรวจรับเฟส 1', duration: 2 } })).json()).tasks.find((t: { name: string }) => t.name === 'ลูกค้าตรวจรับเฟส 1').id
  await request.post(`/api/projects/${pid}/dependencies`, { data: { from: ms, to: acc } })
  await request.post(`/api/projects/${pid}/releases`, { data: { name: 'เฟส 1', milestoneTaskId: ms } })
  // a second delivery point after testing, so phase 1 only buffers its own chain (UI 3 + 4 = 7 days -> 4)
  const ms2 = (await (await request.post(`/api/projects/${pid}/tasks`, { data: { name: 'ส่งมอบเฟส 2', duration: 0, isMilestone: true } })).json()).tasks.find((t: { name: string }) => t.name === 'ส่งมอบเฟส 2').id
  await request.post(`/api/projects/${pid}/dependencies`, { data: { from: byName['ทดสอบระบบ'], to: ms2 } })
  await request.post(`/api/projects/${pid}/releases`, { data: { name: 'เฟส 2', milestoneTaskId: ms2 } })

  await page.goto(`/p/${pid}/settings`)
  const rule = page.getByTestId('rule-releaseSuccessors')
  await expect(rule.getByText('เริ่มทันทีที่ milestone ถึง')).toBeVisible()
  await rule.getByText('รอให้พ้นเวลาเผื่อก่อน').click()
  await expect.poll(async () => (await request.get(`/api/projects/${pid}`).then((r) => r.json())).rules.releaseSuccessors).toBe('after_buffer')
  const sched = (await request.get(`/api/projects/${pid}`).then((r) => r.json())).schedule
  // UI ends 22 Sep, buffer 4 days -> acceptance starts 29 Sep instead of 23 Sep; Frontend (after UI) is untouched
  expect(sched.tasks[acc].start).toBe('2026-09-29')
  expect(sched.tasks[byName['พัฒนา Frontend']].start).toBe('2026-09-23')
})
