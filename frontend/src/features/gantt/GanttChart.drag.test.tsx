import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleProject } from '@/test/fixtures'
import { GanttChart } from './GanttChart'
import { ROW_HEIGHT } from './lib/timeline'

function renderChart(overrides: Partial<Parameters<typeof GanttChart>[0]> = {}) {
  const props = {
    project: sampleProject(),
    zoom: 'day' as const,
    highlightCritical: true,
    selectedId: null,
    onSelect: vi.fn(),
    onToggleCollapse: vi.fn(),
    onDragPreview: vi.fn(),
    onCommitDrag: vi.fn(),
    onLink: vi.fn(),
    onArrowClick: vi.fn(),
    ...overrides,
  }
  render(<GanttChart {...props} />)
  return props
}

describe('GanttChart drag interactions', () => {
  beforeEach(() => {
    // jsdom has no layout: put the time area at (0,0) so clientY maps straight to rows
    Element.prototype.getBoundingClientRect = vi.fn(() => ({ top: 0, left: 0, right: 1000, bottom: 1000, width: 1000, height: 1000, x: 0, y: 0, toJSON: () => ({}) })) as never
    Element.prototype.scrollTo = vi.fn()
  })

  it('moving a bar two days right commits a new start (snapped to a working day)', () => {
    const p = renderChart()
    const bar = screen.getByTestId('bar-t2') // 17–23 Sep
    fireEvent.pointerDown(bar, { button: 0, clientX: 100, clientY: 60, pointerType: 'mouse', pointerId: 1 })
    const area = screen.getByTestId('gantt-chart').querySelector('[class*="timeArea"]')!
    fireEvent.pointerMove(area, { clientX: 172, clientY: 60 }) // +72px = 2 days at 36px
    expect(screen.getByTestId('drag-ghost')).toHaveTextContent('เริ่ม 21 ก.ย.') // Sat 19 -> Mon 21
    expect(p.onDragPreview).toHaveBeenCalledWith({ taskId: 't2', start: '2026-09-21' })
    fireEvent.pointerUp(area, { clientX: 172, clientY: 60 })
    expect(p.onCommitDrag).toHaveBeenCalledWith({ taskId: 't2', start: '2026-09-21' })
    expect(p.onDragPreview).toHaveBeenLastCalledWith(null)
    expect(p.onSelect).not.toHaveBeenCalled()
  })

  it('a tiny movement is a click, not a drag', () => {
    const p = renderChart()
    const bar = screen.getByTestId('bar-t2')
    const area = screen.getByTestId('gantt-chart').querySelector('[class*="timeArea"]')!
    fireEvent.pointerDown(bar, { button: 0, clientX: 100, clientY: 60, pointerType: 'mouse', pointerId: 1 })
    fireEvent.pointerMove(area, { clientX: 102, clientY: 60 })
    fireEvent.pointerUp(area, { clientX: 102, clientY: 60 })
    fireEvent.click(bar)
    expect(p.onCommitDrag).not.toHaveBeenCalled()
    expect(p.onSelect).toHaveBeenCalledWith('t2')
  })

  it('dragging the right edge changes the duration', () => {
    const p = renderChart()
    const handle = screen.getByTestId('resize-t2')
    const area = screen.getByTestId('gantt-chart').querySelector('[class*="timeArea"]')!
    fireEvent.pointerDown(handle, { button: 0, clientX: 300, clientY: 60, pointerType: 'mouse', pointerId: 1 })
    fireEvent.pointerMove(area, { clientX: 300 + 2 * 36, clientY: 60 })
    expect(screen.getByTestId('drag-ghost')).toHaveTextContent('7 วัน')
    fireEvent.pointerUp(area, { clientX: 372, clientY: 60 })
    expect(p.onCommitDrag).toHaveBeenCalledWith({ taskId: 't2', duration: 7 })
  })

  it('dragging the link handle onto another row creates a dependency', () => {
    const p = renderChart()
    const handle = screen.getByTestId('link-t3') // row index 2
    const area = screen.getByTestId('gantt-chart').querySelector('[class*="timeArea"]')!
    fireEvent.pointerDown(handle, { button: 0, clientX: 400, clientY: 2 * ROW_HEIGHT + 20, pointerType: 'mouse', pointerId: 1 })
    fireEvent.pointerMove(area, { clientX: 500, clientY: 3 * ROW_HEIGHT + 20 }) // over row 3 = t4
    expect(screen.getByTestId('link-line')).toBeInTheDocument()
    fireEvent.pointerUp(area, { clientX: 500, clientY: 3 * ROW_HEIGHT + 20 })
    expect(p.onLink).toHaveBeenCalledWith('t3', 't4')
  })

  it('touch pointers never start a drag and arrows are clickable', () => {
    const p = renderChart()
    const bar = screen.getByTestId('bar-t2')
    const area = screen.getByTestId('gantt-chart').querySelector('[class*="timeArea"]')!
    fireEvent.pointerDown(bar, { button: 0, clientX: 100, clientY: 60, pointerType: 'touch', pointerId: 2 })
    fireEvent.pointerMove(area, { clientX: 200, clientY: 60 })
    fireEvent.pointerUp(area, { clientX: 200, clientY: 60 })
    expect(p.onCommitDrag).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('dep-hit-d3'), { clientX: 10, clientY: 20 })
    expect(p.onArrowClick).toHaveBeenCalledWith('d3', 10, 20)
  })

  it('draws changed tasks from the preview schedule with a preview outline', () => {
    const preview = structuredClone(sampleProject().schedule)
    preview.tasks.t4 = { ...preview.tasks.t4, start: '2026-09-28', end: '2026-10-05' }
    renderChart({ previewSchedule: preview })
    expect(screen.getByTestId('bar-t4').className).toMatch(/previewBar/)
    expect(screen.getByTestId('bar-t2').className).not.toMatch(/previewBar/)
  })
})
