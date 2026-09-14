import { AlertTriangle, ArrowRight, MoreHorizontal, Plus, Trash2, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Overallocation, Resource, ResourceOut, ResourceType, ResourceWorkload } from '@/features/projects/types'
import { ApiError } from '@/shared/api/client'
import { addDays, diffDays, formatThai, isoWeekday, startOfWeekISO, todayISO } from '@/shared/lib/date'
import {
  Avatar,
  Button,
  Card,
  Chip,
  ChipButton,
  DateInput,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  Menu,
  NumberInput,
  Segment,
  Skeleton,
  useToast,
} from '@/shared/ui'
import { useCreateResource, useDeleteResource, useResources, useUpdateResource, useWorkload } from './api'
import styles from './resources.module.css'

const COLORS = ['#6a4fd8', '#e0457b', '#1f9e89', '#f28c28', '#2e86de', '#a1519c', '#8a83a8']
const HEAT_DAYS = 14

type Filter = 'all' | 'person' | 'equipment'

export function ResourcesPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const projectId = params.get('project') ?? undefined
  const resources = useResources()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [from, setFrom] = useState(() => startOfWeekISO(todayISO()))
  const to = addDays(from, HEAT_DAYS - 1)
  const workload = useWorkload(from, to, projectId, Boolean(resources.data?.length))
  const [editing, setEditing] = useState<Resource | 'new' | null>(null)
  const [deleting, setDeleting] = useState<ResourceOut | null>(null)
  const remove = useDeleteResource()

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (resources.data ?? []).filter((r) => (filter === 'all' || r.type === filter) && (!q || r.name.toLowerCase().includes(q)))
  }, [resources.data, filter, query])
  const byId = useMemo(() => new Map((workload.data?.resources ?? []).map((w) => [w.resource.id, w])), [workload.data])
  const overs = workload.data?.overallocations ?? []

  const onDelete = async (r: ResourceOut, force: boolean) => {
    try {
      await remove.mutateAsync({ id: r.id, force })
      toast.success(`ลบ "${r.name}" แล้ว`)
      setDeleting(null)
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && !force) {
        const projects = ((e.body as { error: { details: { projects: { name: string }[] } } }).error.details.projects ?? []).map((p) => p.name).join(', ')
        toast.show(`"${r.name}" ถูกมอบหมายอยู่ใน ${projects}`, { tone: 'warn', action: { label: 'ถอดออกทั้งหมดแล้วลบ', onClick: () => void onDelete(r, true) }, duration: 8000 })
      } else toast.error('ลบไม่สำเร็จ')
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>ทรัพยากร</h1>
        <Input aria-label="ค้นหาทรัพยากร" placeholder="ค้นหา" value={query} onChange={(e) => setQuery(e.target.value)} style={{ width: 200, background: 'var(--surface)' }} />
        <Segment<Filter>
          aria-label="ประเภท"
          variant="white"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'ทั้งหมด' },
            { value: 'person', label: 'คน' },
            { value: 'equipment', label: 'เครื่องมือ' },
          ]}
        />
        <span className={styles.range}>
          <span>ช่วง 14 วันจาก</span>
          <DateInput aria-label="วันเริ่มช่วง" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </span>
        <span className={styles.spacer} />
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>
          เพิ่มทรัพยากร
        </Button>
      </div>

      {overs.length > 0 && (
        <Card padding="md" className={styles.warn} data-testid="overallocation-card">
          <div className={styles.warnHead}>
            <AlertTriangle size={18} /> เกินกำลัง {new Set(overs.map((o) => o.resourceId)).size} คน · {overs.length} วัน ในช่วงที่เลือก
            {workload.data && workload.data.threshold !== 100 && <Chip tone="warn">เกณฑ์ {workload.data.threshold}%</Chip>}
          </div>
          {groupOvers(overs).map((g) => (
            <div key={`${g.resourceId}-${g.from}`} className={styles.warnRow}>
              <span className={styles.name}>{g.resourceName}</span>
              <span className={styles.date}>{g.from === g.to ? formatThai(g.from) : `${formatThai(g.from)} – ${formatThai(g.to)}`}</span>
              <span className={styles.date}>{g.load}%</span>
              <span className={styles.items}>{g.items.map((i) => `${i.taskName} (${i.projectName} ${i.units}%)`).join(' + ')}</span>
              <Button size="sm" className={styles.go} icon={<ArrowRight size={14} />} onClick={() => navigate(`/p/${g.items[0].projectId}/gantt?task=${g.items[0].taskId}`)}>
                ไปที่งาน
              </Button>
            </div>
          ))}
        </Card>
      )}

      <Card>
        {resources.isPending ? (
          <div style={{ padding: 24 }}>
            <Skeleton height={20} width="40%" />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Users size={26} />}
            title={resources.data?.length ? 'ไม่พบทรัพยากรที่ตรงกับตัวกรอง' : 'ยังไม่มีทรัพยากร'}
            description={resources.data?.length ? undefined : 'เพิ่มคนหรือเครื่องมือ แล้วมอบหมายให้งานจากแผงงานใน Gantt'}
            action={resources.data?.length ? undefined : <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing('new')}>เพิ่มทรัพยากร</Button>}
          />
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th className={styles.num}>กำลัง/วัน</th>
                  <th className={styles.num}>งาน</th>
                  <th className={styles.loadCell}>ภาระสูงสุดในช่วง</th>
                  <th>{HEAT_DAYS} วัน จาก {formatThai(from)}</th>
                  <th className={styles.actions} />
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <ResourceRow key={r.id} r={r} w={byId.get(r.id)} onEdit={() => setEditing(r)} onDelete={() => setDeleting(r)} />
                ))}
              </tbody>
            </table>
            <div className={styles.legend}>
              <span><i className={[styles.cell, styles.cellPart].join(' ')} style={{ width: 12, height: 12 }} />ว่างบางส่วน</span>
              <span><i className={[styles.cell, styles.cellFull].join(' ')} style={{ width: 12, height: 12 }} />เต็ม</span>
              <span><i className={[styles.cell, styles.cellOver].join(' ')} style={{ width: 12, height: 12 }} />เกินกำลัง</span>
              <span><i className={[styles.cell, styles.cellOff].join(' ')} style={{ width: 12, height: 12 }} />วันหยุด/ลา</span>
            </div>
          </>
        )}
      </Card>

      {editing && <ResourceDialog resource={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <Dialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="ลบทรัพยากร"
        description={deleting ? `"${deleting.name}" ${deleting.assignmentCount ? `ถูกมอบหมายอยู่ ${deleting.assignmentCount} งาน การลบจะถอดออกจากทุกงาน` : 'ยังไม่ถูกมอบหมายงาน'}` : ''}
        actions={
          <>
            <Button onClick={() => setDeleting(null)}>ยกเลิก</Button>
            <Button variant="danger" onClick={() => deleting && void onDelete(deleting, deleting.assignmentCount > 0)} disabled={remove.isPending}>
              ลบทรัพยากร
            </Button>
          </>
        }
      />
    </div>
  )
}

