import { defineConfig, devices } from '@playwright/test'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import base from '../playwright.config'

const here = fileURLToPath(new URL('.', import.meta.url))
const frontendDir = resolve(here, '..')
const backendDir = resolve(here, '../../backend')

/**
 * Screenshot capture for design review (not a test run – nothing asserts).
 * Output: frontend/.screenshots/app/<viewport>/<screen>.png
 *         frontend/.screenshots/mockups/<artboard>.png
 * Reuses the e2e servers (isolated ports + data dir) with cwd made absolute,
 * because relative paths in the base config resolve against this folder.
 */
const servers = (Array.isArray(base.webServer) ? base.webServer : base.webServer ? [base.webServer] : []).map((s) => ({
  ...s,
  cwd: s.cwd?.includes('backend') ? backendDir : frontendDir,
}))

export default defineConfig({
  ...base,
  testDir: '.',
  testMatch: /.*\.shots\.ts/,
  outputDir: '../.screenshots/_artifacts',
  reporter: [['list']],
  retries: 0,
  webServer: servers,
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
