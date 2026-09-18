import { test, expect, type Page } from '@playwright/test'
import { seedSampleProject } from '../shots/seed'

test.skip(({ isMobile }) => isMobile, 'การลากมีเฉพาะ desktop')

async function dragBy(page: Page, selector: string, dx: number, dy = 0) {
  // the chart auto-scrolls to the project start on mount; measure only after that settled
  await page.waitForFunction(() => (document.querySelector('[data-testid="gantt-chart"]')?.scrollLeft ?? 0) > 0)
  await page.waitForTimeout(150)
  const box = await page.locator(selector).boundingBox()
  if (!box) throw new Error(`no box for ${selector}`)
  const x = box.x + Math.min(box.width / 2, 20)
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 })
  await page.mouse.move(x + dx, y + dy, { steps: 4 })
  return { x: x + dx, y: y + dy }
}

test('ลากแถบเลื่อนวัน แล้ว Ctrl+Z คืนค่า', async ({ page, request }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E ลาก ${testInfo.project.name} ${Date.now()}`)
  await page.goto(`/p/${pid}/gantt`)
  await expect(page.getByTestId('chip-dates')).toContainText('เสร็จตามแผน 6 ต.ค.')

  // find the critical "พัฒนา Backend" bar and drag it 5 working days right (7 calendar days = 252px at day zoom)
  const bar = page.locator('[data-testid^="bar-"]').filter({ hasText: 'พัฒนา Backend' })
  const id = (await bar.getAttribute('data-testid'))!.replace('bar-', '')
  await dragBy(page, `[data-testid="bar-${id}"]`, 7 * 36)
  await expect(page.getByTestId('drag-ghost')).toContainText('เริ่ม 1 ต.ค.')
  await page.mouse.up()
  await expect(page.getByText(/ย้าย "พัฒนา Backend" ไปเริ่ม 1 ต.ค./)).toBeVisible()
  await expect(page.getByTestId('chip-dates')).toContainText('เสร็จตามแผน 13 ต.ค.')

  await page.keyboard.press('Control+z')
  await expect(page.getByTestId('chip-dates')).toContainText('เสร็จตามแผน 6 ต.ค.')
  await page.keyboard.press('Control+Shift+z')
  await expect(page.getByTestId('chip-dates')).toContainText('เสร็จตามแผน 13 ต.ค.')
})

test('ลากขอบปรับระยะเวลา, ลากเชื่อม dependency และแก้ผ่าน popover', async ({ page, request }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E เชื่อม ${testInfo.project.name} ${Date.now()}`)
  await page.goto(`/p/${pid}/gantt`)
  const ui = page.locator('[data-testid^="bar-"]').filter({ hasText: 'ออกแบบ UI' })
  const uiId = (await ui.getAttribute('data-testid'))!.replace('bar-', '')

  // resize ออกแบบ UI from 4 to 6 days
  await dragBy(page, `[data-testid="resize-${uiId}"]`, 2 * 36)
  await expect(page.getByTestId('drag-ghost')).toContainText('6 วัน')
  await page.mouse.up()
  await expect(page.getByText(/"ออกแบบ UI" เป็น 6 วัน/)).toBeVisible()
  // the open panel follows the change made on the chart
  await page.locator(`[data-testid="bar-${uiId}"]`).click()
  const panel = page.getByRole('complementary', { name: /^รายละเอียดงาน/ })
  await expect(panel.getByLabel('ระยะเวลา', { exact: true })).toHaveValue('6')
  await dragBy(page, `[data-testid="resize-${uiId}"]`, 36)
  await page.mouse.up()
  await expect(panel.getByLabel('ระยะเวลา', { exact: true })).toHaveValue('7')
  await page.keyboard.press('Escape')

  // link ออกแบบ UI -> พัฒนา Backend (new FS dependency)
  const before = await page.locator('[data-testid^="dep-hit-"]').count()
  await page.waitForFunction(() => (document.querySelector('[data-testid="gantt-chart"]')?.scrollLeft ?? 0) > 0)
  await page.locator(`[data-testid="bar-${uiId}"]`).click()
  const target = page.locator('[data-testid^="task-row-"]').filter({ hasText: 'พัฒนา Backend' })
  const tBox = (await target.boundingBox())!
  const hBox = (await page.locator(`[data-testid="link-${uiId}"]`).boundingBox())!
  await page.mouse.move(hBox.x + hBox.width / 2, hBox.y + hBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(hBox.x + 60, tBox.y + tBox.height / 2, { steps: 6 })
  await expect(page.getByTestId('link-line')).toBeVisible()
  await page.mouse.up()
  await expect(page.getByText('เชื่อมความสัมพันธ์แล้ว')).toBeVisible()
  await expect(page.locator('[data-testid^="dep-hit-"]')).toHaveCount(before + 1)

  // open the newest arrow's popover, switch to SS, then delete it
  const hits = page.locator('[data-testid^="dep-hit-"]')
  await hits.last().click({ force: true })
  const pop = page.getByTestId('dep-popover')
  await expect(pop).toBeVisible()
  await pop.getByLabel('ประเภท').selectOption('SS')
  await expect(pop.getByLabel('ประเภท')).toHaveValue('SS')
  await pop.getByRole('button', { name: 'ลบความสัมพันธ์' }).click()
  await expect(page.locator('[data-testid^="dep-hit-"]')).toHaveCount(before)
})

test('ลาก milestone: เพชรลงตรงวันที่ปล่อยเมาส์ ไม่เหลื่อมหนึ่งวัน', async ({ page, request }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E ลาก milestone ${testInfo.project.name} ${Date.now()}`)
  await page.goto(`/p/${pid}/gantt`)
  const ms = page.getByRole('button', { name: 'milestone ส่งมอบ' })
  await expect(ms).toBeVisible()
  const id = (await ms.getAttribute('data-testid'))!.replace('bar-', '')
  const before = (await ms.boundingBox())!
  // shows 6 Oct; drag 2 days right (72px at day zoom) -> must show 8 Oct, exactly 72px further
  await dragBy(page, `[data-testid="bar-${id}"]`, 72)
  await expect(page.getByTestId('drag-ghost')).toContainText('ถึง 8 ต.ค.')
  await page.mouse.up()
  await expect(page.getByText(/ย้าย "ส่งมอบ" ไปวันที่ 8 ต.ค./)).toBeVisible()
  const after = (await page.getByRole('button', { name: 'milestone ส่งมอบ' }).boundingBox())!
  expect(Math.round(after.x - before.x)).toBe(72)
  const task = (await (await request.get(`/api/projects/${pid}`)).json()).tasks.find((t: { id: string }) => t.id === id)
  expect(task.constraint).toEqual({ type: 'SNET', date: '2026-10-09' })
})
