import { ChevronDown, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { ProjectOut, ReleaseResult, Resource, Schedule, TaskSchedule } from '@/features/projects/types'
import { Avatar } from '@/shared/ui'
import { formatThai, todayISO } from '@/shared/lib/date'
import { DRAG_THRESHOLD_PX, moveTarget, resizeTarget, snapDays, type DragMode, type DragState } from './lib/drag'
import { NAME_COL_MAX, NAME_COL_MIN, NAME_COL_STEP, clampNameColWidth, defaultNameColWidth, readNameColWidth, writeNameColWidth } from './lib/nameCol'
import { buildOutline, epicColors, rowIndexMap } from './lib/outline'
import {
  BAR_HEIGHT,
  DEP_SIDES,
  ROW_HEIGHT,
  anchor,
  arrowPath,
  barGeometry,
  computeAxis,
  headerRows,
  nonWorkingShades,
  xOfDate,
  xOfDayEnd,
  type Zoom,
} from './lib/timeline'
import styles from './gantt.module.css'

export interface DragPatch {
  taskId: string
  /** for move: the new start date (SNET constraint); for resize: the new duration */
  start?: string
  duration?: number
}

export interface GanttChartProps {
  project: ProjectOut
  zoom: Zoom
  highlightCritical: boolean
  selectedId: string | null
  onSelect: (id: string | null) => void
  onToggleCollapse: (id: string, collapsed: boolean) => void
  /** Scroll request: bump to scroll the timeline to today / project start. */
  scrollToken?: number
  scrollTarget?: 'today' | 'start'
  /** Drag interactions (desktop). Omit to make the chart read-only. */
  onDragPreview?: (patch: DragPatch | null) => void
  onCommitDrag?: (patch: DragPatch) => void
  onLink?: (fromId: string, toId: string) => void
  onArrowClick?: (depId: string, clientX: number, clientY: number) => void
  /** Schedule computed for the in-flight drag; bars of changed tasks are drawn from it. */
  previewSchedule?: Schedule | null
  interactive?: boolean
  /** show only this task and its descendants (Epic filter) */
  rootId?: string | null
  /** selection mode: checkboxes in the name column */
  selectable?: boolean
  selectedIds?: Set<string>
  onToggleSelected?: (id: string, on: boolean) => void
  /** resources of the workspace: assignees are drawn as avatars after each bar (ASG on Gantt) */
  resources?: Resource[]
  /** resource ids currently over-allocated (red ring on their avatar) */
  overloadedResourceIds?: ReadonlySet<string>
}

/** avatars shown after a bar before collapsing into "+N" */
const MAX_AVATARS = 3
/** gap between the bar end (and its link handle) and the first avatar */
const AVATAR_GAP = 20

function isMobile(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 767px)').matches
}

