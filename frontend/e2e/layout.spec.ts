import { test, expect } from '@playwright/test'
import { seedLargeProject } from '../shots/seed'

test('โปรเจกต์ยาว: หน้าไม่เลื่อนทั้งหน้า Gantt เลื่อนภายใน หัวตารางตรึง แผงงานยังอยู่ในจอ', async ({ page, request }) => {
  const pid = await seedLargeProject(request)
  const p = await (await request.get(`/api/projects/${pid}`)).json()
  const t = p.tasks.find((x: { name: string }) => x.name === 'พัฒนา Backend')
  await page.goto(`/p/${pid}/gantt?task=${t.id}`)
  const chart = page.getByTestId('gantt-chart')
  await page.getByTestId('task-panel').waitFor()

  const before = await page.evaluate(() => ({
    pageScroll: document.documentElement.scrollHeight - window.innerHeight,
    chart: (() => { const c = document.querySelector('[data-testid=gantt-chart]')!; return { canScroll: c.scrollHeight > c.clientHeight + 1, top: c.scrollTop } })(),
  }))
  expect(before.pageScroll).toBeLessThanOrEqual(1) // the window itself has nothing to scroll
  expect(before.chart.canScroll).toBe(true) // the rows overflow inside the card

  const headBefore = (await page.getByText('ชื่องาน', { exact: true }).boundingBox())!
  const firstRowBefore = (await page.locator('[data-testid^="task-row-"]').first().boundingBox())!
  await chart.evaluate((el) => { el.scrollTop = 400 })
  await page.waitForTimeout(150)
  const headAfter = (await page.getByText('ชื่องาน', { exact: true }).boundingBox())!
  const firstRowAfter = (await page.locator('[data-testid^="task-row-"]').first().boundingBox())!
  expect(Math.round(headAfter.y)).toBe(Math.round(headBefore.y)) // sticky header stays
  expect(firstRowAfter.y).toBeLessThan(firstRowBefore.y - 300) // rows moved

  // the task panel keeps its footer on screen (desktop: pinned to the card; mobile: bottom sheet)
  const done = page.getByTestId('task-panel').getByRole('button', { name: 'เสร็จสิ้น' })
  await expect(done).toBeVisible()
  const box = (await done.boundingBox())!
  const vh = page.viewportSize()!.height
  expect(box.y + box.height).toBeLessThanOrEqual(vh)

  // a horizontal scrollbar belongs to the chart, not the page
  const wide = await chart.evaluate((el) => el.scrollWidth > el.clientWidth)
  expect(wide).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('หน้าตั้งค่ายาวยังเลื่อนทั้งหน้าได้ตามปกติ', async ({ page, request }) => {
  const pid = await seedLargeProject(request)
  await page.goto(`/p/${pid}/settings`)
  await page.getByText('กติกาการคำนวณ').waitFor()
  const scrollable = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1)
  expect(scrollable).toBe(true)
  await page.getByText('โซนอันตราย').scrollIntoViewIfNeeded()
  await expect(page.getByText('โซนอันตราย')).toBeInViewport()
})
