import { test as setup, expect } from '@playwright/test'
import { E2E_CREDENTIALS, STORAGE_STATE } from '../playwright.config'

/** Logs in once through the API and stores the session cookie for every other project. */
setup('เข้าสู่ระบบสำหรับชุดทดสอบ', async ({ request }) => {
  const res = await request.post('/api/auth/login', { data: E2E_CREDENTIALS })
  expect(res.ok(), await res.text()).toBeTruthy()
  await request.storageState({ path: STORAGE_STATE })
})
