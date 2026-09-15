import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { addMonths, formatThai, formatThaiMonth, isoWeekday, parseISO, startOfMonthISO, toISO, todayISO } from '@/shared/lib/date'
import { useIsMobile } from '@/shared/lib/useIsMobile'
import styles from './datePicker.module.css'

export interface DatePickerProps {
  value: string | '' | null
  onChange: (iso: string) => void
  id?: string
  'aria-label'?: string
  min?: string
  max?: string
  placeholder?: string
  disabled?: boolean
  /** show an × that calls onChange('') */
  clearable?: boolean
  className?: string
}

const WEEKDAYS = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.']

/** 6×7 grid of ISO dates for the month containing `monthIso`, weeks starting Monday. */
export function monthCells(monthIso: string): string[] {
  const first = startOfMonthISO(monthIso)
  const lead = isoWeekday(first) - 1 // Monday = 0
  const start = parseISO(first)
  start.setUTCDate(start.getUTCDate() - lead)
  const out: string[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    out.push(toISO(d))
  }
  return out
}

/**
 * Thai date picker (พ.ศ. display, ISO value). Popover on desktop, bottom sheet on mobile.
 * Replaces the native date input, whose format depends on the OS language.
 */
export function DatePicker({ value, onChange, id, min, max, placeholder = 'เลือกวันที่', disabled, clearable, className, ...rest }: DatePickerProps) {
  const label = rest['aria-label']
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => startOfMonthISO(value || todayISO()))
  const wrapRef = useRef<HTMLDivElement>(null)
  const gridId = useId()
  const mobile = useIsMobile()
  const today = todayISO()

  useEffect(() => {
    if (open) setMonth(startOfMonthISO(value || todayISO()))
  }, [open, value])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (iso: string) => {
    onChange(iso)
    setOpen(false)
  }
  const inRange = (iso: string) => (!min || iso >= min) && (!max || iso <= max)
  const cells = monthCells(month)
  const monthStart = startOfMonthISO(month)
  const monthEnd = toISO(new Date(Date.UTC(parseISO(monthStart).getUTCFullYear(), parseISO(monthStart).getUTCMonth() + 1, 0)))

  const panel = (
    <div id={gridId} role="dialog" aria-label={`เลือกวันที่${label ? ` ${label}` : ''}`} className={[styles.pop, mobile && styles.sheet].filter(Boolean).join(' ')} data-testid="date-picker">
      <div className={styles.head}>
        <button type="button" className={styles.nav} aria-label="เดือนก่อนหน้า" onClick={() => setMonth(addMonths(month, -1))}>
          <ChevronLeft size={18} />
        </button>
        <span className={styles.month} aria-live="polite">{formatThaiMonth(month)}</span>
        <button type="button" className={styles.nav} aria-label="เดือนถัดไป" onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRight size={18} />
        </button>
        {mobile && (
          <button type="button" className={styles.nav} aria-label="ปิด" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        )}
      </div>
      <div className={styles.weekdays} aria-hidden="true">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className={styles.grid} role="grid" aria-label={formatThaiMonth(month)}>
        {cells.map((iso) => {
          const outside = iso < monthStart || iso > monthEnd
          const selected = iso === value
          const dis = !inRange(iso)
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              aria-selected={selected}
              aria-label={formatThai(iso, { year: true })}
              data-testid={`day-${iso}`}
              disabled={dis}
              className={[styles.day, outside && styles.dayOut, selected && styles.daySel, iso === today && styles.dayToday, isoWeekday(iso) >= 6 && styles.dayWe].filter(Boolean).join(' ')}
              onClick={() => pick(iso)}
            >
              {parseISO(iso).getUTCDate()}
            </button>
          )
        })}
      </div>
      <div className={styles.foot}>
        <button type="button" className={styles.link} onClick={() => setMonth(startOfMonthISO(today))}>
          ไปเดือนนี้
        </button>
        <button type="button" className={styles.link} disabled={!inRange(today)} onClick={() => pick(today)}>
          วันนี้ · {formatThai(today)}
        </button>
      </div>
    </div>
  )

  return (
    <div ref={wrapRef} className={[styles.wrap, className].filter(Boolean).join(' ')}>
      <button
        type="button"
        id={id}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? gridId : undefined}
        disabled={disabled}
        className={[styles.control, !value && styles.placeholder].filter(Boolean).join(' ')}
        onClick={() => setOpen((v) => !v)}
        data-value={value || ''}
      >
        <CalendarDays size={16} aria-hidden="true" />
        <span className={styles.text}>{value ? formatThai(value, { year: true }) : placeholder}</span>
      </button>
      {clearable && value && !disabled && (
        <button type="button" className={styles.clear} aria-label="ล้างวันที่" onClick={() => onChange('')}>
          <X size={14} />
        </button>
      )}
      {open && (mobile ? <div className={styles.backdrop} onClick={() => setOpen(false)}>{panel}</div> : panel)}
    </div>
  )
}
