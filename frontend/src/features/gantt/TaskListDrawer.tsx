import { ArrowDown, ArrowUp, IndentDecrease, IndentIncrease, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { useMoveTask, useReorderTasks } from '@/features/projects/api'
import type { ProjectOut } from '@/features/projects/types'
import { ApiError } from '@/shared/api/client'
import { formatThai } from '@/shared/lib/date'
import { useResources } from '@/features/resources/api'
import { Avatar, Button, Drawer, IconButton, useToast } from '@/shared/ui'
import { buildOutline } from './lib/outline'
import styles from './taskList.module.css'

export interface TaskListDrawerProps {
  project: ProjectOut
  open: boolean
  onClose: () => void
  selectedId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
}

/**
 * Full task table (docs/features.md GNT-12, TSK-4, WBS-2). Rows can be selected,
 * moved up/down among siblings, indented under the previous sibling or outdented.
 */
export function TaskListDrawer({ project, open, onClose, selectedId, onSelect, onAdd }: TaskListDrawerProps) {
  const toast = useToast()
  const reorder = useReorderTasks(project.id)
  const move = useMoveTask(project.id)
  const resources = useResources()
  const resById = useMemo(() => new Map((resources.data ?? []).map((r) => [r.id, r])), [resources.data])
  const rows = useMemo(() => buildOutline({ ...project, tasks: project.tasks.map((t) => ({ ...t, collapsed: false })) }), [project])
  const byParent = useMemo(() => {
    const m = new Map<string | null, string[]>()
    for (const t of [...project.tasks].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))) {
      const list = m.get(t.parentId) ?? []
      list.push(t.id)
      m.set(t.parentId, list)
    }
    return m
  }, [project.tasks])

  const fail = (e: unknown) => {
    const msg = e instanceof ApiError && e.body && typeof e.body === 'object' && 'error' in e.body ? (e.body as { error: { message: string } }).error.message : 'ย้ายไม่สำเร็จ'
    toast.error(msg)
  }

  const swap = (taskId: string, dir: -1 | 1) => {
    const task = project.tasks.find((t) => t.id === taskId)
    if (!task) return
    const ids = [...(byParent.get(task.parentId) ?? [])]
    const i = ids.indexOf(taskId)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    reorder.mutate({ parentId: task.parentId, ids }, { onError: fail })
  }

  const indent = (taskId: string) => {
    const task = project.tasks.find((t) => t.id === taskId)
    if (!task) return
    const ids = byParent.get(task.parentId) ?? []
    const i = ids.indexOf(taskId)
    if (i <= 0) return
    const newParent = ids[i - 1]
    move.mutate({ taskId, parentId: newParent }, { onError: fail })
  }

  const outdent = (taskId: string) => {
    const task = project.tasks.find((t) => t.id === taskId)
    if (!task || task.parentId === null) return
    const parent = project.tasks.find((t) => t.id === task.parentId)
    if (!parent) return
    const siblings = byParent.get(parent.parentId) ?? []
    const order = siblings.indexOf(parent.id) + 2 // right after the old parent
    move.mutate({ taskId, parentId: parent.parentId, order }, { onError: fail })
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="รายการงาน"
      width={720}
      actions={
        <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={onAdd}>
          เพิ่มงาน
        </Button>
      }
    >
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.wbs}>WBS</th>
            <th>ชื่องาน</th>
            <th className={styles.num}>ระยะ</th>
            <th className={styles.date}>เริ่ม</th>
            <th className={styles.date}>สิ้นสุด</th>
            <th className={styles.num}>Float</th>
            <th className={styles.num}>%</th>
            <th className={styles.who}>ผู้ทำ</th>
            <th className={styles.actions}>จัดลำดับ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const siblings = byParent.get(r.task.parentId) ?? []
            const idx = siblings.indexOf(r.task.id)
            return (
              <tr
                key={r.task.id}
                className={[styles.row, selectedId === r.task.id && styles.rowSel, r.hasChildren && styles.rowSummary].filter(Boolean).join(' ')}
                data-testid={`list-row-${r.task.id}`}
                aria-selected={selectedId === r.task.id}
                onClick={() => onSelect(r.task.id)}
              >
                <td className={styles.wbs}>{r.schedule.wbs}</td>
                <td>
                  <span className={styles.name} style={{ paddingLeft: r.depth * 16 }}>
                    <span
                      className={styles.dot}
                      style={{
                        background: r.hasChildren ? 'var(--ink)' : r.schedule.isMilestone ? 'var(--milestone)' : r.schedule.isCritical ? 'var(--critical)' : 'var(--task)',
                        borderRadius: r.hasChildren || r.schedule.isMilestone ? 2 : 999,
                        transform: r.schedule.isMilestone ? 'rotate(45deg)' : undefined,
                      }}
                    />
                    {r.task.name}
                  </span>
                </td>
                <td className={styles.num}>{r.schedule.isMilestone ? '—' : `${r.schedule.duration} วัน`}</td>
                <td className={styles.date}>{formatThai(r.schedule.start)}</td>
                <td className={styles.date}>{formatThai(r.schedule.end)}</td>
                <td className={[styles.num, r.schedule.isCritical && styles.crit].filter(Boolean).join(' ')}>{r.schedule.totalFloat}</td>
                <td className={styles.num}>{r.schedule.progress}</td>
                <td className={styles.who}>
                  <span className={styles.avatars}>
                    {project.assignments.filter((a) => a.taskId === r.task.id).map((a) => {
                      const res = resById.get(a.resourceId)
                      return res ? <Avatar key={a.id} name={res.name} color={res.color} /> : null
                    })}
                  </span>
                </td>
                <td className={styles.actions} onClick={(e) => e.stopPropagation()}>
                  <IconButton label="เลื่อนขึ้น" disabled={idx <= 0} onClick={() => swap(r.task.id, -1)}>
                    <ArrowUp size={14} />
                  </IconButton>
                  <IconButton label="เลื่อนลง" disabled={idx >= siblings.length - 1} onClick={() => swap(r.task.id, 1)}>
                    <ArrowDown size={14} />
                  </IconButton>
                  <IconButton label="ย่อหน้าเข้า (เป็นลูกของงานบน)" disabled={idx <= 0} onClick={() => indent(r.task.id)}>
                    <IndentIncrease size={14} />
                  </IconButton>
                  <IconButton label="ย่อหน้าออก" disabled={r.task.parentId === null} onClick={() => outdent(r.task.id)}>
                    <IndentDecrease size={14} />
                  </IconButton>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length === 0 && <p className={styles.empty}>ยังไม่มีงาน</p>}
    </Drawer>
  )
}
