import { Link2, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useAddDependency,
  useDeleteDependency,
  useDeleteTask,
  useUpdateDependency,
  useUpdateTask,
} from '@/features/projects/api'
import type { DependencyType, ProjectOut, Task, TaskUpdate } from '@/features/projects/types'
import { ApiError } from '@/shared/api/client'
import { formatThai } from '@/shared/lib/date'
import {
  Button,
  Chip,
  DatePicker,
  Dialog,
  Field,
  IconButton,
  Input,
  NumberInput,
  Select,
  Toggle,
  useToast,
} from '@/shared/ui'
import { AssignmentSection } from './AssignmentSection'
import { ChainDialog } from './ChainDialog'
import { ChecklistSection } from './ChecklistSection'
import styles from './taskPanel.module.css'

export interface TaskPanelProps {
  project: ProjectOut
  taskId: string
  onClose: () => void
  onSelect: (id: string) => void
}

const DEP_LABELS: Record<DependencyType, string> = { FS: 'FS', SS: 'SS', FF: 'FF', SF: 'SF' }
const DEP_TITLES: Record<DependencyType, string> = {
  FS: 'เสร็จแล้วค่อยเริ่ม',
  SS: 'เริ่มพร้อมกัน',
  FF: 'เสร็จพร้อมกัน',
  SF: 'เริ่มก่อนจึงเสร็จได้',
}

function apiMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError && e.body && typeof e.body === 'object' && 'error' in e.body) {
    const err = (e.body as { error: { code?: string; message?: string } }).error
    if (err.code === 'cycle_detected') return 'สร้างวงจรไม่ได้ งานนี้จะวนกลับมาหาตัวเอง'
    if (err.message) return err.message
  }
  return fallback
}

