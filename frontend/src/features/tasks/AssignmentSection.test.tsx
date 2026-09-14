import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, sampleProject } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'
import { AssignmentSection } from './AssignmentSection'

const resources = [
  { id: 'r1', name: 'สมชาย', type: 'person', capacityPerDay: 100, color: '#6a4fd8', daysOff: [], assignmentCount: 0, projectCount: 0 },
  { id: 'r2', name: 'สุดา', type: 'person', capacityPerDay: 100, color: '#e0457b', daysOff: [], assignmentCount: 1, projectCount: 1 },
]

describe('AssignmentSection', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('assigns a resource with units and shows the overallocation warning', async () => {
    const p = sampleProject()
    p.assignments = [{ id: 'a1', taskId: 't3', resourceId: 'r2', units: 100 }]
    const withNew = { ...p, assignments: [...p.assignments, { id: 'a2', taskId: 't3', resourceId: 'r1', units: 50 }] }
    const post = vi.fn(() => withNew)
    vi.stubGlobal(
      'fetch',
      vi.fn(
        mockFetch({
          'GET /resources': () => resources,
          'GET /resources/workload': () => ({
            from: '2026-09-17',
            to: '2026-09-22',
            threshold: 100,
            resources: [],
            overallocations: [
              { resourceId: 'r2', resourceName: 'สุดา', date: '2026-09-21', load: 150, capacity: 100, items: [] },
              { resourceId: 'r2', resourceName: 'สุดา', date: '2026-09-22', load: 150, capacity: 100, items: [] },
            ],
          }),
          'POST /projects/prj_sample/assignments': post,
        }),
      ),
    )
    renderWithProviders(<AssignmentSection project={p} taskId="t3" />)
    await waitFor(() => expect(screen.getByTestId('asg-a1')).toHaveTextContent('สุดา'))
    expect(await screen.findByTestId('asg-warning')).toHaveTextContent('สุดา เกินกำลัง 150% วันที่ 21 ก.ย. – 22 ก.ย.')

    await userEvent.click(screen.getByRole('button', { name: 'มอบหมายทรัพยากร' }))
    const select = screen.getByLabelText('เลือกทรัพยากร')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['เลือกทรัพยากร…', 'สมชาย']) // สุดา already assigned
    await userEvent.selectOptions(select, 'r1')
    await userEvent.clear(screen.getAllByLabelText('สัดส่วน (%)')[1])
    await userEvent.type(screen.getAllByLabelText('สัดส่วน (%)')[1], '50')
    await userEvent.click(screen.getByRole('button', { name: 'มอบหมาย' }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(JSON.parse((post.mock.calls[0] as unknown as [RequestInit])[0].body as string)).toEqual({ taskId: 't3', resourceId: 'r1', units: 50 })
  })

  it('updates units on blur and removes an assignment', async () => {
    const p = sampleProject()
    p.assignments = [{ id: 'a1', taskId: 't3', resourceId: 'r2', units: 100 }]
    const patch = vi.fn(() => p)
    const del = vi.fn(() => ({ ...p, assignments: [] }))
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'GET /resources': () => resources, 'GET /resources/workload': () => ({ from: '', to: '', threshold: 100, resources: [], overallocations: [] }), 'PATCH /projects/prj_sample/assignments/a1': patch, 'DELETE /projects/prj_sample/assignments/a1': del })))
    renderWithProviders(<AssignmentSection project={p} taskId="t3" />)
    const units = await screen.findByLabelText('สัดส่วน (%)')
    await userEvent.clear(units)
    await userEvent.type(units, '60')
    await userEvent.tab()
    await waitFor(() => expect(patch).toHaveBeenCalled())
    expect(JSON.parse((patch.mock.calls[0] as unknown as [RequestInit])[0].body as string)).toEqual({ units: 60 })
    await userEvent.click(screen.getByRole('button', { name: 'ถอด สุดา' }))
    await waitFor(() => expect(del).toHaveBeenCalled())
  })
})
