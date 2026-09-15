import { ArrowRight, Check, Link2, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useChainPreview, useCreateChain } from '@/features/projects/api'
import type { ChainBody, ChainStep, ProjectOut } from '@/features/projects/types'
import { ApiError } from '@/shared/api/client'
import { formatThai } from '@/shared/lib/date'
import { Button, Dialog, NumberInput, Toggle, useToast } from '@/shared/ui'
import styles from './chainDialog.module.css'

interface Props {
  project: ProjectOut
  taskId: string
  open: boolean
  onClose: () => void
  onCreated?: (project: ProjectOut) => void
}

/** Default rows (docs/features.md TSK-9); a project remembers its last-used rows. */
export const DEFAULT_STEPS: ChainStep[] = [
  { name: 'ออกแบบ UI', duration: 3, enabled: true, parallel: false },
  { name: 'พัฒนา Frontend', duration: 5, enabled: true, parallel: false },
  { name: 'พัฒนา Backend', duration: 5, enabled: true, parallel: true },
  { name: 'ทดสอบ', duration: 3, enabled: true, parallel: false },
  { name: 'UAT กับผู้ใช้', duration: 2, enabled: false, parallel: false },
  { name: 'Deploy', duration: 1, enabled: true, parallel: false },
]

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value)
  const key = JSON.stringify(value)
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    window.setTimeout(() => setV(value), ms)
  }
  return v
}

/**
 * "สร้างงานต่อจากงานนี้" – pick steps, edit names/durations, choose parallel FE/BE,
 * see the resulting chain (server dry run) and create everything in one call.
 */
