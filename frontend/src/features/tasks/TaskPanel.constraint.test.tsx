import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { mockFetch, sampleProject } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'
import { TaskPanel } from './TaskPanel'

describe('TaskPanel deadline constraint (FNLT)', () => {
  it('turning the deadline toggle on sends FNLT at the planned end, and it excludes the SNET toggle', async () => {
    const patch = vi.fn(() => sampleProject())
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'PATCH /projects/prj_sample/tasks/t4': patch })))
    renderWithProviders(<TaskPanel project={sampleProject()} taskId="t4" onClose={() => {}} onSelect={() => {}} />)
    await userEvent.click(screen.getByRole('switch', { name: 'ต้องเสร็จภายในวันที่กำหนด' }))
    await waitFor(() => expect(patch).toHaveBeenCalled())
    expect(JSON.parse((patch.mock.calls[0] as unknown as [RequestInit])[0].body as string)).toEqual({ constraint: { type: 'FNLT', date: '2026-10-01' } })
  })

  it('shows the deadline date and an overrun chip when the float is negative', () => {
    const p = sampleProject()
    p.tasks.find((t) => t.id === 't4')!.constraint = { type: 'FNLT', date: '2026-09-29' }
    p.schedule.tasks.t4 = { ...p.schedule.tasks.t4, totalFloat: -2, lateFinish: '2026-09-29' }
    renderWithProviders(<TaskPanel project={p} taskId="t4" onClose={() => {}} onSelect={() => {}} />)
    expect(screen.getByRole('switch', { name: 'ต้องเสร็จภายในวันที่กำหนด' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'เริ่มไม่ก่อนวันที่กำหนด' })).not.toBeChecked()
    expect(screen.getByLabelText('ต้องเสร็จภายในวันที่')).toBeInTheDocument()
    expect(screen.getByText('เลยกำหนดเสร็จ 2 วัน')).toBeInTheDocument()
  })
})
