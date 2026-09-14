import { test, expect } from '@playwright/test'
import { seedSampleProject } from '../shots/seed'

test('ปฏิทิน: เดือน สัปดาห์ตามทรัพยากร กรอง และเปิดแผงงาน', async ({ page, request, isMobile }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E ปฏิทิน ${testInfo.project.name} ${Date.now()}`)
  await page.goto(`/p/${pid}/calendar`)

  if (isMobile) {
    // mobile shows the week as a vertical day list
    await expect(page.getByTestId('day-list')).toBeVisible()
    await expect(page.getByTestId('cal-over-chip')).toContainText('เกินกำลัง 1 คน')
    await page.getByRole('button', { name: /^สุดา/ }).click()
    await page.getByTestId('day-list').getByRole('button', { name: /^ออกแบบ UI/ }).first().click()
    await expect(page.getByTestId('task-panel').getByLabel('ชื่องาน')).toHaveValue('ออกแบบ UI')
    return
  }

  await expect(page.getByTestId('calendar-title')).toContainText('กันยายน 2569')
  await expect(page.getByTestId('month-view')).toBeVisible()
  await expect(page.getByTestId('over-2026-09-17')).toHaveText('1') // สุดา double-booked
  await expect(page.getByTestId('cal-over-chip')).toContainText('เกินกำลัง 1 คน')

  // filter to สุดา hides สมชาย's task
  await page.getByRole('button', { name: /^สุดา/ }).click()
  await expect(page.locator('[data-testid^="cal-chip-"]').filter({ hasText: 'รวบรวมความต้องการ' })).toHaveCount(0)
  await expect(page.locator('[data-testid^="cal-chip-"]').filter({ hasText: 'ออกแบบ UI' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'ทุกคน' }).click()

  // week by resource
  await page.getByRole('radio', { name: 'สัปดาห์' }).click()
  await expect(page.getByTestId('week-view')).toBeVisible()
  await expect(page.getByTestId('calendar-title')).toContainText('14 ก.ย.')
  const sudaRow = page.locator('[data-testid^="week-row-"]').filter({ hasText: 'สุดา' })
  await expect(sudaRow).toContainText('200%')

  // click a chip -> panel; drag it to Monday 21 Sep -> constraint set
  await sudaRow.getByRole('button', { name: /^ออกแบบ UI/ }).first().click()
  await expect(page.getByTestId('task-panel').getByLabel('ชื่องาน')).toHaveValue('ออกแบบ UI')
  await page.keyboard.press('Escape')
  const chip = sudaRow.getByRole('button', { name: /^ออกแบบ UI/ }).first()
  const box = (await chip.boundingBox())!
  const target = page.locator('[data-date="2026-09-18"]').first()
  const tBox = (await target.boundingBox())!
  await page.mouse.move(box.x + 10, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(tBox.x + tBox.width / 2, tBox.y + tBox.height / 2, { steps: 6 })
  await page.mouse.up()
  await expect(page.getByText(/ย้าย "ออกแบบ UI" ไปเริ่ม 18 ก.ย./)).toBeVisible()
})

test('baseline: บันทึกจากตั้งค่า แล้ว Gantt แสดงการใช้เวลาเผื่อ', async ({ page, request }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E baseline ${testInfo.project.name} ${Date.now()}`)
  await page.goto(`/p/${pid}/gantt`)
  await expect(page.getByTestId('chip-buffer')).toHaveText(/^เผื่อ 9 วัน$/)
  await page.getByRole('button', { name: 'บันทึก baseline' }).click()
  await expect(page.getByTestId('chip-buffer')).toContainText('ใช้ไป 0%')

  // slip the critical chain: พัฒนา Backend 6 -> 9 days
  await page.getByRole('button', { name: /^พัฒนา Backend/ }).first().click()
  const panel = page.getByTestId('task-panel')
  await panel.getByLabel('ระยะเวลา', { exact: true }).fill('9')
  await panel.getByLabel('ระยะเวลา', { exact: true }).blur()
  await expect(page.getByTestId('chip-buffer')).toContainText('ใช้ไป 33%')
  await expect(page.getByTestId('chip-dates')).toContainText('สัญญาส่ง 19 ต.ค.') // committed end stays frozen

  await page.goto(`/p/${pid}/settings`)
  const section = page.getByTestId('baseline-section')
  await expect(section).toContainText('เผื่อ 9 วัน (คงที่จนกว่าจะบันทึกใหม่)')
  await expect(section).toContainText('ใช้เผื่อไป 33%')
  await section.getByRole('button', { name: 'ล้าง' }).click()
  await expect(section).toContainText('ยังไม่มี baseline')
})