export function ChainDialog({ project, taskId, open, onClose, onCreated }: Props) {
  const toast = useToast()
  const source = project.tasks.find((t) => t.id === taskId)
  const [steps, setSteps] = useState<ChainStep[]>(() => project.chainTemplates ?? DEFAULT_STEPS)
  const [prefix, setPrefix] = useState(true)
  const [group, setGroup] = useState(true)
  const [copyAssignees, setCopyAssignees] = useState(false)
  const [remember, setRemember] = useState(true)
  const create = useCreateChain(project.id)

  const assignees = useMemo(() => project.assignments.filter((a) => a.taskId === taskId), [project.assignments, taskId])
  const enabled = steps.filter((s) => s.enabled && s.name.trim())
  const body: ChainBody = {
    steps: steps.map((s) => ({ ...s, name: s.name.trim() || s.name })).filter((s) => s.name.trim()),
    prefixWithSource: prefix,
    groupName: group && source ? source.name : null,
    copyAssignees,
    remember,
  }
  const debounced = useDebounced(body, 300)
  const preview = useChainPreview(project.id, taskId, debounced, open && enabled.length > 0 && Boolean(source))

  if (!source) return null

  const patch = (i: number, p: Partial<ChainStep>) => setSteps(steps.map((s, k) => (k === i ? { ...s, ...p } : s)))
  const removeStep = (i: number) => setSteps(steps.filter((_, k) => k !== i))
  const addStep = () => setSteps([...steps, { name: '', duration: 1, enabled: true, parallel: false }])
  /** the enabled step a row would run alongside (the server pairs it with the previous *enabled* step) */
  const prevEnabled = (i: number): ChainStep | null => steps.slice(0, i).reverse().find((x) => x.enabled && x.name.trim()) ?? null

  // blocks for the preview: consecutive parallel steps share a box
  const blocks: ChainStep[][] = []
  for (const s of enabled) {
    if (s.parallel && blocks.length > 0) blocks[blocks.length - 1].push(s)
    else blocks.push([s])
  }
  const totalDays = blocks.reduce((sum, b) => sum + Math.max(...b.map((s) => s.duration)), 0)
  const previewEnd = preview.data?.schedule.summary.plannedEnd ?? null
  // new tasks = ids that were not in the current project; all critical => the whole chain is on the critical path
  const previewCritical = preview.data
    ? Object.values(preview.data.schedule.tasks).filter((t) => project.schedule.tasks[t.id] === undefined && !t.isSummary).every((t) => t.isCritical)
    : false

  const submit = async () => {
    try {
      const out = await create.mutateAsync({ taskId, ...body })
      toast.success(`สร้าง ${enabled.length} งานต่อจาก "${source.name}" แล้ว`)
      onCreated?.(out)
      onClose()
    } catch (e) {
      toast.error(e instanceof ApiError && e.body && typeof e.body === 'object' && 'error' in e.body ? String((e.body as { error: { message: string } }).error.message) : 'สร้างงานไม่สำเร็จ')
    }
  }

  return (
    <Dialog
      size="lg"
      open={open}
      onClose={onClose}
      title={`สร้างงานต่อจาก "${source.name}"`}
      description="เลือกขั้นตอนที่ต้องมี ระบบจะสร้างงานตามลำดับและผูกความสัมพันธ์ FS ให้ · กรอกระยะเวลาแบบไม่ต้องเผื่อ"
      actions={
        <>
          <label className={styles.remember}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            จำรายการนี้ไว้ใช้ครั้งหน้า
          </label>
          <span className={styles.spacer} />
          <Button onClick={onClose}>ยกเลิก</Button>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => void submit()} disabled={enabled.length === 0 || create.isPending} data-testid="chain-submit">
            สร้าง {enabled.length} งาน
          </Button>
        </>
      }
    >
      <div className={styles.body} data-testid="chain-dialog">
        <ul className={styles.steps} aria-label="ขั้นตอน">
          {steps.map((s, i) => (
            <li key={i} className={styles.stepWrap}>
              <div className={[styles.step, !s.enabled && styles.stepOff].filter(Boolean).join(' ')}>
                <button type="button" role="checkbox" aria-checked={s.enabled} aria-label={`ใช้ขั้นตอน ${s.name || i + 1}`} className={[styles.box, s.enabled && styles.boxOn].filter(Boolean).join(' ')} onClick={() => patch(i, { enabled: !s.enabled })}>
                  {s.enabled && <Check size={14} />}
                </button>
                <div className={styles.name}>
                  {prefix && <span className={styles.pre}>{source.name} –</span>}
                  <input aria-label={`ชื่อขั้นตอน ${i + 1}`} value={s.name} maxLength={200} placeholder="ชื่อขั้นตอน" onChange={(e) => patch(i, { name: e.target.value })} disabled={!s.enabled} />
                </div>
                <NumberInput aria-label={`ระยะเวลาขั้นตอน ${i + 1}`} value={s.duration} onChange={(v) => v !== '' && patch(i, { duration: v })} min={0} max={3650} suffix="วัน" disabled={!s.enabled} />
                <button type="button" className={styles.del} aria-label={`ลบขั้นตอน ${s.name || i + 1}`} onClick={() => removeStep(i)}>
                  <Trash2 size={14} />
                </button>
              </div>
              {s.enabled && prevEnabled(i) && (
                <div className={styles.par}>
                  <Toggle checked={s.parallel} onChange={(v) => patch(i, { parallel: v })} label={`ทำคู่ขนานกับ "${prevEnabled(i)!.name}" (เริ่มพร้อมกัน)`} />
                </div>
              )}
            </li>
          ))}
        </ul>
        <button type="button" className={styles.addStep} onClick={addStep}>
          <Plus size={14} /> เพิ่มขั้นตอนเอง
        </button>

        <div className={styles.opts}>
          <label className={styles.opt}>
            <input type="checkbox" checked={prefix} onChange={(e) => setPrefix(e.target.checked)} />
            <span>
              ตั้งชื่อขึ้นต้นด้วยชื่องานนี้
              <small>"{source.name} – {enabled[0]?.name ?? 'ออกแบบ UI'}" แก้ชื่อทีละงานได้ในแถวด้านบน</small>
            </span>
          </label>
          <label className={styles.opt}>
            <input type="checkbox" checked={group} onChange={(e) => setGroup(e.target.checked)} />
            <span>
              รวมงานทั้งหมดเป็นกลุ่ม "{source.name}"
              <small>งานนี้กลายเป็นงานลูกตัวแรกของกลุ่มใหม่ ถ้าไม่ติ๊ก งานใหม่จะต่อท้ายงานนี้ในระดับเดียวกัน</small>
            </span>
          </label>
          <label className={[styles.opt, assignees.length === 0 && styles.optOff].filter(Boolean).join(' ')}>
            <input type="checkbox" checked={copyAssignees} disabled={assignees.length === 0} onChange={(e) => setCopyAssignees(e.target.checked)} />
            <span>
              คัดลอกผู้รับผิดชอบของงานนี้ไปทุกงานใหม่
              <small>{assignees.length === 0 ? 'งานนี้ยังไม่มีผู้รับผิดชอบ' : `${assignees.length} คน`}</small>
            </span>
          </label>
        </div>

        <div className={styles.preview} data-testid="chain-preview">
          <div className={styles.previewTitle}>
            <Link2 size={14} /> ลำดับที่จะได้
          </div>
          <div className={styles.flow}>
            <span className={[styles.node, styles.nodeSrc].join(' ')}>
              {source.name} <small>{source.duration} วัน</small>
            </span>
            {blocks.map((b, i) => (
              <span key={i} className={styles.flowItem}>
                <ArrowRight size={14} className={styles.arrow} />
                <span className={[styles.node, b.length > 1 && styles.nodeStack].filter(Boolean).join(' ')}>
                  {b.map((s) => (
                    <span key={s.name}>
                      {s.name} <small>{s.duration}</small>
                    </span>
                  ))}
                </span>
              </span>
            ))}
          </div>
          <div className={styles.sum}>
            รวม <b>{enabled.length} งานใหม่ · {totalDays} วันทำงาน</b>
            {previewEnd ? (
              <>
                {' '}· โปรเจกต์จะเสร็จ <b>{formatThai(previewEnd, { year: true })}</b>
                {previewCritical ? ' · งานทั้งชุดอยู่บน critical path' : ''}
              </>
            ) : preview.isFetching ? (
              ' · กำลังคำนวณ…'
            ) : null}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
