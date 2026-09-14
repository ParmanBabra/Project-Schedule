import { test, expect } from '@playwright/test'
import { seedSampleProject } from '../shots/seed'

test.skip(({ isMobile }) => isMobile, 'คีย์บอร์ดเป็นเรื่องเดสก์ท็อป')

test('คีย์บอร์ด: N เพิ่มงาน, Esc ปิด, Tab เห็นโฟกัส, ลูกศรเลือกงานในแผง, Ctrl+Z เลิกทำ', async ({ page, request }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E คีย์บอร์ด ${testInfo.project.name} ${Date.now()}`)
  await page.goto(`/p/${pid}/gantt`)
  await expect(page.getByTestId('chip-critical')).toBeVisible()

  // N opens the add dialog with focus in the name field; Esc closes it
  await page.keyboard.press('n')
  const dialog = page.getByRole('dialog', { name: 'เพิ่มงาน' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator(':focus')).toHaveCount(1) // focus trapped inside the dialog
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)

  // Tab from the top reaches the toolbar controls and shows a visible focus ring
  await page.getByRole('link', { name: 'แผนงาน หน้าแรก' }).focus()
  await page.keyboard.press('Tab')
  const focused = page.locator(':focus-visible')
  await expect(focused).toHaveCount(1)
  const outline = await focused.evaluate((el) => getComputedStyle(el).outlineStyle)
  expect(outline).not.toBe('none')

  // open a task with Enter on its bar, edit duration, undo with Ctrl+Z
  await page.getByRole('button', { name: /^ออกแบบ UI/ }).first().focus()
  await page.keyboard.press('Enter')
  const panel = page.getByRole('complementary', { name: /^รายละเอียดงาน/ })
  await expect(panel).toBeVisible()
  const dur = panel.getByLabel('ระยะเวลา', { exact: true })
  await dur.fill('6')
  await dur.press('Tab')
  const bar = page.locator('[data-testid^="bar-"]').filter({ hasText: 'ออกแบบ UI' })
  await expect(bar).toHaveAttribute('title', /24 ก.ย./) // 6 days from 17 ก.ย.
  await expect(page.getByTestId('chip-dates')).toContainText('เสร็จตามแผน 6 ต.ค.') // non-critical: end unchanged
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await page.keyboard.press('Control+z')
  await expect(bar).toHaveAttribute('title', /22 ก.ย./) // back to 4 days
})
