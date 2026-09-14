import { CalendarDays, List, Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useProject, useUpdateTask } from '@/features/projects/api'
import { formatThai } from '@/shared/lib/date'
import { Button, Card, Chip, EmptyState, Segment, Skeleton, Toggle, useToast } from '@/shared/ui'
import { TaskPanel } from '@/features/tasks/TaskPanel'
import { AddTaskDialog } from './AddTaskDialog'
import { GanttChart } from './GanttChart'
import { TaskListDrawer } from './TaskListDrawer'
import type { Zoom } from './lib/timeline'
import styles from './gantt.module.css'

const ZOOM_KEY = 'phaengan.gantt.zoom'

function readZoom(): Zoom {
  try {
    const v = localStorage.getItem(ZOOM_KEY)
    if (v === 'day' || v === 'week' || v === 'month') return v
  } catch {
    /* ignore */
  }
  return window.matchMedia('(max-width: 767px)').matches ? 'week' : 'day'
}

export function GanttPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const project = useProject(projectId)
  const updateTask = useUpdateTask(projectId)
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('task')
  const [zoom, setZoomState] = useState<Zoom>(readZoom)
  const [highlight, setHighlight] = useState(true)
  const [adding, setAdding] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [scrollToken, setScrollToken] = useState(0)

  const setZoom = (z: Zoom) => {
    setZoomState(z)
    try {
      localStorage.setItem(ZOOM_KEY, z)
    } catch {
      /* ignore */
    }
  }

  const select = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(params)
      if (id) next.set('task', id)
      else next.delete('task')
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const toggleCollapse = (id: string, collapsed: boolean) => {
    updateTask.mutate({ taskId: id, collapsed }, { onError: () => toast.error('บันทึกสถานะยุบ/ขยายไม่สำเร็จ') })
  }

  if (project.isPending) {
    return (
      <Card padding="md" className={styles.card}>
        <Skeleton height={24} width="30%" />
        <Skeleton height={44} style={{ marginTop: 16 }} />
        <Skeleton height={44} style={{ marginTop: 8 }} />
        <Skeleton height={44} style={{ marginTop: 8 }} />
      </Card>
    )
  }
  if (project.isError || !project.data) {
    return (
      <Card className={styles.card}>
        <EmptyState title="ไม่พบโปรเจกต์" description="โปรเจกต์นี้อาจถูกลบไปแล้ว" />
      </Card>
    )
  }

  const p = project.data
  const s = p.schedule.summary
  const b = p.schedule.buffer
  const zoomOptions = [
    { value: 'day' as const, label: 'วัน' },
    { value: 'week' as const, label: 'สัปดาห์' },
    { value: 'month' as const, label: 'เดือน' },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <Button size="sm" icon={<List size={16} />} onClick={() => setListOpen(true)} aria-label="รายการงาน" disabled={p.tasks.length === 0}>
          <span className={styles.todayLabel}>รายการงาน</span>
        </Button>
        <Segment<Zoom> aria-label="ระดับการซูม" variant="white" value={zoom} onChange={setZoom} options={zoomOptions} />
        <Button size="sm" icon={<CalendarDays size={16} />} onClick={() => setScrollToken((n) => n + 1)} aria-label="เลื่อนไปวันนี้">
          <span className={styles.todayLabel}>วันนี้</span>
        </Button>
        <Toggle checked={highlight} onChange={setHighlight} label="Critical path" />
        <span className={styles.spacer} />
        <div className={styles.chips}>
          {s.taskCount > 0 && (
            <>
              <Chip tone="critical" data-testid="chip-critical">
                Critical {s.criticalCount} งาน
              </Chip>
              {s.nearCriticalCount > 0 && <Chip tone="warn">ใกล้ critical {s.nearCriticalCount}</Chip>}
              {b.days > 0 && (
                <Chip tone="green" data-testid="chip-buffer">
                  เผื่อ {b.days} วัน
                </Chip>
              )}
              <Chip tone="soft" data-testid="chip-dates">
                เสร็จตามแผน {formatThai(s.plannedEnd)} · สัญญาส่ง {formatThai(s.committedEnd)}
              </Chip>
            </>
          )}
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => setAdding(true)} className={styles.addBtn} aria-label="เพิ่มงาน">
          <span>เพิ่มงาน</span>
        </Button>
      </div>

      <Card className={styles.card}>
        {p.tasks.length === 0 ? (
          <div className={styles.empty}>
            <EmptyState
              title="เริ่มด้วยการเพิ่มงานแรก"
              description={p.buffer.method === 'ccpm' ? 'กรอกระยะเวลาแบบ "ถ้าราบรื่นจะเสร็จใน" ไม่ต้องเผื่อ ระบบจะเผื่อรวมไว้ท้ายโครงการให้' : 'เพิ่มงาน ผูกความสัมพันธ์ แล้วดู critical path'}
              action={
                <Button variant="primary" icon={<Plus size={16} />} onClick={() => setAdding(true)}>
                  เพิ่มงาน
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <GanttChart
              project={p}
              zoom={zoom}
              highlightCritical={highlight}
              selectedId={selectedId}
              onSelect={select}
              onToggleCollapse={toggleCollapse}
              scrollToken={scrollToken}
              scrollTarget="today"
            />
            <div className={styles.legend} aria-label="คำอธิบายสัญลักษณ์">
              <span className={styles.legendItem}><span className={styles.sw} style={{ background: 'var(--critical)' }} />Critical path</span>
              <span className={styles.legendItem}><span className={styles.sw} style={{ background: 'var(--task)' }} />งานทั่วไป</span>
              <span className={styles.legendItem}><span className={styles.sw} style={{ border: '2px dashed var(--link)', background: 'transparent' }} />เลื่อนได้ (float)</span>
              <span className={styles.legendItem}><span style={{ width: 10, height: 10, background: 'var(--milestone)', transform: 'rotate(45deg)', borderRadius: 2 }} />Milestone</span>
              <span className={styles.legendItem}><span className={styles.sw} style={{ background: 'var(--ink)' }} />กลุ่มงาน</span>
              <span className={styles.legendItem}><span className={styles.sw} style={{ border: '2px solid var(--critical)', background: 'repeating-linear-gradient(135deg, var(--critical-bg) 0 4px, var(--surface) 4px 8px)' }} />เวลาเผื่อ</span>
              <span className={styles.legendItem}><span className={styles.sw} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} />วันหยุด</span>
            </div>
          </>
        )}
        {selectedId && p.schedule.tasks[selectedId] && (
          <TaskPanel project={p} taskId={selectedId} onClose={() => select(null)} onSelect={select} />
        )}
      </Card>

      <AddTaskDialog project={p} open={adding} onClose={() => setAdding(false)} onCreated={(id) => select(id)} />
      <TaskListDrawer
        project={p}
        open={listOpen}
        onClose={() => setListOpen(false)}
        selectedId={selectedId}
        onSelect={(id) => {
          select(id)
          setListOpen(false)
        }}
        onAdd={() => {
          setListOpen(false)
          setAdding(true)
        }}
      />
    </div>
  )
}
