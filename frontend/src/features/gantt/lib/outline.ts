import type { ProjectOut, Task, TaskSchedule } from '@/features/projects/types'

export interface OutlineRow {
  task: Task
  schedule: TaskSchedule
  depth: number
  hasChildren: boolean
  collapsed: boolean
  /** index in the visible list */
  index: number
}

/** Visible rows in WBS order, honouring `collapsed` on summary tasks. */
export function buildOutline(project: ProjectOut): OutlineRow[] {
  const byParent = new Map<string | null, Task[]>()
  for (const t of project.tasks) {
    const list = byParent.get(t.parentId) ?? []
    list.push(t)
    byParent.set(t.parentId, list)
  }
  for (const list of byParent.values()) list.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))

  const rows: OutlineRow[] = []
  const walk = (parentId: string | null, depth: number) => {
    for (const t of byParent.get(parentId) ?? []) {
      const schedule = project.schedule.tasks[t.id]
      if (!schedule) continue
      const kids = byParent.get(t.id) ?? []
      rows.push({ task: t, schedule, depth, hasChildren: kids.length > 0, collapsed: t.collapsed, index: rows.length })
      if (kids.length > 0 && !t.collapsed) walk(t.id, depth + 1)
    }
  }
  walk(null, 0)
  return rows
}

/** Row index lookup for arrow drawing; hidden (collapsed) tasks map to their nearest visible ancestor. */
export function rowIndexMap(project: ProjectOut, rows: OutlineRow[]): Map<string, number> {
  const visible = new Map(rows.map((r) => [r.task.id, r.index]))
  const parentOf = new Map(project.tasks.map((t) => [t.id, t.parentId]))
  const out = new Map<string, number>()
  for (const t of project.tasks) {
    let cur: string | null = t.id
    while (cur !== null && !visible.has(cur)) cur = parentOf.get(cur) ?? null
    if (cur !== null) out.set(t.id, visible.get(cur)!)
  }
  return out
}
