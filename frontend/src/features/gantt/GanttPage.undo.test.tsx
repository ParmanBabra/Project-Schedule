import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useHistory } from '@/features/history/store'
import { mockFetch, sampleProject } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'
import { GanttPage } from './GanttPage'

describe('GanttPage undo/redo and shortcuts', () => {
  beforeEach(() => {
    useHistory.getState().clear('prj_sample')
    Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) })
    Element.prototype.scrollTo = vi.fn()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('Ctrl+Z sends the previous state with PUT and Ctrl+Shift+Z re-applies it', async () => {
    const before = sampleProject()
    const after = { ...sampleProject(), updatedAt: '2026-09-15T00:00:01Z' }
    after.tasks = after.tasks.map((t) => (t.id === 't4' ? { ...t, collapsed: true } : t))
    const put = vi.fn(() => before)
    vi.stubGlobal(
      'fetch',
      vi.fn(mockFetch({ 'GET /projects/prj_sample': () => before, 'PATCH /projects/prj_sample/tasks/t4': () => after, 'PUT /projects/prj_sample': put })),
    )
    renderWithProviders(
      <Routes>
        <Route path="/p/:projectId/gantt" element={<GanttPage />} />
      </Routes>,
      { route: '/p/prj_sample/gantt' },
    )
    expect(await screen.findByTestId('task-row-t4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /เลิกทำ/ })).toBeDisabled()

    // any tracked mutation pushes history – here: the collapse toggle isn't available for a leaf,
    // so drive the same hook through the task panel (open t4, toggle milestone)
    await userEvent.click(screen.getByTestId('bar-t4'))
    await userEvent.click(await screen.findByRole('switch', { name: 'เป็น milestone' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /เลิกทำ/ })).toBeEnabled())

    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    const body = JSON.parse((put.mock.calls[0] as unknown as [RequestInit])[0].body as string)
    expect(Object.keys(body).sort()).toEqual(['assignments', 'buffer', 'dependencies', 'holidays', 'name', 'rules', 'startDate', 'tasks', 'workingDays'])
    expect(body.tasks.find((t: { id: string }) => t.id === 't4').collapsed).toBe(false)
    await waitFor(() => expect(screen.getByRole('button', { name: /ทำซ้ำ/ })).toBeEnabled())

    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    await waitFor(() => expect(put).toHaveBeenCalledTimes(2))
  })

  it('N opens the add dialog, 2 switches zoom and C toggles the critical highlight', async () => {
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'GET /projects/prj_sample': () => sampleProject() })))
    renderWithProviders(
      <Routes>
        <Route path="/p/:projectId/gantt" element={<GanttPage />} />
      </Routes>,
      { route: '/p/prj_sample/gantt' },
    )
    await screen.findByTestId('task-row-t1')
    await userEvent.keyboard('2')
    expect(screen.getByRole('radio', { name: 'สัปดาห์' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.keyboard('c')
    expect(screen.getByRole('switch', { name: 'Critical path' })).not.toBeChecked()
    await userEvent.keyboard('n')
    expect(screen.getByRole('dialog', { name: 'เพิ่มงาน' })).toBeInTheDocument()
    // shortcuts are ignored while a dialog is open
    await userEvent.keyboard('1')
    expect(screen.getByRole('radio', { name: 'สัปดาห์' })).toHaveAttribute('aria-checked', 'true')
  })
})
