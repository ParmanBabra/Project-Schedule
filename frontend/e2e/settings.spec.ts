import { test, expect } from '@playwright/test'
import { seedSampleProject } from '../shots/seed'

test('ตั้งค่า: สลับวิธีสำรองเวลา เพิ่มวันหยุด และเห็นผลใน Gantt', async ({ page, request }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E ตั้งค่า ${testInfo.project.name} ${Date.now()}`)
  await page.goto(`/p/${pid}/settings`)

  const ccpm = page.getByTestId('buffer-ccpm')
  await expect(ccpm).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('buffer-example-ccpm')).toContainText('เผื่อ 9 วัน')
  await expect(page.getByTestId('buffer-example-percent')).toContainText('เผื่อ 3 วัน')

  // switch to percent (no dialog in this direction) and pick high risk
  await page.getByTestId('buffer-percent').click()
  await expect(page.getByTestId('buffer-percent')).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('radio', { name: 'สูง 25%' }).click()
  await expect(page.getByTestId('buffer-example-percent')).toContainText('× 25% → เผื่อ 5 วัน')

  // holiday on the critical path pushes the plan by one working day
  await page.getByLabel('วันหยุดใหม่').fill('2026-09-15')
  await page.getByRole('button', { name: 'เพิ่มวันหยุด' }).click()
  await expect(page.getByRole('button', { name: 'ลบวันหยุด 15 ก.ย. 2569' })).toBeVisible()

  // near-critical rule reveals the two float-2 tasks
  await page.getByTestId('rule-nearCriticalFloatDays').getByRole('radio', { name: /ไม่เกิน N วัน/ }).click()
  await expect(page.getByTestId('rule-nearCriticalFloatDays')).toContainText('ใกล้ critical 2 งาน')

  // back to ccpm -> the padding dialog appears
  await page.getByTestId('buffer-ccpm').click()
  const dialog = page.getByRole('dialog', { name: 'เปลี่ยนเป็นรวมเผื่อไว้ท้ายโครงการ' })
  await dialog.getByRole('button', { name: 'กรอกแบบไม่เผื่ออยู่แล้ว' }).click()
  await expect(page.getByTestId('buffer-ccpm')).toHaveAttribute('aria-pressed', 'true')

  // Gantt reflects the holiday (plan end 7 Oct) and near-critical chip
  await page.goto(`/p/${pid}/gantt`)
  await expect(page.getByTestId('chip-dates')).toContainText('เสร็จตามแผน 7 ต.ค.')
  await expect(page.getByText(/ใกล้ critical 2/)).toBeVisible()
})

test('รายการงาน: เปิด drawer ย้ายลำดับ และย่อหน้าเข้า', async ({ page, request }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E รายการงาน ${testInfo.project.name} ${Date.now()}`)
  await page.goto(`/p/${pid}/gantt`)
  await page.getByRole('button', { name: 'รายการงาน' }).click()
  const drawer = page.getByRole('dialog', { name: 'รายการงาน' })
  await expect(drawer.locator('tbody tr')).toHaveCount(8)
  const rows = drawer.locator('tbody tr')
  await expect(rows.nth(0)).toContainText('รวบรวมความต้องการ')
  await rows.nth(0).getByRole('button', { name: 'เลื่อนลง' }).click()
  // the group "ออกแบบ" (with its two children) moves above it
  await expect(drawer.locator('tbody tr').nth(0)).toContainText('ออกแบบ')
  await expect(drawer.locator('tbody tr').nth(3)).toContainText('รวบรวมความต้องการ')
  await drawer.locator('tbody tr').nth(3).getByRole('button', { name: 'เลื่อนขึ้น' }).click()
  await expect(drawer.locator('tbody tr').nth(0)).toContainText('รวบรวมความต้องการ')
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
})
