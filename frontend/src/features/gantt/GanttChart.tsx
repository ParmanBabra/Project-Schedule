import { ChevronDown, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { ProjectOut, Schedule, TaskSchedule } from '@/features/projects/types'
import { formatThai, todayISO } from '@/shared/lib/date'
import { DRAG_THRESHOLD_PX, moveTarget, resizeTarget, snapDays, type DragMode, type DragState } from './lib/drag'
import { buildOutline, rowIndexMap } from './lib/outline'
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
}

const NAME_COL = 220

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
}: GanttChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const timeRef = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => buildOutline(project), [project])
  const axis = useMemo(() => computeAxis(project, zoom, 900), [project, zoom])
  const headers = useMemo(() => headerRows(axis, zoom), [axis, zoom])
  const shades = useMemo(() => nonWorkingShades(axis, project.workingDays, project.holidays), [axis, project.workingDays, project.holidays])
  const rowIndex = useMemo(() => rowIndexMap(project, rows), [project, rows])
  const today = todayISO()
  const todayX = today >= axis.origin && today < axis.end ? xOfDate(axis, today) : null
  const hasBuffer = project.schedule.buffer.days > 0 && project.schedule.summary.plannedEnd
  const bodyHeight = (rows.length + (hasBuffer ? 1 : 0)) * ROW_HEIGHT
  const cal = useMemo(() => ({ workingDays: project.workingDays, holidays: project.holidays }), [project.workingDays, project.holidays])

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
    const g = geometries.get(drag.taskId)
    const s = project.schedule.tasks[drag.taskId]
    if (!g || !s) return null
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
    <div ref={scrollRef} className={styles.chart} data-testid="gantt-chart" style={{ ['--h-row' as string]: `${ROW_HEIGHT}px` }}>
      <div className={styles.inner} style={{ width: NAME_COL + axis.width }}>
        <div className={styles.headerRow}>
          <div className={styles.nameHead}>
            <span className={styles.wbs}>WBS</span>
            <span>ชื่องาน</span>
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
                <span className={styles.wbs}>{r.schedule.wbs}</span>
                <span style={{ width: r.depth * 16, flexShrink: 0 }} />
                {r.hasChildren ? (
                  <button type="button" aria-label={r.collapsed ? 'ขยายกลุ่ม' : 'ยุบกลุ่ม'} aria-expanded={!r.collapsed} className={styles.caret} onClick={() => onToggleCollapse(r.task.id, !r.collapsed)}>
                    {r.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>
                ) : (
                  <span className={styles.caretSpace} />
                )}
                <button type="button" className={styles.nameBtn} title={r.task.name} onClick={() => onSelect(r.task.id)}>
                  <Dot row={r} highlight={highlightCritical} />
                  <span className={styles.name}>{r.task.name}</span>
                </button>
              </div>
            ))}
            {hasBuffer && (
              <div className={[styles.nameRow, styles.bufferName].join(' ')}>
                <span className={styles.wbs} />
                <span className={styles.caretSpace} />
                <span className={styles.name}>สำรองเวลาโครงการ</span>
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
              if (r.hasChildren) {
                return (
                  <button
                    key={r.task.id}
                    type="button"
                    aria-label={`กลุ่ม ${r.task.name}`}
                    data-testid={`bar-${r.task.id}`}
                    className={[styles.summaryBar, crit(s.isCritical) && styles.summaryCritical, selected && styles.summarySel, preview && styles.previewBar].filter(Boolean).join(' ')}
                    style={{ left: g.x, width: Math.max(g.width, 12), top: r.index * ROW_HEIGHT + 12 }}
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
                      crit(s.isCritical) && styles.barCritical,
                      highlightCritical && s.isNearCritical && styles.barNear,
                      r.task.progress >= 100 && styles.barDone,
                      selected && styles.barSel,
                      preview && styles.previewBar,
                      dragging && styles.dragSource,
                      interactive && styles.barInteractive,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ left: g.x, width: g.width, top: y }}
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
                </span>
              )
            })}

            {ghost && drag && (
              <div className={styles.ghost} style={{ left: ghost.x, width: ghost.width, top: barTop(rowIndex.get(drag.taskId) ?? 0) }} data-testid="drag-ghost">
                <span>{ghost.label}</span>
              </div>
            )}

            {hasBuffer && <BufferRow project={project} axis={axis} rowIdx={rows.length} schedule={previewSchedule ?? project.schedule} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function Dot({ row, highlight }: { row: ReturnType<typeof buildOutline>[number]; highlight: boolean }) {
  const s = row.schedule
  const kind = row.hasChildren ? 'summary' : s.isMilestone ? 'milestone' : highlight && s.isCritical ? 'critical' : highlight && s.isNearCritical ? 'near' : 'task'
  const color = kind === 'summary' ? 'var(--ink)' : kind === 'milestone' ? 'var(--milestone)' : kind === 'critical' ? 'var(--critical)' : kind === 'near' ? 'var(--critical-bg)' : 'var(--task)'
  return (
    <span
      aria-hidden="true"
      style={{
        width: 10,
        height: 10,
        flexShrink: 0,
        borderRadius: kind === 'summary' || kind === 'milestone' ? 2 : 999,
        transform: kind === 'milestone' ? 'rotate(45deg)' : undefined,
        background: color,
        boxShadow: kind === 'near' ? 'inset 0 0 0 2px var(--critical)' : undefined,
      }}
    />
  )
}

function BufferRow({ project, axis, rowIdx, schedule }: { project: ProjectOut; axis: ReturnType<typeof computeAxis>; rowIdx: number; schedule: Schedule }) {
  const b = schedule.buffer
  const planned = schedule.summary.plannedEnd
  if (!planned || !b.end) return null
  const x1 = xOfDayEnd(axis, planned)
  const x2 = xOfDayEnd(axis, b.end)
  const top = rowIdx * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2
  const consumed = b.consumedPercent ?? 0
  const mrX2 = b.managementReserveEnd ? xOfDayEnd(axis, b.managementReserveEnd) : null
  const isPreview = project.schedule.buffer.end !== b.end || project.schedule.buffer.days !== b.days
  const label = `เผื่อ ${b.days} วัน${b.consumedPercent !== null ? ` · ใช้ไป ${b.consumedPercent}%` : ''}${isPreview ? ' (ตัวอย่าง)' : ''}`
  const status = b.status
  return (
    <>
      <div className={[styles.buffer, status === 'red' && styles.bufferRed, status === 'yellow' && styles.bufferYellow].filter(Boolean).join(' ')} style={{ left: x1, width: Math.max(x2 - x1 - 14, 8), top }} data-testid="buffer-bar" title={label}>
        <span className={styles.bufferUsed} style={{ width: `${Math.min(100, consumed)}%` }} />
        {x2 - x1 > 110 && <span className={styles.bufferLabel}>{label}</span>}
      </div>
      <span className={styles.deliver} style={{ left: x2 - 8, top: rowIdx * ROW_HEIGHT + 14 }} title={`สัญญาส่ง ${formatThai(b.end, { year: true })}`} />
      {mrX2 !== null && mrX2 > x2 + 12 && <span className={styles.reserve} style={{ left: x2 + 12, width: mrX2 - x2 - 12, top }} title={`เผื่อฉุกเฉิน ${b.managementReserveDays} วัน`} />}
      <span className={styles.deliverLabel} style={{ left: (mrX2 ?? x2) + 14, top: rowIdx * ROW_HEIGHT + 13 }}>
        สัญญาส่ง {formatThai(b.end)}
        {b.managementReserveDays > 0 ? ` · เผื่อฉุกเฉิน ${b.managementReserveDays} วัน` : ''}
      </span>
    </>
  )
}
