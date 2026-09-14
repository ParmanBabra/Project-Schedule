import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { ProjectsPage } from './ProjectsPage'
import type { ProjectListItem } from './types'

const sample: ProjectListItem[] = [
  {
    id: 'prj_a',
    name: 'ระบบจองห้องประชุม',
    startDate: '2026-09-14',
    plannedEnd: '2026-10-06',
    committedEnd: '2026-10-19',
    progress: 32,
    taskCount: 7,
    criticalCount: 4,
    updatedAt: '2026-09-14T10:00:00Z',
  },
  {
    id: 'prj_b',
    name: 'ย้ายสำนักงาน',
    startDate: '2026-11-02',
    plannedEnd: null,
    committedEnd: null,
    progress: 0,
    taskCount: 0,
    criticalCount: 0,
    updatedAt: '2026-09-13T10:00:00Z',
  },
]

function mockFetch(handlers: Record<string, (init?: RequestInit) => unknown | Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const key = `${init?.method ?? 'GET'} ${url.replace(/^\/api/, '')}`
      const handler = handlers[key]
      if (!handler) return new Response('not found', { status: 404 })
      const out = handler(init)
      return out instanceof Response ? out : new Response(JSON.stringify(out), { status: 200 })
    }),
  )
}

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}

describe('ProjectsPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders cards with computed summary and Thai dates', async () => {
    mockFetch({ 'GET /projects': () => sample })
    renderWithProviders(<ProjectsPage />)
    const card = (await screen.findAllByTestId('project-card'))[0]
    expect(within(card).getByRole('link', { name: 'ระบบจองห้องประชุม' })).toHaveAttribute('href', '/p/prj_a/gantt')
    expect(within(card).getByText('14 ก.ย. – 6 ต.ค. 2569')).toBeInTheDocument()
    expect(within(card).getByText('สัญญาส่ง 19 ต.ค.')).toBeInTheDocument()
    expect(within(card).getByText('Critical 4')).toBeInTheDocument()
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '32')
    expect(screen.getByText(/ยังไม่มีงาน/)).toBeInTheDocument()
  })

  it('filters by search and status', async () => {
    mockFetch({ 'GET /projects': () => sample })
    renderWithProviders(<ProjectsPage />)
    await screen.findAllByTestId('project-card')
    await userEvent.type(screen.getByRole('textbox', { name: 'ค้นหาโปรเจกต์' }), 'ย้าย')
    expect(screen.getAllByTestId('project-card')).toHaveLength(1)
    await userEvent.clear(screen.getByRole('textbox', { name: 'ค้นหาโปรเจกต์' }))
    await userEvent.click(screen.getByRole('radio', { name: 'เสร็จแล้ว' }))
    expect(screen.getByText('ไม่พบโปรเจกต์ที่ตรงกับตัวกรอง')).toBeInTheDocument()
  })

  it('shows the empty state when there are no projects', async () => {
    mockFetch({ 'GET /projects': () => [] })
    renderWithProviders(<ProjectsPage />)
    expect(await screen.findByText('ยังไม่มีโปรเจกต์')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'สร้างโปรเจกต์' })).toBeInTheDocument()
  })

  it('creates a project and navigates to its Gantt', async () => {
    const created = { id: 'prj_new', name: 'โปรเจกต์ทดสอบ', schedule: { tasks: {}, summary: {}, buffer: {} } }
    const post = vi.fn(() => created)
    mockFetch({ 'GET /projects': () => [], 'POST /projects': post })
    renderWithProviders(
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/p/:projectId/gantt" element={<LocationProbe />} />
      </Routes>,
    )
    await userEvent.click(await screen.findByRole('button', { name: 'โปรเจกต์ใหม่' }))
    const dialog = screen.getByRole('dialog', { name: 'โปรเจกต์ใหม่' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'สร้างโปรเจกต์' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('กรุณาตั้งชื่อโปรเจกต์')
    await userEvent.type(within(dialog).getByLabelText('ชื่อโปรเจกต์'), 'โปรเจกต์ทดสอบ')
    await userEvent.click(within(dialog).getByRole('button', { name: 'ส' })) // add Saturday
    await userEvent.click(within(dialog).getByRole('button', { name: 'สร้างโปรเจกต์' }))
    expect(await screen.findByTestId('location')).toHaveTextContent('/p/prj_new/gantt')
    const body = JSON.parse((post.mock.calls[0] as unknown as [RequestInit])[0].body as string)
    expect(body).toMatchObject({ name: 'โปรเจกต์ทดสอบ', workingDays: [1, 2, 3, 4, 5, 6] })
  })

  it('deletes a project after confirmation', async () => {
    const del = vi.fn(() => new Response(null, { status: 204 }))
    let list = sample
    mockFetch({ 'GET /projects': () => list, 'DELETE /projects/prj_b': del })
    renderWithProviders(<ProjectsPage />)
    await screen.findAllByTestId('project-card')
    await userEvent.click(screen.getByRole('button', { name: 'ตัวเลือกของ ย้ายสำนักงาน' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'ลบโปรเจกต์' }))
    list = [sample[0]]
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ลบโปรเจกต์' }))
    expect(del).toHaveBeenCalled()
    expect(await screen.findByText('ลบ "ย้ายสำนักงาน" แล้ว')).toBeInTheDocument()
  })
})
