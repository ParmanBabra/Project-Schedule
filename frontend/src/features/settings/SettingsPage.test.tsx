import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, sampleProject } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'
import { SettingsPage } from './SettingsPage'

const defaults = {
  rules: sampleProject().rules,
  buffer: sampleProject().buffer,
  bufferMethods: [
    { id: 'ccpm', title: 'รวมเผื่อไว้ท้ายโครงการ', recommended: true, what: 'กรอกเวลาแบบไม่เผื่อ', fit: 'คุณตั้งใจกรอกเวลาแบบไม่เผื่อ', reference: 'Critical Chain (Goldratt)', options: {} },
    { id: 'percent', title: 'บวกเพิ่มตามความเสี่ยง', recommended: false, what: 'กรอกเวลาแบบปกติ', fit: 'คุณกรอกเวลาแบบที่คุ้นเคย', reference: 'PMBOK', options: {} },
    { id: 'pert', title: 'ประเมิน 3 ค่า', recommended: false, what: 'กรอก 3 ค่า', fit: 'งานไม่แน่นอน', reference: 'PERT', options: {} },
  ],
  ruleDescriptions: [
    { id: 'nearCriticalFloatDays', title: 'งานไหนนับเป็น critical', reference: 'CPM', options: [{ value: 0, label: 'เลื่อนไม่ได้เลย', help: 'งานที่เลื่อนแล้วโครงการเลื่อน' }, { value: 2, label: 'รวมงานที่เลื่อนได้ไม่เกิน N วัน' }] },
    { id: 'lagUnit', title: 'เวลารอ (lag) นับอย่างไร', reference: 'MS Project', options: [{ value: 'working', label: 'ข้ามวันหยุด' }, { value: 'calendar', label: 'นับทุกวันรวมวันหยุด' }] },
    { id: 'overallocationThreshold', title: 'เกณฑ์เกินกำลัง', reference: 'Resource', options: { min: 50, max: 200, step: 10, default: 100, unit: '%' } },
  ],
  managementReserve: { help: 'เวลาเผื่อสำหรับเรื่องที่คาดไม่ถึง', default: 5, unit: '%' },
}

function renderSettings(handlers: Record<string, (init?: RequestInit) => unknown | Response>) {
  vi.stubGlobal('fetch', vi.fn(mockFetch({ 'GET /settings/defaults': () => defaults, 'GET /projects/prj_sample': () => sampleProject(), ...handlers })))
  return renderWithProviders(
    <Routes>
      <Route path="/p/:projectId/settings" element={<SettingsPage />} />
    </Routes>,
    { route: '/p/prj_sample/settings' },
  )
}

