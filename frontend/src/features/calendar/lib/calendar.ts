/** Pure calendar layout helpers (month grid, spanning chips, week rows). */
import { addDays, diffDays, startOfMonthISO, startOfWeekISO } from '@/shared/lib/date'

export const MAX_LANES = 3

/** Six rows of seven ISO dates covering the month, weeks starting on Monday. */
export function monthGrid(anyDayInMonth: string): string[][] {
  const first = startOfMonthISO(anyDayInMonth)
  const start = startOfWeekISO(first)
  const rows: string[][] = []
  for (let w = 0; w < 6; w++) rows.push(Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)))
  return rows
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, d) => addDays(weekStart, d))
}

export interface SpanItem {
  id: string
  start: string
  end: string
}

export interface Segment<T extends SpanItem = SpanItem> {
  item: T
  /** 0-based column of the first day inside this week */
  col: number
  /** number of day columns */
  span: number
  lane: number
  clippedStart: boolean
  clippedEnd: boolean
}

/**
 * Items overlapping the week [weekStart, weekStart+6] cut to the week and packed into
 * lanes (first fit). Longer items first so multi-day bars sit on top, like a calendar.
 */
export function weekSegments<T extends SpanItem>(weekStart: string, items: T[]): Segment<T>[] {
  const weekEnd = addDays(weekStart, 6)
  const inWeek = items
    .filter((t) => t.start <= weekEnd && t.end >= weekStart)
    .sort((a, b) => a.start.localeCompare(b.start) || diffDays(a.start, a.end) - diffDays(b.start, b.end) || a.id.localeCompare(b.id))
  const laneEnds: number[] = [] // last occupied column per lane
  const out: Segment<T>[] = []
  for (const item of inWeek) {
    const s = item.start < weekStart ? weekStart : item.start
    const e = item.end > weekEnd ? weekEnd : item.end
    const col = diffDays(weekStart, s)
    const span = diffDays(s, e) + 1
    let lane = laneEnds.findIndex((endCol) => endCol < col)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(col + span - 1)
    } else laneEnds[lane] = col + span - 1
    out.push({ item, col, span, lane, clippedStart: item.start < weekStart, clippedEnd: item.end > weekEnd })
  }
  return out
}

/** How many hidden items each day has when only MAX_LANES lanes are drawn. */
export function overflowPerDay(segments: Segment[], maxLanes = MAX_LANES): number[] {
  const counts = Array(7).fill(0) as number[]
  for (const seg of segments) {
    if (seg.lane < maxLanes) continue
    for (let c = seg.col; c < seg.col + seg.span; c++) counts[c]++
  }
  return counts
}
