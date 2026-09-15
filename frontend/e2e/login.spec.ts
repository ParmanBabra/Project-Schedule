import { test, expect } from '@playwright/test'
import { E2E_CREDENTIALS } from '../playwright.config'

// this spec starts anonymous on purpose
test.use({ storageState: { cookies: [], origins: [] } })

test('ยังไม่ล็อกอิน → ถูกส่งไปหน้าเข้าสู่ระบบ → รหัสผิดเตือน → เข้าสำเร็จกลับหน้าเดิม → ออกจากระบบ', async ({ page, isMobile }) => {
  await page.goto('/resources')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'แผนงาน' })).toBeVisible()

  await page.getByLabel('ชื่อผู้ใช้').fill(E2E_CREDENTIALS.username)
  await page.getByLabel('รหัสผ่าน').fill('wrong')
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click()
  await expect(page.getByRole('alert')).toHaveText('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')

  await page.getByLabel('รหัสผ่าน').fill(E2E_CREDENTIALS.password)
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click()
  await expect(page).toHaveURL(/\/resources$/)
  await expect(page.getByRole('heading', { name: 'ทรัพยากร' })).toBeVisible()

  // the session survives a reload
  await page.reload()
  await expect(page.getByRole('heading', { name: 'ทรัพยากร' })).toBeVisible()

  if (isMobile) {
    await page.getByRole('button', { name: 'เมนู' }).click()
    await page.getByRole('menuitem', { name: 'ออกจากระบบ' }).click()
  } else {
    await page.getByTestId('logout').click()
  }
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
})
