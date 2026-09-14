import { AlertTriangle, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ProjectOut } from '@/features/projects/types'
import { useAddAssignment, useDeleteAssignment, useResources, useUpdateAssignment, useWorkload } from '@/features/resources/api'
import { ApiError } from '@/shared/api/client'
import { formatThai } from '@/shared/lib/date'
import { Avatar, Button, IconButton, NumberInput, Select, useToast } from '@/shared/ui'
import styles from './taskPanel.module.css'

/** ผู้รับผิดชอบ block inside the task panel (docs/features.md ASG-1, ASG-2, ASG-4). */
export function AssignmentSection({ project, taskId }: { project: ProjectOut; taskId: string }) {
  const toast = useToast()
  const resources = useResources()
  const add = useAddAssignment(project.id)
  const update = useUpdateAssignment(project.id)
  const remove = useDeleteAssignment(project.id)
  const schedule = project.schedule.tasks[taskId]
  const assignments = project.assignments.filter((a) => a.taskId === taskId)
  const assignedIds = assignments.map((a) => a.resourceId)
  const workload = useWorkload(schedule?.start ?? '', schedule?.end ?? '', project.id, Boolean(schedule) && assignments.length > 0, assignedIds)
  const [adding, setAdding] = useState(false)
  const [resourceId, setResourceId] = useState('')
  const [units, setUnits] = useState<number | ''>(100)

  const byId = useMemo(() => new Map((resources.data ?? []).map((r) => [r.id, r])), [resources.data])
  const candidates = (resources.data ?? []).filter((r) => !assignments.some((a) => a.resourceId === r.id))
  const overs = (workload.data?.overallocations ?? []).filter((o) => assignments.some((a) => a.resourceId === o.resourceId))

  const fail = (e: unknown) => toast.error(e instanceof ApiError && e.status === 422 ? 'ทรัพยากรนี้ถูกมอบหมายให้งานนี้แล้ว' : 'บันทึกไม่สำเร็จ')

  if (!schedule || schedule.isSummary) return null

  return (
    <div className={styles.section} data-testid="assignments">
      <div className={styles.sectionTitle}>
        ผู้รับผิดชอบ
        {resources.data && resources.data.length === 0 && (
          <Link to="/resources" className={styles.muted}>
            ยังไม่มีทรัพยากร · เพิ่มก่อน
          </Link>
        )}
      </div>
      {assignments.length === 0 && !adding && <span className={styles.muted}>ยังไม่มีผู้รับผิดชอบ</span>}
      {assignments.map((a) => {
        const r = byId.get(a.resourceId)
        return (
          <div key={a.id} className={styles.asgRow} data-testid={`asg-${a.id}`}>
            <Avatar name={r?.name ?? '?'} color={r?.color} />
            <span className={styles.depName}>{r?.name ?? a.resourceId}</span>
            <UnitsInput value={a.units} onCommit={(v) => update.mutate({ id: a.id, units: v }, { onError: fail })} />
            <IconButton label={`ถอด ${r?.name ?? ''}`} onClick={() => remove.mutate(a.id, { onError: fail })}>
              <Trash2 size={14} />
            </IconButton>
          </div>
        )
      })}
      {overs.length > 0 && (
        <div className={styles.warnBox} data-testid="asg-warning">
          <AlertTriangle size={16} />
          <span>
            {summarizeOvers(overs.map((o) => ({ name: o.resourceName, date: o.date, load: o.load })))}
          </span>
        </div>
      )}
      {adding ? (
        <div className={styles.addDep}>
          <Select aria-label="เลือกทรัพยากร" value={resourceId} onChange={setResourceId} options={[{ value: '', label: 'เลือกทรัพยากร…' }, ...candidates.map((r) => ({ value: r.id, label: r.name }))]} />
          <span style={{ display: 'flex', gap: 6 }}>
            <NumberInput aria-label="สัดส่วน (%)" value={units} onChange={setUnits} min={1} max={1000} step={10} suffix="%" style={{ width: 96 }} />
            <Button
              variant="primary"
              size="sm"
              disabled={!resourceId || units === '' || add.isPending}
              onClick={() =>
                add.mutate(
                  { taskId, resourceId, units: Number(units) || 100 },
                  {
                    onSuccess: () => {
                      setAdding(false)
                      setResourceId('')
                      setUnits(100)
                    },
                    onError: fail,
                  },
                )
              }
            >
              มอบหมาย
            </Button>
          </span>
        </div>
      ) : (
        <button type="button" className={styles.addDepBtn} onClick={() => setAdding(true)} disabled={candidates.length === 0}>
          <Plus size={14} /> มอบหมายทรัพยากร
        </button>
      )}
    </div>
  )
}

function UnitsInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState<number | ''>(value)
  return (
    <NumberInput
      aria-label="สัดส่วน (%)"
      value={v}
      onChange={setV}
      onBlur={() => v !== '' && v !== value && onCommit(v)}
      onKeyDown={(e) => e.key === 'Enter' && v !== '' && v !== value && onCommit(v)}
      min={1}
      max={1000}
      step={10}
      suffix="%"
      style={{ width: 88 }}
    />
  )
}

function summarizeOvers(items: { name: string; date: string; load: number }[]): string {
  const byName = new Map<string, { dates: string[]; load: number }>()
  for (const i of items) {
    const cur = byName.get(i.name) ?? { dates: [], load: 0 }
    cur.dates.push(i.date)
    cur.load = Math.max(cur.load, i.load)
    byName.set(i.name, cur)
  }
  return Array.from(byName.entries())
    .map(([name, v]) => {
      const d = v.dates.sort()
      const range = d.length === 1 ? formatThai(d[0]) : `${formatThai(d[0])} – ${formatThai(d[d.length - 1])}`
      return `${name} เกินกำลัง ${v.load}% วันที่ ${range}`
    })
    .join(' · ')
}
