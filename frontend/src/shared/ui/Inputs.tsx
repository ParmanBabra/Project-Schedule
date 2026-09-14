import { ChevronDown } from 'lucide-react'
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { THAI_WEEKDAY_LETTER } from '@/shared/lib/date'
import styles from './inputs.module.css'

// --------------------------------------------------------------------- Field

export interface FieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  htmlFor?: string
  children: ReactNode
  className?: string
}

export function Field({ label, hint, error, htmlFor, children, className }: FieldProps) {
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      {label && (
        <label className={styles.label} htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? <span className={styles.error} role="alert">{error}</span> : hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  )
}

// --------------------------------------------------------------------- Input

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  suffix?: ReactNode
}

export function Input({ invalid, suffix, className, readOnly, ...rest }: InputProps) {
  const cls = [styles.control, invalid && styles.controlError, readOnly && styles.readonly, className].filter(Boolean).join(' ')
  if (suffix) {
    return (
      <span className={styles.withSuffix}>
        <input className={cls} readOnly={readOnly} {...rest} />
        <span className={styles.suffix}>{suffix}</span>
      </span>
    )
  }
  return <input className={cls} readOnly={readOnly} {...rest} />
}

export interface NumberInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value: number | ''
  onChange: (value: number | '') => void
}

export function NumberInput({ value, onChange, min, max, step = 1, ...rest }: NumberInputProps) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const raw = e.target.value
        onChange(raw === '' ? '' : Number(raw))
      }}
      {...rest}
    />
  )
}

export function DateInput(props: InputProps) {
  return <Input type="date" {...props} />
}

// -------------------------------------------------------------------- Select

export interface SelectOption<T extends string | number> {
  value: T
  label: string
  disabled?: boolean
}

export interface SelectProps<T extends string | number> extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> {
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
  invalid?: boolean
}

export function Select<T extends string | number>({ value, options, onChange, invalid, className, ...rest }: SelectProps<T>) {
  const numeric = typeof value === 'number'
  return (
    <span className={styles.selectWrap}>
      <select
        className={[styles.control, styles.select, invalid && styles.controlError, className].filter(Boolean).join(' ')}
        value={String(value)}
        onChange={(e) => onChange((numeric ? Number(e.target.value) : e.target.value) as T)}
        {...rest}
      >
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={16} />
    </span>
  )
}

// ------------------------------------------------------------------- Segment

export interface SegmentProps<T extends string | number> {
  value: T
  options: Array<{ value: T; label: ReactNode; disabled?: boolean; title?: string }>
  onChange: (value: T) => void
  variant?: 'default' | 'white' | 'onDark'
  block?: boolean
  'aria-label'?: string
  className?: string
}

export function Segment<T extends string | number>({
  value,
  options,
  onChange,
  variant = 'default',
  block,
  className,
  ...rest
}: SegmentProps<T>) {
  const cls = [
    styles.segment,
    variant === 'white' && styles.segmentWhite,
    variant === 'onDark' && styles.segmentDark,
    block && styles.segmentBlock,
    className,
  ]
  return (
    <div role="radiogroup" className={cls.filter(Boolean).join(' ')} aria-label={rest['aria-label']}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            disabled={o.disabled}
            className={[styles.segBtn, on && styles.segBtnOn].filter(Boolean).join(' ')}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// -------------------------------------------------------------------- Toggle

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  disabled?: boolean
  id?: string
}

export function Toggle({ checked, onChange, label, disabled, id }: ToggleProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <label className={styles.toggle} htmlFor={inputId}>
      <input
        id={inputId}
        type="checkbox"
        role="switch"
        className={styles.toggleInput}
        checked={checked}
        disabled={disabled}
        aria-checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={[styles.track, checked && styles.trackOn].filter(Boolean).join(' ')} aria-hidden="true">
        <span className={styles.knob} />
      </span>
      {label && <span>{label}</span>}
    </label>
  )
}

// ---------------------------------------------------------------- WeekdayPicker

export interface WeekdayPickerProps {
  value: number[] // ISO weekdays 1..7
  onChange: (days: number[]) => void
  'aria-label'?: string
}

export function WeekdayPicker({ value, onChange, ...rest }: WeekdayPickerProps) {
  return (
    <div className={styles.dayBtns} role="group" aria-label={rest['aria-label'] ?? 'วันทำงาน'}>
      {[1, 2, 3, 4, 5, 6, 7].map((d) => {
        const on = value.includes(d)
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            className={[styles.dayBtn, on && styles.dayBtnOn].filter(Boolean).join(' ')}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort((a, b) => a - b))}
          >
            {THAI_WEEKDAY_LETTER[d]}
          </button>
        )
      })}
    </div>
  )
}
