import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReleaseResult } from '@/features/projects/types'
import { sampleProject } from '@/test/fixtures'
import { GanttChart } from './GanttChart'

const r1: ReleaseResult = {
  id: 'rel_01',
  name: 'ปีนี้',
  milestoneTaskId: 't2',
  taskIds: ['t1', 't2'],
  chainDays: 8,
  days: 4,
  plannedEnd: '2026-09-23',
  end: '2026-09-29',
  committedEnd: '2026-09-29',
  progress: 62,
  chainProgress: 62,
  chainTaskIds: [],
  consumedPercent: null,
  consumedDays: null,
  status: null,
  aheadDays: 0,
  percentUsed: 50,
  note: null,
}
const r2: ReleaseResult = { ...r1, id: 'rel_02', name: 'ปีหน้า', milestoneTaskId: 't6', taskIds: ['t3', 't4', 't5', 't6'], chainDays: 14, days: 7, plannedEnd: '2026-10-06', end: '2026-10-15', committedEnd: '2026-10-19', progress: 10, chainProgress: 10, chainTaskIds: [], consumedPercent: 40, consumedDays: 3, status: 'red', aheadDays: 0 }

function renderWith(releases: ReleaseResult[]) {
  const p = sampleProject()
  p.schedule.releases = releases
  p.releases = releases.map((r) => ({ id: r.id, name: r.name, milestoneTaskId: r.milestoneTaskId, days: null }))
  render(<GanttChart project={p} zoom="day" highlightCritical selectedId={null} onSelect={vi.fn()} onToggleCollapse={vi.fn()} />)
}

describe('GanttChart release buffers', () => {
  beforeEach(() => {
    Element.prototype.scrollTo = vi.fn()
  })

  it('without releases keeps the single project buffer', () => {
    renderWith([])
    expect(screen.getByTestId('buffer-bar')).toBeInTheDocument()
    expect(screen.getByText('สำรองเวลาโครงการ')).toBeInTheDocument()
  })

  it('draws one buffer bar and one promise diamond per release instead of the project buffer', () => {
    renderWith([r1, r2])
    expect(screen.queryByTestId('buffer-bar')).toBeNull()
    expect(screen.getByText('สำรองเวลา · 2 จุด')).toBeInTheDocument()
    const b1 = screen.getByTestId('release-buffer-rel_01')
    expect(b1).toHaveAttribute('title', 'ปีนี้: เผื่อ 4 วัน (สายงาน 8 วัน, 2 งาน) · สัญญาส่ง 29 ก.ย. 2569')
    expect(b1).toHaveTextContent('ปีนี้ · เผื่อ 4 วัน')
    const b2 = screen.getByTestId('release-buffer-rel_02')
    expect(b2.className).toMatch(/bufferRed/)
    expect(b2).toHaveTextContent('ปีหน้า · เผื่อ 7 วัน · ใช้ไป 40%')
    expect(screen.getByTestId('release-deliver-rel_02')).toHaveAttribute('title', 'ปีหน้า สัญญาส่ง 19 ต.ค. 2569 (ล็อกตอนบันทึก baseline)')
    expect(screen.getByTestId('release-deliver-rel_01')).toHaveAttribute('title', 'ปีนี้ สัญญาส่ง 29 ก.ย. 2569')
  })

  it('the bars sit in date order on the buffer row', () => {
    renderWith([r1, r2])
    const x = (id: string) => parseFloat(screen.getByTestId(id).style.left)
    expect(x('release-buffer-rel_01')).toBeLessThan(x('release-buffer-rel_02'))
    expect(x('release-deliver-rel_01')).toBeLessThan(x('release-deliver-rel_02'))
  })
})
