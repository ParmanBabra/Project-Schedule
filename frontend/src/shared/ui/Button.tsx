import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'onDark'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'md' | 'sm'
  icon?: ReactNode
  block?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  block,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const cls = [styles.btn, styles[variant], size === 'sm' && styles.sm, block && styles.block, className]
    .filter(Boolean)
    .join(' ')
  return (
    <button type={type} className={cls} {...rest}>
      {icon}
      {children}
    </button>
  )
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  onDark?: boolean
  size?: 'md' | 'lg'
}

export function IconButton({ label, onDark, size = 'md', className, children, type = 'button', ...rest }: IconButtonProps) {
  const cls = [styles.iconBtn, onDark && styles.iconBtnDark, size === 'lg' && styles.iconBtnLg, className]
    .filter(Boolean)
    .join(' ')
  return (
    <button type={type} aria-label={label} title={label} className={cls} {...rest}>
      {children}
    </button>
  )
}
