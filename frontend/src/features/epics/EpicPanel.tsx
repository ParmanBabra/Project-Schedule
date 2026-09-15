import { ArrowDown, ArrowUp, Check, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AddTaskDialog } from '@/features/gantt/AddTaskDialog'
import { useDeleteTask, useReorderTasks, useUpdateTask } from '@/features/projects/api'
import type { ProjectOut } from '@/features/projects/types'
import { useResources } from '@/features/resources/api'
import { formatThai } from '@/shared/lib/date'
import { Button, Dialog, Field, IconButton, Input, Select, useToast } from '@/shared/ui'
import { useAddEpicMembers, useUpdateEpic } from './api'
import { EPIC_COLORS, descendantIds, epicOf, epicStats } from './lib/epics'
import panel from '@/features/tasks/taskPanel.module.css'
import styles from './epics.module.css'

interface Props {
  project: ProjectOut
  taskId: string
  onClose: () => void
  onSelect: (id: string) => void
}

/** Right-hand panel for an Epic (docs/features.md EPIC-4): identity, roll-up numbers, members. */
export function EpicPanel({ project, taskId, onClose, onSelect }: Props) {
  const toast = useToast()
  const epic = project.tasks.find((t) => t.id === taskId)
  const resources = useResources()
  const updateEpic = useUpdateEpic(project.id)
  const updateTask = useUpdateTask(project.id)
  const reorder = useReorderTasks(project.id)
  const addMembers = useAddEpicMembers(project.id)
  const deleteTask = useDeleteTask(project.id)
  const [name, setName] = useState(epic?.name ?? '')
  const [desc, setDesc] = useState(epic?.epic?.description ?? '')
  const [adding, setAdding] = useState(false)
  const [moving, setMoving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const descTimer = useRef<number | null>(null)

  useEffect(() => {
    setName(epic?.name ?? '')
    setDesc(epic?.epic?.description ?? '')
  }, [taskId, epic?.name, epic?.epic?.description])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const stats = useMemo(() => (epic ? epicStats(project, epic) : null), [project, epic])
  const children = useMemo(() => project.tasks.filter((t) => t.parentId === taskId).sort((a, b) => a.order - b.order), [project.tasks, taskId])
  const movable = useMemo(() => {
    const inside = new Set(descendantIds(project, taskId))
    return project.tasks.filter((t) => t.id !== taskId && !inside.has(t.id) && !epicOf(project, t.id) && !t.epic)
  }, [project, taskId])

  if (!epic || !epic.epic || !stats) return null
  const failed = () => toast.error('บันทึกไม่สำเร็จ')
  const patch = (body: Parameters<typeof updateEpic.mutate>[0]) => updateEpic.mutate(body, { onError: failed })
  const move = (i: number, dir: -1 | 1) => {
    const ids = children.map((c) => c.id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    reorder.mutate({ parentId: taskId, ids }, { onError: failed })
  }

  return (
    <>
      <div className={panel.backdrop} onClick={onClose} aria-hidden="true" />
      <aside className={panel.panel} aria-label={`Epic ${epic.name}`} data-testid="epic-panel">
        <div className={panel.handle} aria-hidden="true" />
        <div className={panel.scroll}>
          <div className={panel.head}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={panel.caption}>Epic · {stats.taskCount} งาน · #{project.schedule.tasks[taskId]?.wbs}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 4, background: epic.epic.color, flexShrink: 0 }} />
                <input
                  aria-label="ชื่อ Epic"
                  className={panel.nameInput}
                  value={name}
                  maxLength={200}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => (name.trim() && name.trim() !== epic.name ? patch({ taskId, name: name.trim() }) : setName(epic.name))}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                />
              </div>
            </div>
            <IconButton label="ปิด" onClick={onClose}><X size={16} /></IconButton>
          </div>

          <Field label="สี">
            <div className={styles.swatches} role="radiogroup" aria-label="สี Epic">
              {EPIC_COLORS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={epic.epic!.color === c} aria-label={c} className={[styles.swatch, epic.epic!.color === c && styles.swatchOn].filter(Boolean).join(' ')} style={{ background: c }} onClick={() => patch({ taskId, color: c })}>
                  {epic.epic!.color === c && <Check size={14} />}
                </button>
              ))}
            </div>
          </Field>

          <Field label="เป้าหมาย / คำอธิบาย" htmlFor="epic-panel-desc">
            <textarea
              id="epic-panel-desc"
              className={styles.textarea}
              style={{ background: 'var(--surface-3)' }}
              value={desc}
              maxLength={2000}
              placeholder="เช่น พนักงานหยิบสินค้าตาม picking list บนมือถือ"
              onChange={(e) => {
                setDesc(e.target.value)
                if (descTimer.current) window.clearTimeout(descTimer.current)
                descTimer.current = window.setTimeout(() => patch({ taskId, description: e.target.value }), 600)
              }}
            />
          </Field>

          <Field label="เจ้าของ" htmlFor="epic-panel-owner">
            <Select id="epic-panel-owner" value={epic.epic.ownerResourceId ?? ''} onChange={(v) => (v ? patch({ taskId, ownerResourceId: v }) : patch({ taskId, clearOwner: true }))} options={[{ value: '', label: 'ยังไม่ระบุ' }, ...(resources.data ?? []).map((r) => ({ value: r.id, label: r.name }))]} />
          </Field>

          <div className={styles.kv} data-testid="epic-stats">
            <div><span>ความคืบหน้า</span><b>{stats.progress}%</b></div>
            <div><span>เสร็จ</span><b>{stats.doneCount} / {stats.taskCount}</b></div>
            <div><span>ล่าช้า</span><b style={{ color: stats.lateCount ? 'var(--critical-text)' : undefined }}>{stats.lateCount}</b></div>
          </div>
          <div className={panel.row2}>
            <Field label="เริ่ม"><Input readOnly value={stats.start ? formatThai(stats.start, { year: true }) : '—'} aria-label="วันเริ่ม" /></Field>
            <Field label="สิ้นสุด" hint="คำนวณจากงานข้างใน แก้ตรงนี้ไม่ได้"><Input readOnly value={stats.end ? formatThai(stats.end, { year: true }) : '—'} aria-label="วันสิ้นสุด" /></Field>
          </div>

          <div className={panel.section}>
            <div className={panel.sectionTitle}><span>งานใน Epic</span><span className={panel.muted}>{children.length} รายการ</span></div>
            {children.length === 0 && <span className={panel.muted}>ยังไม่มีงาน เพิ่มหรือย้ายงานเข้ามาได้</span>}
            <div className={styles.taskList}>
              {children.map((c, i) => {
                const s = project.schedule.tasks[c.id]
                return (
                  <div key={c.id} className={styles.taskItem} data-testid={`epic-member-${c.id}`}>
                    <span className={[styles.tick, s?.health === 'done' && styles.tickOn].filter(Boolean).join(' ')} aria-hidden="true" />
                    <button type="button" onClick={() => onSelect(c.id)} title={c.name}>{c.name}</button>
                    <small style={s?.health === 'late' ? { color: 'var(--critical-text)' } : undefined}>{s?.isSummary ? 'กลุ่ม' : s?.health === 'late' ? `ล่าช้า · ${c.progress}%` : `${s?.duration ?? c.duration} วัน${c.progress ? ` · ${c.progress}%` : ''}`}</small>
                    <IconButton label={`เลื่อน ${c.name} ขึ้น`} onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={14} /></IconButton>
                    <IconButton label={`เลื่อน ${c.name} ลง`} onClick={() => move(i, 1)} disabled={i === children.length - 1}><ArrowDown size={14} /></IconButton>
                  </div>
                )
              })}
            </div>
            <div className={panel.row2}>
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setAdding(true)} data-testid="epic-add-task">เพิ่มงานใน Epic</Button>
              <Button size="sm" onClick={() => { setPicked(new Set()); setMoving(true) }} disabled={movable.length === 0}>ย้ายงานเข้า…</Button>
            </div>
          </div>
        </div>

        <div className={panel.footer}>
          <Button variant="primary" block onClick={onClose}>เสร็จสิ้น</Button>
          <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setConfirmDelete(true)} aria-label="ลบ Epic">ลบ</Button>
        </div>
      </aside>

      <AddTaskDialog project={project} open={adding} onClose={() => setAdding(false)} onCreated={() => {}} defaultParentId={taskId} />

      <Dialog
        open={moving}
        onClose={() => setMoving(false)}
        title={`ย้ายงานเข้า "${epic.name}"`}
        description="เลือกงานที่ยังไม่อยู่ใน Epic ใด ความสัมพันธ์และผู้รับผิดชอบเดิมอยู่ครบ"
        actions={
          <>
            <Button onClick={() => setMoving(false)}>ยกเลิก</Button>
            <Button variant="primary" disabled={picked.size === 0 || addMembers.isPending} onClick={() => addMembers.mutate({ taskId, taskIds: [...picked] }, { onSuccess: () => { setMoving(false); toast.success(`ย้าย ${picked.size} งานเข้า Epic แล้ว`) }, onError: failed })}>
              ย้าย {picked.size} งาน
            </Button>
          </>
        }
      >
        <div className={styles.existing} role="group" aria-label="งานที่ย้ายได้">
          {movable.map((t) => (
            <label key={t.id} className={styles.exRow}>
              <input type="checkbox" checked={picked.has(t.id)} onChange={(e) => { const n = new Set(picked); if (e.target.checked) n.add(t.id); else n.delete(t.id); setPicked(n) }} />
              <span>{project.schedule.tasks[t.id]?.wbs} {t.name}</span>
              <small>{project.schedule.tasks[t.id]?.isSummary ? 'กลุ่ม' : `${t.duration} วัน`}</small>
            </label>
          ))}
        </div>
      </Dialog>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="ลบ Epic"
        description={children.length ? `"${epic.name}" มีงาน ${children.length} รายการ จะให้ทำอย่างไรกับงานข้างใน` : `ลบ Epic "${epic.name}"`}
        actions={
          <>
            <Button onClick={() => setConfirmDelete(false)}>ยกเลิก</Button>
            {children.length > 0 && <Button onClick={() => deleteTask.mutate({ taskId, mode: 'lift' }, { onSuccess: onClose, onError: failed })}>เก็บงานไว้ ลบแค่ Epic</Button>}
            <Button variant="danger" onClick={() => deleteTask.mutate({ taskId, mode: 'cascade' }, { onSuccess: onClose, onError: failed })}>{children.length ? 'ลบทั้ง Epic และงานข้างใน' : 'ลบ Epic'}</Button>
            {children.length === 0 && <Button onClick={() => updateTask.mutate({ taskId, clearEpic: true }, { onSuccess: () => setConfirmDelete(false), onError: failed })}>เปลี่ยนเป็นกลุ่มธรรมดา</Button>}
          </>
        }
      />
    </>
  )
}
