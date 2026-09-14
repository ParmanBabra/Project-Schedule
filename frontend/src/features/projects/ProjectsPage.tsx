import { Copy, FolderKanban, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '@/shared/api/client'
import { formatThai, formatThaiRange } from '@/shared/lib/date'
import {
  Button,
  Card,
  Chip,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  Menu,
  ProgressBar,
  Segment,
  Skeleton,
  useToast,
} from '@/shared/ui'
import { ImportButton } from '@/features/io/ImportButton'
import { useDeleteProject, useDuplicateProject, useProjects } from './api'
import { CreateProjectDialog } from './CreateProjectDialog'
import styles from './ProjectsPage.module.css'
import type { ProjectListItem } from './types'

type Filter = 'all' | 'active' | 'done'

export function ProjectsPage() {
  const projects = useProjects()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [creating, setCreating] = useState(false)

  const items = useMemo(() => {
    const list = projects.data ?? []
    const q = query.trim().toLowerCase()
    return list.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false
      if (filter === 'active') return p.progress < 100
      if (filter === 'done') return p.progress >= 100 && p.taskCount > 0
      return true
    })
  }, [projects.data, query, filter])

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <h1 className={styles.title}>โปรเจกต์</h1>
        <div className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <Input
            aria-label="ค้นหาโปรเจกต์"
            placeholder="ค้นหาโปรเจกต์"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className={styles.filter}>
          <Segment<Filter>
            aria-label="กรองสถานะ"
            variant="white"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'ทั้งหมด' },
              { value: 'active', label: 'กำลังทำ' },
              { value: 'done', label: 'เสร็จแล้ว' },
            ]}
          />
        </div>
        <span className={styles.spacer} />
        <ImportButton />
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
          โปรเจกต์ใหม่
        </Button>
      </div>

      {projects.isPending ? (
        <div className={styles.grid} aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Card key={i} padding="md" className={styles.card}>
              <Skeleton width="60%" height={20} />
              <Skeleton width="40%" />
              <Skeleton height={8} />
            </Card>
          ))}
        </div>
      ) : projects.isError ? (
        <Card>
          <EmptyState title="โหลดรายการโปรเจกต์ไม่ได้" description="ตรวจสอบว่า backend กำลังทำงานอยู่ แล้วลองใหม่" action={<Button onClick={() => projects.refetch()}>ลองใหม่</Button>} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderKanban size={26} />}
            title={projects.data?.length ? 'ไม่พบโปรเจกต์ที่ตรงกับตัวกรอง' : 'ยังไม่มีโปรเจกต์'}
            description={projects.data?.length ? 'ลองเปลี่ยนคำค้นหรือตัวกรอง' : 'เริ่มต้นด้วยการสร้างโปรเจกต์แรก แล้วเพิ่มงานลงใน Gantt'}
            action={
              projects.data?.length ? undefined : (
                <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
                  สร้างโปรเจกต์
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className={styles.grid}>
          {items.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}

      <CreateProjectDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

function ProjectCard({ project }: { project: ProjectListItem }) {
  const navigate = useNavigate()
  const toast = useToast()
  const duplicate = useDuplicateProject()
  const remove = useDeleteProject()
  const [confirming, setConfirming] = useState(false)

  const onDuplicate = async () => {
    try {
      const copy = await duplicate.mutateAsync({ id: project.id })
      toast.success(`ทำสำเนา "${project.name}" แล้ว`)
      navigate(`/p/${copy.id}/gantt`)
    } catch (e) {
      toast.error(e instanceof ApiError ? `ทำสำเนาไม่สำเร็จ (${e.status})` : 'ทำสำเนาไม่สำเร็จ')
    }
  }

  const onDelete = async () => {
    try {
      await remove.mutateAsync(project.id)
      setConfirming(false)
      toast.success(`ลบ "${project.name}" แล้ว`)
    } catch {
      toast.error('ลบไม่สำเร็จ')
    }
  }

  return (
    <Card padding="md" className={styles.card} data-testid="project-card">
      <div className={styles.cardHead}>
        <Link to={`/p/${project.id}/gantt`} className={styles.cardTitle}>
          {project.name}
        </Link>
        <Menu
          items={[
            { label: 'ทำสำเนา', icon: <Copy size={16} />, onSelect: () => void onDuplicate() },
            { label: 'ลบโปรเจกต์', icon: <Trash2 size={16} />, danger: true, onSelect: () => setConfirming(true) },
          ]}
          trigger={(props) => (
            <IconButton label={`ตัวเลือกของ ${project.name}`} {...props}>
              <MoreHorizontal size={18} />
            </IconButton>
          )}
        />
      </div>
      <div className={styles.cardDates}>
        {project.taskCount === 0 ? (
          <span>เริ่ม {formatThai(project.startDate, { year: true })} · ยังไม่มีงาน</span>
        ) : (
          <>
            <span>{formatThaiRange(project.startDate, project.plannedEnd)}</span>
            {project.committedEnd && <span className={styles.committed}>สัญญาส่ง {formatThai(project.committedEnd)}</span>}
          </>
        )}
      </div>
      <ProgressBar value={project.progress} label={`ความคืบหน้า ${project.progress}%`} />
      <div className={styles.cardChips}>
        <Chip tone="neutral">งาน {project.taskCount}</Chip>
        {project.criticalCount > 0 && <Chip tone="critical">Critical {project.criticalCount}</Chip>}
        <span className={styles.progressText}>{project.progress}%</span>
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="ลบโปรเจกต์"
        description={`"${project.name}" จะถูกย้ายไปถังขยะ กู้คืนได้จากโฟลเดอร์ data/trash`}
        actions={
          <>
            <Button onClick={() => setConfirming(false)}>ยกเลิก</Button>
            <Button variant="danger" onClick={() => void onDelete()} disabled={remove.isPending}>
              ลบโปรเจกต์
            </Button>
          </>
        }
      />
    </Card>
  )
}
