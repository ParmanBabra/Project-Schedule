import { Check, Copy, Flag, Plus, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useClearBaseline,
  useDeleteProject,
  useDuplicateProject,
  useProject,
  useSaveBaseline,
  useUpdateBuffer,
  useUpdateProject,
  useUpdateRules,
  useUpdateTask,
} from '@/features/projects/api'
import type { BufferMethod, BufferSettings, ProjectOut, Rules } from '@/features/projects/types'
import { formatThai } from '@/shared/lib/date'
import {
  Button,
  Card,
  Chip,
  ChipButton,
  DateInput,
  Dialog,
  EmptyState,
  Field,
  Input,
  NumberInput,
  Segment,
  Skeleton,
  WeekdayPicker,
  useToast,
} from '@/shared/ui'
import { useSchedulePreview, useSettingsDefaults, type BufferMethodInfo, type RuleInfo } from './api'
import styles from './settings.module.css'

export function SettingsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const project = useProject(projectId)
  const defaults = useSettingsDefaults()
  if (project.isPending || defaults.isPending) {
    return (
      <Card padding="md">
        <Skeleton height={24} width="30%" />
      </Card>
    )
  }
  if (project.isError || !project.data || defaults.isError || !defaults.data) {
    return (
      <Card>
        <EmptyState title="โหลดการตั้งค่าไม่ได้" />
      </Card>
    )
  }
  return <SettingsForm project={project.data} methods={defaults.data.bufferMethods} rules={defaults.data.ruleDescriptions} mrHelp={defaults.data.managementReserve.help} />
}

// -------------------------------------------------------------------------- form

