import { test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinClock, resolvePath, screens, settle } from './screens'

const here = fileURLToPath(new URL('.', import.meta.url))
const outRoot = resolve(here, '../.screenshots/app')

for (const screen of screens) {
  test(`shot: ${screen.name}`, async ({ page: authedPage, browser, request }, testInfo) => {
    const viewport = testInfo.project.name as 'desktop' | 'mobile'
    test.skip(screen.viewports !== undefined && !screen.viewports.includes(viewport), `${screen.name} not defined for ${viewport}`)
    const dir = resolve(outRoot, viewport)
    mkdirSync(dir, { recursive: true })

    // anonymous screens (login) get a fresh context without the shared session cookie
    const page = screen.noAuth ? await (await browser.newContext({ ...testInfo.project.use, storageState: undefined })).newPage() : authedPage
    await pinClock(page)
    await page.goto(await resolvePath(screen, request))
    await settle(page)
    if (screen.setup) {
      await screen.setup(page)
      await settle(page)
    }
    await page.screenshot({ path: resolve(dir, `${screen.name}.png`), fullPage: true })
  })
}
