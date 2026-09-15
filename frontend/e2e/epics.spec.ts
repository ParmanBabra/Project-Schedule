import { test, expect } from '@playwright/test'
import { seedSampleProject } from '../shots/seed'

test('Epic: สร้างจากงานที่มีอยู่ (โหมดเลือก) → สี/ป้ายบน Gantt → แผง Epic → หน้า Epics → กรอง', async ({ page, request, isMobile }, testInfo) => {
  const pid = await seedSampleProject(request, `E2E Epic ${testInfo.project.name} ${Date.now()}`)
  await page.goto(`/p/${pid}/gantt`)
  await expect(page.getByTestId('chip-critical')).toBeVisible()

  if (!isMobile) {
    // selection mode -> "รวมเป็น Epic" with พัฒนา Backend + พัฒนา Frontend
    await page.getByRole('button', { name: 'เลือกหลายงาน' }).click()
    await page.getByRole('checkbox', { name: 'เลือก พัฒนา Backend' }).check()
    await page.getByRole('checkbox', { name: 'เลือก พัฒนา Frontend' }).check()
    await expect(page.getByTestId('selection-bar')).toContainText('เลือก 2 งาน')
    await page.getByTestId('selection-bar').getByRole('button', { name: 'รวมเป็น Epic' }).click()
    const dlg = page.getByRole('dialog', { name: 'สร้าง Epic' })
    await expect(dlg.getByRole('checkbox', { name: /พัฒนา Backend/ })).toBeChecked()
    await dlg.getByLabel('ชื่อ Epic').fill('พัฒนาระบบ')
    await dlg.getByRole('radio', { name: '#1f9e89' }).click()
    await dlg.getByTestId('epic-submit').click()
    await expect(dlg).toHaveCount(0)
  } else {
    // mobile: create through the Epics page with existing tasks
    await page.goto(`/p/${pid}/epics`)
    await page.getByRole('button', { name: 'สร้าง Epic' }).first().click()
    const dlg = page.getByRole('dialog', { name: 'สร้าง Epic' })
    await dlg.getByLabel('ชื่อ Epic').fill('พัฒนาระบบ')
    await dlg.getByRole('radio', { name: '#1f9e89' }).click()
    await dlg.getByRole('radio', { name: 'เลือกจากงานที่มีอยู่' }).click()
    await dlg.getByRole('checkbox', { name: /พัฒนา Backend/ }).check()
    await dlg.getByRole('checkbox', { name: /พัฒนา Frontend/ }).check()
    await dlg.getByTestId('epic-submit').click()
    await expect(dlg).toHaveCount(0)
    await page.goto(`/p/${pid}/gantt`)
  }

  // Gantt: epic row with badge, members under it, bars coloured
  const project = await (await request.get(`/api/projects/${pid}`)).json()
  const epic = project.tasks.find((t: { epic: unknown; name: string }) => t.epic && t.name === 'พัฒนาระบบ')
  expect(epic.epic.color).toBe('#1f9e89')
  const be = project.tasks.find((t: { name: string }) => t.name === 'พัฒนา Backend')
  expect(be.parentId).toBe(epic.id)
  await expect(page.getByTestId(`epic-badge-${epic.id}`)).toBeVisible()
  const barColor = await page.locator(`[data-testid="bar-${be.id}"]`).evaluate((el) => getComputedStyle(el).backgroundColor)
  // critical highlight keeps Backend pink; turn it off to see the epic colour
  await page.getByText('Critical path', { exact: true }).first().click()
  const barColorOff = await page.locator(`[data-testid="bar-${be.id}"]`).evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(barColor).not.toBe(barColorOff)
  expect(barColorOff).toBe('rgb(31, 158, 137)')

  // Epic panel
  await page.getByRole('button', { name: /^พัฒนาระบบ/ }).first().click()
  const panel = page.getByTestId('epic-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByTestId('epic-stats')).toContainText('0 / 2')
  await expect(panel.getByTestId(`epic-member-${be.id}`)).toBeVisible()
  await panel.getByLabel('เป้าหมาย / คำอธิบาย').fill('สร้างระบบหลัก')
  await panel.getByRole('radio', { name: '#f28c28' }).click()
  await expect.poll(async () => (await (await request.get(`/api/projects/${pid}`)).json()).tasks.find((t: { id: string }) => t.id === epic.id).epic).toMatchObject({ color: '#f28c28', description: 'สร้างระบบหลัก' })
  await page.keyboard.press('Escape')

  // filter by epic -> only the epic and its members remain
  await page.getByLabel('กรองตาม Epic').selectOption(epic.id)
  await expect(page.getByRole('button', { name: /^รวบรวมความต้องการ/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^พัฒนา Frontend/ }).first()).toBeVisible()

  // Epics page shows the card with roll-up numbers
  await page.goto(`/p/${pid}/epics`)
  const card = page.getByTestId(`epic-card-${epic.id}`)
  await expect(card).toContainText('พัฒนาระบบ')
  await expect(card).toContainText('0/2')
  await expect(card).toContainText('ยังไม่เริ่ม')
})

test('Epic: วางจาก Excel สร้างหลาย Epic พร้อมงานย่อย', async ({ page, request, isMobile }, testInfo) => {
  test.skip(isMobile, 'เดสก์ท็อปพอ')
  const pid = await seedSampleProject(request, `E2E Epic วาง ${testInfo.project.name} ${Date.now()}`)
  await page.goto(`/p/${pid}/epics`)
  await page.getByRole('button', { name: 'สร้าง Epic' }).first().click()
  const dlg = page.getByRole('dialog', { name: 'สร้าง Epic' })
  await dlg.getByRole('radio', { name: 'วางจาก Excel / รายการ' }).click()
  await dlg.getByLabel('วางรายการ').fill(['3\tPicking list\tPicking list (3)', '\tPicking list\tPlant Route (Mobile) (5)', '\tPicking list\tConfirm', '4\tMaster (Juno)\tMaster Data', '\t\t- Create', '\t\t- Edit'].join('\n'))
  await expect(dlg.getByTestId('paste-preview')).toContainText('Picking list')
  await expect(dlg.getByTestId('epic-submit')).toHaveText(/สร้าง 2 Epic · 4 งาน/)
  await dlg.getByTestId('epic-submit').click()
  await expect(dlg).toHaveCount(0)
  await expect(page.getByTestId('epic-grid')).toContainText('Picking list')
  await expect(page.getByTestId('epic-grid')).toContainText('Master (Juno)')
  const project = await (await request.get(`/api/projects/${pid}`)).json()
  const md = project.tasks.find((t: { name: string }) => t.name === 'Master Data')
  expect(md.checklist.map((c: { text: string }) => c.text)).toEqual(['Create', 'Edit'])
  const pl = project.tasks.find((t: { name: string; epic: unknown }) => t.name === 'Picking list' && t.epic)
  expect(project.schedule.tasks[pl.id].duration).toBe(11) // 3 + 5 + 3 (default) sequential
})
