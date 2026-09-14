import { Trash2, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useDeleteDependency, useUpdateDependency } from '@/features/projects/api'
import type { DependencyType, ProjectOut } from '@/features/projects/types'
import { ApiError } from '@/shared/api/client'
import { Field, IconButton, NumberInput, Select, useToast } from '@/shared/ui'
import styles from './popover.module.css'

const TYPES: { value: DependencyType; label: string }[] = [
  { value: 'FS', label: 'FS เสร็จแล้วค่อยเริ่ม' },
  { value: 'SS', label: 'SS เริ่มพร้อมกัน' },
  { value: 'FF', label: 'FF เสร็จพร้อมกัน' },
  { value: 'SF', label: 'SF เริ่มก่อนจึงเสร็จได้' },
]

export interface DependencyPopoverProps {
  project: ProjectOut
  depId: string
  x: number
  y: number
  onClose: () => void
}

/** Small floating editor opened by clicking a dependency arrow (docs/features.md DEP-3). */
export function DependencyPopover({ project, depId, x, y, onClose }: DependencyPopoverProps) {
  const toast = useToast()
  const update = useUpdateDependency(project.id)
  const remove = useDeleteDependency(project.id)
  const ref = useRef<HTMLDivElement>(null)
  const dep = project.dependencies.find((d) => d.id === depId)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (!dep) return null
  const from = project.tasks.find((t) => t.id === dep.from)?.name ?? dep.from
  const to = project.tasks.find((t) => t.id === dep.to)?.name ?? dep.to
  const fail = (e: unknown) => toast.error(e instanceof ApiError ? 'แก้ไขไม่สำเร็จ' : 'แก้ไขไม่สำเร็จ')

  const left = Math.min(x, window.innerWidth - 300)
  const top = Math.min(y, window.innerHeight - 220)
  return (
    <div ref={ref} className={styles.pop} style={{ left, top }} role="dialog" aria-label="แก้ไขความสัมพันธ์" data-testid="dep-popover">
      <div className={styles.head}>
        <div className={styles.title}>
          <span className={styles.name}>{from}</span>
          <span className={styles.arrow}>→</span>
          <span className={styles.name}>{to}</span>
        </div>
        <IconButton label="ปิด" onClick={onClose}>
          <X size={14} />
        </IconButton>
      </div>
      <div className={styles.row}>
        <Field label="ประเภท" htmlFor="dep-type">
          <Select<DependencyType> id="dep-type" value={dep.type} options={TYPES} onChange={(type) => update.mutate({ depId, type }, { onError: fail })} />
        </Field>
        <Field label="lag (วัน)" htmlFor="dep-lag">
          <NumberInput
            id="dep-lag"
            value={dep.lag}
            min={-3650}
            max={3650}
            suffix="วัน"
            onChange={(v) => v !== '' && v !== dep.lag && update.mutate({ depId, lag: v }, { onError: fail })}
          />
        </Field>
      </div>
      <button
        type="button"
        className={styles.delete}
        onClick={() =>
          remove.mutate(depId, {
            onSuccess: () => {
              toast.success('ลบความสัมพันธ์แล้ว')
              onClose()
            },
            onError: fail,
          })
        }
      >
        <Trash2 size={14} /> ลบความสัมพันธ์
      </button>
    </div>
  )
}
