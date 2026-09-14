import { defineConfig, devices } from '@playwright/test'
import base from '../playwright.config'

/**
 * Screenshot capture for design review (not a test run – nothing asserts).
 * Output: frontend/.screenshots/app/<viewport>/<screen>.png
 *         frontend/.screenshots/mockups/<artboard>.png
 */
export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: /.*\.shots\.ts/,
  outputDir: '../.screenshots/_artifacts',
  reporter: [['list']],
  retries: 0,
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
