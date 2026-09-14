/**
 * Pure timeline geometry for the Gantt. The x axis is calendar days from `origin`;
 * every zoom level just changes pixels-per-day. Working-day maths stays in the backend –
 * the frontend only draws what the schedule says.
 */
import { addDays, diffDays, formatThai, isoWeekday, parseISO, startOfWeekISO, THAI_MONTHS_SHORT } from '@/shared/lib/date'
import type { ProjectOut, TaskSchedule } from '@/features/projects/types'

export type Zoom = 'day' | 'week' | 'month'

export const PX_PER_DAY: Record<Zoom, number> = { day: 36, week: 12, month: 4 }
export const ROW_HEIGHT = 44
export const BAR_HEIGHT = 26
export const HEADER_HEIGHT = 56

export interface Axis {
  origin: string // ISO date at x = 0
  end: string // exclusive
  days: number
  pxPerDay: number
  width: number
}

export interface HeaderCell {
  key: string
  x: number
  width: number
  label: string
  muted?: boolean
}

export interface Shade {
  x: number
  width: number
  kind: 'weekend' | 'holiday'
}

/** Compute the visible range: a week before the earliest date, two weeks after the latest. */
export function computeAxis(project: ProjectOut, zoom: Zoom, minWidth = 800): Axis {
  const pxPerDay = PX_PER_DAY[zoom]
  const schedules = Object.values(project.schedule.tasks)
  let earliest = project.startDate
  let latest = addDays(project.startDate, 27)
  for (const s of schedules) {
    if (s.start < earliest) earliest = s.start
    if (s.end > latest) latest = s.end
  }
  const b = project.schedule.buffer
  if (b.managementReserveEnd && b.managementReserveEnd > latest) latest = b.managementReserveEnd
  else if (b.end && b.end > latest) latest = b.end
  const origin = addDays(startOfWeekISO(earliest), -7)
  let end = addDays(startOfWeekISO(addDays(latest, 14)), 7)
  let days = diffDays(origin, end)
  const needed = Math.ceil(minWidth / pxPerDay)
  if (days < needed) {
    days = needed
    end = addDays(origin, days)
  }
  return { origin, end, days, pxPerDay, width: days * pxPerDay }
}

export function xOfDate(axis: Axis, iso: string): number {
  return diffDays(axis.origin, iso) * axis.pxPerDay
}

/** x of the *end* of the given day (start of the next day). */
export function xOfDayEnd(axis: Axis, iso: string): number {
  return xOfDate(axis, iso) + axis.pxPerDay
}

export function dateAtX(axis: Axis, x: number): string {
  return addDays(axis.origin, Math.floor(x / axis.pxPerDay))
}

// ------------------------------------------------------------------ headers

export function headerRows(axis: Axis, zoom: Zoom): { top: HeaderCell[]; bottom: HeaderCell[] } {
  const top: HeaderCell[] = []
  const bottom: HeaderCell[] = []
  const w = axis.pxPerDay
  if (zoom === 'day') {
    for (let d = 0; d < axis.days; d++) {
      const iso = addDays(axis.origin, d)
      const wd = isoWeekday(iso)
      bottom.push({ key: iso, x: d * w, width: w, label: String(parseISO(iso).getUTCDate()), muted: wd >= 6 })
      if (wd === 1) {
        const endIso = addDays(iso, 6)
        top.push({ key: `w${iso}`, x: d * w, width: 7 * w, label: weekLabel(iso, endIso) })
      }
    }
  } else if (zoom === 'week') {
    for (let d = 0; d < axis.days; d++) {
      const iso = addDays(axis.origin, d)
      if (isoWeekday(iso) === 1) bottom.push({ key: iso, x: d * w, width: 7 * w, label: String(parseISO(iso).getUTCDate()) })
      if (iso.endsWith('-01') || d === 0) {
        const monthEnd = firstOfNextMonth(iso)
        const span = Math.min(diffDays(iso, monthEnd), axis.days - d)
        top.push({ key: `m${iso}`, x: d * w, width: span * w, label: monthLabel(iso) })
      }
    }
  } else {
    for (let d = 0; d < axis.days; d++) {
      const iso = addDays(axis.origin, d)
      if (iso.endsWith('-01') || d === 0) {
        const monthEnd = firstOfNextMonth(iso)
        const span = Math.min(diffDays(iso, monthEnd), axis.days - d)
        bottom.push({ key: `m${iso}`, x: d * w, width: span * w, label: THAI_MONTHS_SHORT[parseISO(iso).getUTCMonth()] })
      }
      if (iso.endsWith('-01-01') || d === 0) {
        const yearEnd = `${Number(iso.slice(0, 4)) + 1}-01-01`
        const span = Math.min(diffDays(iso, yearEnd), axis.days - d)
        top.push({ key: `y${iso}`, x: d * w, width: span * w, label: String(parseISO(iso).getUTCFullYear() + 543) })
      }
    }
  }
  return { top, bottom }
}

