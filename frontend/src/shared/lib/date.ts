/** Date helpers. Wire format is ISO `YYYY-MM-DD` (ค.ศ.); display is Thai with พ.ศ. */

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]
export const THAI_MONTHS_LONG = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]
export const THAI_WEEKDAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.']
/** ISO weekday (1 = Monday … 7 = Sunday) → Thai one-letter label */
export const THAI_WEEKDAY_LETTER: Record<number, string> = {
  1: 'จ', 2: 'อ', 3: 'พ', 4: 'พฤ', 5: 'ศ', 6: 'ส', 7: 'อา',
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function todayISO(): string {
  const now = new Date()
  return toISO(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())))
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return toISO(d)
}

/** Whole calendar days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000)
}

/** ISO weekday 1..7 (Monday = 1). */
export function isoWeekday(iso: string): number {
  const d = parseISO(iso).getUTCDay()
  return d === 0 ? 7 : d
}

export function startOfWeekISO(iso: string): string {
  return addDays(iso, 1 - isoWeekday(iso))
}

export function startOfMonthISO(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

export function addMonths(iso: string, n: number): string {
  const d = parseISO(iso)
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + n)
  return toISO(d)
}

export function buddhistYear(iso: string): number {
  return parseISO(iso).getUTCFullYear() + 543
}

/** "6 ต.ค." or "6 ต.ค. 2569" */
export function formatThai(iso: string | null | undefined, opts: { year?: boolean } = {}): string {
  if (!iso) return '—'
  const d = parseISO(iso)
  const base = `${d.getUTCDate()} ${THAI_MONTHS_SHORT[d.getUTCMonth()]}`
  return opts.year ? `${base} ${d.getUTCFullYear() + 543}` : base
}

/** "14 ก.ย. – 6 ต.ค. 2569" (year shown once unless it differs). */
export function formatThaiRange(a: string | null | undefined, b: string | null | undefined): string {
  if (!a || !b) return '—'
  const ya = buddhistYear(a)
  const yb = buddhistYear(b)
  if (ya !== yb) return `${formatThai(a, { year: true })} – ${formatThai(b, { year: true })}`
  return `${formatThai(a)} – ${formatThai(b, { year: true })}`
}

/** "กันยายน 2569" */
export function formatThaiMonth(iso: string): string {
  const d = parseISO(iso)
  return `${THAI_MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`
}