function SettingsForm({ project, methods, rules, mrHelp }: { project: ProjectOut; methods: BufferMethodInfo[]; rules: RuleInfo[]; mrHelp: string }) {
  const toast = useToast()
  const navigate = useNavigate()
  const updateProject = useUpdateProject(project.id)
  const updateBuffer = useUpdateBuffer(project.id)
  const updateRules = useUpdateRules(project.id)
  const updateTask = useUpdateTask(project.id)
  const duplicate = useDuplicateProject()
  const remove = useDeleteProject()
  const saveBaseline = useSaveBaseline(project.id)
  const clearBaseline = useClearBaseline(project.id)

  const [name, setName] = useState(project.name)
  const [seenName, setSeenName] = useState(project.name)
  if (project.name !== seenName) {
    // derive during render (React's recommended pattern) instead of an effect
    setSeenName(project.name)
    setName(project.name)
  }
  const [holiday, setHoliday] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [ccpmAsk, setCcpmAsk] = useState(false)

  const saved = () => toast.show('บันทึกแล้ว', { tone: 'success', duration: 1500 })
  const failed = () => toast.error('บันทึกไม่สำเร็จ')

  const saveBuffer = (patch: Partial<BufferSettings>, undoable = true) => {
    const previous = project.buffer
    updateBuffer.mutate(
      { ...project.buffer, ...patch },
      {
        onSuccess: () =>
          undoable
            ? toast.show('ปรับสำรองเวลาแล้ว', { action: { label: 'เลิกทำ', onClick: () => updateBuffer.mutate(previous) } })
            : saved(),
        onError: failed,
      },
    )
  }
  const saveRules = (patch: Partial<Rules>) => {
    const previous = project.rules
    updateRules.mutate(
      { ...project.rules, ...patch },
      { onSuccess: () => toast.show('ปรับกติกาแล้ว', { action: { label: 'เลิกทำ', onClick: () => updateRules.mutate(previous) } }), onError: failed },
    )
  }

  const chooseMethod = (method: BufferMethod) => {
    if (method === project.buffer.method) return
    if (method === 'ccpm' && project.buffer.method === 'percent' && project.tasks.some((t) => t.duration > 0)) {
      setCcpmAsk(true)
      return
    }
    saveBuffer({ method })
  }

  const applyCcpm = async (reduce: boolean) => {
    setCcpmAsk(false)
    if (reduce) {
      const leaves = project.tasks.filter((t) => !project.schedule.tasks[t.id]?.isSummary && !t.isMilestone && t.duration > 1)
      for (const t of leaves) {
        await updateTask.mutateAsync({ taskId: t.id, duration: Math.max(1, Math.ceil(t.duration * 0.8)) })
      }
    }
    saveBuffer({ method: 'ccpm' }, false)
    toast.success(reduce ? 'ลดระยะเวลาทุกงานลง 20% และใช้วิธีรวมเผื่อไว้ท้ายโครงการแล้ว' : 'ใช้วิธีรวมเผื่อไว้ท้ายโครงการแล้ว')
  }

  const chain = project.schedule.summary.chainDays
  const s = project.schedule

  return (
    <div className={styles.page}>
      <div className={styles.sheet}>
        <div className={styles.pageHead}>
          <div>
            <div className={styles.crumb}>{project.name}</div>
            <h1 className={styles.h1}>ตั้งค่าโปรเจกต์</h1>
          </div>
          <span className={styles.spacer} />
          <Chip tone="soft">บันทึกอัตโนมัติ</Chip>
        </div>

        {/* ---------------------------------------------------------- general */}
        <Card padding="md" className={styles.sec}>
          <div className={styles.secHead}>
            <h2>ทั่วไป</h2>
          </div>
          <div className={styles.row2}>
            <Field label="ชื่อโปรเจกต์" htmlFor="st-name">
              <Input
                id="st-name"
                value={name}
                maxLength={200}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name.trim() && name.trim() !== project.name && updateProject.mutate({ name: name.trim() }, { onSuccess: saved, onError: failed })}
              />
            </Field>
            <Field label="วันเริ่ม" htmlFor="st-start" hint="งานที่ไม่มีงานก่อนหน้าจะเริ่มวันนี้">
              <DateInput id="st-start" value={project.startDate} onChange={(e) => e.target.value && updateProject.mutate({ startDate: e.target.value }, { onSuccess: saved, onError: failed })} />
            </Field>
          </div>
        </Card>

        {/* ----------------------------------------------------- working days */}
        <Card padding="md" className={styles.sec}>
          <div className={styles.secHead}>
            <h2>วันทำงาน</h2>
            <p>วันที่ระบบนับเป็นวันทำงาน วันอื่นจะถูกข้าม</p>
          </div>
          <WeekdayPicker value={project.workingDays} onChange={(days) => days.length > 0 && updateProject.mutate({ workingDays: days }, { onSuccess: saved, onError: failed })} />
          <div className={styles.hol}>
            <span className={styles.crumb}>วันหยุดพิเศษ</span>
            {project.holidays.map((h) => (
              <ChipButton key={h} tone="soft" icon={<X size={12} />} aria-label={`ลบวันหยุด ${formatThai(h, { year: true })}`} onClick={() => updateProject.mutate({ holidays: project.holidays.filter((x) => x !== h) }, { onSuccess: saved, onError: failed })}>
                {formatThai(h, { year: true })}
              </ChipButton>
            ))}
            <span className={styles.holAdd}>
              <DateInput aria-label="วันหยุดใหม่" value={holiday} min={project.startDate} onChange={(e) => setHoliday(e.target.value)} />
              <Button
                size="sm"
                icon={<Plus size={14} />}
                disabled={!holiday || project.holidays.includes(holiday)}
                onClick={() => {
                  updateProject.mutate({ holidays: [...project.holidays, holiday] }, { onSuccess: saved, onError: failed })
                  setHoliday('')
                }}
              >
                เพิ่มวันหยุด
              </Button>
            </span>
          </div>
        </Card>

        {/* ------------------------------------------------------------ buffer */}
        <Card padding="md" className={styles.sec}>
          <div className={styles.secHead}>
            <h2>สำรองเวลา</h2>
            <p>เลือกวิธีคิดเวลาเผื่อของโครงการ ตัวอย่างคำนวณจากแผนปัจจุบันของคุณ</p>
          </div>
          <div className={styles.opts}>
            {methods.map((m) => (
              <BufferCard key={m.id} info={m} project={project} active={project.buffer.method === m.id} onChoose={() => chooseMethod(m.id)} onPatch={(p) => saveBuffer(p)} />
            ))}
          </div>
          <div className={styles.mr}>
            <span>{mrHelp}</span>
            <NumberInput
              aria-label="management reserve (%)"
              className={styles.num}
              value={project.buffer.managementReservePercent}
              min={0}
              max={100}
              suffix="%"
              onChange={(v) => v !== '' && v >= 0 && v <= 100 && saveBuffer({ managementReservePercent: v })}
            />
            <span>= {s.buffer.managementReserveDays} วัน</span>
          </div>
          {chain === 0 && <span className={styles.crumb}>ยังไม่มีงาน เมื่อเพิ่มงานแล้วตัวอย่างจะคำนวณให้ทันที</span>}
        </Card>

        {/* ---------------------------------------------------------- baseline */}
        <Card padding="md" className={styles.sec} data-testid="baseline-section">
          <div className={styles.secHead}>
            <h2>Baseline และการติดตาม</h2>
            <p>ล็อกแผนไว้เทียบ เพื่อดูว่าใช้เวลาเผื่อไปเท่าไรและงานไหนล่าช้า</p>
          </div>
          {project.baseline ? (
            <div className={styles.inline} style={{ gap: 'var(--sp-3)' }}>
              <Chip tone="primary" icon={<Flag size={12} />}>
                บันทึกเมื่อ {formatThai(project.baseline.savedAt.slice(0, 10), { year: true })}
              </Chip>
              <span className={styles.crumb}>
                เสร็จตามแผนตอนนั้น {formatThai(project.baseline.plannedEnd)} · เผื่อ {project.baseline.bufferDays} วัน (คงที่จนกว่าจะบันทึกใหม่)
              </span>
              <span className={styles.spacer} />
              <Button size="sm" onClick={() => saveBaseline.mutate(undefined, { onSuccess: () => toast.success('บันทึก baseline ใหม่แล้ว'), onError: failed })}>
                บันทึกใหม่จากแผนปัจจุบัน
              </Button>
              <Button size="sm" variant="ghost" onClick={() => clearBaseline.mutate(undefined, { onSuccess: () => toast.success('ล้าง baseline แล้ว'), onError: failed })}>
                ล้าง
              </Button>
            </div>
          ) : (
            <div className={styles.inline} style={{ gap: 'var(--sp-3)' }}>
              <span className={styles.crumb}>ยังไม่มี baseline · สถานะการใช้เวลาเผื่อจะเริ่มแสดงหลังบันทึก</span>
              <span className={styles.spacer} />
              <Button size="sm" variant="primary" icon={<Flag size={14} />} disabled={project.schedule.summary.taskCount === 0} onClick={() => saveBaseline.mutate(undefined, { onSuccess: () => toast.success('บันทึก baseline แล้ว'), onError: failed })}>
                บันทึก baseline ตอนนี้
              </Button>
            </div>
          )}
          {project.schedule.buffer.status && (
            <div className={styles.ex} style={{ alignSelf: 'flex-start' }}>
              ใช้เผื่อไป <b>{project.schedule.buffer.consumedPercent}%</b> ({project.schedule.buffer.consumedDays} วัน) ขณะที่งานหลักคืบหน้า <b>{project.schedule.buffer.chainProgress}%</b> →{' '}
              <b>{project.schedule.buffer.status === 'green' ? 'ยังปลอดภัย' : project.schedule.buffer.status === 'yellow' ? 'จับตา' : 'ต้องแก้'}</b>
            </div>
          )}
        </Card>

        {/* ------------------------------------------------------------- rules */}
        <Card padding="md" className={styles.sec}>
          <div className={styles.secHead}>
            <h2>กติกาการคำนวณ</h2>
            <p>ทุกข้อมีค่าเริ่มต้นตามหลักที่ใช้กันทั่วไป เปลี่ยนได้ทุกเมื่อ</p>
          </div>
          {rules.map((r) => (
            <RuleCard key={r.id} info={r} project={project} onSave={saveRules} />
          ))}
        </Card>

        {/* ------------------------------------------------------------ danger */}
        <Card padding="md" className={styles.sec}>
          <div className={styles.danger}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16 }}>โซนอันตราย</h2>
              <p className={styles.crumb} style={{ margin: '2px 0 0' }}>
                ทำสำเนาก่อนลบถ้าไม่แน่ใจ โปรเจกต์ที่ลบจะอยู่ในถังขยะ
              </p>
            </div>
            <span className={styles.spacer} />
            <Button size="sm" icon={<Copy size={14} />} onClick={() => duplicate.mutate({ id: project.id }, { onSuccess: (copy) => navigate(`/p/${copy.id}/gantt`), onError: failed })}>
              ทำสำเนา
            </Button>
            <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)}>
              ลบโปรเจกต์
            </Button>
          </div>
        </Card>
      </div>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="ลบโปรเจกต์"
        description={`"${project.name}" จะถูกย้ายไปถังขยะ กู้คืนได้จากโฟลเดอร์ data/trash`}
        actions={
          <>
            <Button onClick={() => setConfirmDelete(false)}>ยกเลิก</Button>
            <Button variant="danger" onClick={() => remove.mutate(project.id, { onSuccess: () => navigate('/'), onError: failed })}>
              ลบโปรเจกต์
            </Button>
          </>
        }
      />
      <Dialog
        open={ccpmAsk}
        onClose={() => setCcpmAsk(false)}
        title="เปลี่ยนเป็นรวมเผื่อไว้ท้ายโครงการ"
        description={`วิธีนี้ต้องการเวลาที่กรอกแบบไม่เผื่อ งานที่มีอยู่ ${project.schedule.summary.taskCount} งานกรอกไว้แบบไหน`}
        actions={
          <>
            <Button onClick={() => void applyCcpm(false)}>กรอกแบบไม่เผื่ออยู่แล้ว</Button>
            <Button variant="primary" onClick={() => void applyCcpm(true)}>
              มีเผื่ออยู่ ช่วยลดให้ 20%
            </Button>
          </>
        }
      />
    </div>
  )
}