describe('SettingsPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows buffer cards with a live example and lets the user switch method', async () => {
    const previewBody = { ...sampleProject().schedule, buffer: { ...sampleProject().schedule.buffer, method: 'percent', days: 3, end: '2026-10-09' }, summary: { ...sampleProject().schedule.summary, committedEnd: '2026-10-09' } }
    const patchBuffer = vi.fn(() => ({ ...sampleProject(), buffer: { ...sampleProject().buffer, method: 'percent' } }))
    renderSettings({ 'POST /projects/prj_sample/schedule/preview': () => previewBody, 'PATCH /projects/prj_sample/buffer': patchBuffer })
    const ccpm = await screen.findByTestId('buffer-ccpm')
    expect(ccpm).toHaveAttribute('aria-pressed', 'true')
    expect(within(ccpm).getByText('แนะนำ')).toBeInTheDocument()
    expect(screen.getByTestId('buffer-example-ccpm')).toHaveTextContent('สายงานหลัก 17 วัน × 50% → เผื่อ 9 วัน → สัญญาส่ง 19 ต.ค. 2569')
    await waitFor(() => expect(screen.getByTestId('buffer-example-percent')).toHaveTextContent('เผื่อ 3 วัน'))
    await userEvent.click(screen.getByTestId('buffer-percent'))
    await waitFor(() => expect(patchBuffer).toHaveBeenCalled())
    expect(JSON.parse((patchBuffer.mock.calls[0] as unknown as [RequestInit])[0].body as string)).toMatchObject({ method: 'percent', ccpmRatio: 50 })
  })

  it('asks before switching back to ccpm when tasks were estimated with padding', async () => {
    const p = { ...sampleProject(), buffer: { ...sampleProject().buffer, method: 'percent' as const } }
    const patchBuffer = vi.fn(() => sampleProject())
    const patchTask = vi.fn(() => sampleProject())
    vi.stubGlobal(
      'fetch',
      vi.fn(
        mockFetch({
          'GET /settings/defaults': () => defaults,
          'GET /projects/prj_sample': () => p,
          'POST /projects/prj_sample/schedule/preview': () => p.schedule,
          'PATCH /projects/prj_sample/buffer': patchBuffer,
          ...Object.fromEntries(p.tasks.map((t) => [`PATCH /projects/prj_sample/tasks/${t.id}`, patchTask])),
        }),
      ),
    )
    renderWithProviders(
      <Routes>
        <Route path="/p/:projectId/settings" element={<SettingsPage />} />
      </Routes>,
      { route: '/p/prj_sample/settings' },
    )
    await userEvent.click(await screen.findByTestId('buffer-ccpm'))
    const dialog = screen.getByRole('dialog', { name: 'เปลี่ยนเป็นรวมเผื่อไว้ท้ายโครงการ' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'มีเผื่ออยู่ ช่วยลดให้ 20%' }))
    await waitFor(() => expect(patchBuffer).toHaveBeenCalled())
    expect(patchTask).toHaveBeenCalledTimes(6)
    expect(JSON.parse((patchTask.mock.calls[0] as unknown as [RequestInit])[0].body as string)).toEqual({ duration: 3 }) // ceil(3 * 0.8)
  })

  it('updates rules with an undo toast and manages holidays', async () => {
    const patchRules = vi.fn(() => ({ ...sampleProject(), rules: { ...sampleProject().rules, lagUnit: 'calendar' } }))
    const patchProject = vi.fn(() => ({ ...sampleProject(), holidays: ['2026-10-13'] }))
    renderSettings({ 'POST /projects/prj_sample/schedule/preview': () => sampleProject().schedule, 'PATCH /projects/prj_sample/rules': patchRules, 'PATCH /projects/prj_sample': patchProject })
    const lag = await screen.findByTestId('rule-lagUnit')
    await userEvent.click(within(lag).getByRole('radio', { name: 'นับทุกวันรวมวันหยุด' }))
    await waitFor(() => expect(patchRules).toHaveBeenCalled())
    expect(JSON.parse((patchRules.mock.calls[0] as unknown as [RequestInit])[0].body as string)).toMatchObject({ lagUnit: 'calendar', nearCriticalFloatDays: 0 })
    expect(await screen.findByText('ปรับกติกาแล้ว')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'เลิกทำ' }))
    await waitFor(() => expect(patchRules).toHaveBeenCalledTimes(2))
    expect(JSON.parse((patchRules.mock.calls[1] as unknown as [RequestInit])[0].body as string)).toMatchObject({ lagUnit: 'working' })

    await userEvent.click(screen.getByRole('button', { name: 'วันหยุดใหม่' }))
    const picker = screen.getByTestId('date-picker')
    while ((await within(picker).findByRole('grid')).getAttribute('aria-label') !== 'ตุลาคม 2569') {
      await userEvent.click(within(picker).getByRole('button', { name: 'เดือนถัดไป' }))
    }
    await userEvent.click(within(picker).getByTestId('day-2026-10-13'))
    await userEvent.click(screen.getByRole('button', { name: 'เพิ่มวันหยุด' }))
    await waitFor(() => expect(patchProject).toHaveBeenCalled())
    expect(JSON.parse((patchProject.mock.calls[0] as unknown as [RequestInit])[0].body as string)).toEqual({ holidays: ['2026-10-13'] })
    expect(await screen.findByRole('button', { name: 'ลบวันหยุด 13 ต.ค. 2569' })).toBeInTheDocument()
  })
})
