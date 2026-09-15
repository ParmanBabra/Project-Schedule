import { describe, expect, it } from 'vitest'
import { sampleProject } from '@/test/fixtures'
import { descendantIds, epicOf, epicStats, epicsOf, parsePaste } from './epics'

describe('parsePaste', () => {
  it('reads Excel rows (No · Topic · Task) with repeated topics and "-" sub-items', () => {
    const text = [
      '3\tPicking list\tPicking list',
      '\tPicking list\tPlant Route (Mobile)',
      '\tPicking list\tConfirm (2)',
      '4\tMaster for Standalone (Juno)\tMaster Data (Cost center)',
      '\t\t- Create',
      '\t\t- Edit',
      '\tMaster for Standalone (Juno)\tIntegration Module',
      '',
      '5\tInterface Automated WH\tCreate Task',
    ].join('\n')
    const epics = parsePaste(text)
    expect(epics.map((e) => e.name)).toEqual(['Picking list', 'Master for Standalone (Juno)', 'Interface Automated WH'])
    expect(epics[0].tasks.map((t) => t.name)).toEqual(['Picking list', 'Plant Route (Mobile)', 'Confirm'])
    expect(epics[0].tasks[2].duration).toBe(2)
    expect(epics[1].tasks[0].checklist).toEqual(['Create', 'Edit'])
    expect(epics[1].tasks[1].name).toBe('Integration Module')
  })

  it('reads a plain outline: headings, indented tasks, bullets', () => {
    const epics = parsePaste('Picking list\n  Picking list | 3\n  Confirm\n  - ทดสอบกับคลัง\nE-Tax\n\tGet File Billing\n')
    expect(epics).toHaveLength(2)
    expect(epics[0].tasks[0]).toEqual({ name: 'Picking list', duration: 3, checklist: [] })
    expect(epics[0].tasks[1].checklist).toEqual(['ทดสอบกับคลัง'])
    expect(epics[1].tasks.map((t) => t.name)).toEqual(['Get File Billing'])
  })

  it('merges the same topic written twice (case-insensitive) and ignores blanks', () => {
    const epics = parsePaste('A\tx\n\nB\ty\na\tz')
    expect(epics.map((e) => e.name)).toEqual(['A', 'B'])
    expect(epics[0].tasks.map((t) => t.name)).toEqual(['x', 'z'])
  })
})

describe('epic helpers', () => {
  it('finds epics, descendants and per-epic stats', () => {
    const p = sampleProject()
    const g = p.tasks.find((t) => t.id === 't2')!
    // make ออกแบบระบบ an Epic holding t3 and t4
    g.epic = { color: '#e0457b', description: 'ออกแบบ', ownerResourceId: null }
    p.tasks.find((t) => t.id === 't3')!.parentId = 't2'
    p.tasks.find((t) => t.id === 't4')!.parentId = 't2'
    p.schedule.tasks.t2 = { ...p.schedule.tasks.t2, isSummary: true, progress: 40 }
    p.schedule.tasks.t3.health = 'done'
    p.schedule.tasks.t4.health = 'late'
    expect(epicsOf(p).map((e) => e.id)).toEqual(['t2'])
    expect(descendantIds(p, 't2').sort()).toEqual(['t3', 't4'])
    expect(epicOf(p, 't4')?.id).toBe('t2')
    expect(epicOf(p, 't1')).toBeNull()
    const s = epicStats(p, g)
    expect(s).toMatchObject({ taskCount: 2, doneCount: 1, lateCount: 1, progress: 40, status: 'late', color: '#e0457b' })
  })
})
