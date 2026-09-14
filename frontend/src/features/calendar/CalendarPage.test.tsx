import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, sampleProject } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'
import { CalendarPage } from './CalendarPage'

const resources = [
  { id: 'r1', name: 'สมชาย', type: 'person', capacityPerDay: 100, color: '#6a4fd8', daysOff: [], assignmentCount: 1, projectCount: 1 },
  { id: 'r2', name: 'สุดา', type: 'person', capacityPerDay: 100, color: '#e0457b', daysOff: [], assignmentCount: 2, projectCount: 1 },
]

function project() {
  const p = sampleProject()
  p.assignments = [
    { id: 'a1', taskId: 't2', resourceId: 'r1', units: 100 },
    { id: 'a2', taskId: 't3', resourceId: 'r2', units: 100 },
    { id: 'a3', taskId: 't5', resourceId: 'r2', units: 100 },
  ]
  return p
}

const workload = {
  from: '2026-08-31',
  to: '2026-10-11',
  threshold: 100,
  resources: [],
  overallocations: [{ resourceId: 'r2', resourceName: 'สุดา', date: '2026-09-22', load: 200, capacity: 100, items: [] }],
}

function renderCal() {
  return renderWithProviders(
    <Routes>
      <Route path="/p/:projectId/calendar" element={<CalendarPage />} />
    </Routes>,
    { route: '/p/prj_sample/calendar' },
  )
}

describe('CalendarPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-09-16T03:00:00Z') })
    Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('renders the month with spanning chips, an overload badge and a resource filter', async () => {
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'GET /projects/prj_sample': project, 'GET /resources': () => resources, 'GET /resources/workload': () => workload })))
    renderCal()
    expect(await screen.findByTestId('calendar-title')).toHaveTextContent('กันยายน 2569')
    expect(screen.getByTestId('month-view')).toBeInTheDocument()
    // t2 (17–23 Sep) spans two weeks -> two chips
    expect(screen.getAllByTestId('cal-chip-t2')).toHaveLength(2)
    expect(await screen.findByTestId('over-2026-09-22')).toHaveTextContent('1')
    expect(screen.getByTestId('cal-over-chip')).toHaveTextContent('เกินกำลัง 1 คน')

    await userEvent.click(await screen.findByRole('button', { name: 'สุดา' }))
    expect(screen.queryByTestId('cal-chip-t2')).not.toBeInTheDocument() // สมชาย's task hidden
    expect(screen.getAllByTestId('cal-chip-t3').length).toBeGreaterThan(0)
  })

  it('switches to the week-by-resource view and navigates weeks', async () => {
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'GET /projects/prj_sample': project, 'GET /resources': () => resources, 'GET /resources/workload': () => workload })))
    renderCal()
    await screen.findByTestId('month-view')
    await userEvent.click(screen.getByRole('radio', { name: 'สัปดาห์' }))
    expect(screen.getByTestId('calendar-title')).toHaveTextContent('14 ก.ย. – 20 ก.ย. 2569')
    const rowSuda = await screen.findByTestId('week-row-r2')
    expect(within(rowSuda).getAllByTestId('week-chip-r2-t3').length).toBeGreaterThan(0)
    expect(screen.getByTestId('week-row-none')).toHaveTextContent('รวบรวมความต้องการ') // unassigned t1
    await userEvent.click(screen.getByRole('button', { name: 'ช่วงถัดไป' }))
    expect(screen.getByTestId('calendar-title')).toHaveTextContent('21 ก.ย. – 27 ก.ย. 2569')
    await waitFor(() => expect(within(screen.getByTestId('week-row-r2')).getByText('200%')).toBeInTheDocument())
  })

  it('clicking a chip opens the task panel', async () => {
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'GET /projects/prj_sample': project, 'GET /resources': () => resources, 'GET /resources/workload': () => workload })))
    renderCal()
    await userEvent.click((await screen.findAllByTestId('cal-chip-t4'))[0])
    await screen.findByTestId('task-panel')
    expect(screen.getByLabelText('ชื่องาน')).toHaveValue('พัฒนา Backend')
  })
})