function ResourceRow({ r, w, onEdit, onDelete }: { r: ResourceOut; w?: ResourceWorkload; onEdit: () => void; onDelete: () => void }) {
  const peak = w?.peak ?? 0
  const over = (w?.overDays ?? 0) > 0
  return (
    <tr className={styles.row} data-testid={`resource-row-${r.id}`} onClick={onEdit}>
      <td>
        <div className={styles.nameCell}>
          <Avatar name={r.name} color={r.color} />
          <div>
            {r.name}
            <div className={styles.sub}>{r.type === 'person' ? 'คน' : 'เครื่องมือ'}{r.daysOff.length ? ` · วันลา ${r.daysOff.length} วัน` : ''}</div>
          </div>
        </div>
      </td>
      <td className={styles.num} data-label="กำลัง/วัน">{r.capacityPerDay}%</td>
      <td className={styles.num} data-label="งาน">{r.assignmentCount}</td>
      <td className={styles.loadCell} data-label="ภาระสูงสุด">
        <div className={styles.load}>
          <div className={styles.loadBar}>
            <div className={[styles.loadFill, over && styles.loadOver].filter(Boolean).join(' ')} style={{ width: `${Math.min(100, (peak / Math.max(r.capacityPerDay, 1)) * 100 / 1.5)}%` }} />
          </div>
          <span className={[styles.loadPct, over && styles.loadPctOver].filter(Boolean).join(' ')}>{peak}%</span>
        </div>
      </td>
      <td>
        <div className={styles.heat} aria-label={`ภาระรายวันของ ${r.name}`}>
          {(w?.days ?? []).map((d) => (
            <span
              key={d.date}
              title={`${formatThai(d.date)} · ${d.off ? 'วันลา' : `${d.load}%`}${d.items.length ? ` · ${d.items.map((i) => i.taskName).join(', ')}` : ''}`}
              className={[
                styles.cell,
                d.off ? styles.cellOff : d.over ? styles.cellOver : d.load >= r.capacityPerDay ? styles.cellFull : d.load > 0 ? styles.cellPart : '',
                isoWeekday(d.date) >= 6 && styles.cellWe,
              ]
                .filter(Boolean)
                .join(' ')}
            />
          ))}
        </div>
      </td>
      <td className={styles.actions} onClick={(e) => e.stopPropagation()}>
        <Menu
          items={[
            { label: 'แก้ไข', onSelect: onEdit },
            { label: 'ลบทรัพยากร', icon: <Trash2 size={14} />, danger: true, onSelect: onDelete },
          ]}
          trigger={(props) => (
            <IconButton label={`ตัวเลือกของ ${r.name}`} {...props}>
              <MoreHorizontal size={16} />
            </IconButton>
          )}
        />
      </td>
    </tr>
  )
}

