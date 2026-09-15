import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectOut } from '@/features/projects/types'
import { mockFetch, sampleProject } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'
import { CreateEpicDialog } from './CreateEpicDialog'
import { EpicsPage } from './EpicsPage'

function withEpic(): ProjectOut {
  const p = sampleProject()
  const g = p.tasks.find((t) => t.id === 't2')!
  g.epic = { color: '#e0457b', description: 'ออกแบบทั้งระบบ', ownerResourceId: null }
  p.tasks.find((t) => t.id === 't3')!.parentId = 't2'
  p.schedule.tasks.t2 = { ...p.schedule.tasks.t2, isSummary: true, progress: 40 }
  return p
}

describe('EpicsPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lists epic cards with roll-up numbers and filters by status', async () => {
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'GET /projects/prj_sample': () => withEpic(), 'GET /resources': () => [] })))
    renderWithProviders(
      <Routes>
        <Route path="/p/:projectId/epics" element={<EpicsPage />} />
      </Routes>,
      { route: '/p/prj_sample/epics' },
    )
    const card = await screen.findByTestId('epic-card-t2')
    expect(card).toHaveTextContent('ออกแบบระบบ')
    expect(card).toHaveTextContent('ออกแบบทั้งระบบ')
    expect(card).toHaveTextContent('กำลังทำ')
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40')
    expect(card).toHaveTextContent('งาน 0/1')
    expect(screen.getByRole('button', { name: /กำลังทำ 1/ })).toBeInTheDocument()
    expect(screen.getByText(/1 epics · 1 งาน/)).toBeInTheDocument()
  })

  it('shows the empty state with a create button', async () => {
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'GET /projects/prj_sample': () => sampleProject(), 'GET /resources': () => [] })))
    renderWithProviders(
      <Routes>
        <Route path="/p/:projectId/epics" element={<EpicsPage />} />
      </Routes>,
      { route: '/p/prj_sample/epics' },
    )
    expect(await screen.findByText('ยังไม่มี Epic')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'สร้าง Epic แรก' }))
    expect(screen.getByRole('dialog', { name: 'สร้าง Epic' })).toBeInTheDocument()
  })
})

describe('CreateEpicDialog', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('manual tab posts name, colour and rows; Enter adds a row', async () => {
    const post = vi.fn(() => sampleProject())
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'POST /projects/prj_sample/epics': post, 'GET /resources': () => [] })))
    const onClose = vi.fn()
    renderWithProviders(<CreateEpicDialog project={sampleProject()} open onClose={onClose} />)
    const dlg = screen.getByRole('dialog', { name: 'สร้าง Epic' })
    await userEvent.type(within(dlg).getByLabelText('ชื่อ Epic'), 'Picking list')
    await userEvent.click(within(dlg).getByRole('radio', { name: '#1f9e89' }))
    await userEvent.type(within(dlg).getByLabelText('ชื่องานที่ 1'), 'Picking list{Enter}')
    await userEvent.type(within(dlg).getByLabelText('ชื่องานที่ 2'), 'Confirm')
    await userEvent.clear(within(dlg).getByLabelText('ระยะเวลางานที่ 2'))
    await userEvent.type(within(dlg).getByLabelText('ระยะเวลางานที่ 2'), '2')
    expect(within(dlg).getByText(/Epic นี้จะยาว/).parentElement).toHaveTextContent('5 วันทำงาน')
    expect(within(dlg).getByTestId('epic-submit')).toHaveTextContent('สร้าง Epic + 2 งาน')
    await userEvent.click(within(dlg).getByTestId('epic-submit'))
    await waitFor(() => expect(post).toHaveBeenCalled())
    const body = JSON.parse((post.mock.calls[0] as unknown as [RequestInit])[0].body as string)
    expect(body).toMatchObject({ name: 'Picking list', color: '#1f9e89', sequential: true, tasks: [{ name: 'Picking list', duration: 3 }, { name: 'Confirm', duration: 2 }], existingTaskIds: [] })
    expect(onClose).toHaveBeenCalled()
  })

  it('paste tab previews parsed epics and posts the bulk body', async () => {
    const bulk = vi.fn(() => sampleProject())
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'POST /projects/prj_sample/epics/bulk': bulk, 'GET /resources': () => [] })))
    renderWithProviders(<CreateEpicDialog project={sampleProject()} open onClose={() => {}} initialTab="paste" />)
    const dlg = screen.getByRole('dialog', { name: 'สร้าง Epic' })
    await userEvent.click(within(dlg).getByLabelText('วางรายการ'))
    await userEvent.paste('3\tPicking list\tPicking list (3)\n\tPicking list\tConfirm\n4\tMaster\tMaster Data\n\t\t- Create')
    const pv = within(dlg).getByTestId('paste-preview')
    expect(pv).toHaveTextContent('Picking list')
    expect(pv).toHaveTextContent('Create')
    expect(within(dlg).getByTestId('epic-submit')).toHaveTextContent('สร้าง 2 Epic · 3 งาน')
    await userEvent.click(within(dlg).getByTestId('epic-submit'))
    await waitFor(() => expect(bulk).toHaveBeenCalled())
    const body = JSON.parse((bulk.mock.calls[0] as unknown as [RequestInit])[0].body as string)
    expect(body.linkEpics).toBe(true)
    expect(body.epics[0].tasks).toEqual([{ name: 'Picking list', duration: 3, checklist: [] }, { name: 'Confirm', duration: 3, checklist: [] }])
    expect(body.epics[1].tasks[0].checklist).toEqual(['Create'])
  })

  it('existing tab preselects the given tasks and sends existingTaskIds', async () => {
    const post = vi.fn(() => sampleProject())
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'POST /projects/prj_sample/epics': post, 'GET /resources': () => [] })))
    renderWithProviders(<CreateEpicDialog project={sampleProject()} open onClose={() => {}} initialTab="existing" initialTaskIds={['t4', 't5']} defaultName="พัฒนา Backend" />)
    const dlg = screen.getByRole('dialog', { name: 'สร้าง Epic' })
    expect(within(dlg).getByLabelText('ชื่อ Epic')).toHaveValue('พัฒนา Backend')
    expect(within(dlg).getByRole('checkbox', { name: /พัฒนา Backend/ })).toBeChecked()
    expect(within(dlg).getByText(/เข้า Epic ใหม่/).textContent).toContain('2 งาน')
    await userEvent.click(within(dlg).getByTestId('epic-submit'))
    await waitFor(() => expect(post).toHaveBeenCalled())
    const body = JSON.parse((post.mock.calls[0] as unknown as [RequestInit])[0].body as string)
    expect(body.existingTaskIds.sort()).toEqual(['t4', 't5'])
    expect(body.tasks).toEqual([])
  })
})
