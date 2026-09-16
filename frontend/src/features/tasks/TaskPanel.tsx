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
import { useCreateEpic } from '@/features/epics/api'
import { epicsOf } from '@/features/epics/lib/epics'
import { useMoveTask } from '@/features/projects/api'
import { useCreateRelease, useDeleteRelease, useUpdateRelease } from '@/features/releases/api'
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
  const [description, setDescription] = useState(task?.description ?? '')
  const timer = useRef<number | null>(null)
  const pending = useRef<TaskUpdate>({})

  useEffect(() => {
    setName(task?.name ?? '')
    setDuration(task?.duration ?? 1)
    setProgress(task?.progress ?? 0)
    setDescription(task?.description ?? '')
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
    if (pending.current.description === undefined) setDescription(task.description)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.duration, task?.progress, task?.name, task?.description])

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
  const moveTask = useMoveTask(project.id)
  const createEpic = useCreateEpic(project.id)
  const [newEpicName, setNewEpicName] = useState<string | null>(null)
  const epicChoices = useMemo(() => epicsOf(project).filter((e) => e.id !== taskId), [project, taskId])

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

  const floatChip = schedule.totalFloat < 0 ? (
    <Chip tone="critical" title="กำหนดเสร็จ (ต้องเสร็จภายใน) เร็วกว่าที่แผนทำได้">เลยกำหนดเสร็จ {-schedule.totalFloat} วัน</Chip>
  ) : schedule.isCritical ? (
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

          <Field label="หมายเหตุ" htmlFor="tp-description" hint={description.length > 1800 ? `${description.length} / 2000` : undefined}>
            <textarea
              id="tp-description"
              className={styles.textarea}
              value={description}
              maxLength={2000}
              rows={3}
              placeholder="รายละเอียด ข้อควรระวัง หรือลิงก์ที่เกี่ยวข้อง"
              onChange={(e) => {
                setDescription(e.target.value)
                queue({ description: e.target.value.trim() }, 800)
              }}
              onBlur={flush}
            />
          </Field>

          {!isSummary && (
            <div className={styles.section}>
              <Toggle
                checked={task.isMilestone}
                onChange={(v) => updateTask.mutate({ taskId, isMilestone: v, ...(v ? {} : { duration: Math.max(1, Number(duration) || 1) }) })}
                label="เป็น milestone"
              />
              {task.isMilestone && <ReleaseSection project={project} taskId={taskId} />}
              <Toggle
                checked={task.constraint?.type === 'SNET'}
                onChange={(v) =>
                  v
                    ? updateTask.mutate({ taskId, constraint: { type: 'SNET', date: schedule.start } })
                    : updateTask.mutate({ taskId, clearConstraint: true })
                }
                label="เริ่มไม่ก่อนวันที่กำหนด"
              />
              {task.constraint?.type === 'SNET' && (
                <DatePicker
                  aria-label="เริ่มไม่ก่อนวันที่"
                  value={task.constraint.date}
                  onChange={(v) => v && updateTask.mutate({ taskId, constraint: { type: 'SNET', date: v } })}
                />
              )}
              <Toggle
                checked={task.constraint?.type === 'FNLT'}
                onChange={(v) =>
                  v
                    ? updateTask.mutate({ taskId, constraint: { type: 'FNLT', date: schedule.end } })
                    : updateTask.mutate({ taskId, clearConstraint: true })
                }
                label="ต้องเสร็จภายในวันที่กำหนด"
              />
              {task.constraint?.type === 'FNLT' && (
                <>
                  <DatePicker
                    aria-label="ต้องเสร็จภายในวันที่"
                    value={task.constraint.date}
                    onChange={(v) => v && updateTask.mutate({ taskId, constraint: { type: 'FNLT', date: v } })}
                  />
                  <div className={styles.hint}>งานก่อนหน้าทั้งสายจะถูกนับ float จากวันนี้ ถ้าแผนทำไม่ทันจะขึ้น "เลยกำหนดเสร็จ"</div>
                </>
              )}
            </div>
          )}

          <Field label="อยู่ใน Epic" htmlFor="tp-epic" hint="ย้ายแล้วความสัมพันธ์และผู้รับผิดชอบเดิมอยู่ครบ">
            <Select<string>
              id="tp-epic"
              value={task.parentId && project.tasks.find((t) => t.id === task.parentId)?.epic ? task.parentId : task.parentId ? `group:${task.parentId}` : ''}
              onChange={(v) => {
                if (v === '__new__') setNewEpicName(task.name)
                else if (v.startsWith('group:')) return
                else moveTask.mutate({ taskId, parentId: v || null }, { onError: (e) => toast.error(apiMessage(e, 'ย้ายไม่สำเร็จ')) })
              }}
              options={[
                { value: '', label: 'ไม่มี (ระดับบนสุด)' },
                ...(task.parentId && !project.tasks.find((t) => t.id === task.parentId)?.epic ? [{ value: `group:${task.parentId}`, label: `กลุ่ม: ${byId.get(task.parentId)?.name ?? ''}` }] : []),
                ...epicChoices.map((e) => ({ value: e.id, label: e.name })),
                { value: '__new__', label: '+ สร้าง Epic ใหม่แล้วย้ายไป…' },
              ]}
            />
          </Field>

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
        open={newEpicName !== null}
        onClose={() => setNewEpicName(null)}
        title="สร้าง Epic ใหม่แล้วย้ายงานนี้เข้าไป"
        description={`"${task.name}" จะกลายเป็นงานแรกใน Epic ใหม่ แก้สีและเป้าหมายได้ในแผง Epic`}
        actions={
          <>
            <Button onClick={() => setNewEpicName(null)}>ยกเลิก</Button>
            <Button variant="primary" disabled={!newEpicName?.trim() || createEpic.isPending} onClick={() => createEpic.mutate({ name: newEpicName!.trim(), existingTaskIds: [taskId], position: 'after', afterTaskId: task.parentId ? null : taskId, parentId: task.parentId }, { onSuccess: () => { setNewEpicName(null); toast.success('สร้าง Epic แล้ว') }, onError: (e) => toast.error(apiMessage(e, 'สร้าง Epic ไม่สำเร็จ')) })}>
              สร้าง Epic
            </Button>
          </>
        }
      >
        <Field label="ชื่อ Epic" htmlFor="tp-new-epic">
          <Input id="tp-new-epic" value={newEpicName ?? ''} onChange={(e) => setNewEpicName(e.target.value)} maxLength={200} autoFocus />
        </Field>
      </Dialog>

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

/** Milestone as a delivery point with its own buffer (BUF-8). */
function ReleaseSection({ project, taskId }: { project: ProjectOut; taskId: string }) {
  const toast = useToast()
  const create = useCreateRelease(project.id)
  const update = useUpdateRelease(project.id)
  const remove = useDeleteRelease(project.id)
  const release = project.releases.find((r) => r.milestoneTaskId === taskId)
  const result = project.schedule.releases.find((r) => r.milestoneTaskId === taskId)
  const [name, setName] = useState(release?.name ?? '')
  const [days, setDays] = useState<number | ''>(release?.days ?? '')
  useEffect(() => {
    setName(release?.name ?? '')
    setDays(release?.days ?? '')
  }, [release?.id, release?.name, release?.days])
  const fail = (e: unknown) => toast.error(apiMessage(e, 'บันทึกจุดส่งมอบไม่สำเร็จ'))
  const task = project.tasks.find((t) => t.id === taskId)
  return (
    <div className={styles.section} data-testid="release-section">
      <Toggle
        checked={Boolean(release)}
        onChange={(v) => (v ? create.mutate({ name: task?.name ?? 'ส่งมอบ', milestoneTaskId: taskId }, { onError: fail }) : release && remove.mutate(release.id, { onError: fail }))}
        label="จุดส่งมอบ มีเวลาเผื่อของตัวเอง"
      />
      {!release && <div className={styles.hint}>งานที่ป้อนเข้า milestone นี้จะถูกเผื่อเวลาแยกเป็นก้อนของตัวเอง เช่น ส่งมอบสิ้นปีนี้ กับสิ้นปีหน้า</div>}
      {release && (
        <>
          <Field label="ชื่อจุดส่งมอบ" htmlFor="tp-release-name">
            <Input
              id="tp-release-name"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => (name.trim() && name.trim() !== release.name ? update.mutate({ releaseId: release.id, name: name.trim() }, { onError: fail }) : setName(release.name))}
            />
          </Field>
          <Field label="เวลาเผื่อ" htmlFor="tp-release-days" hint={release.days === null ? `คำนวณให้ ${result?.days ?? 0} วัน จากสายงาน ${result?.chainDays ?? 0} วัน` : 'กำหนดเอง · ล้างช่องเพื่อให้ระบบคำนวณ'}>
            <NumberInput
              id="tp-release-days"
              value={days}
              min={0}
              max={3650}
              suffix="วัน"
              placeholder={String(result?.days ?? 0)}
              onChange={setDays}
              onBlur={() => {
                if (days === '' && release.days !== null) update.mutate({ releaseId: release.id, clearDays: true }, { onError: fail })
                else if (days !== '' && days !== release.days) update.mutate({ releaseId: release.id, days }, { onError: fail })
              }}
            />
          </Field>
          {result && (
            <div className={styles.hint} data-testid="release-summary">
              {result.taskIds.length} งาน · เสร็จตามแผน {formatThai(result.plannedEnd, { year: true })} · สัญญาส่ง {formatThai(result.committedEnd, { year: true })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