// ------------------------------------------------------------------ buffer card

function BufferCard({ info, project, active, onChoose, onPatch }: { info: BufferMethodInfo; project: ProjectOut; active: boolean; onChoose: () => void; onPatch: (p: Partial<BufferSettings>) => void }) {
  const draft: BufferSettings = { ...project.buffer, method: info.id, days: null }
  const preview = useSchedulePreview(project.id, { buffer: draft }, !active && project.schedule.summary.chainDays > 0)
  const b = active ? project.schedule.buffer : preview.data?.buffer
  const committed = active ? project.schedule.summary.committedEnd : preview.data?.summary.committedEnd
  const chain = project.schedule.summary.chainDays
  const percent = project.buffer.percent ?? { low: 10, medium: 15, high: 25 }[project.buffer.riskLevel]

  const example =
    chain === 0 ? (
      <span>เพิ่มงานก่อน แล้วตัวอย่างจะแสดงที่นี่</span>
    ) : !b ? (
      <span>กำลังคำนวณ…</span>
    ) : info.id === 'pert' && b.note ? (
      <span>{b.note}</span>
    ) : (
      <span>
        สายงานหลัก <b>{chain} วัน</b>
        {info.id === 'percent' ? ` × ${percent}%` : info.id === 'ccpm' ? ` × ${project.buffer.ccpmRatio}%` : ''} → เผื่อ <b>{b.days} วัน</b> → สัญญาส่ง <b>{formatThai(committed ?? b.end, { year: true })}</b>
      </span>
    )

  return (
    <div
      role="button"
      aria-pressed={active}
      tabIndex={0}
      className={[styles.opt, active && styles.optOn].filter(Boolean).join(' ')}
      onClick={onChoose}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onChoose()
        }
      }}
      data-testid={`buffer-${info.id}`}
    >
      {active && (
        <span className={styles.tick} aria-hidden="true">
          <Check size={14} />
        </span>
      )}
      {info.recommended && <span className={styles.rec}>แนะนำ</span>}
      <h3>{info.title}</h3>
      <p>{info.what}</p>
      <div className={styles.fit}>เหมาะเมื่อ {info.fit}</div>
      {active && info.id === 'ccpm' && (
        <div className={styles.slider} onClick={(e) => e.stopPropagation()}>
          <span>สัดส่วนเผื่อ</span>
          <input
            type="range"
            aria-label="สัดส่วนเผื่อ (%)"
            min={30}
            max={50}
            step={5}
            value={project.buffer.ccpmRatio}
            onChange={(e) => onPatch({ ccpmRatio: Number(e.target.value) })}
          />
          <b>{project.buffer.ccpmRatio}%</b>
        </div>
      )}
      {active && info.id === 'percent' && (
        <div onClick={(e) => e.stopPropagation()}>
          <Segment
            aria-label="ระดับความเสี่ยง"
            block
            value={project.buffer.riskLevel}
            onChange={(riskLevel) => onPatch({ riskLevel, percent: null })}
            options={[
              { value: 'low', label: 'ต่ำ 10%' },
              { value: 'medium', label: 'กลาง 15%' },
              { value: 'high', label: 'สูง 25%' },
            ]}
          />
        </div>
      )}
      {active && info.id === 'pert' && (
        <div onClick={(e) => e.stopPropagation()}>
          <Segment
            aria-label="ความมั่นใจ"
            block
            value={project.buffer.pertConfidence}
            onChange={(pertConfidence) => onPatch({ pertConfidence })}
            options={[
              { value: 84 as const, label: 'มั่นใจ 84%' },
              { value: 98 as const, label: 'มั่นใจ 98%' },
            ]}
          />
        </div>
      )}
      <div className={styles.ex} data-testid={`buffer-example-${info.id}`}>
        {example}
      </div>
      <span className={styles.ref}>{info.reference}</span>
    </div>
  )
}

