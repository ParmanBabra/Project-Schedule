import { describe, expect, it } from 'vitest'
import { NAME_COL_KEY, clampNameColWidth, defaultNameColWidth, readNameColWidth, writeNameColWidth } from './nameCol'

function memStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init))
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    map: m,
  }
}

describe('name column width helpers', () => {
  it('clamps to the allowed range and rounds', () => {
    expect(clampNameColWidth(10)).toBe(120)
    expect(clampNameColWidth(9999)).toBe(560)
    expect(clampNameColWidth(300.6)).toBe(301)
  })

  it('defaults differ between desktop and mobile', () => {
    expect(defaultNameColWidth(false)).toBe(220)
    expect(defaultNameColWidth(true)).toBe(120)
  })

  it('reads null when nothing stored or the value is garbage, clamps stored numbers', () => {
    expect(readNameColWidth(memStorage())).toBeNull()
    expect(readNameColWidth(memStorage({ [NAME_COL_KEY]: 'abc' }))).toBeNull()
    expect(readNameColWidth(memStorage({ [NAME_COL_KEY]: '900' }))).toBe(560)
    expect(readNameColWidth(memStorage({ [NAME_COL_KEY]: '320' }))).toBe(320)
  })

  it('writes clamped values and removes on null', () => {
    const s = memStorage()
    writeNameColWidth(50, s)
    expect(s.map.get(NAME_COL_KEY)).toBe('120')
    writeNameColWidth(null, s)
    expect(s.map.has(NAME_COL_KEY)).toBe(false)
  })

  it('survives a throwing storage', () => {
    const bad = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') }, removeItem: () => { throw new Error('x') } }
    expect(readNameColWidth(bad)).toBeNull()
    expect(() => writeNameColWidth(200, bad)).not.toThrow()
  })
})
