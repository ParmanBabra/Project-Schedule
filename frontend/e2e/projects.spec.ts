import { test, expect } from '@playwright/test'

test('สร้างโปรเจกต์ → เปิด Gantt → กลับมาเห็นการ์ด → ลบ', async ({ page }) => {
  const name = `E2E โปรเจกต์ ${Date.now()}`
  await page.goto('/')
  await page.getByRole('button', { name: 'โปรเจกต์ใหม่' }).click()
  const dialog = page.getByRole('dialog', { name: 'โปรเจกต์ใหม่' })
  await dialog.getByLabel('ชื่อโปรเจกต์').fill(name)
  await dialog.getByLabel('วันเริ่ม').fill('2026-09-14')
  await dialog.getByRole('button', { name: 'สร้างโปรเจกต์' }).click()

  await expect(page).toHaveURL(/\/p\/prj_[0-9a-f]+\/gantt$/)
  await expect(page.getByRole('button', { name: 'สลับโปรเจกต์' })).toContainText(name)

  await page.getByRole('link', { name: 'แผนงาน หน้าแรก' }).click()
  const card = page.getByTestId('project-card').filter({ hasText: name })
  await expect(card).toBeVisible()
  await expect(card).toContainText('ยังไม่มีงาน')

  await card.getByRole('button', { name: `ตัวเลือกของ ${name}` }).click()
  await page.getByRole('menuitem', { name: 'ลบโปรเจกต์' }).click()
  await page.getByRole('dialog', { name: 'ลบโปรเจกต์' }).getByRole('button', { name: 'ลบโปรเจกต์' }).click()
  await expect(card).toHaveCount(0)
})
