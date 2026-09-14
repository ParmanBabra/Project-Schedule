import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, sampleProject } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'
import { TaskListDrawer } from './TaskListDrawer'

describe('TaskListDrawer', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lists every task with schedule columns and reorders siblings', async () => {
    const reorder = vi.fn(() => sampleProject())
    const move = vi.fn(() => sampleProject())
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'PATCH /projects/prj_sample/tasks/reorder': reorder, 'PATCH /projects/prj_sample/tasks/t2/move': move })))
    const onSelect = vi.fn()
    renderWithProviders(<TaskListDrawer project={sampleProject()} open onClose={() => {}} selectedId="t2" onSelect={onSelect} onAdd={() => {}} />)
    const rows = screen.getAllByTestId(/^list-row-/)
    expect(rows).toHaveLength(6)
    const row2 = screen.getByTestId('list-row-t2')
    expect(row2).toHaveAttribute('aria-selected', 'true')
    expect(within(row2).getByText('17 ก.ย.')).toBeInTheDocument()
    expect(within(row2).getByText('5 วัน')).toBeInTheDocument()

    await userEvent.click(within(row2).getByRole('button', { name: 'เลื่อนขึ้น' }))
    const body = JSON.parse((reorder.mock.calls[0] as unknown as [RequestInit])[0].body as string)
    expect(body).toEqual({ parentId: null, ids: ['t2', 't1', 't3', 't4', 't5', 't6'] })

    await userEvent.click(within(row2).getByRole('button', { name: /ย่อหน้าเข้า/ }))
    expect(JSON.parse((move.mock.calls[0] as unknown as [RequestInit])[0].body as string)).toEqual({ parentId: 't1' })

    expect(within(screen.getByTestId('list-row-t1')).getByRole('button', { name: 'เลื่อนขึ้น' })).toBeDisabled()
    await userEvent.click(within(screen.getByTestId('list-row-t3')).getByText('ออกแบบ UI'))
    expect(onSelect).toHaveBeenCalledWith('t3')
  })
})
