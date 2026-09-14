import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import styles from './badges.module.css'

export type ChipTone = 'critical' | 'soft' | 'primary' | 'warn' | 'green' | 'neutral'

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone
  icon?: ReactNode
}

export function Chip({ tone = 'soft', icon, className, children, ...rest }: ChipProps) {
  return (
    <span className={[styles.chip, styles[tone], className].filter(Boolean).join(' ')} {...rest}>
      {icon}
      {children}
    </span>
  )
}

export interface ChipButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ChipTone
  icon?: ReactNode
}

export function ChipButton({ tone = 'soft', icon, className, children, type = 'button', ...rest }: ChipButtonProps) {
  return (
    <button
      type={type}
      className={[styles.chip, styles.chipButton, styles[tone], className].filter(Boolean).join(' ')}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'primary' | 'soft' | 'critical'
}

export function Pill({ tone = 'primary', className, children, ...rest }: PillProps) {
  const cls = [styles.pill, tone === 'soft' && styles.pillSoft, tone === 'critical' && styles.pillCritical, className]
  return (
    <span className={cls.filter(Boolean).join(' ')} {...rest}>
      {children}
    </span>
  )
}

export function PillButton({
  tone = 'primary',
  className,
  children,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'soft' | 'critical' }) {
  const cls = [styles.pill, tone === 'soft' && styles.pillSoft, tone === 'critical' && styles.pillCritical, className]
  return (
    <button type={type} className={cls.filter(Boolean).join(' ')} {...rest}>
      {children}
    </button>
  )
}

export interface AvatarProps {
  name: string
  color?: string
  size?: 'sm' | 'lg'
  className?: string
}

export function Avatar({ name, color = 'var(--primary)', size = 'sm', className }: AvatarProps) {
  const initial = Array.from(name.trim())[0] ?? '?'
  return (
    <span
      className={[styles.avatar, size === 'lg' ? styles.avatarLg : styles.avatarSm, className].filter(Boolean).join(' ')}
      style={{ background: color }}
      aria-label={name}
      title={name}
    >
      {initial}
    </span>
  )
}

export type DotKind = 'task' | 'critical' | 'near' | 'milestone' | 'summary'

export function StatusDot({ kind = 'task', className }: { kind?: DotKind; className?: string }) {
  const map: Record<DotKind, string | undefined> = {
    task: undefined,
    critical: styles.dotCritical,
    near: styles.dotNear,
    milestone: styles.dotMilestone,
    summary: styles.dotSummary,
  }
  return <span className={[styles.dot, map[kind], className].filter(Boolean).join(' ')} aria-hidden="true" />
}