export function TaskPanel({ project, taskId, onClose, onSelect }: TaskPanelProps) {
  const toast = useToast()
  const task = project.tasks.find((t) => t.id === taskId)
  const schedule = project.schedule.tasks[taskId]
  const updateTask = useUpdateTask(project.id)
  const deleteTask = useDeleteTask(project.id)
  const addDep = useAddDependency(project.id)
  const updateDep = useUpdateDependency(project.id)
  const deleteDep = useDeleteDependency(project.id)

  // ---- local draft with debounced autosave (docs/ui-design.md §2.3)
  const [name, setName] = useState(task?.name ?? '')
  const [duration, setDuration] = useState<number | ''>(task?.duration ?? 1)
  const [progress, setProgress] = useState<number | ''>(task?.progress ?? 0)
  const timer = useRef<number | null>(null)
  const pending = useRef<TaskUpdate>({})

  useEffect(() => {
    setName(task?.name ?? '')
    setDuration(task?.duration ?? 1)
    setProgress(task?.progress ?? 0)
    pending.current = {}
    if (timer.current) window.clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  // the task can change outside the panel (drag/resize on the Gantt, undo): follow the server
  // value for every field that has no unsaved edit of its own
  useEffect(() => {
    if (!task) return
    if (pending.current.duration === undefined) setDuration(task.duration)
    if (pending.current.progress === undefined) setProgress(task.progress)
    if (pending.current.name === undefined) setName(task.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.duration, task?.progress, task?.name])

  const flush = () => {
    const body = pending.current
    pending.current = {}
    if (Object.keys(body).length === 0) return
    updateTask.mutate({ taskId, ...body }, { onError: (e) => toast.error(apiMessage(e, 'บันทึกไม่สำเร็จ')) })
  }
  const queue = (patch: TaskUpdate, delay = 500) => {
    pending.current = { ...pending.current, ...patch }
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, delay)
  }
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const byId = useMemo(() => new Map(project.tasks.map((t) => [t.id, t])), [project.tasks])
  const predecessors = useMemo(() => project.dependencies.filter((d) => d.to === taskId), [project.dependencies, taskId])
  const successors = useMemo(() => project.dependencies.filter((d) => d.from === taskId), [project.dependencies, taskId])
  const candidates = useMemo(() => {
    if (!task) return []
    const related = new Set<string>([taskId, ...predecessors.map((d) => d.from)])
    // exclude ancestors and descendants (same WBS branch is invalid)
    const parentOf = (id: string) => byId.get(id)?.parentId ?? null
    for (let cur = parentOf(taskId); cur; cur = parentOf(cur)) related.add(cur)
    const isDesc = (id: string) => {
      for (let cur = parentOf(id); cur; cur = parentOf(cur)) if (cur === taskId) return true
      return false
    }
    return project.tasks.filter((t) => !related.has(t.id) && !isDesc(t.id))
  }, [project.tasks, taskId, predecessors, byId, task])

  const [addingDep, setAddingDep] = useState(false)
  const [newPred, setNewPred] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [chainOpen, setChainOpen] = useState(false)

  if (!task || !schedule) return null
  const isSummary = schedule.isSummary
  const derivedProgress = Boolean(task && task.checklist.length > 0 && task.progressFromChecklist)
  const ccpm = project.buffer.method === 'ccpm'

  const submitDep = async () => {
    if (!newPred) return
    try {
      await addDep.mutateAsync({ from: newPred, to: taskId })
      setAddingDep(false)
      setNewPred('')
    } catch (e) {
      toast.error(apiMessage(e, 'เพิ่มงานก่อนหน้าไม่สำเร็จ'))
    }
  }

  const onDelete = async (mode: 'lift' | 'cascade') => {
    try {
      await deleteTask.mutateAsync({ taskId, mode })
      toast.success(`ลบ "${task.name}" แล้ว`)
      setConfirmDelete(false)
      onClose()
    } catch (e) {
      toast.error(apiMessage(e, 'ลบไม่สำเร็จ'))
    }
  }

  const floatChip = schedule.isCritical ? (
    <Chip tone="critical">อยู่บน Critical path</Chip>
  ) : schedule.isNearCritical ? (
    <Chip tone="warn">ใกล้ critical · เลื่อนได้ {schedule.totalFloat} วัน</Chip>
  ) : (
    <Chip tone="primary">เลื่อนได้ {schedule.totalFloat} วัน</Chip>
  )

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <aside className={styles.panel} aria-label={`รายละเอียดงาน ${task.name}`} data-testid="task-panel">
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.scroll}>
          <div className={styles.head}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={styles.caption}>{isSummary ? 'กลุ่มงาน' : 'งาน'} #{schedule.wbs}</div>
              <input
                aria-label="ชื่องาน"
                className={styles.nameInput}
                value={name}
                maxLength={200}
                onChange={(e) => {
                  setName(e.target.value)
                  if (e.target.value.trim()) queue({ name: e.target.value.trim() })
                }}
                onBlur={() => {
                  if (!name.trim()) setName(task.name)
                  else flush()
                }}
              />
            </div>
            <IconButton label="ปิด" onClick={onClose}>
              <X size={16} />
            </IconButton>
          </div>

          <div>{floatChip}</div>

          {!isSummary && (
            <div className={styles.row2}>
              <Field label="ระยะเวลา" htmlFor="tp-duration" hint={ccpm && !task.isMilestone ? 'ไม่ต้องเผื่อ' : undefined}>
                <NumberInput
                  id="tp-duration"
                  value={task.isMilestone ? 0 : duration}
                  onChange={(v) => {
                    setDuration(v)
                    if (v !== '' && v >= 0) queue({ duration: v })
                  }}
                  onBlur={flush}
                  min={0}
                  max={3650}
                  suffix="วัน"
                  disabled={task.isMilestone}
                  placeholder={ccpm ? 'ถ้าราบรื่น กี่วัน' : 'กี่วัน'}
                />
              </Field>
              <Field label="ความคืบหน้า" htmlFor="tp-progress" hint={derivedProgress ? 'จากงานย่อย' : undefined}>
                <NumberInput
                  id="tp-progress"
                  value={derivedProgress ? task.progress : progress}
                  readOnly={derivedProgress}
                  title={derivedProgress ? 'คำนวณจากงานย่อย ปิดสวิตช์ในส่วนงานย่อยถ้าอยากกรอกเอง' : undefined}
                  onChange={(v) => {
                    setProgress(v)
                    if (v !== '' && v >= 0 && v <= 100) queue({ progress: v })
                  }}
                  onBlur={flush}
                  min={0}
                  max={100}
                  step={5}
                  suffix="%"
                />
              </Field>
            </div>
          )}
          {isSummary && (
            <div className={styles.row2}>
              <Field label="ระยะเวลา (จากลูก)"><Input readOnly value={`${schedule.duration} วัน`} /></Field>
              <Field label="ความคืบหน้า (จากลูก)"><Input readOnly value={`${schedule.progress}%`} /></Field>
            </div>
          )}

          <div className={styles.row2}>
            <Field label="เริ่ม" hint="คำนวณจากความสัมพันธ์">
              <Input readOnly value={formatThai(schedule.start, { year: true })} aria-label="วันเริ่ม" />
            </Field>
            <Field label="สิ้นสุด">
              <Input readOnly value={formatThai(schedule.end, { year: true })} aria-label="วันสิ้นสุด" />
            </Field>
          </div>

          {!isSummary && (
            <div className={styles.section}>
              <Toggle
                checked={task.isMilestone}
                onChange={(v) => updateTask.mutate({ taskId, isMilestone: v, ...(v ? {} : { duration: Math.max(1, Number(duration) || 1) }) })}
                label="เป็น milestone"
              />
              <Toggle
                checked={task.constraint !== null}
                onChange={(v) =>
                  v
                    ? updateTask.mutate({ taskId, constraint: { type: 'SNET', date: schedule.start } })
                    : updateTask.mutate({ taskId, clearConstraint: true })
                }
                label="เริ่มไม่ก่อนวันที่กำหนด"
              />
              {task.constraint && (
                <DatePicker
                  aria-label="เริ่มไม่ก่อนวันที่"
                  value={task.constraint.date}
                  onChange={(v) => v && updateTask.mutate({ taskId, constraint: { type: 'SNET', date: v } })}
                />
              )}
            </div>
          )}

          {!isSummary && <ChecklistSection project={project} taskId={taskId} />}

          {!isSummary && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>งานต่อเนื่อง</div>
              <Button icon={<Link2 size={16} />} className={styles.chainBtn} onClick={() => setChainOpen(true)} data-testid="open-chain">
                สร้างงานต่อจากงานนี้…
              </Button>
              <span className={styles.muted}>สร้างชุดงาน เช่น ออกแบบ UI → พัฒนา → ทดสอบ → deploy แล้วผูกลำดับให้อัตโนมัติ</span>
            </div>
          )}

          <div className={styles.section}>
            <div className={styles.sectionTitle}>งานก่อนหน้า</div>
            {predecessors.length === 0 && !addingDep && <span className={styles.muted}>ยังไม่มี งานนี้เริ่มได้ตั้งแต่ต้นโปรเจกต์</span>}
            {predecessors.map((d) => (
              <div key={d.id} className={styles.depRow} data-testid={`pred-${d.id}`}>
                <button type="button" className={styles.depName} title={byId.get(d.from)?.name} onClick={() => onSelect(d.from)} style={{ textAlign: 'left', color: 'inherit' }}>
                  {byId.get(d.from)?.name ?? d.from}
                </button>
                <Select<DependencyType>
                  aria-label="ประเภทความสัมพันธ์"
                  value={d.type}
                  onChange={(type) => updateDep.mutate({ depId: d.id, type }, { onError: (e) => toast.error(apiMessage(e, 'แก้ไขไม่สำเร็จ')) })}
                  options={(Object.keys(DEP_LABELS) as DependencyType[]).map((k) => ({ value: k, label: DEP_LABELS[k] }))}
                  title={DEP_TITLES[d.type]}
                />
                <LagInput value={d.lag} onCommit={(lag) => updateDep.mutate({ depId: d.id, lag }, { onError: (e) => toast.error(apiMessage(e, 'แก้ไขไม่สำเร็จ')) })} />
                <IconButton label="ลบความสัมพันธ์" onClick={() => deleteDep.mutate(d.id)}>
                  <Trash2 size={14} />
                </IconButton>
              </div>
            ))}
            {predecessors.length > 0 && (
              <span className={styles.muted}>
                {(Object.keys(DEP_TITLES) as DependencyType[]).map((k) => `${k} = ${DEP_TITLES[k]}`).join(' · ')}
              </span>
            )}
            {addingDep ? (
              <div className={styles.addDep}>
                <Select
                  aria-label="เลือกงานก่อนหน้า"
                  value={newPred}
                  onChange={setNewPred}
                  options={[{ value: '', label: 'เลือกงาน…' }, ...candidates.map((t) => ({ value: t.id, label: `${project.schedule.tasks[t.id]?.wbs ?? ''} ${t.name}` }))]}
                />
                <Button variant="primary" size="sm" onClick={() => void submitDep()} disabled={!newPred || addDep.isPending}>
                  เพิ่ม
                </Button>
              </div>
            ) : (
              <button type="button" className={styles.addDepBtn} onClick={() => setAddingDep(true)} disabled={candidates.length === 0}>
                <Plus size={14} /> เพิ่มงานก่อนหน้า
              </button>
            )}
          </div>

          {successors.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>งานถัดไป</div>
              {successors.map((d) => (
                <button key={d.id} type="button" className={styles.succ} onClick={() => onSelect(d.to)}>
                  <span>{byId.get(d.to)?.name ?? d.to}</span>
                  <span className={styles.muted}>{DEP_LABELS[d.type]}{d.lag ? ` ${d.lag > 0 ? '+' : ''}${d.lag}` : ''}</span>
                </button>
              ))}
            </div>
          )}

          <AssignmentSection project={project} taskId={taskId} />

          <div className={[styles.cpm, !schedule.isCritical && styles.cpmSoft].filter(Boolean).join(' ')} data-testid="cpm-box">
            <div className={styles.cpmTitle}>Critical Path Method</div>
            <div className={styles.cpmGrid}>
              <div><span>ES</span><b>{formatThai(schedule.earlyStart)}</b></div>
              <div><span>EF</span><b>{formatThai(schedule.earlyFinish)}</b></div>
              <div><span>LS</span><b>{formatThai(schedule.lateStart)}</b></div>
              <div><span>LF</span><b>{formatThai(schedule.lateFinish)}</b></div>
            </div>
            <div className={styles.cpmFloat}>
              Total float <b>{schedule.totalFloat} วัน</b> · Free float <b>{schedule.freeFloat} วัน</b>
              {schedule.isCritical ? ' · เลื่อนไม่ได้เลย' : ''}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <Button variant="primary" block onClick={() => { flush(); onClose() }}>
            เสร็จสิ้น
          </Button>
          <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setConfirmDelete(true)} aria-label="ลบงาน">
            ลบ
          </Button>
        </div>
      </aside>

      {chainOpen && <ChainDialog project={project} taskId={taskId} open={chainOpen} onClose={() => setChainOpen(false)} />}

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={isSummary ? 'ลบกลุ่มงาน' : 'ลบงาน'}
        description={
          isSummary
            ? `"${task.name}" มีงานลูกอยู่ จะให้ทำอย่างไรกับงานลูก`
            : `"${task.name}" และความสัมพันธ์ที่เกี่ยวข้องจะถูกลบ`
        }
        actions={
          isSummary ? (
            <>
              <Button onClick={() => setConfirmDelete(false)}>ยกเลิก</Button>
              <Button onClick={() => void onDelete('lift')}>ย้ายงานลูกออกมา</Button>
              <Button variant="danger" onClick={() => void onDelete('cascade')}>ลบทั้งกลุ่ม</Button>
            </>
          ) : (
            <>
              <Button onClick={() => setConfirmDelete(false)}>ยกเลิก</Button>
              <Button variant="danger" onClick={() => void onDelete('lift')} disabled={deleteTask.isPending}>
                ลบงาน
              </Button>
            </>
          )
        }
      />
    </>
  )
}

function LagInput({ value, onCommit }: { value: number; onCommit: (lag: number) => void }) {
  const [v, setV] = useState<number | ''>(value)
  useEffect(() => setV(value), [value])
  return (
    <NumberInput
      aria-label="lag (วัน)"
      value={v}
      onChange={setV}
      onBlur={() => {
        if (v !== '' && v !== value) onCommit(v)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && v !== '' && v !== value) onCommit(v)
      }}
      min={-3650}
      max={3650}
      suffix="วัน"
      title="เวลารอ (lag) เป็นบวกหรือลบได้"
    />
  )
}

export type { Task }
