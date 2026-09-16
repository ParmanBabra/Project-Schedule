import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleProject } from '@/test/fixtures'
import { GanttChart } from './GanttChart'
import { NAME_COL_KEY } from './lib/nameCol'

function renderChart() {
  render(
    <GanttChart project={sampleProject()} zoom="day" highlightCritical selectedId={null} onSelect={vi.fn()} onToggleCollapse={vi.fn()} />,
  )
  return {
    chart: screen.getByTestId('gantt-chart'),
    resizer: screen.getByRole('separator', { name: 'ปรับความกว้างคอลัมน์ชื่องาน' }),
  }
}

const widthOf = (chart: HTMLElement) => chart.style.getPropertyValue('--w-namecol')

describe('GanttChart resizable name column', () => {
  beforeEach(() => {
    localStorage.clear()
    Element.prototype.scrollTo = vi.fn()
  })

  it('starts at the 220px default and exposes it on the separator', () => {
    const { chart, resizer } = renderChart()
    expect(widthOf(chart)).toBe('220px')
    expect(resizer).toHaveAttribute('aria-valuenow', '220')
    expect(resizer).toHaveAttribute('aria-orientation', 'vertical')
  })

  it('dragging the handle to the right widens the column and remembers it', () => {
    const { chart, resizer } = renderChart()
    fireEvent.pointerDown(resizer, { button: 0, clientX: 220, pointerId: 1 })
    fireEvent.pointerMove(resizer, { clientX: 340, pointerId: 1 })
    expect(widthOf(chart)).toBe('340px')
    expect(chart.className).toMatch(/chartResizing/)
    fireEvent.pointerUp(resizer, { clientX: 340, pointerId: 1 })
    expect(chart.className).not.toMatch(/chartResizing/)
    expect(localStorage.getItem(NAME_COL_KEY)).toBe('340')
    expect(resizer).toHaveAttribute('aria-valuenow', '340')
  })

  it('never goes below 120px or above 560px', () => {
    const { chart, resizer } = renderChart()
    fireEvent.pointerDown(resizer, { button: 0, clientX: 220, pointerId: 1 })
    fireEvent.pointerMove(resizer, { clientX: -500, pointerId: 1 })
    expect(widthOf(chart)).toBe('120px')
    fireEvent.pointerMove(resizer, { clientX: 5000, pointerId: 1 })
    expect(widthOf(chart)).toBe('560px')
    fireEvent.pointerUp(resizer, { clientX: 5000, pointerId: 1 })
  })

  it('restores the saved width on the next mount and double-click resets to default', () => {
    localStorage.setItem(NAME_COL_KEY, '400')
    const { chart, resizer } = renderChart()
    expect(widthOf(chart)).toBe('400px')
    fireEvent.doubleClick(resizer)
    expect(widthOf(chart)).toBe('220px')
    expect(localStorage.getItem(NAME_COL_KEY)).toBeNull()
  })

  it('is keyboard operable: arrows step 16px, Home/End jump, Enter resets', () => {
    const { chart, resizer } = renderChart()
    resizer.focus()
    fireEvent.keyDown(resizer, { key: 'ArrowRight' })
    expect(widthOf(chart)).toBe('236px')
    fireEvent.keyDown(resizer, { key: 'ArrowLeft' })
    fireEvent.keyDown(resizer, { key: 'ArrowLeft' })
    expect(widthOf(chart)).toBe('204px')
    fireEvent.keyDown(resizer, { key: 'End' })
    expect(widthOf(chart)).toBe('560px')
    fireEvent.keyDown(resizer, { key: 'Home' })
    expect(widthOf(chart)).toBe('120px')
    fireEvent.keyDown(resizer, { key: 'Enter' })
    expect(widthOf(chart)).toBe('220px')
  })

  it('ignores non-primary buttons', () => {
    const { chart, resizer } = renderChart()
    fireEvent.pointerDown(resizer, { button: 2, clientX: 220, pointerId: 1 })
    fireEvent.pointerMove(resizer, { clientX: 400, pointerId: 1 })
    expect(widthOf(chart)).toBe('220px')
  })
})
