import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const E2E_DATA_DIR = resolve(here, '../.e2e-data')
const BACKEND_PORT = 8001
const FRONTEND_PORT = 5174

/**
 * End-to-end tests run against their OWN backend + frontend dev servers on separate
 * ports (8001 / 5174) with an isolated DATA_DIR, so they never touch `data/` or a
 * dev server you have running on 8000 / 5173.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${FRONTEND_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'th-TH',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: `..\\backend\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --port ${BACKEND_PORT}`,
      cwd: '../backend',
      url: `http://127.0.0.1:${BACKEND_PORT}/api/health`,
      reuseExistingServer: false,
      env: { DATA_DIR: E2E_DATA_DIR },
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${FRONTEND_PORT} --strictPort`,
      url: `http://127.0.0.1:${FRONTEND_PORT}`,
      reuseExistingServer: false,
      env: { API_TARGET: `http://127.0.0.1:${BACKEND_PORT}` },
      timeout: 60_000,
    },
  ],
})