// -------------------------------------------------------------------- rule card

function RuleCard({ info, project, onSave }: { info: RuleInfo; project: ProjectOut; onSave: (patch: Partial<Rules>) => void }) {
  const rules = project.rules
  const s = project.schedule
  const listOptions = Array.isArray(info.options) ? info.options : null
  const rangeOptions = !Array.isArray(info.options) ? info.options : null

  const near = rules.nearCriticalFloatDays
  const [nearDraft, setNearDraft] = useState<number | ''>(near || 2)

  const currentValue = useMemo(() => {
    switch (info.id) {
      case 'nearCriticalFloatDays':
        return near > 0 ? 2 : 0
      case 'defaultDependency':
        return rules.defaultDependency.type
      default:
        return (rules as unknown as Record<string, unknown>)[info.id] as string | number
    }
  }, [info.id, rules, near])

  const help = listOptions?.find((o) => o.value === currentValue)?.help

  const set = (value: string | number) => {
    switch (info.id) {
      case 'nearCriticalFloatDays':
        onSave({ nearCriticalFloatDays: value === 0 ? 0 : Number(nearDraft) || 2 })
        break
      case 'defaultDependency':
        onSave({ defaultDependency: { ...rules.defaultDependency, type: value as Rules['defaultDependency']['type'] } })
        break
      default:
        onSave({ [info.id]: value } as Partial<Rules>)
    }
  }

  const example =
    info.id === 'nearCriticalFloatDays'
      ? `ตอนนี้มี critical ${s.summary.criticalCount} งาน${near > 0 ? ` และใกล้ critical ${s.summary.nearCriticalCount} งาน` : ''}`
      : info.id === 'progressRollup'
        ? `ความคืบหน้ารวมตอนนี้ ${s.summary.progress}%`
        : info.id === 'lateDetection'
          ? `ตอนนี้ล่าช้า ${s.summary.lateCount} งาน`
          : info.id === 'bufferZones' && s.buffer.status
            ? `ตอนนี้: ใช้เผื่อ ${s.buffer.consumedPercent}% / คืบหน้า ${s.buffer.chainProgress}% → ${s.buffer.status === 'green' ? 'เขียว' : s.buffer.status === 'yellow' ? 'เหลือง' : 'แดง'}`
            : null

  return (
    <div className={styles.rule} data-testid={`rule-${info.id}`}>
      <div className={styles.rl}>
        <h3>{info.title}</h3>
        <span className={styles.ref}>{info.reference}</span>
      </div>
      <div className={styles.rr}>
        {listOptions && (
          <Segment
            aria-label={info.title}
            value={currentValue}
            onChange={set}
            options={listOptions.map((o) => ({
              value: o.value,
              label: o.label,
              disabled: o.value === 'baseline' ? !project.baseline : o.disabled,
              title: o.value === 'baseline' && !project.baseline ? 'ใช้ได้เมื่อบันทึก baseline แล้ว' : o.help,
            }))}
          />
        )}
        {info.id === 'bufferZones' && (
          <div className={styles.inline}>
            <span className={styles.pair}>
              <span className={styles.crumb}>เหลือง เมื่อใช้เผื่อเกิน</span>
              <NumberInput aria-label="โซนเหลือง (%)" value={rules.bufferZones.yellow} min={50} max={300} step={10} suffix="%" onChange={(v) => v !== '' && onSave({ bufferZones: { ...rules.bufferZones, yellow: v } })} />
              <span className={styles.crumb}>ของความคืบหน้า</span>
            </span>
            <span className={styles.pair}>
              <span className={styles.crumb}>แดง เมื่อเกิน</span>
              <NumberInput aria-label="โซนแดง (%)" value={rules.bufferZones.red} min={60} max={400} step={10} suffix="%" onChange={(v) => v !== '' && onSave({ bufferZones: { ...rules.bufferZones, red: v } })} />
            </span>
          </div>
        )}
        {info.id === 'nearCriticalFloatDays' && near > 0 && (
          <div className={styles.inline}>
            <span className={styles.crumb}>N =</span>
            <NumberInput aria-label="จำนวนวัน near-critical" value={nearDraft} min={1} max={365} suffix="วัน" onChange={setNearDraft} onBlur={() => nearDraft !== '' && nearDraft !== near && onSave({ nearCriticalFloatDays: Number(nearDraft) })} />
          </div>
        )}
        {info.id === 'defaultDependency' && (
          <div className={styles.inline}>
            <span className={styles.crumb}>lag เริ่มต้น</span>
            <NumberInput aria-label="lag เริ่มต้น (วัน)" value={rules.defaultDependency.lag} min={-365} max={365} suffix="วัน" onChange={(v) => v !== '' && onSave({ defaultDependency: { ...rules.defaultDependency, lag: v } })} />
          </div>
        )}
        {rangeOptions && info.id !== 'bufferZones' && (
          <div className={styles.inline}>
            <NumberInput
              aria-label={info.title}
              value={(rules as unknown as Record<string, number>)[info.id]}
              min={rangeOptions.min}
              max={rangeOptions.max}
              step={rangeOptions.step}
              suffix={rangeOptions.unit}
              onChange={(v) => v !== '' && v >= rangeOptions.min && v <= rangeOptions.max && onSave({ [info.id]: v } as Partial<Rules>)}
            />
          </div>
        )}
        {help && <p>{help}</p>}
        {example && <div className={styles.ex} style={{ alignSelf: 'flex-start' }}>{example}</div>}
      </div>
    </div>
  )
}

