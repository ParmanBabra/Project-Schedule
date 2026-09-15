import { test as setup, expect } from '@playwright/test'
import { rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { E2E_CREDENTIALS, STORAGE_STATE } from '../playwright.config'

/** Logs in once through the API and stores the session cookie for every other project. */
setup('เข้าสู่ระบบสำหรับชุดทดสอบ', async ({ request }) => {
  rmSync(resolve(dirname(STORAGE_STATE), 'locks'), { recursive: true, force: true }) // stale seed locks from a killed run
  const res = await request.post('/api/auth/login', { data: E2E_CREDENTIALS })
  expect(res.ok(), await res.text()).toBeTruthy()
  await request.storageState({ path: STORAGE_STATE })
})