export function GanttChart({
  project,
  zoom,
  highlightCritical,
  selectedId,
  onSelect,
  onToggleCollapse,
  scrollToken,
  scrollTarget,
  onDragPreview,
  onCommitDrag,
  onLink,
  onArrowClick,
  previewSchedule,
  interactive = true,
  rootId = null,
  selectable = false,
  selectedIds,
  onToggleSelected,
  resources,
  overloadedResourceIds,
}: GanttChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => buildOutline(project, rootId), [project, rootId])
  const epicColor = useMemo(() => epicColors(project), [project])
  const axis = useMemo(() => computeAxis(project, zoom, 900), [project, zoom])
  const headers = useMemo(() => headerRows(axis, zoom), [axis, zoom])
  const shades = useMemo(() => nonWorkingShades(axis, project.workingDays, project.holidays), [axis, project.workingDays, project.holidays])
  const rowIndex = useMemo(() => rowIndexMap(project, rows), [project, rows])
  const today = todayISO()
  const todayX = today >= axis.origin && today < axis.end ? xOfDate(axis, today) : null
  const hasReleases = project.schedule.releases.length > 0
  const hasBuffer = hasReleases || (project.schedule.buffer.days > 0 && project.schedule.summary.plannedEnd)
  const bodyHeight = (rows.length + (hasBuffer ? 1 : 0)) * ROW_HEIGHT
  const cal = useMemo(() => ({ workingDays: project.workingDays, holidays: project.holidays }), [project.workingDays, project.holidays])

  // --------------------------------------------------------------- assignees
  const assigneesByTask = useMemo(() => {
    const byId = new Map((resources ?? []).map((r) => [r.id, r]))
    const map = new Map<string, { resource: Resource; units: number }[]>()
    for (const a of project.assignments) {
      const resource = byId.get(a.resourceId)
      if (!resource) continue
      const list = map.get(a.taskId) ?? []
      list.push({ resource, units: a.units })
      map.set(a.taskId, list)
    }
    return map
  }, [project.assignments, resources])

  /** feeding buffer drawn after a task (BUF-6): the avatars move past it */
  const feedingEndByTask = useMemo(() => {
    const m = new Map<string, string>()
    for (const fb of (previewSchedule ?? project.schedule).feedingBuffers) if (fb.end) m.set(fb.fromTaskId, fb.end)
    return m
  }, [previewSchedule, project.schedule])

  // -------------------------------------------------------- name column width
  /** null = never resized → responsive default from tokens.css */
  const [nameColStored, setNameColStored] = useState<number | null>(() => readNameColWidth())
  const nameCol = nameColStored ?? defaultNameColWidth(isMobile())
  const setNameCol = (px: number | null) => {
    const v = px === null ? null : clampNameColWidth(px)
    setNameColStored(v)
    writeNameColWidth(v)
  }
  const colDrag = useRef<{ startX: number; startW: number } | null>(null)
  const [colResizing, setColResizing] = useState(false)
  const beginColResize = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    colDrag.current = { startX: e.clientX, startW: nameCol }
    setColResizing(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const moveColResize = (e: ReactPointerEvent<HTMLElement>) => {
    const d = colDrag.current
    if (!d) return
    setNameCol(d.startW + (e.clientX - d.startX))
  }
  const endColResize = () => {
    colDrag.current = null
    setColResizing(false)
  }
  const keyColResize = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowLeft') setNameCol(nameCol - NAME_COL_STEP)
    else if (e.key === 'ArrowRight') setNameCol(nameCol + NAME_COL_STEP)
    else if (e.key === 'Home') setNameCol(NAME_COL_MIN)
    else if (e.key === 'End') setNameCol(NAME_COL_MAX)
    else if (e.key === 'Enter' || e.key === 'Escape') setNameCol(null)
    else return
    e.preventDefault()
  }

  // ------------------------------------------------------------------ scroll
  const scrollTo = (target: 'today' | 'start') => {
    const el = scrollRef.current
    if (!el) return
    const iso = target === 'today' && todayX !== null ? today : project.startDate
    el.scrollTo({ left: Math.max(0, xOfDate(axis, iso) - 24), behavior: 'smooth' })
  }
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      const el = scrollRef.current
      if (el) el.scrollLeft = Math.max(0, xOfDate(axis, project.startDate) - 24)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (scrollToken) scrollTo(scrollTarget ?? 'today')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToken])

  // -------------------------------------------------------------- schedules
  /** Schedule used for drawing: preview (during drag) wins for tasks it contains. */
  const drawSchedule = (id: string): TaskSchedule | undefined => previewSchedule?.tasks[id] ?? project.schedule.tasks[id]
  const changedByPreview = (id: string) => {
    const a = project.schedule.tasks[id]
    const b = previewSchedule?.tasks[id]
    return Boolean(a && b && (a.start !== b.start || a.end !== b.end))
  }

  const geometries = useMemo(() => {
    const out = new Map<string, ReturnType<typeof barGeometry>>()
    for (const id of Object.keys(project.schedule.tasks)) {
      const s = previewSchedule?.tasks[id] ?? project.schedule.tasks[id]
      if (s) out.set(id, barGeometry(axis, s))
    }
    return out
  }, [axis, project.schedule.tasks, previewSchedule])

  // ------------------------------------------------------------------- drag
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const lastPreview = useRef<string>('')

  const rowAtClientY = useCallback(
    (clientY: number): string | null => {
      const el = timeRef.current
      if (!el) return null
      const top = el.getBoundingClientRect().top
      const idx = Math.floor((clientY - top) / ROW_HEIGHT)
      return rows[idx]?.task.id ?? null
    },
    [rows],
  )

  const currentPatch = (d: DragState): DragPatch | null => {
    const s = project.schedule.tasks[d.taskId]
    if (!s) return null
    const days = snapDays(d.dx, axis.pxPerDay)
    if (d.mode === 'move') return { taskId: d.taskId, start: moveTarget(s, days, cal) }
    if (d.mode === 'resize') return { taskId: d.taskId, duration: resizeTarget(s, days, cal) }
    return null
  }

  const beginDrag = (e: ReactPointerEvent, taskId: string, mode: DragMode) => {
    if (!interactive || e.button !== 0 || e.pointerType === 'touch') return
    if (mode !== 'link' && project.schedule.tasks[taskId]?.isSummary) return
    e.stopPropagation()
    const state: DragState = { mode, taskId, startClientX: e.clientX, startClientY: e.clientY, dx: 0, dy: 0, active: false, overTaskId: null }
    dragRef.current = state
    setDrag(state)
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startClientX
    const dy = e.clientY - d.startClientY
    const active = d.active || Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX
    const next: DragState = { ...d, dx, dy, active, overTaskId: d.mode === 'link' ? rowAtClientY(e.clientY) : null }
    dragRef.current = next
    setDrag(next)
    if (active && d.mode !== 'link' && onDragPreview) {
      const patch = currentPatch(next)
      const key = JSON.stringify(patch)
      if (patch && key !== lastPreview.current) {
        lastPreview.current = key
        onDragPreview(patch)
      }
    }
  }

  const endDrag = () => {
    const d = dragRef.current
    dragRef.current = null
    setDrag(null)
    lastPreview.current = ''
    onDragPreview?.(null)
    if (!d || !d.active) return
    if (d.mode === 'link') {
      if (d.overTaskId && d.overTaskId !== d.taskId) onLink?.(d.taskId, d.overTaskId)
      return
    }
    const patch = currentPatch(d)
    if (!patch) return
    const s = project.schedule.tasks[d.taskId]
    if (patch.start && patch.start === s.start) return
    if (patch.duration && patch.duration === s.duration) return
    onCommitDrag?.(patch)
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    const d = dragRef.current
    if (!d) return
    if (d.mode === 'link') {
      const over = rowAtClientY(e.clientY)
      dragRef.current = { ...d, overTaskId: over }
    }
    endDrag()
  }

  // ghost geometry for the dragged bar (immediate feedback, before the preview arrives)
  const ghost = useMemo(() => {
    if (!drag || !drag.active || drag.mode === 'link') return null
    const s = project.schedule.tasks[drag.taskId]
    if (!s) return null
    // always measure from the committed schedule: the preview already contains the move,
    // so using `geometries` here would shift the ghost by the delta twice
    const g = barGeometry(axis, s)
    const days = snapDays(drag.dx, axis.pxPerDay)
    const patch = currentPatch(drag)
    if (drag.mode === 'move') return { x: g.x + days * axis.pxPerDay, width: g.width, label: patch?.start ? `เริ่ม ${formatThai(patch.start)}` : '' }
    const width = Math.max(axis.pxPerDay, g.width + days * axis.pxPerDay)
    return { x: g.x, width, label: patch?.duration ? `${patch.duration} วัน` : '' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, geometries, axis])

  const linkLine = useMemo(() => {
    if (!drag || drag.mode !== 'link' || !drag.active) return null
    const g = geometries.get(drag.taskId)
    const idx = rowIndex.get(drag.taskId)
    if (!g || idx === undefined) return null
    const from = { x: g.endX, y: idx * ROW_HEIGHT + ROW_HEIGHT / 2 }
    const toIdx = drag.overTaskId ? rowIndex.get(drag.overTaskId) : undefined
    const to = toIdx !== undefined ? { x: (geometries.get(drag.overTaskId!)?.x ?? from.x + drag.dx), y: toIdx * ROW_HEIGHT + ROW_HEIGHT / 2 } : { x: from.x + drag.dx, y: from.y + drag.dy }
    return { from, to, valid: Boolean(drag.overTaskId && drag.overTaskId !== drag.taskId) }
  }, [drag, geometries, rowIndex])

  // ----------------------------------------------------------------- arrows
  const arrows = useMemo(() => {
    const list: { id: string; d: string; critical: boolean }[] = []
    for (const dep of project.dependencies) {
      const fromIdx = rowIndex.get(dep.from)
      const toIdx = rowIndex.get(dep.to)
      const g1 = geometries.get(dep.from)
      const g2 = geometries.get(dep.to)
      if (fromIdx === undefined || toIdx === undefined || !g1 || !g2) continue
      const sides = DEP_SIDES[dep.type]
      const from = anchor(g1, sides.from, fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2)
      const to = anchor(g2, sides.to, toIdx * ROW_HEIGHT + ROW_HEIGHT / 2)
      const a = project.schedule.tasks[dep.from]
      const b = project.schedule.tasks[dep.to]
      list.push({ id: dep.id, d: arrowPath(from, to), critical: Boolean(a?.isCritical && b?.isCritical) })
    }
    return list
  }, [project.dependencies, project.schedule.tasks, rowIndex, geometries])

  const crit = (isCritical: boolean) => highlightCritical && isCritical
  const barTop = (idx: number) => idx * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2

  return (
    <div
      ref={scrollRef}
      className={[styles.chart, colResizing && styles.chartResizing].filter(Boolean).join(' ')}
      data-testid="gantt-chart"
      style={{ ['--h-row' as string]: `${ROW_HEIGHT}px`, ['--w-namecol' as string]: `${nameCol}px` }}
    >
      <div className={styles.inner} style={{ width: nameCol + axis.width }}>
        <div className={styles.headerRow}>
          <div className={styles.nameHead}>
            <span className={styles.wbs}>WBS</span>
            <span>ชื่องาน</span>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="ปรับความกว้างคอลัมน์ชื่องาน"
              aria-valuemin={NAME_COL_MIN}
              aria-valuemax={NAME_COL_MAX}
              aria-valuenow={nameCol}
              tabIndex={0}
              title="ลากเพื่อปรับความกว้าง · ดับเบิลคลิกคืนค่าเดิม"
              data-testid="namecol-resizer"
              className={[styles.colResizer, colResizing && styles.colResizerActive].filter(Boolean).join(' ')}
              onPointerDown={beginColResize}
              onPointerMove={moveColResize}
              onPointerUp={endColResize}
              onPointerCancel={endColResize}
              onDoubleClick={() => setNameCol(null)}
              onKeyDown={keyColResize}
            />
          </div>
          <div className={styles.timeHead} style={{ width: axis.width }}>
            <div className={styles.hTop}>
              {headers.top.map((c) => (
                <div key={c.key} className={styles.hCell} style={{ left: c.x, width: c.width }}>
                  {c.label}
                </div>
              ))}
            </div>
            <div className={styles.hBottom}>
              {headers.bottom.map((c) => (
                <div key={c.key} className={[styles.hCell, zoom !== 'day' && styles.hCellWide, c.muted && styles.hMuted].filter(Boolean).join(' ')} style={{ left: c.x, width: c.width }}>
                  {c.label}
                </div>
              ))}
            </div>
            {todayX !== null && (
              <span className={styles.todayTag} style={{ left: todayX }} data-testid="today-tag">
                วันนี้
              </span>
            )}
          </div>
        </div>

        <div className={styles.body} style={{ height: bodyHeight }}>
          <div className={styles.namesCol}>
            {rows.map((r) => (
              <div
                key={r.task.id}
                data-testid={`task-row-${r.task.id}`}
                className={[styles.nameRow, r.hasChildren && styles.nameRowSummary, selectedId === r.task.id && styles.nameRowSel].filter(Boolean).join(' ')}
                aria-current={selectedId === r.task.id ? 'true' : undefined}
              >
                {selectable && (
                  <input
                    type="checkbox"
                    className={styles.selectBox}
                    aria-label={`เลือก ${r.task.name}`}
                    checked={selectedIds?.has(r.task.id) ?? false}
                    onChange={(e) => onToggleSelected?.(r.task.id, e.target.checked)}
                  />
                )}
                <span className={styles.wbs}>{r.schedule.wbs}</span>
                <span style={{ width: r.depth * 16, flexShrink: 0 }} />
                {r.hasChildren ? (
                  <button type="button" aria-label={r.collapsed ? 'ขยายกลุ่ม' : 'ยุบกลุ่ม'} aria-expanded={!r.collapsed} className={styles.caret} onClick={() => onToggleCollapse(r.task.id, !r.collapsed)}>
                    {r.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                ) : (
                  <span className={styles.caretSpace} />
                )}
                <button
                  type="button"
                  className={styles.nameBtn}
                  title={r.schedule.health === 'late' ? `${r.task.name} · ล่าช้า (ควรได้ ${r.schedule.expectedProgress}% ได้ ${r.task.progress}%)` : r.task.name}
                  onClick={() => onSelect(r.task.id)}
                >
                  <Dot row={r} highlight={highlightCritical} epicColor={epicColor.get(r.task.id)} />
                  <span className={styles.name}>{r.task.name}</span>
                  {r.task.epic && <span className={styles.epicBadge} data-testid={`epic-badge-${r.task.id}`}>Epic</span>}
                  {r.schedule.health === 'late' && (
                    <span className={styles.lateTag} data-testid={`late-${r.task.id}`}>
                      ล่าช้า
                    </span>
                  )}
                </button>
              </div>
            ))}
            {hasBuffer && (
              <div className={[styles.nameRow, styles.bufferName].join(' ')}>
                <span className={styles.wbs} />
                <span className={styles.caretSpace} />
                <span className={styles.name}>{hasReleases ? `สำรองเวลา · ${project.schedule.releases.length} จุด` : 'สำรองเวลาโครงการ'}</span>
              </div>
            )}
          </div>

          <div
            ref={timeRef}
            className={[styles.timeArea, drag?.active && styles.timeAreaDragging].filter(Boolean).join(' ')}
            style={{ width: axis.width, height: bodyHeight }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={endDrag}
          >
            {shades.map((s) => (
              <div key={`${s.kind}${s.x}`} className={[styles.shade, s.kind === 'holiday' && styles.shadeHoliday].filter(Boolean).join(' ')} style={{ left: s.x, width: s.width }} />
            ))}
            {todayX !== null && <div className={styles.today} style={{ left: todayX }} data-testid="today-line" />}
            <svg className={styles.arrows} width={axis.width} height={bodyHeight} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <defs>
                <marker id="arrow-crit" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0 0L6 3L0 6z" fill="var(--critical)" stroke="none" />
                </marker>
                <marker id="arrow-link" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0 0L6 3L0 6z" fill="var(--link)" stroke="none" />
                </marker>
              </defs>
              {arrows.map((a) => (
                <g key={a.id}>
                  <path d={a.d} data-testid={`dep-${a.id}`} stroke={crit(a.critical) ? 'var(--critical)' : 'var(--link)'} markerEnd={crit(a.critical) ? 'url(#arrow-crit)' : 'url(#arrow-link)'} />
                  {onArrowClick && (
                    <path
                      d={a.d}
                      className={styles.arrowHit}
                      data-testid={`dep-hit-${a.id}`}
                      onClick={(e) => onArrowClick(a.id, e.clientX, e.clientY)}
                    >
                      <title>คลิกเพื่อแก้ไขความสัมพันธ์</title>
                    </path>
                  )}
                </g>
              ))}
              {linkLine && (
                <path
                  d={`M${linkLine.from.x} ${linkLine.from.y} L${linkLine.to.x} ${linkLine.to.y}`}
                  stroke={linkLine.valid ? 'var(--primary)' : 'var(--text-4)'}
                  strokeDasharray="6 4"
                  data-testid="link-line"
                />
              )}
            </svg>

            {rows.map((r) => {
              const g = geometries.get(r.task.id)
              const s = drawSchedule(r.task.id)
              if (!g || !s) return null
              const y = barTop(r.index)
              const selected = selectedId === r.task.id
              const preview = changedByPreview(r.task.id)
              const dragging = drag?.active && drag.taskId === r.task.id && drag.mode !== 'link'
              if (r.hasChildren || r.task.epic) {
                return (
                  <button
                    key={r.task.id}
                    type="button"
                    aria-label={`กลุ่ม ${r.task.name}`}
                    data-testid={`bar-${r.task.id}`}
                    className={[styles.summaryBar, crit(s.isCritical) && !r.task.epic && styles.summaryCritical, selected && styles.summarySel, preview && styles.previewBar].filter(Boolean).join(' ')}
                    style={{ left: g.x, width: Math.max(g.width, 12), top: r.index * ROW_HEIGHT + 12, ...(r.task.epic ? { ['--summary' as string]: r.task.epic.color } : epicColor.get(r.task.id) && !crit(s.isCritical) ? { ['--summary' as string]: epicColor.get(r.task.id) } : {}) }}
                    onClick={() => onSelect(r.task.id)}
                    onPointerDown={(e) => beginDrag(e, r.task.id, 'link')}
                  />
                )
              }
              if (s.isMilestone) {
                return (
                  <span key={r.task.id}>
                    <button
                      type="button"
                      aria-label={`milestone ${r.task.name}`}
                      data-testid={`bar-${r.task.id}`}
                      className={[styles.milestone, crit(s.isCritical) && styles.milestoneCritical, selected && styles.milestoneSel, preview && styles.previewBar, dragging && styles.dragSource].filter(Boolean).join(' ')}
                      style={{ left: g.x, top: r.index * ROW_HEIGHT + 14 }}
                      onClick={() => !drag?.active && onSelect(r.task.id)}
                      onPointerDown={(e) => beginDrag(e, r.task.id, 'move')}
                    />
                    <span className={styles.milestoneLabel} style={{ left: g.endX + 6, top: r.index * ROW_HEIGHT + 13 }}>
                      {formatThai(s.end)}
                    </span>
                  </span>
                )
              }
              const showLabel = g.width >= 90
              return (
                <span key={r.task.id}>
                  <button
                    type="button"
                    data-testid={`bar-${r.task.id}`}
                    data-critical={s.isCritical ? 'true' : undefined}
                    title={`${r.task.name} · ${formatThai(s.start)} – ${formatThai(s.end, { year: true })} · float ${s.totalFloat} วัน`}
                    className={[
                      styles.bar,
                      epicColor.has(r.task.id) && styles.barEpic,
                      crit(s.isCritical) && (epicColor.has(r.task.id) ? styles.barCriticalEpic : styles.barCritical),
                      highlightCritical && s.isNearCritical && (epicColor.has(r.task.id) ? styles.barNearEpic : styles.barNear),
                      r.task.progress >= 100 && styles.barDone,
                      selected && styles.barSel,
                      preview && styles.previewBar,
                      dragging && styles.dragSource,
                      interactive && styles.barInteractive,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ left: g.x, width: g.width, top: y, ...(epicColor.get(r.task.id) ? { ['--bar' as string]: epicColor.get(r.task.id) } : {}) }}
                    onClick={() => !drag?.active && onSelect(r.task.id)}
                    onPointerDown={(e) => beginDrag(e, r.task.id, 'move')}
                  >
                    <span className={styles.progress} style={{ width: `${r.task.progress}%` }} />
                    {showLabel && <span className={styles.barLabel}>{r.task.name}</span>}
                    {interactive && (
                      <>
                        <span className={styles.resizeHandle} data-testid={`resize-${r.task.id}`} aria-hidden="true" onPointerDown={(e) => beginDrag(e, r.task.id, 'resize')} />
                      </>
                    )}
                  </button>
                  {interactive && (
                    <span
                      className={[styles.linkHandle, (selected || drag?.taskId === r.task.id) && styles.linkHandleShow].filter(Boolean).join(' ')}
                      data-testid={`link-${r.task.id}`}
                      title="ลากไปยังงานอื่นเพื่อสร้างความสัมพันธ์"
                      style={{ left: g.endX + 2, top: y + BAR_HEIGHT / 2 - 7 }}
                      onPointerDown={(e) => beginDrag(e, r.task.id, 'link')}
                    />
                  )}
                  {g.floatWidth ? <span className={styles.floatBar} style={{ left: g.floatX, width: g.floatWidth, top: y }} /> : null}
                  <Assignees taskId={r.task.id} list={assigneesByTask.get(r.task.id)} overloaded={overloadedResourceIds} left={Math.max(g.floatWidth ? g.floatX + g.floatWidth : g.endX, feedingEndByTask.has(r.task.id) ? xOfDayEnd(axis, feedingEndByTask.get(r.task.id)!) : 0) + AVATAR_GAP} top={y + (BAR_HEIGHT - 22) / 2} />
                </span>
              )
            })}

            {(previewSchedule ?? project.schedule).feedingBuffers.map((fb) => {
              const idx = rowIndex.get(fb.fromTaskId)
              if (idx === undefined || !fb.start || !fb.end) return null
              const x1 = xOfDate(axis, fb.start)
              const x2 = xOfDayEnd(axis, fb.end)
              const from = project.tasks.find((t) => t.id === fb.fromTaskId)?.name ?? fb.fromTaskId
              const to = project.tasks.find((t) => t.id === fb.toTaskId)?.name ?? fb.toTaskId
              const title = `Feeding buffer ${fb.days} วัน: สายงานรอง "${from}" (${fb.chainDays} วัน) มาบรรจบ "${to}" · มี float ${fb.availableDays} วัน${fb.ok ? ' · พอ' : ' · ไม่พอ ควรเริ่มสายนี้ให้เร็วขึ้น'}`
              return (
                <span
                  key={`fb-${fb.fromTaskId}`}
                  className={[styles.feeding, !fb.ok && styles.feedingShort].filter(Boolean).join(' ')}
                  style={{ left: x1, width: Math.max(x2 - x1, 6), top: barTop(idx) + (BAR_HEIGHT - 12) / 2 }}
                  data-testid={`feeding-${fb.fromTaskId}`}
                  data-ok={fb.ok ? 'true' : 'false'}
                  title={title}
                />
              )
            })}

            {ghost && drag && (
              <div className={styles.ghost} style={{ left: ghost.x, width: ghost.width, top: barTop(rowIndex.get(drag.taskId) ?? 0) }} data-testid="drag-ghost">
                <span>{ghost.label}</span>
              </div>
            )}

            {hasBuffer && !hasReleases && <BufferRow project={project} axis={axis} rowIdx={rows.length} schedule={previewSchedule ?? project.schedule} />}
            {hasReleases && (previewSchedule ?? project.schedule).releases.map((r, i, all) => <ReleaseBuffer key={r.id} release={r} next={all[i + 1]} axis={axis} rowIdx={rows.length} />)}
          </div>
        </div>
      </div>
    </div>
  )
}

function Assignees({ taskId, list, overloaded, left, top }: { taskId: string; list?: { resource: Resource; units: number }[]; overloaded?: ReadonlySet<string>; left: number; top: number }) {
  if (!list || list.length === 0) return null
  const shown = list.slice(0, MAX_AVATARS)
  const more = list.length - shown.length
  const label = list.map((a) => `${a.resource.name} ${a.units}%${overloaded?.has(a.resource.id) ? ' (เกินกำลัง)' : ''}`).join(', ')
  return (
    <span className={styles.assignees} style={{ left, top }} role="img" aria-label={`ผู้ทำ: ${label}`} title={`ผู้ทำ: ${label}`} data-testid={`assignees-${taskId}`}>
      {shown.map((a) => (
        <Avatar key={a.resource.id} name={a.resource.name} color={a.resource.color} className={[styles.assigneeAv, overloaded?.has(a.resource.id) && styles.assigneeOver].filter(Boolean).join(' ')} />
      ))}
      {more > 0 && <span className={[styles.assigneeAv, styles.assigneeMore].join(' ')}>+{more}</span>}
    </span>
  )
}

function Dot({ row, highlight, epicColor }: { row: ReturnType<typeof buildOutline>[number]; highlight: boolean; epicColor?: string }) {
  const s = row.schedule
  const isSummary = row.hasChildren || Boolean(row.task.epic)
  const kind = isSummary ? 'summary' : s.isMilestone ? 'milestone' : highlight && s.isCritical ? 'critical' : highlight && s.isNearCritical ? 'near' : 'task'
  const base = kind === 'summary' ? 'var(--ink)' : kind === 'milestone' ? 'var(--milestone)' : kind === 'critical' ? 'var(--critical)' : kind === 'near' ? 'var(--critical-bg)' : 'var(--task)'
  // inside an Epic every task keeps the Epic colour; critical / near-critical become a ring instead
  const color = epicColor && kind !== 'milestone' ? epicColor : base
  const ring = epicColor && kind === 'critical' ? '0 0 0 2px var(--surface), 0 0 0 4px var(--critical)' : kind === 'near' ? `inset 0 0 0 2px var(--critical${epicColor ? '-bg' : ''})` : undefined
  return (
    <span
      aria-hidden="true"
      data-critical={kind === 'critical' ? 'true' : undefined}
      style={{
        width: 10,
        height: 10,
        flexShrink: 0,
        borderRadius: kind === 'summary' || kind === 'milestone' ? 2 : 999,
        transform: kind === 'milestone' ? 'rotate(45deg)' : undefined,
        background: color,
        boxShadow: ring,
      }}
    />
  )
}

/** One release's buffer on the buffer row: bar after its milestone, diamond at the promised date (BUF-8). */
function ReleaseBuffer({ release: r, next, axis, rowIdx }: { release: ReleaseResult; next?: ReleaseResult; axis: ReturnType<typeof computeAxis>; rowIdx: number }) {
  if (!r.plannedEnd || !r.end) return null
  const x1 = xOfDayEnd(axis, r.plannedEnd)
  const x2 = xOfDayEnd(axis, r.end)
  const committed = r.committedEnd ?? r.end
  const xc = xOfDayEnd(axis, committed)
  const top = rowIdx * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2
  const usage = r.aheadDays > 0 ? ` · ล่วงหน้า ${r.aheadDays} วัน` : r.consumedPercent !== null ? ` · ใช้ไป ${r.consumedPercent}%` : ''
  const label = `${r.name} · เผื่อ ${r.days} วัน${usage}`
  const title = `${r.name}: เผื่อ ${r.days} วัน (สายงาน ${r.chainDays} วัน, ${r.taskIds.length} งาน)${usage} · สัญญาส่ง ${formatThai(committed, { year: true })}`
  // a label after the diamond only when the next release's bar leaves room for it
  const roomAfter = next?.plannedEnd ? xOfDayEnd(axis, next.plannedEnd) - Math.max(x2, xc) - 14 : Infinity
  return (
    <>
      {r.days > 0 && (
        <div className={[styles.buffer, r.status === 'red' && styles.bufferRed, r.status === 'yellow' && styles.bufferYellow].filter(Boolean).join(' ')} style={{ left: x1, width: Math.max(x2 - x1 - 14, 8), top }} data-testid={`release-buffer-${r.id}`} title={title}>
          <span className={styles.bufferUsed} style={{ width: `${Math.min(100, r.consumedPercent ?? 0)}%` }} />
          {x2 - x1 > 110 && <span className={styles.bufferLabel}>{label}</span>}
        </div>
      )}
      {xc > x2 + 12 && <span className={styles.slack} style={{ left: x2, width: xc - x2 - 8, top }} title={`ล่วงหน้า ${r.aheadDays} วัน ก่อนวันสัญญาส่ง`} />}
      <span className={styles.deliver} style={{ left: xc - 8, top: rowIdx * ROW_HEIGHT + 14 }} data-testid={`release-deliver-${r.id}`} title={`${r.name} สัญญาส่ง ${formatThai(committed, { year: true })}${committed !== r.end ? ' (ล็อกตอนบันทึก baseline)' : ''}`} />
      {x2 - x1 <= 110 && roomAfter > 120 && <span className={styles.deliverLabel} style={{ left: Math.max(x2, xc) + 14, top: rowIdx * ROW_HEIGHT + 13 }}>{r.name} · เผื่อ {r.days} วัน</span>}
    </>
  )
}

function BufferRow({ project, axis, rowIdx, schedule }: { project: ProjectOut; axis: ReturnType<typeof computeAxis>; rowIdx: number; schedule: Schedule }) {
  const b = schedule.buffer
  const planned = b.start ?? schedule.summary.plannedEnd
  if (!planned || !b.end) return null
  const x1 = xOfDayEnd(axis, planned)
  const x2 = xOfDayEnd(axis, b.end)
  const committed = b.committedEnd ?? b.end
  const xc = xOfDayEnd(axis, committed)
  const top = rowIdx * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2
  const consumed = b.consumedPercent ?? 0
  const mrX2 = b.managementReserveEnd ? xOfDayEnd(axis, b.managementReserveEnd) : null
  const isPreview = project.schedule.buffer.end !== b.end || project.schedule.buffer.days !== b.days
  const usage = b.aheadDays > 0 ? ` · ล่วงหน้า ${b.aheadDays} วัน` : b.consumedPercent !== null ? ` · ใช้ไป ${b.consumedPercent}%` : ''
  const label = `เผื่อ ${b.days} วัน${usage}${isPreview ? ' (ตัวอย่าง)' : ''}`
  const status = b.status
  const gapEnd = Math.max(x2, xc) // the promise diamond never moves; the buffer bar follows the plan
  return (
    <>
      <div className={[styles.buffer, status === 'red' && styles.bufferRed, status === 'yellow' && styles.bufferYellow].filter(Boolean).join(' ')} style={{ left: x1, width: Math.max(x2 - x1 - 14, 8), top }} data-testid="buffer-bar" title={label}>
        <span className={styles.bufferUsed} style={{ width: `${Math.min(100, consumed)}%` }} />
        {x2 - x1 > 110 && <span className={styles.bufferLabel}>{label}</span>}
      </div>
      {xc > x2 + 12 && <span className={styles.slack} style={{ left: x2, width: xc - x2 - 8, top }} title={`ล่วงหน้า ${b.aheadDays} วัน ก่อนวันสัญญาส่ง`} data-testid="buffer-slack" />}
      <span className={styles.deliver} style={{ left: xc - 8, top: rowIdx * ROW_HEIGHT + 14 }} title={`สัญญาส่ง ${formatThai(committed, { year: true })}${committed !== b.end ? ' (ล็อกตอนบันทึก baseline)' : ''}`} />
      {mrX2 !== null && mrX2 > gapEnd + 12 && <span className={styles.reserve} style={{ left: gapEnd + 12, width: mrX2 - gapEnd - 12, top }} title={`เผื่อฉุกเฉิน ${b.managementReserveDays} วัน`} />}
      <span className={styles.deliverLabel} style={{ left: (mrX2 && mrX2 > gapEnd + 12 ? mrX2 : gapEnd) + 14, top: rowIdx * ROW_HEIGHT + 13 }}>
        สัญญาส่ง {formatThai(committed)}
        {b.managementReserveDays > 0 ? ` · เผื่อฉุกเฉิน ${b.managementReserveDays} วัน` : ''}
      </span>
    </>
  )
}
