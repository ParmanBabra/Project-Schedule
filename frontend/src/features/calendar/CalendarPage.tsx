import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useProject, useUpdateTask } from '@/features/projects/api'
import type { ProjectOut, Resource } from '@/features/projects/types'
import { useResources, useWorkload } from '@/features/resources/api'
import { TaskPanel } from '@/features/tasks/TaskPanel'
import { nextWorkingDay } from '@/features/gantt/lib/drag'
import { addDays, addMonths, formatThai, formatThaiMonth, isoWeekday, parseISO, startOfMonthISO, startOfWeekISO, THAI_WEEKDAYS_SHORT, todayISO } from '@/shared/lib/date'
import { Avatar, Button, Card, Chip, EmptyState, IconButton, Segment, Skeleton, useToast } from '@/shared/ui'
import { MAX_LANES, monthGrid, overflowPerDay, weekDays, weekSegments } from './lib/calendar'
import styles from './calendar.module.css'

type View = 'month' | 'week'
const DOW = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.']

interface Item {
  id: string
  start: string
  end: string
  name: string
  critical: boolean
  late: boolean
  milestone: boolean
  color: string | null
  resourceIds: string[]
}

export function CalendarPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const project = useProject(projectId)
  const resources = useResources()
  const updateTask = useUpdateTask(projectId)
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('task')
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  const [view, setView] = useState<View>(isMobile ? 'week' : 'month')
  const [anchor, setAnchor] = useState(() => todayISO())
  const [filter, setFilter] = useState<string[]>([])
  const [dropDate, setDropDate] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const touchStartX = useRef<number | null>(null)

  const select = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(params)
      if (id) next.set('task', id)
      else next.delete('task')
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const p = project.data
  const rangeStart = view === 'month' ? monthGrid(anchor)[0][0] : startOfWeekISO(anchor)
  const rangeEnd = view === 'month' ? addDays(rangeStart, 41) : addDays(rangeStart, 6)
  const projectResourceIds = useMemo(() => Array.from(new Set((p?.assignments ?? []).map((a) => a.resourceId))), [p?.assignments])
  const workload = useWorkload(rangeStart, rangeEnd, projectId, Boolean(p) && projectResourceIds.length > 0, projectResourceIds)
  const resById = useMemo(() => new Map((resources.data ?? []).map((r) => [r.id, r])), [resources.data])

  const items = useMemo<Item[]>(() => {
    if (!p) return []
    const out: Item[] = []
    for (const t of p.tasks) {
      const s = p.schedule.tasks[t.id]
      if (!s || s.isSummary) continue
      const rids = p.assignments.filter((a) => a.taskId === t.id).map((a) => a.resourceId)
      if (filter.length > 0 && !rids.some((r) => filter.includes(r))) continue
      out.push({
        id: t.id,
        start: s.start,
        end: s.end,
        name: t.name,
        critical: s.isCritical,
        late: s.health === 'late',
        milestone: s.isMilestone,
        color: rids.length ? (resById.get(rids[0])?.color ?? null) : t.color,
        resourceIds: rids,
      })
    }
    return out
  }, [p, filter, resById])

  const overByDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of workload.data?.overallocations ?? []) m.set(o.date, (m.get(o.date) ?? 0) + 1)
    return m
  }, [workload.data])
  const overByResDate = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of workload.data?.overallocations ?? []) m.set(`${o.resourceId}|${o.date}`, o.load)
    return m
  }, [workload.data])

  // ---------------------------------------------------------------- drag (desktop)
  const moveTo = (taskId: string, targetDate: string) => {
    if (!p) return
    const s = p.schedule.tasks[taskId]
    if (!s || targetDate === s.start) return
    const cal = { workingDays: p.workingDays, holidays: p.holidays }
    const start = nextWorkingDay(targetDate, cal)
    const name = p.tasks.find((t) => t.id === taskId)?.name ?? ''
    updateTask.mutate(
      { taskId, constraint: { type: 'SNET', date: start } },
      { onSuccess: () => toast.success(`ย้าย "${name}" ไปเริ่ม ${formatThai(start)}`), onError: () => toast.error('ย้ายงานไม่สำเร็จ') },
    )
  }
  const onChipPointerDown = (e: ReactPointerEvent, id: string) => {
    if (e.pointerType === 'touch' || e.button !== 0) return
    setDragId(id)
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragId) return
    const cell = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('[data-date]')
    setDropDate(cell?.dataset.date ?? null)
  }
  const onPointerUp = () => {
    if (dragId && dropDate) moveTo(dragId, dropDate)
    setDragId(null)
    setDropDate(null)
  }

  if (project.isPending) {
    return (
      <Card padding="md" className={styles.card}>
        <Skeleton height={24} width="30%" />
      </Card>
    )
  }
  if (project.isError || !p) {
    return (
      <Card className={styles.card}>
        <EmptyState title="ไม่พบโปรเจกต์" />
      </Card>
    )
  }

  const today = todayISO()
  const holidays = new Set(p.holidays)
  const title = view === 'month' ? formatThaiMonth(startOfMonthISO(anchor)) : `${formatThai(rangeStart)} – ${formatThai(rangeEnd, { year: true })}`
  const shift = (dir: -1 | 1) => setAnchor(view === 'month' ? addMonths(startOfMonthISO(anchor), dir) : addDays(startOfWeekISO(anchor), dir * 7))
  const onTouchStart = (e: ReactTouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }
  const onTouchEnd = (e: ReactTouchEvent) => {
    const start = touchStartX.current
    touchStartX.current = null
    if (start === null) return
    const dx = (e.changedTouches[0]?.clientX ?? start) - start
    if (Math.abs(dx) > 60) setAnchor(addDays(startOfWeekISO(anchor), dx < 0 ? 7 : -7)) // swipe left = next week
  }
  const resourcesInProject = (resources.data ?? []).filter((r) => projectResourceIds.includes(r.id))
  const overCount = new Set((workload.data?.overallocations ?? []).map((o) => o.resourceId)).size

  return (
    <div className={styles.page} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <div className={styles.toolbar}>
        <IconButton label="ช่วงก่อนหน้า" onClick={() => shift(-1)}>
          <ChevronLeft size={16} />
        </IconButton>
        <IconButton label="ช่วงถัดไป" onClick={() => shift(1)}>
          <ChevronRight size={16} />
        </IconButton>
        <Button size="sm" onClick={() => setAnchor(today)}>
          วันนี้
        </Button>
        <h2 className={styles.title} data-testid="calendar-title">
          {title}
        </h2>
        <Segment<View>
          aria-label="มุมมอง"
          variant="white"
          value={view}
          onChange={setView}
          options={[
            { value: 'month', label: 'เดือน' },
            { value: 'week', label: 'สัปดาห์' },
          ]}
        />
        <span className={styles.spacer} />
        {overCount > 0 && (
          <Chip tone="warn" icon={<AlertTriangle size={12} />} data-testid="cal-over-chip">
            เกินกำลัง {overCount} คน ในช่วงนี้
          </Chip>
        )}
        <div className={styles.filters} role="group" aria-label="กรองตามทรัพยากร">
          <button type="button" className={[styles.avChip, filter.length === 0 && styles.avChipOn].filter(Boolean).join(' ')} onClick={() => setFilter([])}>
            ทุกคน
          </button>
          {resourcesInProject.map((r) => {
            const on = filter.includes(r.id)
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={on}
                className={[styles.avChip, on && styles.avChipOn].filter(Boolean).join(' ')}
                onClick={() => setFilter(on ? filter.filter((x) => x !== r.id) : [...filter, r.id])}
              >
                <Avatar name={r.name} color={r.color} />
                {r.name}
              </button>
            )
          })}
        </div>
      </div>

      <Card className={styles.card} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} data-testid="calendar-card">
        {p.tasks.length === 0 ? (
          <EmptyState title="ยังไม่มีงานให้แสดง" description="เพิ่มงานใน Gantt ก่อน แล้วปฏิทินจะแสดงงานตามวัน" />
        ) : view === 'month' ? (
          <MonthView anchor={anchor} items={items} holidays={holidays} workingDays={p.workingDays} today={today} selectedId={selectedId} onSelect={select} overByDate={overByDate} dropDate={dropDate} dragId={dragId} onChipPointerDown={onChipPointerDown} />
        ) : (
          <WeekByResource weekStart={rangeStart} items={items} resources={resourcesInProject} project={p} today={today} selectedId={selectedId} onSelect={select} overByResDate={overByResDate} dropDate={dropDate} dragId={dragId} onChipPointerDown={onChipPointerDown} filter={filter} />
        )}
        <DayList weekStart={rangeStart} items={items} resources={resourcesInProject} filter={filter} today={today} holidays={holidays} workingDays={p.workingDays} onSelect={select} overByResDate={overByResDate} />
        <div className={styles.legend}>
          <span className={styles.legendItem}><span className={styles.sw} style={{ background: 'var(--critical)' }} />Critical</span>
          <span className={styles.legendItem}><span className={styles.sw} style={{ background: 'var(--task)' }} />งานทั่วไป (สีตามคนแรกที่รับผิดชอบ)</span>
          <span className={styles.legendItem}><span className={styles.sw} style={{ boxShadow: 'inset 0 0 0 2px var(--critical)', background: 'transparent' }} />ล่าช้า</span>
          <span className={styles.legendItem}><span className={styles.badge} style={{ position: 'static' }}>2</span>จำนวนคนที่เกินกำลังในวันนั้น</span>
          <span className={styles.spacer} />
          <span style={{ color: 'var(--text-3)', fontSize: 'var(--fs-caption)' }}>ลากชิปไปวางวันอื่นเพื่อเลื่อนงาน</span>
        </div>
        {selectedId && p.schedule.tasks[selectedId] && <TaskPanel project={p} taskId={selectedId} onClose={() => select(null)} onSelect={select} />}
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- month view

