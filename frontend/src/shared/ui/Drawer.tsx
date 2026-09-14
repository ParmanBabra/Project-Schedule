import { X } from 'lucide-react'
import { useEffect, useId, type ReactNode } from 'react'
import { IconButton } from './Button'
import styles from './drawer.module.css'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: number
  actions?: ReactNode
}

/** Left-side overlay panel (desktop 480px, full width on mobile). */
export function Drawer({ open, onClose, title, children, width = 480, actions }: DrawerProps) {
  const id = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-labelledby={id} className={styles.drawer} style={{ width }}>
        <div className={styles.head}>
          <h2 id={id} className={styles.title}>
            {title}
          </h2>
          <div className={styles.headActions}>
            {actions}
            <IconButton label="ปิด" onClick={onClose}>
              <X size={16} />
            </IconButton>
          </div>
        </div>
        <div className={styles.body}>{children}</div>
      </aside>
    </div>
  )
}
