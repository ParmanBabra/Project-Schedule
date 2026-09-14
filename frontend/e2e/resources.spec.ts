import { test, expect } from '@playwright/test'
import { seedSampleProject } from '../shots/seed'

test('ทรัพยากร: เห็นเกินกำลัง มอบหมายจากแผงงาน และไปที่งาน', async ({ page, request }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E ทรัพยากร ${testInfo.project.name} ${Date.now()}`)

  // Gantt shows the overallocation chip (สุดา: UI + Frontend overlap 21–22 Sep)
  await page.goto(`/p/${pid}/gantt`)
  await expect(page.getByTestId('chip-overallocation')).toContainText('เกินกำลัง 1 คน')

  // task panel: warning + assign วิชัย at 50% to ออกแบบ UI
  await page.getByRole('button', { name: /^ออกแบบ UI/ }).first().click()
  const panel = page.getByTestId('task-panel')
  await expect(panel.getByTestId('asg-warning')).toContainText(/สุดา.*เกินกำลัง 200% วันที่ 17 ก.ย. – 22 ก.ย./)
  await panel.getByRole('button', { name: 'มอบหมายทรัพยากร' }).click()
  const select = panel.getByLabel('เลือกทรัพยากร')
  const value = (await select.locator('option', { hasText: 'วิชัย' }).first().getAttribute('value'))!
  await select.selectOption(value)
  await panel.getByLabel('สัดส่วน (%)').last().fill('50')
  await panel.getByRole('button', { name: 'มอบหมาย' }).click()
  await expect(panel.locator('[data-testid^="asg-"]').filter({ hasText: 'วิชัย' })).toBeVisible()
  await page.keyboard.press('Escape')

  // resources page lists everyone with the warning card; "ไปที่งาน" jumps back to the Gantt
  await page.goto('/resources?project=' + pid)
  await page.getByLabel('วันเริ่มช่วง').fill('2026-09-14')
  const card = page.getByTestId('overallocation-card')
  await expect(card).toContainText('สุดา')
  await expect(card).toContainText('17 ก.ย. – 22 ก.ย.')
  await expect(page.getByTestId('resource-row-' + (await rowId(page, 'สุดา')))).toContainText('200%')
  await card.getByRole('button', { name: 'ไปที่งาน' }).first().click()
  await expect(page).toHaveURL(/\/gantt\?task=t_/)
  await expect(page.getByTestId('task-panel')).toBeVisible()
})

async function rowId(page: import('@playwright/test').Page, name: string): Promise<string> {
  const row = page.locator('[data-testid^="resource-row-"]').filter({ hasText: name }).first()
  return (await row.getAttribute('data-testid'))!.replace('resource-row-', '')
}
