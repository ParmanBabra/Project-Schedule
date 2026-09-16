import { test, expect } from '@playwright/test'
import { seedSampleProject } from '../shots/seed'

test('Gantt แสดง critical path, buffer และเพิ่มงานได้', async ({ page, request }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E Gantt ${testInfo.project.name} ${Date.now()}`)
  await page.goto(`/p/${pid}/gantt`)

  await expect(page.getByTestId('chip-critical')).toContainText('Critical 5 งาน')
  await expect(page.getByTestId('chip-dates')).toContainText('เสร็จตามแผน 6 ต.ค.')
  await expect(page.getByTestId('chip-dates')).toContainText('สัญญาส่ง 19 ต.ค.')
  await expect(page.getByTestId('buffer-bar')).toBeVisible()
  await expect(page.locator('[data-testid^="bar-"][data-critical="true"]')).toHaveCount(4)
  await expect(page.locator('[data-testid^="dep-d_"]')).toHaveCount(7)
  // BUF-6: Frontend (UI 4 + Frontend 5 = 9 days, float 2) feeds ทดสอบระบบ and is short of its 5-day feeding buffer
  await expect(page.locator('[data-testid^="feeding-"]')).toHaveCount(1)
  await expect(page.locator('[data-testid^="feeding-"]').first()).toHaveAttribute('data-ok', 'false')

  // assignees show up after their bars; สุดา is double-booked so her avatar carries the overload ring
  await expect(page.locator('[data-testid^="assignees-"]')).toHaveCount(6)
  await expect(page.getByRole('img', { name: /^ผู้ทำ: สุดา.* 100% \(เกินกำลัง\)$/ }).first()).toBeVisible()

  // group row shows and collapses
  const group = page.getByRole('button', { name: 'ยุบกลุ่ม' })
  await expect(group).toBeVisible()
  await group.click()
  await expect(page.getByRole('button', { name: 'ขยายกลุ่ม' })).toBeVisible()
  await expect(page.getByText('ออกแบบ UI', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'ขยายกลุ่ม' }).click()

  // add a task and see it selected
  const name = `งานใหม่ ${Date.now()}`
  await page.getByRole('button', { name: 'เพิ่มงาน' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'เพิ่มงาน' })
  await dialog.getByLabel('ชื่องาน').fill(name)
  await dialog.getByLabel('ระยะเวลา', { exact: true }).fill('2')
  await dialog.getByRole('button', { name: 'เพิ่มงาน' }).click()
  await expect(page).toHaveURL(/task=t_/)
  await expect(page.locator('[data-testid^="task-row-"][aria-current="true"]')).toContainText(name)

  // clean up so the sample stays stable for screenshots
  const url = new URL(page.url())
  const tid = url.searchParams.get('task')
  await request.delete(`/api/projects/${pid}/tasks/${tid}`)
})

test('แผงงาน: แก้ระยะเวลา เพิ่ม dependency และเห็นผลใน Gantt', async ({ page, request }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E แผงงาน ${testInfo.project.name} ${Date.now()}`)
  await page.goto(`/p/${pid}/gantt`)
  await page.getByRole('button', { name: /^ออกแบบ UI/ }).first().click()
  const panel = page.getByTestId('task-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByText('เลื่อนได้ 2 วัน')).toBeVisible()

  // lengthen ออกแบบ UI to 8 days -> it becomes critical and the plan end moves
  await panel.getByLabel('ระยะเวลา').fill('8')
  await panel.getByLabel('ระยะเวลา').blur()
  await expect(panel.getByText('อยู่บน Critical path')).toBeVisible()
  await expect(page.getByTestId('chip-dates')).toContainText('เสร็จตามแผน 8 ต.ค.')

  // restore
  await panel.getByLabel('ระยะเวลา').fill('4')
  await panel.getByLabel('ระยะเวลา').blur()
  await expect(panel.getByText('เลื่อนได้ 2 วัน')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
})

test('ลากขอบคอลัมน์ชื่องานเพื่อขยาย จำค่าไว้ และดับเบิลคลิกคืนค่าเดิม', async ({ page, request }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E namecol ${testInfo.project.name} ${Date.now()}`)
  await page.goto(`/p/${pid}/gantt`)
  const handle = page.getByRole('separator', { name: 'ปรับความกว้างคอลัมน์ชื่องาน' })
  const before = Number(await handle.getAttribute('aria-valuenow'))
  const box = (await handle.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()
  await expect(handle).toHaveAttribute('aria-valuenow', String(before + 120))
  const head = page.getByText('ชื่องาน', { exact: true }).locator('..')
  expect(Math.round((await head.boundingBox())!.width)).toBe(before + 120)

  await page.reload()
  await expect(page.getByRole('separator', { name: 'ปรับความกว้างคอลัมน์ชื่องาน' })).toHaveAttribute('aria-valuenow', String(before + 120))

  await page.getByRole('separator', { name: 'ปรับความกว้างคอลัมน์ชื่องาน' }).dblclick()
  await expect(page.getByRole('separator', { name: 'ปรับความกว้างคอลัมน์ชื่องาน' })).toHaveAttribute('aria-valuenow', String(before))
})

test('พิมพ์หมายเหตุในแผงงาน บันทึกอัตโนมัติ และยังอยู่หลังรีเฟรช', async ({ page, request }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E note ${testInfo.project.name} ${Date.now()}`)
  await page.goto(`/p/${pid}/gantt`)
  await page.locator('[data-testid^="bar-"]').filter({ hasText: 'พัฒนา Backend' }).click()
  const note = page.getByLabel('หมายเหตุ')
  await expect(note).toHaveValue('')
  await note.fill('รอ API จากทีม ERP ก่อนเริ่ม')
  await note.blur()
  await expect.poll(async () => (await request.get(`/api/projects/${pid}`).then((r) => r.json())).tasks.find((t: { name: string }) => t.name === 'พัฒนา Backend').description).toBe('รอ API จากทีม ERP ก่อนเริ่ม')
  await page.reload()
  await expect(page.getByLabel('หมายเหตุ')).toHaveValue('รอ API จากทีม ERP ก่อนเริ่ม')
})