/** Merge consecutive overallocated days of the same resource with the same tasks into one row. */
function groupOvers(overs: Overallocation[]) {
  type Group = { resourceId: string; resourceName: string; from: string; to: string; load: number; items: Overallocation['items'] }
  const groups: Group[] = []
  const lastByResource = new Map<string, Group>()
  for (const o of [...overs].sort((a, b) => a.resourceId.localeCompare(b.resourceId) || a.date.localeCompare(b.date))) {
    const key = o.items.map((i) => `${i.projectId}/${i.taskId}`).join('|')
    const last = lastByResource.get(o.resourceId)
    // merge runs of the same tasks; a gap of up to 3 calendar days bridges a weekend
    if (last && diffDays(last.to, o.date) <= 3 && last.items.map((i) => `${i.projectId}/${i.taskId}`).join('|') === key) {
      last.to = o.date
      last.load = Math.max(last.load, o.load)
    } else {
      const g: Group = { resourceId: o.resourceId, resourceName: o.resourceName, from: o.date, to: o.date, load: o.load, items: o.items }
      groups.push(g)
      lastByResource.set(o.resourceId, g)
    }
  }
  return groups.sort((a, b) => a.from.localeCompare(b.from) || a.resourceName.localeCompare(b.resourceName))
}

// ------------------------------------------------------------------- dialog

function ResourceDialog({ resource, onClose }: { resource: Resource | null; onClose: () => void }) {
  const toast = useToast()
  const create = useCreateResource()
  const update = useUpdateResource()
  const [name, setName] = useState(resource?.name ?? '')
  const [type, setType] = useState<ResourceType>(resource?.type ?? 'person')
  const [capacity, setCapacity] = useState<number | ''>(resource?.capacityPerDay ?? 100)
  const [color, setColor] = useState(resource?.color ?? COLORS[0])
  const [daysOff, setDaysOff] = useState<string[]>(resource?.daysOff ?? [])
  const [off, setOff] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!name.trim()) return setError('กรุณาตั้งชื่อ')
    if (capacity === '' || capacity < 1) return setError('กำลังต่อวันต้องมากกว่า 0')
    setError(null)
    try {
      if (resource) await update.mutateAsync({ id: resource.id, name: name.trim(), type, capacityPerDay: capacity, color, daysOff })
      else await create.mutateAsync({ name: name.trim(), type, capacityPerDay: capacity, color, daysOff })
      toast.success(resource ? 'บันทึกแล้ว' : `เพิ่ม "${name.trim()}" แล้ว`)
      onClose()
    } catch {
      setError('บันทึกไม่สำเร็จ')
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={resource ? 'แก้ไขทรัพยากร' : 'เพิ่มทรัพยากร'}
      actions={
        <>
          <Button onClick={onClose}>ยกเลิก</Button>
          <Button variant="primary" onClick={() => void submit()} disabled={create.isPending || update.isPending}>
            {resource ? 'บันทึก' : 'เพิ่ม'}
          </Button>
        </>
      }
    >
      <form
        className={styles.form}
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <Field label="ชื่อ" htmlFor="res-name" error={error}>
          <Input id="res-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น สมชาย หรือ Server A" maxLength={120} />
        </Field>
        <div className={styles.row2}>
          <Field label="ประเภท">
            <Segment<ResourceType> aria-label="ประเภททรัพยากร" block value={type} onChange={setType} options={[{ value: 'person', label: 'คน' }, { value: 'equipment', label: 'เครื่องมือ' }]} />
          </Field>
          <Field label="กำลังต่อวัน" htmlFor="res-cap" hint="100% = ทำงานได้เต็มวัน">
            <NumberInput id="res-cap" value={capacity} onChange={setCapacity} min={1} max={1000} step={10} suffix="%" />
          </Field>
        </div>
        <Field label="สี">
          <div className={styles.colors} role="radiogroup" aria-label="สี">
            {COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} className={[styles.swatch, color === c && styles.swatchOn].filter(Boolean).join(' ')} style={{ background: c }} onClick={() => setColor(c)} />
            ))}
          </div>
        </Field>
        <Field label="วันลา / วันหยุดส่วนตัว" hint="วันเหล่านี้จะไม่นับเป็นกำลัง งานที่ทับจะถือว่าเกินกำลัง">
          <div className={styles.offList}>
            {daysOff.map((d) => (
              <ChipButton key={d} tone="soft" icon={<X size={12} />} aria-label={`ลบวันลา ${formatThai(d, { year: true })}`} onClick={() => setDaysOff(daysOff.filter((x) => x !== d))}>
                {formatThai(d, { year: true })}
              </ChipButton>
            ))}
            <span className={styles.offAdd}>
              <DateInput aria-label="วันลาใหม่" value={off} onChange={(e) => setOff(e.target.value)} />
              <Button
                size="sm"
                icon={<Plus size={14} />}
                disabled={!off || daysOff.includes(off)}
                onClick={() => {
                  setDaysOff([...daysOff, off].sort())
                  setOff('')
                }}
              >
                เพิ่มวันลา
              </Button>
            </span>
          </div>
        </Field>
        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Dialog>
  )
}
