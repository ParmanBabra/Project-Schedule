import type { APIRequestContext, Page } from '@playwright/test'
import { seedResources, seedSampleProject } from './seed'

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
  /** render without the shared login session (login page itself) */
  noAuth?: boolean
}

const gantt = async (request: APIRequestContext) => `/p/${await seedSampleProject(request)}/gantt`
// a second sample so checklist edits never touch the shared one (other baselines stay stable)
const ganttTasks = async (request: APIRequestContext) => `/p/${await seedSampleProject(request, 'ระบบจองห้องประชุม (งานย่อย)', { assignments: false })}/gantt`

export const screens: Screen[] = [
  { name: 'login', path: '/login', noAuth: true },
  { name: 'login-error', path: '/login', noAuth: true, setup: async (page) => { await page.getByLabel('ชื่อผู้ใช้').fill('admin'); await page.getByLabel('รหัสผ่าน').fill('x'); await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click(); await page.getByRole('alert').waitFor() } },
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
  { name: 'gantt-export', path: gantt, viewports: ['desktop'], setup: async (page) => { await page.getByRole('button', { name: 'ส่งออก' }).click() } },
  {
    name: 'gantt-task-checklist',
    path: ganttTasks,
    mockup: { desktop: 'TaskChecklist', mobile: 'MobileChecklist' },
    setup: async (page) => {
      await page.getByRole('button', { name: /^พัฒนา Backend/ }).first().click()
      await page.getByTestId('checklist').waitFor()
      // deterministic: the sample is reused across runs, so start from an empty list
      while ((await page.getByRole('button', { name: /^ลบงานย่อย/ }).count()) > 0) {
        await page.getByRole('button', { name: /^ลบงานย่อย/ }).first().click()
        await page.waitForTimeout(150)
      }
      {
        const add = page.getByLabel('เพิ่มงานย่อย')
        for (const t of ['เขียน spec หน้าจอ', 'ตกลง API กับ Backend', 'ทำหน้าจอสแกน barcode', 'เชื่อม API บันทึกตำแหน่ง']) {
          await add.fill(t)
          await add.press('Enter')
          await page.getByRole('checkbox', { name: `ทำเสร็จ ${t}` }).waitFor()
        }
        await page.getByRole('checkbox', { name: 'ทำเสร็จ เขียน spec หน้าจอ' }).click()
        await page.getByRole('checkbox', { name: 'ทำเสร็จ ตกลง API กับ Backend' }).click()
        await page.getByTestId('checklist-count').getByText('เสร็จ 2 / 4').waitFor()
      }
      await page.getByTestId('checklist').scrollIntoViewIfNeeded()
    },
  },
  {
    name: 'gantt-chain-dialog',
    path: ganttTasks,
    mockup: { desktop: 'ChainDialog', mobile: 'MobileChain' },
    setup: async (page) => {
      await page.getByRole('button', { name: /^ทดสอบระบบ/ }).first().click()
      await page.getByTestId('open-chain').click()
      await page.getByTestId('chain-preview').getByText(/โปรเจกต์จะเสร็จ/).waitFor()
    },
  },
  { name: 'gantt-task-list', path: gantt, setup: async (page) => { await page.getByRole('button', { name: 'รายการงาน' }).click() } },
  {
    name: 'gantt-dragging',
    path: gantt,
    viewports: ['desktop'],
    setup: async (page) => {
      const bar = page.locator('[data-testid^="bar-"]').filter({ hasText: 'พัฒนา Backend' })
      const box = (await bar.boundingBox())!
      await page.mouse.move(box.x + 20, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + 20 + 5 * 36, box.y + box.height / 2, { steps: 6 })
      await page.waitForTimeout(400)
    },
  },
  {
    name: 'gantt-dep-popover',
    path: gantt,
    viewports: ['desktop'],
    setup: async (page) => { await page.locator('[data-testid^="dep-hit-"]').last().click({ force: true }) },
  },
  { name: 'settings', path: async (r) => `/p/${await seedSampleProject(r)}/settings`, mockup: { desktop: 'SettingsDesktop', mobile: 'SettingsMobile' } },
  {
    name: 'settings-datepicker',
    path: async (r) => `/p/${await seedSampleProject(r)}/settings`,
    setup: async (page) => { await page.getByLabel('วันหยุดใหม่').click(); await page.getByTestId('date-picker').waitFor() },
  },
  { name: 'resources', path: async (r) => { await seedSampleProject(r); await seedResources(r); return '/resources' } },
  { name: 'resources-edit', path: async (r) => { await seedSampleProject(r); return '/resources' }, setup: async (page) => { await page.getByRole('button', { name: 'ตัวเลือกของ สุดา' }).click(); await page.getByRole('menuitem', { name: 'แก้ไข' }).click() } },
  { name: 'calendar', path: async (r) => `/p/${await seedSampleProject(r)}/calendar`, mockup: { mobile: 'MobileCalendar' } },
  {
    name: 'calendar-week',
    path: async (r) => `/p/${await seedSampleProject(r)}/calendar`,
    viewports: ['desktop'],
    setup: async (page) => { await page.getByRole('radio', { name: 'สัปดาห์' }).click() },
  },
  { name: 'ui-kit', path: '/dev/ui', viewports: ['desktop'] },
]

/** Mockup artboards rendered for side-by-side reference (design/*.dc.html). */
export const mockups = ['Layout2', 'Layout3', 'GanttBuffer', 'SettingsDesktop', 'SettingsMobile', 'MobileGantt', 'MobileTaskSheet', 'MobileCalendar', 'TaskChecklist', 'ChainDialog', 'MobileChecklist', 'MobileChain', 'TopicEntry', 'TopicDialog', 'TopicPaste', 'MobileTopic']

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
