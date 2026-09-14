import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import type { ProjectOut } from '@/features/projects/types'
import { formatThai, todayISO } from '@/shared/lib/date'
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
}

const NAME_COL = 220

export function GanttChart({ project, zoom, highlightCritical, selectedId, onSelect, onToggleCollapse, scrollToken, scrollTarget }: GanttChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => buildOutline(project), [project])
  const axis = useMemo(() => computeAxis(project, zoom, 900), [project, zoom])
  const headers = useMemo(() => headerRows(axis, zoom), [axis, zoom])
  const shades = useMemo(() => nonWorkingShades(axis, project.workingDays, project.holidays), [axis, project.workingDays, project.holidays])
  const rowIndex = useMemo(() => rowIndexMap(project, rows), [project, rows])
  const today = todayISO()
  const todayX = today >= axis.origin && today < axis.end ? xOfDate(axis, today) : null
  const hasBuffer = project.schedule.buffer.days > 0 && project.schedule.summary.plannedEnd
  const bodyHeight = (rows.length + (hasBuffer ? 1 : 0)) * ROW_HEIGHT

  // scroll to project start on first render / on request
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

  const geometries = useMemo(() => {
    const out = new Map<string, ReturnType<typeof barGeometry>>()
    for (const [id, s] of Object.entries(project.schedule.tasks)) out.set(id, barGeometry(axis, s))
    return out
  }, [axis, project.schedule.tasks])

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
                <div
                  key={c.key}
                  className={[styles.hCell, zoom !== 'day' && styles.hCellWide, c.muted && styles.hMuted].filter(Boolean).join(' ')}
                  style={{ left: c.x, width: c.width }}
                >
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
                  <button
                    type="button"
                    aria-label={r.collapsed ? 'ขยายกลุ่ม' : 'ยุบกลุ่ม'}
                    aria-expanded={!r.collapsed}
                    className={styles.caret}
                    onClick={() => onToggleCollapse(r.task.id, !r.collapsed)}
                  >
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

          <div className={styles.timeArea} style={{ width: axis.width, height: bodyHeight }}>
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
                <path
                  key={a.id}
                  d={a.d}
                  data-testid={`dep-${a.id}`}
                  stroke={crit(a.critical) ? 'var(--critical)' : 'var(--link)'}
                  markerEnd={crit(a.critical) ? 'url(#arrow-crit)' : 'url(#arrow-link)'}
                />
              ))}
            </svg>

            {rows.map((r) => {
              const g = geometries.get(r.task.id)
              if (!g) return null
              const y = barTop(r.index)
              const selected = selectedId === r.task.id
              if (r.hasChildren) {
                return (
                  <button
                    key={r.task.id}
                    type="button"
                    aria-label={`กลุ่ม ${r.task.name}`}
                    data-testid={`bar-${r.task.id}`}
                    className={[styles.summaryBar, crit(r.schedule.isCritical) && styles.summaryCritical, selected && styles.summarySel].filter(Boolean).join(' ')}
                    style={{ left: g.x, width: Math.max(g.width, 12), top: r.index * ROW_HEIGHT + 12 }}
                    onClick={() => onSelect(r.task.id)}
                  />
                )
              }
              if (r.schedule.isMilestone) {
                return (
                  <span key={r.task.id}>
                    <button
                      type="button"
                      aria-label={`milestone ${r.task.name}`}
                      data-testid={`bar-${r.task.id}`}
                      className={[styles.milestone, crit(r.schedule.isCritical) && styles.milestoneCritical, selected && styles.milestoneSel].filter(Boolean).join(' ')}
                      style={{ left: g.x, top: r.index * ROW_HEIGHT + 14 }}
                      onClick={() => onSelect(r.task.id)}
                    />
                    <span className={styles.milestoneLabel} style={{ left: g.endX + 6, top: r.index * ROW_HEIGHT + 13 }}>
                      {formatThai(r.schedule.end)}
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
                    data-critical={r.schedule.isCritical ? 'true' : undefined}
                    title={`${r.task.name} · ${formatThai(r.schedule.start)} – ${formatThai(r.schedule.end, { year: true })} · float ${r.schedule.totalFloat} วัน`}
                    className={[
                      styles.bar,
                      crit(r.schedule.isCritical) && styles.barCritical,
                      highlightCritical && r.schedule.isNearCritical && styles.barNear,
                      r.task.progress >= 100 && styles.barDone,
                      selected && styles.barSel,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ left: g.x, width: g.width, top: y }}
                    onClick={() => onSelect(r.task.id)}
                  >
                    <span className={styles.progress} style={{ width: `${r.task.progress}%` }} />
                    {showLabel && <span className={styles.barLabel}>{r.task.name}</span>}
                  </button>
                  {g.floatWidth ? <span className={styles.floatBar} style={{ left: g.floatX, width: g.floatWidth, top: y }} /> : null}
                </span>
              )
            })}

            {hasBuffer && <BufferRow project={project} axis={axis} rowIdx={rows.length} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function Dot({ row, highlight }: { row: ReturnType<typeof buildOutline>[number]; highlight: boolean }) {
  const s = row.schedule
  const kind = row.hasChildren ? 'summary' : s.isMilestone ? 'milestone' : highlight && s.isCritical ? 'critical' : highlight && s.isNearCritical ? 'near' : 'task'
  const color =
    kind === 'summary' ? 'var(--ink)' : kind === 'milestone' ? 'var(--milestone)' : kind === 'critical' ? 'var(--critical)' : kind === 'near' ? 'var(--critical-bg)' : 'var(--task)'
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

function BufferRow({ project, axis, rowIdx }: { project: ProjectOut; axis: ReturnType<typeof computeAxis>; rowIdx: number }) {
  const b = project.schedule.buffer
  const planned = project.schedule.summary.plannedEnd
  if (!planned || !b.end) return null
  const x1 = xOfDayEnd(axis, planned)
  const x2 = xOfDayEnd(axis, b.end)
  const top = rowIdx * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2
  const consumed = b.consumedPercent ?? 0
  const mrX2 = b.managementReserveEnd ? xOfDayEnd(axis, b.managementReserveEnd) : null
  const label = `เผื่อ ${b.days} วัน${b.consumedPercent !== null ? ` · ใช้ไป ${b.consumedPercent}%` : ''}`
  return (
    <>
      <div className={styles.buffer} style={{ left: x1, width: Math.max(x2 - x1 - 14, 8), top }} data-testid="buffer-bar" title={label}>
        <span className={styles.bufferUsed} style={{ width: `${consumed}%` }} />
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
