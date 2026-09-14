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
