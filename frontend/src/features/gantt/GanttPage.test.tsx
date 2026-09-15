import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, sampleProject } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'
import { GanttPage } from './GanttPage'

function renderGantt(route = '/p/prj_sample/gantt') {
  return renderWithProviders(
    <Routes>
      <Route path="/p/:projectId/gantt" element={<GanttPage />} />
    </Routes>,
    { route },
  )
}

describe('GanttPage', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    })
    Element.prototype.scrollTo = vi.fn()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('renders rows, critical bars, dependency arrows and buffer row', async () => {
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'GET /projects/prj_sample': () => sampleProject() })))
    renderGantt()
    expect(await screen.findByTestId('task-row-t1')).toHaveTextContent('รวบรวมความต้องการ')
    expect(screen.getByTestId('chip-critical')).toHaveTextContent('Critical 4 งาน')
    expect(screen.getByTestId('chip-dates')).toHaveTextContent('เสร็จตามแผน 6 ต.ค. · สัญญาส่ง 19 ต.ค.')
    expect(screen.getByTestId('bar-t2')).toHaveAttribute('data-critical', 'true')
    expect(screen.getByTestId('bar-t3')).not.toHaveAttribute('data-critical')
    expect(screen.getAllByTestId(/^dep-d\d+$/)).toHaveLength(6)
    expect(screen.getByTestId('buffer-bar')).toHaveAttribute('title', 'เผื่อ 9 วัน')
    expect(screen.getByText('สำรองเวลาโครงการ')).toBeInTheDocument()
  })

  it('marks the buffer chip as locked once a baseline exists and explains why', async () => {
    const p = sampleProject()
    p.baseline = { savedAt: '2026-09-15T04:31:25Z', plannedEnd: '2026-10-28', chainDays: 42, bufferDays: 21, tasks: {} }
    p.schedule.buffer.days = 21
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'GET /projects/prj_sample': () => p })))
    renderGantt()
    const chip = await screen.findByTestId('chip-buffer')
    expect(chip).toHaveTextContent('เผื่อ 21 วัน')
    expect(within(chip).getByLabelText('ล็อกที่ baseline')).toBeInTheDocument()
    expect(chip.getAttribute('title')).toContain('ตอนนั้น 42 วัน ตอนนี้ 17 วัน')
  })

  it('selecting a bar writes ?task= and highlights the row', async () => {
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'GET /projects/prj_sample': () => sampleProject() })))
    renderGantt()
    await userEvent.click(await screen.findByTestId('bar-t4'))
    expect(screen.getByTestId('task-row-t4')).toHaveAttribute('aria-current', 'true')
  })

  it('shows the empty state and adds the first task', async () => {
    const empty = { ...sampleProject(), tasks: [], dependencies: [], schedule: { ...sampleProject().schedule, tasks: {}, criticalPath: [], summary: { ...sampleProject().schedule.summary, taskCount: 0, criticalCount: 0, plannedEnd: null, committedEnd: null }, buffer: { ...sampleProject().schedule.buffer, days: 0, end: null } } }
    const afterAdd = sampleProject()
    afterAdd.tasks = [afterAdd.tasks[0]]
    afterAdd.dependencies = []
    afterAdd.schedule = { ...afterAdd.schedule, tasks: { t1: afterAdd.schedule.tasks.t1 }, criticalPath: ['t1'] }
    const post = vi.fn(() => afterAdd)
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'GET /projects/prj_sample': () => empty, 'POST /projects/prj_sample/tasks': post })))
    renderGantt()
    expect(await screen.findByText('เริ่มด้วยการเพิ่มงานแรก')).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'เพิ่มงาน' })[0])
    const dialog = screen.getByRole('dialog', { name: 'เพิ่มงาน' })
    expect(within(dialog).getByPlaceholderText('ถ้าราบรื่น กี่วัน')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('ชื่องาน'), 'รวบรวมความต้องการ')
    await userEvent.clear(within(dialog).getByLabelText('ระยะเวลา'))
    await userEvent.type(within(dialog).getByLabelText('ระยะเวลา'), '3')
    await userEvent.click(within(dialog).getByRole('button', { name: 'เพิ่มงาน' }))
    const body = JSON.parse((post.mock.calls[0] as unknown as [RequestInit])[0].body as string)
    expect(body).toMatchObject({ name: 'รวบรวมความต้องการ', duration: 3, isMilestone: false, parentId: null })
    expect(await screen.findByTestId('task-row-t1')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('task-row-t1')).toHaveAttribute('aria-current', 'true'))
  })

  it('collapses a group and hides its children', async () => {
    const p = sampleProject()
    p.tasks.push({ id: 'g', name: 'พัฒนา', duration: 0, progress: 0, isMilestone: false, constraint: null, color: null, parentId: null, collapsed: false, order: 3.5, estimate: null, checklist: [], progressFromChecklist: true, epic: null })
    p.tasks.find((t) => t.id === 't4')!.parentId = 'g'
    p.tasks.find((t) => t.id === 't5')!.parentId = 'g'
    p.schedule.tasks.g = { ...p.schedule.tasks.t4, id: 'g', wbs: '4', isSummary: true, start: '2026-09-23', end: '2026-10-01' }
    const collapsed = structuredClone(p)
    collapsed.tasks.find((t) => t.id === 'g')!.collapsed = true
    const patch = vi.fn(() => collapsed)
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'GET /projects/prj_sample': () => p, 'PATCH /projects/prj_sample/tasks/g': patch })))
    renderGantt()
    expect(await screen.findByTestId('task-row-t4')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'ยุบกลุ่ม' }))
    expect(JSON.parse((patch.mock.calls[0] as unknown as [RequestInit])[0].body as string)).toEqual({ collapsed: true })
    expect(await screen.findByRole('button', { name: 'ขยายกลุ่ม' })).toBeInTheDocument()
    expect(screen.queryByTestId('task-row-t4')).not.toBeInTheDocument()
  })
})
