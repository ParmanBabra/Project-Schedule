import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useProject } from '@/features/projects/api'
import { useResources } from '@/features/resources/api'
import { formatThaiRange } from '@/shared/lib/date'
import { Avatar, Button, Card, Chip, ChipButton, EmptyState, Skeleton } from '@/shared/ui'
import { CreateEpicDialog } from './CreateEpicDialog'
import { STATUS_LABEL, epicStats, epicsOf, type EpicStatus } from './lib/epics'
import styles from './epics.module.css'

type Filter = 'all' | 'doing' | 'late' | 'done' | 'todo'
const TONE: Record<EpicStatus, 'neutral' | 'primary' | 'green' | 'critical'> = { todo: 'neutral', doing: 'primary', done: 'green', late: 'critical' }

/** Overview of every Epic in the project (docs/features.md EPIC-3). */
export function EpicsPage() {
  const { projectId = '' } = useParams()
  const project = useProject(projectId)
  const resources = useResources()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const [creating, setCreating] = useState(false)

  const stats = useMemo(() => (project.data ? epicsOf(project.data).map((e) => epicStats(project.data!, e)) : []), [project.data])
  const shown = stats.filter((s) => filter === 'all' || s.status === filter)
  const byStatus = (st: EpicStatus) => stats.filter((s) => s.status === st).length
  const resName = (id: string) => resources.data?.find((r) => r.id === id)

  if (project.isPending) return <div className={styles.page}><Card padding="md"><Skeleton height={24} width="30%" /></Card></div>
  if (project.isError || !project.data) return <div className={styles.page}><Card><EmptyState title="ไม่พบโปรเจกต์" /></Card></div>
  const p = project.data
  const taskTotal = stats.reduce((n, s) => n + s.taskCount, 0)

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>Epics</h1>
        <span className={styles.count}>{stats.length} epics · {taskTotal} งาน{stats.length ? ` · เสร็จ ${stats.reduce((n, s) => n + s.doneCount, 0)}` : ''}</span>
        <span className={styles.spacer} />
        <div className={styles.filters} role="group" aria-label="กรองสถานะ">
          {(['all', 'doing', 'late', 'done', 'todo'] as Filter[]).map((f) => {
            const n = f === 'all' ? stats.length : byStatus(f)
            if (f !== 'all' && n === 0) return null
            return (
              <ChipButton key={f} tone={filter === f ? 'primary' : f === 'late' ? 'critical' : 'soft'} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === 'all' ? 'ทั้งหมด' : STATUS_LABEL[f]} {n}
              </ChipButton>
            )
          })}
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)} className={styles.desktopOnly}>
          สร้าง Epic
        </Button>
      </div>

      {stats.length === 0 ? (
        <Card>
          <EmptyState
            title="ยังไม่มี Epic"
            description="Epic คือเรื่องใหญ่ที่รวมงานหลายตัวไว้ด้วยกัน เช่น Picking list มีสี เป้าหมาย และภาพรวมของตัวเอง"
            action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>สร้าง Epic แรก</Button>}
          />
        </Card>
      ) : (
        <div className={styles.grid} data-testid="epic-grid">
          {shown.map((s) => (
            <Card key={s.id} padding="md" className={styles.card} style={{ ['--epic' as string]: s.color }} role="link" tabIndex={0} data-testid={`epic-card-${s.id}`} onClick={() => navigate(`/p/${p.id}/gantt?epic=${s.id}&task=${s.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/p/${p.id}/gantt?epic=${s.id}&task=${s.id}`) }}>
              <div className={styles.cardTop}>
                <h3 className={styles.cardTitle}>{s.name}</h3>
                <Chip tone={TONE[s.status]} className={styles.status}>{s.status === 'late' ? `ล่าช้า ${s.lateCount} งาน` : STATUS_LABEL[s.status]}</Chip>
              </div>
              {s.description && <p className={styles.desc}>{s.description}</p>}
              <div className={styles.pbRow}>
                <div className={styles.pb} role="progressbar" aria-valuenow={s.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`ความคืบหน้า ${s.name}`}><div style={{ width: `${s.progress}%` }} /></div>
                <span className={styles.pct}>{s.progress}%</span>
              </div>
              <div className={styles.meta}>
                <span>งาน <b>{s.doneCount}/{s.taskCount}</b></span>
                {s.start && s.end && <span>{formatThaiRange(s.start, s.end)}</span>}
                {s.lateCount > 0 && <span className={styles.late}>ล่าช้า {s.lateCount}</span>}
                <span className={styles.avs}>
                  {s.resourceIds.slice(0, 4).map((rid) => {
                    const r = resName(rid)
                    return r ? <Avatar key={rid} name={r.name} color={r.color} size="sm" /> : null
                  })}
                </span>
              </div>
            </Card>
          ))}
          <button type="button" className={[styles.card, styles.newCard].join(' ')} onClick={() => setCreating(true)}>
            <Plus size={18} /> สร้าง Epic ใหม่ · หรือวางจาก Excel
          </button>
        </div>
      )}

      <Button variant="primary" icon={<Plus size={16} />} className={styles.fab} onClick={() => setCreating(true)} aria-label="สร้าง Epic">
        สร้าง Epic
      </Button>
      <CreateEpicDialog project={p} open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
