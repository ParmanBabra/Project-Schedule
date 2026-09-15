import { Check, GripVertical, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useUpdateTask } from '@/features/projects/api'
import type { ProjectOut } from '@/features/projects/types'
import { Chip, ProgressBar, Toggle, useToast } from '@/shared/ui'
import styles from './taskPanel.module.css'

interface Props {
  project: ProjectOut
  taskId: string
}

type Draft = { id?: string; text: string; done: boolean }

/** Derived progress the server will store when the switch is on (TSK-8). */
export function checklistPercent(items: Array<{ done: boolean }>): number | null {
  if (items.length === 0) return null
  return Math.round((items.filter((i) => i.done).length * 100) / items.length)
}

/**
 * งานย่อย (checklist) inside the task panel: tick, edit inline, add, delete, drag to reorder.
 * Every change sends the full list; the server assigns ids and derives the task progress.
 */
export function ChecklistSection({ project, taskId }: Props) {
  const toast = useToast()
  const task = project.tasks.find((t) => t.id === taskId)
  const updateTask = useUpdateTask(project.id)
  const [items, setItems] = useState<Draft[]>(task?.checklist ?? [])
  const [draft, setDraft] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [synced, setSynced] = useState(0)
  const addRef = useRef<HTMLInputElement>(null)
  // One PATCH in flight at a time; rapid edits coalesce into the newest list so nothing
  // is lost or reordered on the server (each PATCH carries the whole list).
  const queue = useRef<{ busy: boolean; next: Draft[] | null }>({ busy: false, next: null })

  // adopt the server copy (with ids) only when no local edit is pending
  useEffect(() => {
    if (!queue.current.busy) setItems(task?.checklist ?? [])
  }, [task?.checklist, synced])

  if (!task) return null
  const done = items.filter((i) => i.done).length
  const derived = checklistPercent(items)

  const send = (list: Draft[]) => {
    updateTask.mutate(
      { taskId, checklist: list.map(({ id, text, done }) => ({ id, text, done })) },
      {
        onError: () => toast.error('บันทึกงานย่อยไม่สำเร็จ'),
        onSettled: () => {
          const next = queue.current.next
          queue.current.next = null
          if (next) send(next)
          else {
            queue.current.busy = false
            setSynced((n) => n + 1)
          }
        },
      },
    )
  }
  const commit = (next: Draft[]) => {
    setItems(next)
    if (queue.current.busy) queue.current.next = next
    else {
      queue.current.busy = true
      send(next)
    }
  }

  const toggle = (i: number) => commit(items.map((it, k) => (k === i ? { ...it, done: !it.done } : it)))
  const rename = (i: number, text: string) => setItems(items.map((it, k) => (k === i ? { ...it, text } : it)))
  const commitRename = (i: number) => {
    const text = items[i]?.text.trim()
    if (!text) {
      // empty text = delete, like most checklist UIs
      commit(items.filter((_, k) => k !== i))
      return
    }
    if (text !== task.checklist[i]?.text) commit(items.map((it, k) => (k === i ? { ...it, text } : it)))
  }
  const remove = (i: number) => commit(items.filter((_, k) => k !== i))
  const add = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    commit([...items, { text, done: false }])
    window.setTimeout(() => addRef.current?.focus(), 0)
  }
  const onAddKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      add()
    }
  }
  const drop = (to: number) => {
    if (dragIndex === null || dragIndex === to) return
    const next = [...items]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(to, 0, moved)
    setDragIndex(null)
    commit(next)
  }

  return (
    <div className={styles.section} data-testid="checklist">
      <div className={styles.sectionTitle}>
        <span>งานย่อย</span>
        {items.length > 0 && (
          <Chip tone="primary" data-testid="checklist-count">
            เสร็จ {done} / {items.length}
          </Chip>
        )}
      </div>
      {items.length > 0 && <ProgressBar value={derived ?? 0} aria-label="ความคืบหน้าของงานย่อย" />}
      <ul className={styles.ckList} aria-label="รายการงานย่อย">
        {items.map((it, i) => (
          <li
            key={it.id ?? `new-${i}`}
            className={[styles.ck, it.done && styles.ckDone, dragIndex === i && styles.ckDragging].filter(Boolean).join(' ')}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drop(i)}
            onDragEnd={() => setDragIndex(null)}
            data-testid={`ck-${it.id ?? i}`}
          >
            <span className={styles.ckGrip} aria-hidden="true">
              <GripVertical size={14} />
            </span>
            <button
              type="button"
              role="checkbox"
              aria-checked={it.done}
              aria-label={`${it.done ? 'ยกเลิก' : 'ทำเสร็จ'} ${it.text}`}
              className={[styles.ckBox, it.done && styles.ckBoxOn].filter(Boolean).join(' ')}
              onClick={() => toggle(i)}
            >
              {it.done && <Check size={14} />}
            </button>
            <input
              className={styles.ckText}
              aria-label={`ข้อความงานย่อย ${i + 1}`}
              value={it.text}
              maxLength={300}
              onChange={(e) => rename(i, e.target.value)}
              onBlur={() => commitRename(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
            />
            <button type="button" className={styles.ckDel} aria-label={`ลบงานย่อย ${it.text}`} onClick={() => remove(i)}>
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.ckAdd}>
        <Plus size={14} aria-hidden="true" />
        <input
          ref={addRef}
          aria-label="เพิ่มงานย่อย"
          placeholder="เพิ่มงานย่อย · พิมพ์แล้ว Enter"
          value={draft}
          maxLength={300}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onAddKey}
          onBlur={add}
        />
      </div>
      {items.length > 0 && (
        <>
          <Toggle
            checked={task.progressFromChecklist}
            onChange={(v) => updateTask.mutate({ taskId, progressFromChecklist: v }, { onError: () => toast.error('บันทึกไม่สำเร็จ') })}
            label="คิด % ความคืบหน้าจากงานย่อย"
          />
          {task.progressFromChecklist && (
            <div className={styles.infoBox} data-testid="checklist-note">
              ติ๊กงานย่อยแล้ว % ของงานจะเป็น <b>{done} ÷ {items.length} = {derived}%</b> อัตโนมัติ ปิดสวิตช์ถ้าอยากกรอก % เอง
            </div>
          )}
        </>
      )}
    </div>
  )
}
