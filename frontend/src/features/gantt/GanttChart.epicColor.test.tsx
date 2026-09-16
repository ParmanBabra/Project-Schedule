import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleProject } from '@/test/fixtures'
import { GanttChart } from './GanttChart'

const TEAL = '#1f9e89'

/** t4 (critical) and t5 (float) become children of a teal Epic */
function withEpic() {
  const p = sampleProject()
  p.tasks.push({ ...p.tasks[0], id: 'e1', name: 'Picking list', parentId: null, order: 7, epic: { color: TEAL, description: '', ownerResourceId: null }, progress: 0 })
  for (const id of ['t4', 't5']) p.tasks.find((t) => t.id === id)!.parentId = 'e1'
  p.schedule.tasks.e1 = { ...p.schedule.tasks.t4, wbs: '7', isSummary: true, isCritical: true, start: p.schedule.tasks.t5.start, end: p.schedule.tasks.t4.end }
  p.schedule.tasks.t4 = { ...p.schedule.tasks.t4, wbs: '7.1' }
  p.schedule.tasks.t5 = { ...p.schedule.tasks.t5, wbs: '7.2' }
  return p
}

describe('GanttChart colours inside an Epic', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn()
  })

  it('keeps the Epic colour on a critical child and marks critical with a ring instead of pink fill', () => {
    render(<GanttChart project={withEpic()} zoom="day" highlightCritical selectedId={null} onSelect={vi.fn()} onToggleCollapse={vi.fn()} />)
    const bar = screen.getByTestId('bar-t4')
    expect(bar).toHaveAttribute('data-critical', 'true')
    expect(bar.style.getPropertyValue('--bar')).toBe(TEAL)
    expect(bar.className).toMatch(/barCriticalEpic/)
    expect(bar.className).not.toMatch(/barCritical(?!Epic)/)
    // the dot in front of the name follows: Epic colour + critical ring
    const dot = screen.getByTestId('task-row-t4').querySelector('[data-critical="true"]') as HTMLElement
    expect(dot.style.background).toBe('rgb(31, 158, 137)')
    expect(dot.style.boxShadow).toContain('var(--critical)')
  })

  it('a non-critical child is plain Epic colour and a critical task outside any Epic is still pink', () => {
    render(<GanttChart project={withEpic()} zoom="day" highlightCritical selectedId={null} onSelect={vi.fn()} onToggleCollapse={vi.fn()} />)
    const child = screen.getByTestId('bar-t5')
    expect(child.style.getPropertyValue('--bar')).toBe(TEAL)
    expect(child.className).not.toMatch(/barCritical/)
    const outside = screen.getByTestId('bar-t2')
    expect(outside.className).toMatch(/barCritical(?!Epic)/)
    expect(outside.style.getPropertyValue('--bar')).toBe('')
  })

  it('without the critical highlight the child is just Epic coloured', () => {
    render(<GanttChart project={withEpic()} zoom="day" highlightCritical={false} selectedId={null} onSelect={vi.fn()} onToggleCollapse={vi.fn()} />)
    expect(screen.getByTestId('bar-t4').className).not.toMatch(/barCritical/)
    expect(screen.getByTestId('bar-t4').style.getPropertyValue('--bar')).toBe(TEAL)
  })
})
