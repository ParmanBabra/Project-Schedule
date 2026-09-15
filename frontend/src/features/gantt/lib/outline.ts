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
/**
 * `rootId` limits the outline to that task and its descendants (Epic filter).
 */
export function buildOutline(project: ProjectOut, rootId: string | null = null): OutlineRow[] {
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
  if (rootId) {
    const root = project.tasks.find((t) => t.id === rootId)
    const schedule = root && project.schedule.tasks[rootId]
    if (root && schedule) {
      const kids = byParent.get(rootId) ?? []
      rows.push({ task: root, schedule, depth: 0, hasChildren: kids.length > 0, collapsed: root.collapsed, index: 0 })
      if (kids.length > 0 && !root.collapsed) walk(rootId, 1)
    }
    return rows
  }
  walk(null, 0)
  return rows
}

/** Colour of the nearest Epic ancestor (or the task itself) for every task id. */
export function epicColors(project: ProjectOut): Map<string, string> {
  const byId = new Map(project.tasks.map((t) => [t.id, t]))
  const out = new Map<string, string>()
  for (const t of project.tasks) {
    let cur: Task | undefined = t
    while (cur) {
      if (cur.epic) {
        out.set(t.id, cur.epic.color)
        break
      }
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
  }
  return out
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
