import { X } from 'lucide-react'
import { useEffect, useId, useRef, type HTMLAttributes, type ReactNode } from 'react'
import { IconButton } from './Button'
import styles from './surfaces.module.css'

// ---------------------------------------------------------------------- Card

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'md' | 'sm'
}

export function Card({ padding = 'none', className, children, ...rest }: CardProps) {
  const cls = [styles.card, padding === 'md' && styles.cardPad, padding === 'sm' && styles.cardPadSm, className]
  return (
    <div className={cls.filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  )
}

// --------------------------------------------------------------- ProgressBar

export function ProgressBar({ value, tone = 'primary', size = 'md', label }: { value: number; tone?: 'primary' | 'task'; size?: 'md' | 'lg'; label?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div
      className={[styles.progress, tone === 'task' && styles.progressTask, size === 'lg' && styles.progressLg].filter(Boolean).join(' ')}
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={styles.progressBar} style={{ width: `${v}%` }} />
    </div>
  )
}

// ---------------------------------------------------------------- EmptyState

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className={styles.empty}>
      {icon && <div className={styles.emptyIcon}>{icon}</div>}
      <div className={styles.emptyTitle}>{title}</div>
      {description && <p style={{ margin: 0 }}>{description}</p>}
      {action}
    </div>
  )
}

export function Skeleton({ width = '100%', height = 16, className, style }: { width?: number | string; height?: number | string; className?: string; style?: React.CSSProperties }) {
  return <div className={[styles.skeleton, className].filter(Boolean).join(' ')} style={{ width, height, ...style }} aria-hidden="true" />
}

// ------------------------------------------------------------------- Tooltip

export function Tooltip({ text, children }: { text: ReactNode; children: ReactNode }) {
  return (
    <span className={styles.tipWrap}>
      {children}
      <span role="tooltip" className={styles.tip}>
        {text}
      </span>
    </span>
  )
}

// -------------------------------------------------------------------- Dialog

export interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  actions?: ReactNode
  /** lg = 640px for dense forms (chain dialog); default 460px */
  size?: 'md' | 'lg'
}

export function Dialog({ open, onClose, title, description, children, actions, size = 'md' }: DialogProps) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])')
    first?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className={[styles.dialog, size === 'lg' && styles.dialogLg].filter(Boolean).join(' ')}>
        <div className={styles.dialogHead}>
          <div>
            <h2 id={titleId} className={styles.dialogTitle}>
              {title}
            </h2>
            {description && <p className={styles.dialogDesc}>{description}</p>}
          </div>
          <IconButton label="ปิด" onClick={onClose} data-close>
            <X size={16} />
          </IconButton>
        </div>
        {children}
        {actions && <div className={styles.dialogActions}>{actions}</div>}
      </div>
    </div>
  )
}
