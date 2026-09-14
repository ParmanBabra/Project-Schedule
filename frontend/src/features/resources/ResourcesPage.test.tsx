import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ResourceOut, WorkloadResponse } from '@/features/projects/types'
import { mockFetch } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'
import { ResourcesPage } from './ResourcesPage'

const resources: ResourceOut[] = [
  { id: 'r1', name: 'สมชาย', type: 'person', capacityPerDay: 100, color: '#6a4fd8', daysOff: [], assignmentCount: 2, projectCount: 1 },
  { id: 'r2', name: 'สุดา', type: 'person', capacityPerDay: 100, color: '#e0457b', daysOff: ['2026-09-25'], assignmentCount: 2, projectCount: 1 },
  { id: 'r3', name: 'Server A', type: 'equipment', capacityPerDay: 100, color: '#8a83a8', daysOff: [], assignmentCount: 0, projectCount: 0 },
]

function workload(): WorkloadResponse {
  const day = (date: string, load: number, over = false, items: WorkloadResponse['resources'][0]['days'][0]['items'] = []) => ({ date, load, capacity: 100, over, off: false, items })
  const items = [
    { projectId: 'prj_a', projectName: 'ระบบจอง', taskId: 't3', taskName: 'ออกแบบ UI', units: 100 },
    { projectId: 'prj_a', projectName: 'ระบบจอง', taskId: 't5', taskName: 'พัฒนา Frontend', units: 100 },
  ]
  return {
    from: '2026-09-14',
    to: '2026-09-27',
    threshold: 100,
    resources: [
      { resource: resources[0], days: [day('2026-09-14', 100), day('2026-09-15', 100)], peak: 100, overDays: 0 },
      { resource: resources[1], days: [day('2026-09-21', 200, true, items), day('2026-09-22', 200, true, items)], peak: 200, overDays: 2 },
      { resource: resources[2], days: [], peak: 0, overDays: 0 },
    ],
    overallocations: [
      { resourceId: 'r2', resourceName: 'สุดา', date: '2026-09-21', load: 200, capacity: 100, items },
      { resourceId: 'r2', resourceName: 'สุดา', date: '2026-09-22', load: 200, capacity: 100, items },
    ],
  }
}

describe('ResourcesPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('lists resources with peak load, groups overallocation days and filters by type', async () => {
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'GET /resources': () => resources, 'GET /resources/workload': () => workload() })))
    renderWithProviders(<ResourcesPage />)
    expect(await screen.findByTestId('resource-row-r2')).toHaveTextContent('สุดา')
    expect(screen.getByTestId('resource-row-r2')).toHaveTextContent('วันลา 1 วัน')
    await waitFor(() => expect(screen.getByTestId('resource-row-r2')).toHaveTextContent('200%'))
    const card = screen.getByTestId('overallocation-card')
    expect(card).toHaveTextContent('เกินกำลัง 1 คน · 2 วัน')
    expect(card).toHaveTextContent('21 ก.ย. – 22 ก.ย.')
    expect(card).toHaveTextContent('ออกแบบ UI (ระบบจอง 100%) + พัฒนา Frontend (ระบบจอง 100%)')
    expect(within(card).getByRole('button', { name: 'ไปที่งาน' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: 'เครื่องมือ' }))
    expect(screen.queryByTestId('resource-row-r2')).not.toBeInTheDocument()
    expect(screen.getByTestId('resource-row-r3')).toBeInTheDocument()
  })

  it('creates a resource from the dialog', async () => {
    const post = vi.fn(() => ({ id: 'r9', name: 'วิชัย', type: 'person', capacityPerDay: 80, color: '#1f9e89', daysOff: ['2026-10-01'] }))
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'GET /resources': () => [], 'POST /resources': post })))
    renderWithProviders(<ResourcesPage />)
    await userEvent.click((await screen.findAllByRole('button', { name: 'เพิ่มทรัพยากร' }))[0])
    const dialog = screen.getByRole('dialog', { name: 'เพิ่มทรัพยากร' })
    await userEvent.type(within(dialog).getByLabelText('ชื่อ'), 'วิชัย')
    await userEvent.clear(within(dialog).getByLabelText('กำลังต่อวัน'))
    await userEvent.type(within(dialog).getByLabelText('กำลังต่อวัน'), '80')
    await userEvent.click(within(dialog).getByRole('radio', { name: '#1f9e89' }))
    await userEvent.type(within(dialog).getByLabelText('วันลาใหม่'), '2026-10-01')
    await userEvent.click(within(dialog).getByRole('button', { name: 'เพิ่มวันลา' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'เพิ่ม' }))
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(JSON.parse((post.mock.calls[0] as unknown as [RequestInit])[0].body as string)).toEqual({ name: 'วิชัย', type: 'person', capacityPerDay: 80, color: '#1f9e89', daysOff: ['2026-10-01'] })
  })

  it('deleting an assigned resource explains and offers force delete', async () => {
    const del = vi.fn((_init?: RequestInit, _url?: string) => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'GET /resources': () => resources, 'GET /resources/workload': () => workload(), 'DELETE /resources/r1': del })))
    renderWithProviders(<ResourcesPage />)
    await screen.findByTestId('resource-row-r1')
    await userEvent.click(screen.getByRole('button', { name: 'ตัวเลือกของ สมชาย' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'ลบทรัพยากร' }))
    const dialog = screen.getByRole('dialog', { name: 'ลบทรัพยากร' })
    expect(dialog).toHaveTextContent('ถูกมอบหมายอยู่ 2 งาน')
    await userEvent.click(within(dialog).getByRole('button', { name: 'ลบทรัพยากร' }))
    await waitFor(() => expect(del).toHaveBeenCalled())
    expect((del.mock.calls[0] as unknown as [RequestInit, string])[1]).toContain('force=true')
  })
})
