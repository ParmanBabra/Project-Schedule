import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { mockFetch, sampleProject } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'
import { TaskPanel } from './TaskPanel'

function milestoneProject() {
  const p = sampleProject()
  const t6 = p.tasks.find((t) => t.id === 't6')!
  t6.isMilestone = true
  t6.duration = 0
  p.schedule.tasks.t6 = { ...p.schedule.tasks.t6, isMilestone: true, duration: 0 }
  return p
}

describe('TaskPanel release section (BUF-8)', () => {
  it('is only offered on milestones', () => {
    renderWithProviders(<TaskPanel project={milestoneProject()} taskId="t2" onClose={() => {}} onSelect={() => {}} />)
    expect(screen.queryByTestId('release-section')).toBeNull()
  })

  it('turning the toggle on creates a release named after the milestone', async () => {
    const post = vi.fn(() => milestoneProject())
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'POST /projects/prj_sample/releases': post })))
    renderWithProviders(<TaskPanel project={milestoneProject()} taskId="t6" onClose={() => {}} onSelect={() => {}} />)
    expect(screen.getByText(/งานที่ป้อนเข้า milestone นี้/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('switch', { name: 'จุดส่งมอบ มีเวลาเผื่อของตัวเอง' }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    const body = JSON.parse((post.mock.calls[0] as unknown as [RequestInit])[0].body as string)
    expect(body).toEqual({ name: 'ทดสอบระบบ', milestoneTaskId: 't6' })
  })

  it('shows the computed buffer, lets the user override the days, and turning off deletes the release', async () => {
    const p = milestoneProject()
    p.releases = [{ id: 'rel_01', name: 'ส่งมอบปีนี้', milestoneTaskId: 't6', days: null }]
    p.schedule.releases = [{ id: 'rel_01', name: 'ส่งมอบปีนี้', milestoneTaskId: 't6', taskIds: ['t1', 't2', 't3', 't4', 't5', 't6'], chainDays: 17, days: 9, plannedEnd: '2026-10-06', end: '2026-10-19', committedEnd: '2026-10-19', progress: 32, chainProgress: 32, chainTaskIds: [], consumedPercent: null, consumedDays: null, status: null, aheadDays: 0, percentUsed: 50, note: null }]
    const patch = vi.fn(() => p)
    const del = vi.fn(() => milestoneProject())
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'PATCH /projects/prj_sample/releases/rel_01': patch, 'DELETE /projects/prj_sample/releases/rel_01': del })))
    renderWithProviders(<TaskPanel project={p} taskId="t6" onClose={() => {}} onSelect={() => {}} />)
    expect(screen.getByLabelText('ชื่อจุดส่งมอบ')).toHaveValue('ส่งมอบปีนี้')
    expect(screen.getByText('คำนวณให้ 9 วัน จากสายงาน 17 วัน')).toBeInTheDocument()
    expect(screen.getByTestId('release-summary')).toHaveTextContent('6 งาน · เสร็จตามแผน 6 ต.ค. 2569 · สัญญาส่ง 19 ต.ค. 2569')

    const days = screen.getByLabelText('เวลาเผื่อ')
    await userEvent.type(days, '12')
    await userEvent.tab()
    await waitFor(() => expect(patch).toHaveBeenCalled())
    expect(JSON.parse((patch.mock.calls[0] as unknown as [RequestInit])[0].body as string)).toEqual({ days: 12 })

    await userEvent.click(screen.getByRole('switch', { name: 'จุดส่งมอบ มีเวลาเผื่อของตัวเอง' }))
    await waitFor(() => expect(del).toHaveBeenCalled())
  })
})
