/** Pure helpers for drag interactions (move / resize / link). Mirrors the backend calendar rules. */
import type { TaskSchedule } from '@/features/projects/types'
import { addDays, isoWeekday } from '@/shared/lib/date'

export interface WorkCal {
  workingDays: number[]
  holidays: string[]
}

export function isWorkingDay(iso: string, cal: WorkCal): boolean {
  return cal.workingDays.includes(isoWeekday(iso)) && !cal.holidays.includes(iso)
}

export function nextWorkingDay(iso: string, cal: WorkCal): string {
  let d = iso
  for (let i = 0; i < 400 && !isWorkingDay(d, cal); i++) d = addDays(d, 1)
  return d
}

export function prevWorkingDay(iso: string, cal: WorkCal): string {
  let d = iso
  for (let i = 0; i < 400 && !isWorkingDay(d, cal); i++) d = addDays(d, -1)
  return d
}

/** Inclusive count of working days in [a, b]; 0 when b < a. */
export function countWorkingDays(a: string, b: string, cal: WorkCal): number {
  if (b < a) return 0
  let n = 0
  for (let d = a; d <= b; d = addDays(d, 1)) if (isWorkingDay(d, cal)) n++
  return n
}

/** Whole days for a horizontal pointer delta. */
export function snapDays(dx: number, pxPerDay: number): number {
  return Math.round(dx / pxPerDay)
}

/** New start date when a bar is moved by `days` calendar days (snapped to a working day). */
export function moveTarget(s: TaskSchedule, days: number, cal: WorkCal): string {
  return nextWorkingDay(addDays(s.start, days), cal)
}

/**
 * A milestone is drawn at the END of the day it shows. Moving it by `days` must make it show on
 * that day (snapped back to a working day), so the "start no earlier than" we send is the next
 * working day after it: the engine puts the milestone on the boundary where that day begins.
 */
export function milestoneTarget(s: TaskSchedule, days: number, cal: WorkCal): { start: string; shown: string } {
  const shown = prevWorkingDay(addDays(s.end, days), cal)
  return { start: nextWorkingDay(addDays(shown, 1), cal), shown }
}

/** New working-day duration when the right edge is dragged by `days` calendar days (min 1). */
export function resizeTarget(s: TaskSchedule, days: number, cal: WorkCal): number {
  const end = prevWorkingDay(addDays(s.end, days), cal)
  return Math.max(1, countWorkingDays(s.start, end, cal))
}

export type DragMode = 'move' | 'resize' | 'link'

export interface DragState {
  mode: DragMode
  taskId: string
  startClientX: number
  startClientY: number
  dx: number
  dy: number
  /** true once the pointer moved past the click threshold */
  active: boolean
  /** link mode: id of the row currently under the pointer */
  overTaskId: string | null
}

export const DRAG_THRESHOLD_PX = 4
