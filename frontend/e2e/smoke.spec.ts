import { test, expect } from '@playwright/test'

test('หน้าแรกเปิดได้และ backend ตอบ', async ({ page, request }) => {
  const health = await request.get('/api/health')
  expect(health.ok()).toBeTruthy()
  expect((await health.json()).status).toBe('ok')

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'แผนงาน' })).toBeVisible()
  await expect(page.getByTestId('backend-status')).toHaveText(/พร้อม/)
})
