import { test, expect } from '@playwright/test'
import { resolvePath, screens, settle } from '../shots/screens'

/**
 * Visual regression: every registered screen must match its approved baseline.
 * Baselines live in e2e/visual.spec.ts-snapshots/ and are committed.
 * Approve intentional changes with: npm run visual:approve   (after a design review)
 */
for (const screen of screens) {
  test(`visual: ${screen.name}`, async ({ page, request }, testInfo) => {
    const viewport = testInfo.project.name as 'desktop' | 'mobile'
    test.skip(screen.viewports !== undefined && !screen.viewports.includes(viewport), `${screen.name} not defined for ${viewport}`)
    await page.goto(await resolvePath(screen, request))
    await settle(page)
    if (screen.setup) {
      await screen.setup(page)
      await settle(page)
    }
    await expect(page).toHaveScreenshot(`${screen.name}.png`, {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
      animations: 'disabled',
      mask: [page.getByTestId('today-line')],
    })
  })
}
