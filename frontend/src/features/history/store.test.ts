import { beforeEach, describe, expect, it } from 'vitest'
import { sampleProject } from '@/test/fixtures'
import { HISTORY_LIMIT, useHistory } from './store'

function snap(updatedAt: string) {
  return { ...sampleProject(), updatedAt }
}

describe('history store', () => {
  beforeEach(() => useHistory.getState().clear('prj_sample'))

  it('pushes, undoes and redoes in order', () => {
    const h = useHistory.getState()
    h.push(snap('1'))
    h.push(snap('2'))
    const current = snap('3')
    expect(useHistory.getState().undo('prj_sample', current)?.updatedAt).toBe('2')
    expect(useHistory.getState().undo('prj_sample', snap('2'))?.updatedAt).toBe('1')
    expect(useHistory.getState().undo('prj_sample', snap('1'))).toBeUndefined()
    expect(useHistory.getState().redo('prj_sample', snap('1'))?.updatedAt).toBe('2')
    expect(useHistory.getState().redo('prj_sample', snap('2'))?.updatedAt).toBe('3')
  })

  it('ignores duplicate snapshots, clears redo on new push and caps the stack', () => {
    const h = useHistory.getState()
    h.push(snap('a'))
    h.push(snap('a'))
    expect(useHistory.getState().stacks.prj_sample.past).toHaveLength(1)
    useHistory.getState().undo('prj_sample', snap('b'))
    expect(useHistory.getState().stacks.prj_sample.future).toHaveLength(1)
    useHistory.getState().push(snap('c'))
    expect(useHistory.getState().stacks.prj_sample.future).toHaveLength(0)
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) useHistory.getState().push(snap(`x${i}`))
    expect(useHistory.getState().stacks.prj_sample.past).toHaveLength(HISTORY_LIMIT)
  })
})
