import type { Page } from '@playwright/test'

/**
 * Registry of every screen/state that design review and visual regression cover.
 * Add an entry whenever a new page or a meaningful UI state is built.
 *
 * `setup` runs after navigation and before the screenshot (open a panel, hover a bar…).
 * `mockup` names the design artboard (design/<mockup>.dc.html) to compare against, if one exists.
 */
export interface Screen {
  name: string
  path: string
  viewports?: Array<'desktop' | 'mobile'>
  mockup?: { desktop?: string; mobile?: string }
  setup?: (page: Page) => Promise<void>
}

export const screens: Screen[] = [
  {
    name: 'home',
    path: '/',
    mockup: { desktop: 'Layout2', mobile: 'MobileGantt' },
  },
  // Phase 2+ examples (uncomment/adjust as pages land):
  // { name: 'projects', path: '/', mockup: {} },
  // { name: 'gantt', path: '/p/demo/gantt', mockup: { desktop: 'GanttBuffer', mobile: 'MobileGantt' } },
  // { name: 'gantt-task-panel', path: '/p/demo/gantt?task=t_02', mockup: { desktop: 'Layout3', mobile: 'MobileTaskSheet' } },
  // { name: 'settings', path: '/p/demo/settings', mockup: { desktop: 'SettingsDesktop', mobile: 'SettingsMobile' } },
  // { name: 'calendar', path: '/p/demo/calendar', mockup: { mobile: 'MobileCalendar' } },
]

/** Mockup artboards rendered for side-by-side reference (design/*.dc.html). */
export const mockups = [
  'Layout2',
  'Layout3',
  'GanttBuffer',
  'SettingsDesktop',
  'SettingsMobile',
  'MobileGantt',
  'MobileTaskSheet',
  'MobileCalendar',
]

/** Wait until web fonts (Kanit) and pending network/animations settle. */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(() => document.fonts.ready)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(150)
}
