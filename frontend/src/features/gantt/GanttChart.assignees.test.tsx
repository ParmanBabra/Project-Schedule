import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Resource } from '@/features/projects/types'
import { sampleProject } from '@/test/fixtures'
import { GanttChart } from './GanttChart'

const resources: Resource[] = [
  { id: 'r1', name: 'สมชาย', type: 'person', capacityPerDay: 100, color: '#6a4fd8', daysOff: [] },
  { id: 'r2', name: 'สุดา', type: 'person', capacityPerDay: 100, color: '#e0457b', daysOff: [] },
  { id: 'r3', name: 'วิชัย', type: 'person', capacityPerDay: 100, color: '#1f9e89', daysOff: [] },
  { id: 'r4', name: 'Server A', type: 'equipment', capacityPerDay: 100, color: '#8a83a8', daysOff: [] },
]

function renderChart(overloaded?: Set<string>) {
  const p = sampleProject()
  p.assignments = [
    { id: 'a1', taskId: 't2', resourceId: 'r2', units: 100 },
    { id: 'a2', taskId: 't4', resourceId: 'r1', units: 100 },
    { id: 'a3', taskId: 't4', resourceId: 'r2', units: 50 },
    { id: 'a4', taskId: 't4', resourceId: 'r3', units: 100 },
    { id: 'a5', taskId: 't4', resourceId: 'r4', units: 100 },
    { id: 'a6', taskId: 't5', resourceId: 'r_missing', units: 100 },
  ]
  render(<GanttChart project={p} zoom="day" highlightCritical selectedId={null} onSelect={vi.fn()} onToggleCollapse={vi.fn()} resources={resources} overloadedResourceIds={overloaded} />)
}

describe('GanttChart assignee avatars', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn()
  })

  it('shows the assignees of a task after its bar with names and units', () => {
    renderChart()
    const one = screen.getByTestId('assignees-t2')
    expect(one).toHaveAttribute('aria-label', 'ผู้ทำ: สุดา 100%')
    expect(one).toHaveTextContent('ส')
    expect(one.querySelectorAll('span')).toHaveLength(1)
  })

  it('collapses more than three assignees into +N but keeps everyone in the tooltip', () => {
    renderChart()
    const many = screen.getByTestId('assignees-t4')
    expect(many).toHaveTextContent('สสว+1')
    expect(many).toHaveAttribute('title', 'ผู้ทำ: สมชาย 100%, สุดา 50%, วิชัย 100%, Server A 100%')
  })

  it('draws nothing for tasks without assignees or with an unknown resource', () => {
    renderChart()
    expect(screen.queryByTestId('assignees-t1')).toBeNull()
    expect(screen.queryByTestId('assignees-t5')).toBeNull()
  })

  it('marks over-allocated resources', () => {
    renderChart(new Set(['r2']))
    const one = screen.getByTestId('assignees-t2')
    expect(one.firstElementChild?.className).toMatch(/assigneeOver/)
    expect(one).toHaveAttribute('aria-label', 'ผู้ทำ: สุดา 100% (เกินกำลัง)')
    expect(screen.getByTestId('assignees-t4').firstElementChild?.className).not.toMatch(/assigneeOver/)
  })
})