function firstOfNextMonth(iso: string): string {
  const d = parseISO(iso)
  return `${d.getUTCMonth() === 11 ? d.getUTCFullYear() + 1 : d.getUTCFullYear()}-${String(((d.getUTCMonth() + 1) % 12) + 1).padStart(2, '0')}-01`
}

function weekLabel(a: string, b: string): string {
  const da = parseISO(a)
  const db = parseISO(b)
  if (da.getUTCMonth() === db.getUTCMonth()) return `${da.getUTCDate()} – ${formatThai(b, { year: true })}`
  return `${formatThai(a)} – ${formatThai(b, { year: true })}`
}

function monthLabel(iso: string): string {
  const d = parseISO(iso)
  return `${THAI_MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`
}

// ------------------------------------------------------------------- shading

export function nonWorkingShades(axis: Axis, workingDays: number[], holidays: string[]): Shade[] {
  const out: Shade[] = []
  const hol = new Set(holidays)
  const w = axis.pxPerDay
  let run: Shade | null = null
  for (let d = 0; d < axis.days; d++) {
    const iso = addDays(axis.origin, d)
    const kind: Shade['kind'] | null = hol.has(iso) ? 'holiday' : !workingDays.includes(isoWeekday(iso)) ? 'weekend' : null
    if (kind && run && run.kind === kind && run.x + run.width === d * w) run.width += w
    else if (kind) {
      run = { x: d * w, width: w, kind }
      out.push(run)
    } else run = null
  }
  return out
}

// ---------------------------------------------------------------------- bars

export interface BarGeometry {
  x: number
  width: number
  endX: number
  floatX?: number
  floatWidth?: number
}

export function barGeometry(axis: Axis, s: TaskSchedule): BarGeometry {
  if (s.isMilestone) {
    // diamond centred on the end-of-day boundary; anchors on its left/right tips
    const cx = xOfDayEnd(axis, s.end)
    return { x: cx - 8, width: 0, endX: cx + 8 }
  }
  const x = xOfDate(axis, s.start)
  const endX = xOfDayEnd(axis, s.end)
  const geo: BarGeometry = { x, width: Math.max(endX - x, axis.pxPerDay), endX }
  if (s.totalFloat > 0 && s.lateFinish > s.end) {
    geo.floatX = endX
    geo.floatWidth = xOfDayEnd(axis, s.lateFinish) - endX
  }
  return geo
}

// -------------------------------------------------------------------- arrows

export interface ArrowGeometry {
  id: string
  path: string
  critical: boolean
}

export function arrowPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  rowHeight = ROW_HEIGHT,
): string {
  const gap = 8
  if (to.x >= from.x + 2 * gap) {
    const mid = from.x + Math.max(gap, (to.x - from.x) / 2)
    return `M${from.x} ${from.y} H${mid} V${to.y} H${to.x}`
  }
  const dir = to.y >= from.y ? 1 : -1
  const bendY = from.y + (dir * rowHeight) / 2
  return `M${from.x} ${from.y} h${gap} V${bendY} H${to.x - gap} V${to.y} H${to.x}`
}

/** Anchor points on a bar for each dependency side. */
export function anchor(geo: BarGeometry, side: 'start' | 'finish', y: number) {
  return { x: side === 'start' ? geo.x : geo.endX, y }
}

export const DEP_SIDES: Record<string, { from: 'start' | 'finish'; to: 'start' | 'finish' }> = {
  FS: { from: 'finish', to: 'start' },
  SS: { from: 'start', to: 'start' },
  FF: { from: 'finish', to: 'finish' },
  SF: { from: 'start', to: 'finish' },
}
