import type { APIRequestContext, Page } from '@playwright/test'
import { seedSampleProject } from './seed'

/**
 * Registry of every screen/state that design review and visual regression cover.
 * Add an entry whenever a new page or a meaningful UI state is built.
 *
 * `path` may be a function that seeds data through the API and returns the URL.
 * `setup` runs after navigation and before the screenshot (open a panel, hover a bar…).
 * `mockup` names the design artboard (design/<mockup>.dc.html) to compare against, if one exists.
 */
export interface Screen {
  name: string
  path: string | ((request: APIRequestContext) => Promise<string>)
  viewports?: Array<'desktop' | 'mobile'>
  mockup?: { desktop?: string; mobile?: string }
  setup?: (page: Page) => Promise<void>
}

const gantt = async (request: APIRequestContext) => `/p/${await seedSampleProject(request)}/gantt`

export const screens: Screen[] = [
  { name: 'projects', path: '/', mockup: {} },
  { name: 'projects-create', path: '/', setup: async (page) => { await page.getByRole('button', { name: 'โปรเจกต์ใหม่' }).click() } },
  { name: 'gantt', path: gantt, mockup: { desktop: 'GanttBuffer', mobile: 'MobileGantt' } },
  { name: 'gantt-week', path: gantt, viewports: ['desktop'], setup: async (page) => { await page.getByRole('radio', { name: 'สัปดาห์' }).click() } },
  { name: 'gantt-add-task', path: gantt, setup: async (page) => { await page.getByRole('button', { name: 'เพิ่มงาน' }).first().click() } },
  {
    name: 'gantt-task-panel',
    path: gantt,
    mockup: { desktop: 'Layout3', mobile: 'MobileTaskSheet' },
    setup: async (page) => { await page.getByRole('button', { name: /^ออกแบบระบบ/ }).first().click() },
  },
  { name: 'gantt-task-list', path: gantt, setup: async (page) => { await page.getByRole('button', { name: 'รายการงาน' }).click() } },
  { name: 'settings', path: async (r) => `/p/${await seedSampleProject(r)}/settings`, mockup: { desktop: 'SettingsDesktop', mobile: 'SettingsMobile' } },
  { name: 'ui-kit', path: '/dev/ui', viewports: ['desktop'] },
]

/** Mockup artboards rendered for side-by-side reference (design/*.dc.html). */
export const mockups = ['Layout2', 'Layout3', 'GanttBuffer', 'SettingsDesktop', 'SettingsMobile', 'MobileGantt', 'MobileTaskSheet', 'MobileCalendar']

export async function resolvePath(screen: Screen, request: APIRequestContext): Promise<string> {
  return typeof screen.path === 'string' ? screen.path : screen.path(request)
}

/** Wait until web fonts (Kanit) and pending network/animations settle. */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.evaluate(() => document.fonts.ready)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.waitForTimeout(150)
}