test('เลื่อนไทม์ไลน์ไปทางขวาแล้ว แถบงานและอวาตาร์ต้องลอดใต้คอลัมน์ชื่อที่ตรึงไว้', async ({ page, request }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E sticky ${testInfo.project.name} ${Date.now()}`)
  await page.goto(`/p/${pid}/gantt`)
  const chart = page.getByTestId('gantt-chart')
  const barLoc = page.locator('[data-testid^="bar-"]').filter({ hasText: 'พัฒนา Backend' })
  await barLoc.waitFor()
  const tid = (await barLoc.getAttribute('data-testid'))!.replace('bar-', '')
  // scroll so that every bar sits left of the sticky column's right edge
  await chart.evaluate((el) => { el.scrollLeft = 5000 })
  await page.waitForTimeout(200)
  const col = (await page.getByTestId(`task-row-${tid}`).boundingBox())!
  const bar = (await barLoc.boundingBox())!
  expect(bar.x + bar.width).toBeLessThan(col.x + col.width) // the bar really is "behind" the column now
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('[data-testid^="task-row-"]')?.getAttribute('data-testid') ?? null, [col.x + col.width - 30, col.y + col.height / 2])
  expect(hit).toBe(`task-row-${tid}`)
  const head = (await page.getByText('ชื่องาน', { exact: true }).locator('..').boundingBox())!
  const headerHit = await page.evaluate(([x, y]) => (document.elementFromPoint(x, y)?.closest('[class*="nameHead"]') ? 'head' : 'other'), [head.x + head.width - 30, head.y + head.height / 2])
  expect(headerHit).toBe('head')
})

test('กำหนดเสร็จภายในวันที่ (FNLT): float ติดลบขึ้นชิปเลยกำหนด และปิดได้', async ({ page, request }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E fnlt ${testInfo.project.name} ${Date.now()}`, { assignments: false })
  await page.goto(`/p/${pid}/gantt`)
  await page.locator('[data-testid^="bar-"]').filter({ hasText: 'พัฒนา Backend' }).click()
  const panel = page.getByTestId('task-panel')
  await panel.getByText('ต้องเสร็จภายในวันที่กำหนด').click()
  const picker = panel.getByLabel('ต้องเสร็จภายในวันที่', { exact: true })
  await expect(picker).toBeVisible()
  // the toggle stores a deadline at the planned end (1 Oct); move it to 28 Sep through the API -> 3 working days late
  const tid = await expect.poll(async () => (await request.get(`/api/projects/${pid}`).then((r) => r.json())).tasks.find((t: { name: string; constraint: { type: string } | null }) => t.name === 'พัฒนา Backend' && t.constraint?.type === 'FNLT')?.id).not.toBeUndefined().then(async () => (await request.get(`/api/projects/${pid}`).then((r) => r.json())).tasks.find((t: { name: string }) => t.name === 'พัฒนา Backend').id as string)
  await request.patch(`/api/projects/${pid}/tasks/${tid}`, { data: { constraint: { type: 'FNLT', date: '2026-09-28' } } })
  await page.reload()
  await expect(panel.getByText('เลยกำหนดเสร็จ 3 วัน')).toBeVisible()
  await expect(panel.getByRole('switch', { name: 'ต้องเสร็จภายในวันที่กำหนด' })).toBeChecked()
  await panel.getByText('ต้องเสร็จภายในวันที่กำหนด').click()
  await expect(panel.getByText('อยู่บน Critical path')).toBeVisible()
})
