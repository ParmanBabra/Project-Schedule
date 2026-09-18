import { test, expect } from '@playwright/test'
import { pinClock, resolvePath, screens, settle } from '../shots/screens'

/**
 * Visual regression: every registered screen must match its approved baseline.
 * Baselines live in e2e/visual.spec.ts-snapshots/ and are committed.
 * Approve intentional changes with: npm run visual:approve   (after a design review)
 */
for (const screen of screens) {
  test(`visual: ${screen.name}`, async ({ page: authedPage, browser, request }, testInfo) => {
    const viewport = testInfo.project.name as 'desktop' | 'mobile'
    test.skip(screen.viewports !== undefined && !screen.viewports.includes(viewport), `${screen.name} not defined for ${viewport}`)
    // anonymous screens (login) get a fresh context without the shared session cookie
    const page = screen.noAuth ? await (await browser.newContext({ ...testInfo.project.use, storageState: undefined })).newPage() : authedPage
    await pinClock(page)
    await page.goto(await resolvePath(screen, request))
    await settle(page)
    if (screen.setup) {
      await screen.setup(page)
      await settle(page)
    }
    // hide the today marker (it moves every day) instead of masking it, so baselines stay clean
    await page.addStyleTag({ content: '[data-testid="today-line"], [data-testid="today-tag"] { visibility: hidden !important; }' })
    await expect(page).toHaveScreenshot(`${screen.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
      animations: 'disabled',
    })
  })
}
