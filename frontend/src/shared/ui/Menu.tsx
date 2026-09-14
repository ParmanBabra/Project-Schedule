import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import styles from './menu.module.css'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
}

export interface MenuProps {
  items: MenuItem[]
  /** Render the trigger. Receives props to spread on a button. */
  trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu'; 'aria-controls': string }) => ReactNode
  align?: 'left' | 'right'
}

export function Menu({ items, trigger, align = 'right' }: MenuProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
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

  return (
    <div ref={ref} className={styles.wrap}>
      {trigger({ onClick: () => setOpen((v) => !v), 'aria-expanded': open, 'aria-haspopup': 'menu', 'aria-controls': id })}
      {open && (
        <div id={id} role="menu" className={[styles.menu, align === 'left' && styles.left].filter(Boolean).join(' ')}>
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              className={[styles.item, it.danger && styles.danger].filter(Boolean).join(' ')}
              onClick={() => {
                setOpen(false)
                it.onSelect()
              }}
            >
              {it.icon}
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
