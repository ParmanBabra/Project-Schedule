import { test } from '@playwright/test'
import { existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { mockups, settle } from './screens'

const here = fileURLToPath(new URL('.', import.meta.url))

/**
 * Renders the agreed design artboards (design/*.dc.html) to PNG so they can be
 * placed side by side with real app screenshots. Runs in the desktop project only;
 * each artboard already has its own fixed size (phone artboards are 390 wide).
 * Rebuild artboards first if missing: cd design && node build-layouts.mjs && node build-mobile.mjs && node build-settings.mjs
 */
const designDir = resolve(here, '../../design')
const outDir = resolve(here, '../.screenshots/mockups')

for (const name of mockups) {
  test(`mockup: ${name}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'mockups render once')
    const file = resolve(designDir, `${name}.dc.html`)
    test.skip(!existsSync(file), `missing ${file} – run the design build scripts`)
    mkdirSync(outDir, { recursive: true })

    await page.setViewportSize({ width: 1600, height: 1600 })
    await page.goto(pathToFileURL(file).href)
    await settle(page)
    const root = page.locator('x-dc > *:not(helmet)').first()
    await root.screenshot({ path: resolve(outDir, `${name}.png`) })
  })
}
