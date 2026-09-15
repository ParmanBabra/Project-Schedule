import { test, expect } from '@playwright/test'
import { seedSampleProject } from '../shots/seed'

test('งานย่อย: เพิ่ม ติ๊ก แก้ ลบ แล้ว % ของงานตามงานย่อย', async ({ page, request }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E งานย่อย ${testInfo.project.name} ${Date.now()}`)
  await page.goto(`/p/${pid}/gantt`)
  await page.getByRole('button', { name: /^พัฒนา Backend/ }).first().click()
  const panel = page.getByRole('complementary', { name: /^รายละเอียดงาน/ })
  await expect(panel).toBeVisible()

  const add = panel.getByLabel('เพิ่มงานย่อย')
  await add.fill('เขียน spec')
  await add.press('Enter')
  await add.fill('ทำหน้าจอ')
  await add.press('Enter')
  await add.fill('ทดสอบ')
  await add.press('Enter')
  await expect(panel.getByTestId('checklist-count')).toHaveText('เสร็จ 0 / 3')
  await expect(panel.getByLabel('ความคืบหน้า', { exact: true })).toHaveValue('0')

  await panel.getByRole('checkbox', { name: 'ทำเสร็จ เขียน spec' }).click()
  await expect(panel.getByTestId('checklist-count')).toHaveText('เสร็จ 1 / 3')
  await expect(panel.getByLabel('ความคืบหน้า', { exact: true })).toHaveValue('33')
  await expect(panel.getByLabel('ความคืบหน้า', { exact: true })).toHaveAttribute('readonly', '')

  // rename and delete
  const second = panel.getByLabel('ข้อความงานย่อย 2')
  await second.fill('ทำหน้าจอสแกน')
  await second.press('Enter')
  await expect(panel.getByRole('checkbox', { name: 'ทำเสร็จ ทำหน้าจอสแกน' })).toBeVisible()
  await panel.getByRole('button', { name: 'ลบงานย่อย ทดสอบ' }).click()
  await expect(panel.getByTestId('checklist-count')).toHaveText('เสร็จ 1 / 2')
  await expect(panel.getByLabel('ความคืบหน้า', { exact: true })).toHaveValue('50')

  // switch off -> manual again
  await panel.getByText('คิด % ความคืบหน้าจากงานย่อย').click()
  const pct = panel.getByLabel('ความคืบหน้า', { exact: true })
  await expect(pct).not.toHaveAttribute('readonly', '')
  await pct.fill('80')
  await pct.press('Tab')
  await expect(page.getByLabel('ความคืบหน้า', { exact: true })).toHaveValue('80')
  await page.keyboard.press('Escape')
  await page.reload()
  await page.getByRole('button', { name: /^พัฒนา Backend/ }).first().click()
  await expect(page.getByLabel('ความคืบหน้า', { exact: true })).toHaveValue('80')
  await expect(page.getByTestId('checklist-count')).toHaveText('เสร็จ 1 / 2')
})

test('สร้างงานต่อจากงานนี้: เลือกขั้นตอน คู่ขนาน รวมกลุ่ม แล้วได้โซ่งานใน Gantt', async ({ page, request }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E โซ่งาน ${testInfo.project.name} ${Date.now()}`)
  await page.goto(`/p/${pid}/gantt`)
  await page.getByRole('button', { name: /^ทดสอบระบบ/ }).first().click()
  await page.getByTestId('open-chain').click()
  const dialog = page.getByRole('dialog', { name: 'สร้างงานต่อจาก "ทดสอบระบบ"' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByTestId('chain-submit')).toHaveText(/สร้าง 5 งาน/)
  await expect(dialog.getByTestId('chain-preview')).toContainText('โปรเจกต์จะเสร็จ')

  // drop Deploy, keep FE/BE parallel (default), group on (default)
  await dialog.getByRole('checkbox', { name: 'ใช้ขั้นตอน Deploy' }).click()
  await expect(dialog.getByTestId('chain-submit')).toHaveText(/สร้าง 4 งาน/)
  await dialog.getByTestId('chain-submit').click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText(/สร้าง 4 งานต่อจาก "ทดสอบระบบ" แล้ว/)).toBeVisible()

  // a new group holds the source + 4 steps; FE and BE start on the same day
  await expect(page.getByRole('button', { name: /^ทดสอบระบบ – ออกแบบ UI/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'กลุ่ม ทดสอบระบบ' })).toBeVisible()
  const project = await (await request.get(`/api/projects/${pid}`)).json()
  const byName = Object.fromEntries(project.tasks.map((t: { name: string; id: string; parentId: string | null }) => [t.name, t]))
  const fe = project.schedule.tasks[byName['ทดสอบระบบ – พัฒนา Frontend'].id]
  const be = project.schedule.tasks[byName['ทดสอบระบบ – พัฒนา Backend'].id]
  expect(fe.start).toBe(be.start)
  const groupId = byName['ทดสอบระบบ – ทดสอบ'].parentId as string | null
  expect(groupId).not.toBeNull()
  const groupTask = project.tasks.find((t: { id: string }) => t.id === groupId)
  expect(groupTask.name).toBe('ทดสอบระบบ')
  expect(groupTask.parentId).toBeNull()
  expect(byName['ทดสอบระบบ'].parentId ?? groupTask.id).toBe(groupTask.id) // byName picked one of the two; the source is inside the group
  expect(project.tasks.filter((t: { parentId: string | null }) => t.parentId === groupTask.id)).toHaveLength(5)
  expect(project.schedule.tasks[groupTask.id].isSummary).toBe(true)
  expect(project.chainTemplates.map((s: { name: string }) => s.name)).toContain('Deploy')
  // the original successor keeps its link to the source task
  const sourceId = project.tasks.find((t: { name: string; parentId: string | null }) => t.name === 'ทดสอบระบบ' && t.parentId === groupTask.id).id
  expect(project.dependencies.some((d: { from: string; to: string }) => d.from === sourceId && d.to === byName['ส่งมอบ'].id)).toBeTruthy()

  // reopening the dialog on another task starts from the remembered rows (Deploy unticked)
  await page.keyboard.press('Escape') // close the panel (on mobile it covers the list)
  await expect(page.getByRole('complementary', { name: /^รายละเอียดงาน/ })).toHaveCount(0)
  await page.getByRole('button', { name: /^รวบรวมความต้องการ/ }).first().click()
  await page.getByTestId('open-chain').click()
  await expect(page.getByRole('checkbox', { name: 'ใช้ขั้นตอน Deploy' })).toHaveAttribute('aria-checked', 'false')
})