interface MonthProps {
  anchor: string
  items: Item[]
  holidays: Set<string>
  workingDays: number[]
  today: string
  selectedId: string | null
  onSelect: (id: string) => void
  overByDate: Map<string, number>
  dropDate: string | null
  dragId: string | null
  onChipPointerDown: (e: ReactPointerEvent, id: string) => void
}

function MonthView({ anchor, items, holidays, workingDays, today, selectedId, onSelect, overByDate, dropDate, dragId, onChipPointerDown }: MonthProps) {
  const month = startOfMonthISO(anchor).slice(0, 7)
  const grid = monthGrid(anchor)
  return (
    <div className={styles.month} data-testid="month-view">
      <div className={styles.dow}>
        {DOW.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className={styles.weeks}>
        {grid.map((week) => {
          const segs = weekSegments(week[0], items)
          const overflow = overflowPerDay(segs)
          return (
            <div key={week[0]} className={styles.week}>
              {week.map((iso, col) => {
                const wd = isoWeekday(iso)
                const over = overByDate.get(iso)
                return (
                  <div
                    key={iso}
                    data-date={iso}
                    className={[
                      styles.cell,
                      !iso.startsWith(month) && styles.cellOut,
                      !workingDays.includes(wd) && styles.cellWe,
                      holidays.has(iso) && styles.cellHoliday,
                      iso === today && styles.cellToday,
                      dropDate === iso && styles.cellDrop,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className={styles.dayNum}>{parseISO(iso).getUTCDate()}</span>
                    {holidays.has(iso) && <span className={styles.holName}>วันหยุด</span>}
                    {over ? (
                      <span className={styles.badge} title={`เกินกำลัง ${over} คน`} data-testid={`over-${iso}`}>
                        {over}
                      </span>
                    ) : null}
                    {overflow[col] > 0 && <span className={styles.more}>+{overflow[col]} งาน</span>}
                  </div>
                )
              })}
              <div className={styles.segLayer}>
                {segs
                  .filter((s) => s.lane < MAX_LANES)
                  .map((s) => (
                    <button
                      key={s.item.id}
                      type="button"
                      data-testid={`cal-chip-${s.item.id}`}
                      title={`${s.item.name} · ${formatThai(s.item.start)} – ${formatThai(s.item.end)}`}
                      className={[
                        styles.seg,
                        s.item.critical && styles.segCritical,
                        s.item.late && styles.segLate,
                        s.item.id === selectedId && styles.segSel,
                        s.clippedStart && styles.segClipL,
                        s.clippedEnd && styles.segClipR,
                        s.item.milestone && styles.segMs,
                        dragId === s.item.id && styles.segDrag,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={{
                        left: `calc(${(s.col / 7) * 100}% + 4px)`,
                        width: s.item.milestone ? undefined : `calc(${(s.span / 7) * 100}% - 8px)`,
                        top: s.lane * 26,
                        background: !s.item.critical && !s.item.milestone && s.item.color ? s.item.color : undefined,
                        color: !s.item.critical && !s.item.milestone && s.item.color ? '#fff' : undefined,
                      }}
                      onClick={() => onSelect(s.item.id)}
                      onPointerDown={(e) => onChipPointerDown(e, s.item.id)}
                    >
                      {!s.item.milestone && s.item.name}
                    </button>
                  ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// -------------------------------------------------------- week by resource view

interface WeekProps {
  weekStart: string
  items: Item[]
  resources: Resource[]
  project: ProjectOut
  today: string
  selectedId: string | null
  onSelect: (id: string) => void
  overByResDate: Map<string, number>
  dropDate: string | null
  dragId: string | null
  onChipPointerDown: (e: ReactPointerEvent, id: string) => void
  filter: string[]
}

function WeekByResource({ weekStart, items, resources, project, today, selectedId, onSelect, overByResDate, dropDate, dragId, onChipPointerDown, filter }: WeekProps) {
  const days = weekDays(weekStart)
  const rows: { key: string; resource: Resource | null; items: Item[] }[] = resources
    .filter((r) => filter.length === 0 || filter.includes(r.id))
    .map((r) => ({ key: r.id, resource: r, items: items.filter((i) => i.resourceIds.includes(r.id)) }))
  const unassigned = items.filter((i) => i.resourceIds.length === 0)
  if (unassigned.length && filter.length === 0) rows.push({ key: 'none', resource: null, items: unassigned })
  const weekLoad = (rid: string) => {
    let peak = 0
    for (const d of days) peak = Math.max(peak, overByResDate.get(`${rid}|${d}`) ?? 0)
    return peak
  }
  return (
    <div className={styles.weekView} data-testid="week-view">
      <table className={styles.wTable}>
        <thead>
          <tr>
            <th>ทรัพยากร</th>
            {days.map((d) => (
              <th key={d} className={[!project.workingDays.includes(isoWeekday(d)) && styles.we, d === today && styles.today].filter(Boolean).join(' ')}>
                {THAI_WEEKDAYS_SHORT[parseISO(d).getUTCDay()]} {parseISO(d).getUTCDate()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} data-testid={`week-row-${row.key}`}>
              <td className={styles.resCell}>
                {row.resource ? (
                  <>
                    <Avatar name={row.resource.name} color={row.resource.color} />
                    <div>
                      {row.resource.name}
                      {weekLoad(row.resource.id) > 0 && <div className={styles.resSub} style={{ color: 'var(--critical-text)' }}>สูงสุด {weekLoad(row.resource.id)}%</div>}
                    </div>
                  </>
                ) : (
                  <span className={styles.resSub}>ยังไม่มอบหมาย</span>
                )}
              </td>
              {days.map((d) => {
                const over = row.resource ? overByResDate.get(`${row.resource.id}|${d}`) : undefined
                const working = project.workingDays.includes(isoWeekday(d)) && !project.holidays.includes(d)
                const dayItems = working ? row.items.filter((i) => i.start <= d && i.end >= d) : []
                return (
                  <td key={d} data-date={d} className={[!project.workingDays.includes(isoWeekday(d)) && styles.we, over && styles.over, dropDate === d && styles.cellDrop].filter(Boolean).join(' ')}>
                    {over ? (
                      <div className={styles.overPct}>
                        <AlertTriangle size={11} /> {over}%
                      </div>
                    ) : null}
                    {dayItems.map((i) => (
                      <button
                        key={i.id}
                        type="button"
                        data-testid={`week-chip-${row.key}-${i.id}`}
                        className={[styles.wChip, i.critical && styles.wChipCritical, i.id === selectedId && styles.wChipSel, dragId === i.id && styles.segDrag].filter(Boolean).join(' ')}
                        style={!i.critical && i.color ? { background: i.color, color: '#fff' } : undefined}
                        onClick={() => onSelect(i.id)}
                        onPointerDown={(e) => onChipPointerDown(e, i.id)}
                        title={i.name}
                      >
                        {i.name}
                      </button>
                    ))}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ----------------------------------------------------------- mobile day list

function DayList({ weekStart, items, resources, filter, today, holidays, workingDays, onSelect, overByResDate }: { weekStart: string; items: Item[]; resources: Resource[]; filter: string[]; today: string; holidays: Set<string>; workingDays: number[]; onSelect: (id: string) => void; overByResDate: Map<string, number> }) {
  const days = weekDays(weekStart)
  const ids = filter.length ? filter : resources.map((r) => r.id)
  return (
    <div className={styles.dayList} data-testid="day-list">
      {days.map((d) => {
        const off = !workingDays.includes(isoWeekday(d)) || holidays.has(d)
        const dayItems = off ? [] : items.filter((i) => i.start <= d && i.end >= d)
        const over = Math.max(0, ...ids.map((rid) => overByResDate.get(`${rid}|${d}`) ?? 0))
        return (
          <div key={d} className={[styles.day, over > 0 && styles.dayOver, off && styles.dayWe, d === today && styles.dayToday].filter(Boolean).join(' ')}>
            <div className={styles.dn}>
              <b>{parseISO(d).getUTCDate()}</b>
              <span>{THAI_WEEKDAYS_SHORT[parseISO(d).getUTCDay()]}</span>
            </div>
            <div className={styles.dTasks}>
              {dayItems.length === 0 && <span className={styles.free}>{off ? 'วันหยุด' : 'ว่าง'}</span>}
              {dayItems.map((i) => (
                <button key={i.id} type="button" className={[styles.wChip, i.critical && styles.wChipCritical].filter(Boolean).join(' ')} style={!i.critical && i.color ? { background: i.color, color: '#fff' } : undefined} onClick={() => onSelect(i.id)}>
                  {i.name}
                </button>
              ))}
            </div>
            {over > 0 && (
              <span className={styles.overPct}>
                <AlertTriangle size={12} /> {over}%
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

