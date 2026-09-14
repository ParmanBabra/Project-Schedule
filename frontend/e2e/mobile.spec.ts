import { test, expect } from '@playwright/test'
import { seedSampleProject } from '../shots/seed'

test.skip(({ isMobile }) => !isMobile, 'เฉพาะมือถือ')

test('มือถือ: BottomNav สลับหน้า ปุ่ม + เปิดเพิ่มงาน ปัดเปลี่ยนสัปดาห์', async ({ page, request }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E มือถือ ${testInfo.project.name} ${Date.now()}`)
  await page.goto(`/p/${pid}/calendar`)
  const nav = page.getByTestId('bottom-nav')
  await expect(nav).toBeVisible()
  await expect(page.getByTestId('calendar-title')).toContainText('14 ก.ย. – 20 ก.ย.')

  // swipe left on the calendar card -> next week
  const card = page.getByTestId('calendar-card')
  await page.waitForLoadState('networkidle') // layout settles once the workload banner has loaded
  const box = (await card.boundingBox())!
  const cdp = await page.context().newCDPSession(page)
  const y = box.y + Math.min(box.height / 2, 200)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width - 20, y }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 40, y }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(page.getByTestId('calendar-title')).toContainText('21 ก.ย. – 27 ก.ย.')

  // + goes to the Gantt and opens Add task
  await nav.getByRole('button', { name: 'เพิ่มงาน' }).click()
  await expect(page).toHaveURL(/\/gantt$/)
  await expect(page.getByRole('dialog', { name: 'เพิ่มงาน' })).toBeVisible()
  await page.keyboard.press('Escape')

  // tabs navigate
  await nav.getByRole('link', { name: 'ทรัพยากร' }).click()
  await expect(page).toHaveURL(/\/resources$/)
  await expect(page.getByRole('heading', { name: 'ทรัพยากร' })).toBeVisible()
})
