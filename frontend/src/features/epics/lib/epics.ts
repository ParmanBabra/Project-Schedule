import type { ProjectOut, Task } from '@/features/projects/types'

export const EPIC_COLORS = ['#6a4fd8', '#e0457b', '#1f9e89', '#f28c28', '#2e86de', '#a1519c']

export type EpicStatus = 'todo' | 'doing' | 'done' | 'late'

export interface EpicStats {
  id: string
  name: string
  color: string
  description: string
  ownerResourceId: string | null
  taskCount: number
  doneCount: number
  lateCount: number
  progress: number
  start: string | null
  end: string | null
  isCritical: boolean
  status: EpicStatus
  /** resource ids assigned to any task inside */
  resourceIds: string[]
}

/** All Epic tasks of a project in outline order (by WBS). */
export function epicsOf(project: ProjectOut): Task[] {
  return project.tasks
    .filter((t) => t.epic !== null)
    .sort((a, b) => wbsKey(project, a.id).localeCompare(wbsKey(project, b.id), undefined, { numeric: true }))
}

function wbsKey(project: ProjectOut, id: string): string {
  return project.schedule.tasks[id]?.wbs ?? '999'
}

/** Ids of every descendant of `rootId` (not including the root). */
export function descendantIds(project: ProjectOut, rootId: string): string[] {
  const kids = new Map<string | null, Task[]>()
  for (const t of project.tasks) {
    const list = kids.get(t.parentId) ?? []
    list.push(t)
    kids.set(t.parentId, list)
  }
  const out: string[] = []
  const walk = (id: string) => {
    for (const k of kids.get(id) ?? []) {
      out.push(k.id)
      walk(k.id)
    }
  }
  walk(rootId)
  return out
}

/** Nearest Epic ancestor (or the task itself when it is an Epic). */
export function epicOf(project: ProjectOut, taskId: string): Task | null {
  const byId = new Map(project.tasks.map((t) => [t.id, t]))
  let cur: Task | undefined = byId.get(taskId)
  while (cur) {
    if (cur.epic) return cur
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return null
}

export function epicStats(project: ProjectOut, epic: Task): EpicStats {
  const s = project.schedule.tasks[epic.id]
  const leaves = descendantIds(project, epic.id).filter((id) => !project.schedule.tasks[id]?.isSummary)
  const doneCount = leaves.filter((id) => project.schedule.tasks[id]?.health === 'done').length
  const lateCount = leaves.filter((id) => project.schedule.tasks[id]?.health === 'late').length
  const progress = s?.progress ?? 0
  const status: EpicStatus = lateCount > 0 ? 'late' : leaves.length > 0 && progress >= 100 ? 'done' : progress > 0 ? 'doing' : 'todo'
  const leafSet = new Set(leaves)
  const resourceIds = [...new Set(project.assignments.filter((a) => leafSet.has(a.taskId)).map((a) => a.resourceId))]
  return {
    id: epic.id,
    name: epic.name,
    color: epic.epic?.color ?? EPIC_COLORS[0],
    description: epic.epic?.description ?? '',
    ownerResourceId: epic.epic?.ownerResourceId ?? null,
    taskCount: leaves.length,
    doneCount,
    lateCount,
    progress,
    start: leaves.length ? (s?.start ?? null) : null,
    end: leaves.length ? (s?.end ?? null) : null,
    isCritical: Boolean(s?.isCritical && leaves.length),
    status,
    resourceIds,
  }
}

export const STATUS_LABEL: Record<EpicStatus, string> = { todo: 'ยังไม่เริ่ม', doing: 'กำลังทำ', done: 'เสร็จแล้ว', late: 'ล่าช้า' }

// ------------------------------------------------------------ paste parser

export interface PastedTask {
  name: string
  duration?: number
  checklist: string[]
}
export interface PastedEpic {
  name: string
  tasks: PastedTask[]
}

const BULLET = /^[-•*·]\s*/

/**
 * Parse text pasted from Excel or a plain outline into Epics.
 *
 * Tab-separated rows (Excel): the LAST non-empty text column is the task, the column before
 * it is the Epic (a leading numeric "No" column is ignored). An empty Epic cell repeats the
 * previous Epic. A row whose task starts with "-" is a sub-item (checklist) of the task above.
 *
 * Plain outline: a non-indented line is an Epic, indented lines are tasks, "-" lines are
 * sub-items. A trailing number in parentheses or after "|" sets the duration: "Confirm (2)".
 */
export function parsePaste(text: string): PastedEpic[] {
  const epics: PastedEpic[] = []
  let cur: PastedEpic | null = null
  const push = (epicName: string | null, taskText: string) => {
    if (epicName && (!cur || cur.name !== epicName)) {
      cur = epics.find((e) => e.name.localeCompare(epicName, undefined, { sensitivity: 'accent' }) === 0) ?? null
      if (!cur) {
        cur = { name: epicName, tasks: [] }
        epics.push(cur)
      }
    }
    if (!taskText) return
    if (!cur) {
      cur = { name: taskText, tasks: [] }
      epics.push(cur)
      return
    }
    if (BULLET.test(taskText)) {
      const last = cur.tasks[cur.tasks.length - 1]
      if (last) last.checklist.push(taskText.replace(BULLET, '').trim())
      return
    }
    cur.tasks.push(withDuration(taskText))
  }

  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue
    if (raw.includes('\t')) {
      const cells = raw.split('\t').map((c) => c.trim())
      const texts = cells.filter((c, i) => c && !(i === 0 && /^\d+(\.\d+)?$/.test(c)))
      if (texts.length === 0) continue
      const task = texts[texts.length - 1]
      const epicName = texts.length >= 2 ? texts[texts.length - 2] : null
      if (BULLET.test(task)) push(null, task)
      else push(epicName, task)
      continue
    }
    const indented = /^\s/.test(raw)
    const line = raw.trim()
    if (BULLET.test(line)) push(null, line)
    else if (indented) push(null, line)
    else push(line, '')
  }
  return epics.filter((e) => e.name)
}

function withDuration(text: string): PastedTask {
  const m = text.match(/^(.*?)\s*(?:\((\d+)\s*(?:วัน|d|days?)?\)|\|\s*(\d+)\s*(?:วัน|d)?)\s*$/i)
  if (m && (m[2] || m[3])) return { name: m[1].trim(), duration: Number(m[2] ?? m[3]), checklist: [] }
  return { name: text.trim(), checklist: [] }
}
