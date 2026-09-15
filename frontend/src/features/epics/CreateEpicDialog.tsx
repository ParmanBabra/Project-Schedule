import { Check, GripVertical, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { EpicCreate, ProjectOut } from '@/features/projects/types'
import { useResources } from '@/features/resources/api'
import { ApiError } from '@/shared/api/client'
import { Button, Dialog, Field, Input, NumberInput, Segment, Select, useToast } from '@/shared/ui'
import { useCreateEpic, useCreateEpics } from './api'
import { EPIC_COLORS, epicOf, epicsOf, parsePaste } from './lib/epics'
import styles from './epics.module.css'

export type EpicTab = 'manual' | 'paste' | 'existing'

interface Props {
  project: ProjectOut
  open: boolean
  onClose: () => void
  onCreated?: (project: ProjectOut) => void
  initialTab?: EpicTab
  /** preselect tasks for the "existing" tab (selection mode on the Gantt) */
  initialTaskIds?: string[]
  defaultName?: string
}

interface Row {
  name: string
  duration: number | ''
}

const DEFAULT_ROWS: Row[] = [{ name: '', duration: 3 }]

export function CreateEpicDialog({ project, open, onClose, onCreated, initialTab = 'manual', initialTaskIds = [], defaultName = '' }: Props) {
  const toast = useToast()
  const resources = useResources()
  const createEpic = useCreateEpic(project.id)
  const createEpics = useCreateEpics(project.id)
  const [tab, setTab] = useState<EpicTab>(initialTab)
  const [name, setName] = useState(defaultName)
  const [color, setColor] = useState(EPIC_COLORS[0])
  const [description, setDescription] = useState('')
  const [owner, setOwner] = useState('')
  const [parentId, setParentId] = useState('')
  const [rows, setRows] = useState<Row[]>(DEFAULT_ROWS)
  const [paste, setPaste] = useState('')
  const [defaultDays, setDefaultDays] = useState<number | ''>(3)
  const [sequential, setSequential] = useState<'seq' | 'par'>('seq')
  const [linkEpics, setLinkEpics] = useState<'wait' | 'free'>('wait')
  const [picked, setPicked] = useState<Set<string>>(new Set(initialTaskIds))
  const [error, setError] = useState<string | null>(null)

  const epics = useMemo(() => epicsOf(project), [project])
  useEffect(() => {
    if (!open) return
    setTab(initialTab)
    setName(defaultName)
    const used = new Set(epics.map((e) => e.epic?.color))
    setColor(EPIC_COLORS.find((c) => !used.has(c)) ?? EPIC_COLORS[epics.length % EPIC_COLORS.length])
    setDescription('')
    setOwner('')
    setParentId('')
    setRows(DEFAULT_ROWS)
    setPaste('')
    setPicked(new Set(initialTaskIds))
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const parsed = useMemo(() => parsePaste(paste), [paste])
  const manualRows = rows.filter((r) => r.name.trim())
  // tasks that can be pulled into a new Epic: not an Epic themselves, not already inside an Epic
  const candidates = useMemo(() => project.tasks.filter((t) => !t.epic && !epicOf(project, t.id)).sort((a, b) => (project.schedule.tasks[a.id]?.wbs ?? '').localeCompare(project.schedule.tasks[b.id]?.wbs ?? '', undefined, { numeric: true })), [project])

  const totalDays = useMemo(() => {
    const ds = manualRows.map((r) => Number(r.duration) || 0)
    if (ds.length === 0) return 0
    return sequential === 'seq' ? ds.reduce((a, b) => a + b, 0) : Math.max(...ds)
  }, [manualRows, sequential])

  const count = tab === 'manual' ? manualRows.length : tab === 'paste' ? parsed.reduce((n, e) => n + e.tasks.length, 0) : picked.size
  const epicCount = tab === 'paste' ? parsed.length : 1
  const canSubmit = tab === 'paste' ? parsed.length > 0 : name.trim().length > 0 && (tab !== 'existing' || picked.size > 0)

  const submit = async () => {
    setError(null)
    try {
      let out: ProjectOut
      if (tab === 'paste') {
        out = await createEpics.mutateAsync({
          linkEpics: linkEpics === 'wait',
          epics: parsed.map((e) => ({
            name: e.name,
            description: '',
            sequential: sequential === 'seq',
            parentId: parentId || null,
            tasks: e.tasks.map((t) => ({ name: t.name, duration: t.duration ?? (Number(defaultDays) || 3), checklist: t.checklist })),
          })),
        })
        toast.success(`สร้าง ${parsed.length} Epic · ${count} งาน แล้ว`)
      } else {
        const body: EpicCreate = {
          name: name.trim(),
          color,
          description: description.trim(),
          ownerResourceId: owner || null,
          parentId: parentId || null,
          sequential: sequential === 'seq',
          tasks: tab === 'manual' ? manualRows.map((r) => ({ name: r.name.trim(), duration: Number(r.duration) || 0 })) : [],
          existingTaskIds: tab === 'existing' ? [...picked] : [],
        }
        out = await createEpic.mutateAsync(body)
        toast.success(count > 0 ? `สร้าง Epic "${body.name}" + ${count} งาน แล้ว` : `สร้าง Epic "${body.name}" แล้ว`)
      }
      onCreated?.(out)
      onClose()
    } catch (e) {
      setError(e instanceof ApiError && e.body && typeof e.body === 'object' && 'error' in e.body ? String((e.body as { error: { message: string } }).error.message) : 'สร้าง Epic ไม่สำเร็จ')
    }
  }

  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)))
  const addRow = () => setRows([...rows, { name: '', duration: Number(defaultDays) || 3 }])

  return (
    <Dialog
      size="lg"
      open={open}
      onClose={onClose}
      title="สร้าง Epic"
      description="Epic คือเรื่องใหญ่หนึ่งเรื่องที่มีสีและเป้าหมายของตัวเอง งานข้างในเป็นตัวกำหนดวันและ % ของ Epic"
      actions={
        <>
          {error && <span style={{ color: 'var(--critical-text)', fontSize: 'var(--fs-label)' }} role="alert">{error}</span>}
          <span className={styles.spacer} />
          <Button onClick={onClose}>ยกเลิก</Button>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => void submit()} disabled={!canSubmit || createEpic.isPending || createEpics.isPending} data-testid="epic-submit">
            {tab === 'paste' ? `สร้าง ${epicCount} Epic · ${count} งาน` : count > 0 ? `สร้าง Epic + ${count} งาน` : 'สร้าง Epic'}
          </Button>
        </>
      }
    >
      <div className={styles.body} data-testid="create-epic">
        {tab !== 'paste' && (
          <div className={styles.sec}>
            <div className={styles.secHead}>1 · ข้อมูล Epic</div>
            <div className={styles.row2}>
              <Field label="ชื่อ Epic" htmlFor="epic-name">
                <Input id="epic-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Picking list" maxLength={200} autoFocus />
              </Field>
              <Field label="สี">
                <div className={styles.swatches} role="radiogroup" aria-label="สี Epic">
                  {EPIC_COLORS.map((c) => (
                    <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} className={[styles.swatch, color === c && styles.swatchOn].filter(Boolean).join(' ')} style={{ background: c }} onClick={() => setColor(c)}>
                      {color === c && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <Field label="เป้าหมาย / คำอธิบาย" htmlFor="epic-desc" hint="ไม่บังคับ">
              <textarea id="epic-desc" className={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="เช่น พนักงานหยิบสินค้าตาม picking list บนมือถือ ยืนยันแล้วส่งผลกลับ LMS" />
            </Field>
            <div className={styles.row2eq}>
              <Field label="เจ้าของ" htmlFor="epic-owner">
                <Select id="epic-owner" value={owner} onChange={setOwner} options={[{ value: '', label: 'ยังไม่ระบุ' }, ...(resources.data ?? []).map((r) => ({ value: r.id, label: r.name }))]} />
              </Field>
              <Field label="วาง Epic ไว้" htmlFor="epic-parent">
                <Select id="epic-parent" value={parentId} onChange={setParentId} options={[{ value: '', label: 'ระดับบนสุดของโปรเจกต์' }, ...epics.map((e) => ({ value: e.id, label: `ใน Epic: ${e.name}` }))]} />
              </Field>
            </div>
          </div>
        )}

        <div className={styles.sec}>
          <div className={styles.secHead}>
            {tab === 'paste' ? 'วางจาก Excel / รายการ' : '2 · งานใน Epic'} <small>เลือกวิธีใส่งานได้ 3 แบบ</small>
          </div>
          <Segment<EpicTab>
            aria-label="วิธีใส่งาน"
            variant="white"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'manual', label: 'พิมพ์เอง' },
              { value: 'paste', label: 'วางจาก Excel / รายการ' },
              { value: 'existing', label: 'เลือกจากงานที่มีอยู่' },
            ]}
          />

          {tab === 'manual' && (
            <>
              <div className={styles.rowHead}><span /><span>ชื่องาน</span><span>ระยะเวลา</span><span /></div>
              {rows.map((r, i) => (
                <div key={i} className={styles.trow}>
                  <span className={styles.grip} aria-hidden="true"><GripVertical size={14} /></span>
                  <Input aria-label={`ชื่องานที่ ${i + 1}`} value={r.name} placeholder="ชื่องาน" maxLength={200} onChange={(e) => setRow(i, { name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && i === rows.length - 1 && r.name.trim()) { e.preventDefault(); addRow() } }} />
                  <NumberInput aria-label={`ระยะเวลางานที่ ${i + 1}`} value={r.duration} min={0} max={3650} suffix="วัน" onChange={(v) => setRow(i, { duration: v })} />
                  <button type="button" className={styles.del} aria-label={`ลบงานที่ ${i + 1}`} onClick={() => setRows(rows.length > 1 ? rows.filter((_, k) => k !== i) : DEFAULT_ROWS)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button type="button" className={styles.addRow} onClick={addRow}>
                <Plus size={14} /> เพิ่มงาน · Enter ขึ้นแถวใหม่
              </button>
            </>
          )}

          {tab === 'paste' && (
            <>
              <textarea
                className={styles.paste}
                aria-label="วางรายการ"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={'วางจาก Excel: คอลัมน์ หัวข้อ  งาน (บรรทัดที่ขึ้นต้นด้วย - เป็นงานย่อย)\nหรือพิมพ์:\nPicking list\n  Picking list (3)\n  Plant Route (Mobile) (5)\n  - งานย่อย'}
              />
              <div className={styles.optRow}>
                <span className={styles.optLabel}>วันต่อ 1 งาน (ถ้าไม่ระบุ)</span>
                <span style={{ width: 110 }}><NumberInput aria-label="วันต่อ 1 งาน" value={defaultDays} min={0} max={3650} suffix="วัน" onChange={setDefaultDays} /></span>
              </div>
              <div className={styles.optRow}>
                <span className={styles.optLabel}>ระหว่าง Epic</span>
                <Segment<'wait' | 'free'> aria-label="ระหว่าง Epic" value={linkEpics} onChange={setLinkEpics} options={[{ value: 'wait', label: 'Epic ถัดไปรอ Epic ก่อน' }, { value: 'free', label: 'อิสระต่อกัน' }]} />
              </div>
              <div className={styles.optRow}>
                <span className={styles.optLabel}>วาง Epic ไว้</span>
                <span style={{ minWidth: 220 }}><Select aria-label="วาง Epic ไว้" value={parentId} onChange={setParentId} options={[{ value: '', label: 'ระดับบนสุดของโปรเจกต์' }, ...epics.map((e) => ({ value: e.id, label: `ใน Epic: ${e.name}` }))]} /></span>
              </div>
              {parsed.length > 0 && (
                <div className={styles.preview} data-testid="paste-preview" aria-label="ตัวอย่างที่จะได้">
                  {parsed.map((e, i) => (
                    <div key={e.name} style={{ ['--epic' as string]: EPIC_COLORS[(epics.length + i) % EPIC_COLORS.length] }}>
                      <div className={styles.pvEpic}><span className={styles.pvSq} />{e.name}<small style={{ marginLeft: 'auto', color: 'var(--text-3)', fontWeight: 400 }}>{e.tasks.length} งาน</small></div>
                      {e.tasks.map((t, k) => (
                        <div key={k}>
                          <div className={styles.pvTask}><span className={styles.pvDot} />{t.name}<small>{t.duration ?? (Number(defaultDays) || 3)}</small></div>
                          {t.checklist.map((c) => <div key={c} className={styles.pvSub}>{c}</div>)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'existing' && (
            <div className={styles.existing} role="group" aria-label="งานที่มีอยู่">
              {candidates.length === 0 && <span className={styles.count}>ไม่มีงานที่ยังไม่อยู่ใน Epic</span>}
              {candidates.map((t) => (
                <label key={t.id} className={styles.exRow}>
                  <input type="checkbox" checked={picked.has(t.id)} onChange={(e) => { const n = new Set(picked); if (e.target.checked) n.add(t.id); else n.delete(t.id); setPicked(n) }} />
                  <span>{project.schedule.tasks[t.id]?.wbs} {t.name}</span>
                  <small>{project.schedule.tasks[t.id]?.isSummary ? 'กลุ่ม' : `${t.duration} วัน`}</small>
                </label>
              ))}
            </div>
          )}

          {tab !== 'existing' && (
            <div className={styles.optRow}>
              <span className={styles.optLabel}>ลำดับงานข้างใน</span>
              <Segment<'seq' | 'par'> aria-label="ลำดับงานข้างใน" value={sequential} onChange={setSequential} options={[{ value: 'seq', label: 'ต่อกันตามลำดับ (FS)' }, { value: 'par', label: 'ทำพร้อมกัน' }]} />
            </div>
          )}
        </div>

        {tab === 'manual' && manualRows.length > 0 && (
          <div className={styles.sumLine}>Epic นี้จะยาว <b>{totalDays} วันทำงาน</b>{sequential === 'seq' ? ' (ต่อกัน)' : ' (พร้อมกัน)'} · แก้ทุกอย่างได้ทีหลังในแผง Epic</div>
        )}
        {tab === 'existing' && picked.size > 0 && (
          <div className={styles.sumLine}>ย้าย <b>{picked.size} งาน</b> เข้า Epic ใหม่ ความสัมพันธ์และผู้รับผิดชอบเดิมอยู่ครบ</div>
        )}
      </div>
    </Dialog>
  )
}
