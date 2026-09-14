import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import styles from './surfaces.module.css'

export type ToastTone = 'info' | 'success' | 'error' | 'warn'

export interface ToastItem {
  id: number
  message: string
  tone: ToastTone
  action?: { label: string; onClick: () => void }
}

interface ToastApi {
  show: (message: string, opts?: { tone?: ToastTone; action?: ToastItem['action']; duration?: number }) => void
  success: (message: string) => void
  error: (message: string) => void
  warn: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), [])

  const show = useCallback<ToastApi['show']>(
    (message, opts = {}) => {
      const id = ++seq.current
      setItems((xs) => [...xs, { id, message, tone: opts.tone ?? 'info', action: opts.action }])
      window.setTimeout(() => dismiss(id), opts.duration ?? (opts.action ? 5000 : 3200))
    },
    [dismiss],
  )

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show(m, { tone: 'success' }),
      error: (m) => show(m, { tone: 'error', duration: 5000 }),
      warn: (m) => show(m, { tone: 'warn' }),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.toasts} aria-live="polite" aria-atomic="false">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={[
              styles.toast,
              t.tone === 'error' && styles.toastError,
              t.tone === 'warn' && styles.toastWarn,
              t.tone === 'success' && styles.toastSuccess,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span>{t.message}</span>
            {t.action && (
              <button
                type="button"
                className={styles.toastAction}
                onClick={() => {
                  t.action?.onClick()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return { show: () => {}, success: () => {}, error: () => {}, warn: () => {} }
  }
  return ctx
}
