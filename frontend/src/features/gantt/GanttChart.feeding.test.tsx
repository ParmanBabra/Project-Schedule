import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleProject } from '@/test/fixtures'
import { GanttChart } from './GanttChart'

describe('GanttChart feeding buffers (BUF-6)', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn()
  })

  it('draws a dotted bar after the feeding task, red when its float is short', () => {
    const p = sampleProject()
    p.schedule.feedingBuffers = [
      { fromTaskId: 't5', toTaskId: 't6', dependencyId: 'd6', chainDays: 9, days: 5, availableDays: 2, ok: false, start: '2026-09-30', end: '2026-10-06' },
      { fromTaskId: 't3', toTaskId: 't4', dependencyId: null, chainDays: 4, days: 2, availableDays: 4, ok: true, start: '2026-09-23', end: '2026-09-24' },
    ]
    render(<GanttChart project={p} zoom="day" highlightCritical selectedId={null} onSelect={vi.fn()} onToggleCollapse={vi.fn()} />)
    const short = screen.getByTestId('feeding-t5')
    expect(short).toHaveAttribute('data-ok', 'false')
    expect(short.className).toMatch(/feedingShort/)
    expect(short).toHaveAttribute('title', 'Feeding buffer 5 วัน: สายงานรอง "พัฒนา Frontend" (9 วัน) มาบรรจบ "ทดสอบระบบ" · มี float 2 วัน · ไม่พอ ควรเริ่มสายนี้ให้เร็วขึ้น')
    const fine = screen.getByTestId('feeding-t3')
    expect(fine).toHaveAttribute('data-ok', 'true')
    expect(fine.className).not.toMatch(/feedingShort/)
    // sits on the feeding task's row, right after that task's bar
    const bar = screen.getByTestId('bar-t5')
    expect(parseFloat(short.style.top)).toBeGreaterThan(parseFloat(bar.style.top))
    expect(parseFloat(short.style.left)).toBeGreaterThanOrEqual(parseFloat(bar.style.left) + parseFloat(bar.style.width) - 1)
  })

  it('draws nothing when the schedule has no feeding buffers', () => {
    render(<GanttChart project={sampleProject()} zoom="day" highlightCritical selectedId={null} onSelect={vi.fn()} onToggleCollapse={vi.fn()} />)
    expect(screen.queryAllByTestId(/^feeding-/)).toHaveLength(0)
  })
})
