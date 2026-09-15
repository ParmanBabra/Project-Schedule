import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const E2E_DATA_DIR = resolve(here, '../.e2e-data')
const BACKEND_PORT = 8001
const FRONTEND_PORT = 5174

/** The e2e backend runs with the login gate ON using these credentials. */
export const E2E_CREDENTIALS = { username: 'e2e', password: 'e2e-password' }
/** Session cookie saved by e2e/auth.setup.ts and reused by every browser project. */
export const STORAGE_STATE = resolve(here, '.auth/state.json')

/**
 * End-to-end tests run against their OWN backend + frontend dev servers on separate
 * ports (8001 / 5174) with an isolated DATA_DIR, so they never touch `data/` or a
 * dev server you have running on 8000 / 5173. A `setup` project logs in first.
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
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, storageState: STORAGE_STATE }, dependencies: ['setup'] },
    { name: 'mobile', use: { ...devices['Pixel 7'], storageState: STORAGE_STATE }, dependencies: ['setup'] },
  ],
  webServer: [
    {
      command: `..\\backend\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --port ${BACKEND_PORT}`,
      cwd: '../backend',
      url: `http://127.0.0.1:${BACKEND_PORT}/api/health`,
      reuseExistingServer: false,
      env: {
        DATA_DIR: E2E_DATA_DIR,
        AUTH_DISABLED: '0',
        AUTH_USERNAME: E2E_CREDENTIALS.username,
        AUTH_PASSWORD: E2E_CREDENTIALS.password,
        SESSION_SECRET: 'e2e-secret',
        AUTH_MAX_FAILURES: '100000', // the login screens fail on purpose many times per run
        CONFIG_FILE: resolve(here, '.auth/no-config.json'), // never read the developer's real config.json
      },
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
