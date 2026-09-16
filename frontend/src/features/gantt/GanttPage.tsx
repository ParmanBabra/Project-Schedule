import { CalendarDays, ChevronDown, CheckSquare, ClipboardPaste, FolderKanban, Flag, List, Lock, Plus, Redo2, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { useUiStore } from '@/app/layout/uiStore'
import { useIsMobile } from '@/shared/lib/useIsMobile'
import { useCanUndoRedo, useHistory } from '@/features/history/store'
import { projectKeys, useAddDependency, useProject, useReplaceState, useSaveBaseline, useUpdateTask } from '@/features/projects/api'
import type { ProjectOut, Task } from '@/features/projects/types'
import { useResources, useWorkload } from '@/features/resources/api'
import { useSchedulePreview } from '@/features/settings/api'
import { TaskPanel } from '@/features/tasks/TaskPanel'
import { ApiError } from '@/shared/api/client'
import { formatThai, todayISO } from '@/shared/lib/date'
import { Button, Card, Chip, EmptyState, IconButton, Menu, Segment, Select, Skeleton, Toggle, useToast } from '@/shared/ui'
import { ExportMenu } from '@/features/io/ExportMenu'
import { CreateEpicDialog, type EpicTab } from '@/features/epics/CreateEpicDialog'
import { EpicPanel } from '@/features/epics/EpicPanel'
import { useAddEpicMembers } from '@/features/epics/api'
import { epicsOf } from '@/features/epics/lib/epics'
import epicStyles from '@/features/epics/epics.module.css'
import { useMoveTask } from '@/features/projects/api'
import { AddTaskDialog } from './AddTaskDialog'
import { DependencyPopover } from './DependencyPopover'
import { GanttChart, type DragPatch } from './GanttChart'
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

function apiMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError && e.body && typeof e.body === 'object' && 'error' in e.body) {
    const err = (e.body as { error: { code?: string; message?: string } }).error
    if (err.code === 'cycle_detected') return 'สร้างวงจรไม่ได้ งานนี้จะวนกลับมาหาตัวเอง'
    if (err.message) return err.message
  }
  return fallback
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT') {
    const type = (el as HTMLInputElement).type
    return !['checkbox', 'radio', 'range', 'button', 'submit'].includes(type)
  }
  return tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export function GanttPage() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const project = useProject(projectId)
  const updateTask = useUpdateTask(projectId)
  const addDependency = useAddDependency(projectId)
  const replaceState = useReplaceState(projectId)
  const saveBaseline = useSaveBaseline(projectId)
  const qc = useQueryClient()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('task')
  const [zoom, setZoomState] = useState<Zoom>(readZoom)
  const [highlight, setHighlight] = useState(true)
  const [adding, setAdding] = useState(false)
  const [epicDialog, setEpicDialog] = useState<{ tab: EpicTab; taskIds?: string[] } | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [moveTarget, setMoveTarget] = useState<string>('')
  const addMembers = useAddEpicMembers(projectId)
  const moveTask = useMoveTask(projectId)
  const epicFilter = params.get('epic')
  const [listOpen, setListOpen] = useState(false)
  const [scrollToken, setScrollToken] = useState(0)
  const [dragPatch, setDragPatch] = useState<DragPatch | null>(null)
  const [popover, setPopover] = useState<{ depId: string; x: number; y: number } | null>(null)
  const { canUndo, canRedo } = useCanUndoRedo(projectId)
  const addTaskRequest = useUiStore((s) => s.addTaskRequest)
  const isMobile = useIsMobile()
  useEffect(() => {
    if (addTaskRequest > 0) setAdding(true)
  }, [addTaskRequest])
  const wlFrom = project.data?.startDate ?? todayISO()
  const wlTo = project.data?.schedule.summary.plannedEnd ?? wlFrom
  const projectResourceIds = useMemo(() => Array.from(new Set((project.data?.assignments ?? []).map((a) => a.resourceId))), [project.data?.assignments])
  const workload = useWorkload(wlFrom, wlTo, projectId, projectResourceIds.length > 0, projectResourceIds)
  const resources = useResources()
  const overloadedIds = useMemo(() => new Set((workload.data?.overallocations ?? []).map((o) => o.resourceId)), [workload.data])
  const overCount = overloadedIds.size

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

  // ------------------------------------------------------------ drag preview
  const patchTasks = useMemo<Task[] | undefined>(() => {
    const p = project.data
    if (!p || !dragPatch) return undefined
    const t = p.tasks.find((x) => x.id === dragPatch.taskId)
    if (!t) return undefined
    return [
      {
        ...t,
        ...(dragPatch.start ? { constraint: { type: 'SNET', date: dragPatch.start } } : {}),
        ...(dragPatch.duration !== undefined ? { duration: dragPatch.duration } : {}),
      },
    ]
  }, [project.data, dragPatch])
  const preview = useSchedulePreview(projectId, { patchTasks }, Boolean(patchTasks))

  const commitDrag = (patch: DragPatch) => {
    const p = project.data
    if (!p) return
    const body = patch.start ? { taskId: patch.taskId, constraint: { type: 'SNET' as const, date: patch.start } } : { taskId: patch.taskId, duration: patch.duration }
    updateTask.mutate(body, {
      onSuccess: (next) => {
        const s = next.schedule.tasks[patch.taskId]
        const name = next.tasks.find((t) => t.id === patch.taskId)?.name ?? ''
        toast.show(patch.start ? `ย้าย "${name}" ไปเริ่ม ${formatThai(s.start)}` : `"${name}" เป็น ${patch.duration} วัน`, {
          action: { label: 'เลิกทำ', onClick: () => undo() },
        })
      },
      onError: (e) => toast.error(apiMessage(e, 'ย้ายงานไม่สำเร็จ')),
    })
  }

  const link = (from: string, to: string) => {
    addDependency.mutate(
      { from, to },
      {
        onSuccess: () => toast.success('เชื่อมความสัมพันธ์แล้ว'),
        onError: (e) => toast.error(apiMessage(e, 'เชื่อมไม่สำเร็จ')),
      },
    )
  }

  // --------------------------------------------------------------- undo/redo
  const undo = useCallback(() => {
    const current = qc.getQueryData<ProjectOut>(projectKeys.detail(projectId))
    if (!current) return
    const snapshot = useHistory.getState().undo(projectId, current)
    if (!snapshot) return
    replaceState.mutate(snapshot, { onError: () => toast.error('เลิกทำไม่สำเร็จ') })
  }, [projectId, qc, replaceState, toast])

  const redo = useCallback(() => {
    const current = qc.getQueryData<ProjectOut>(projectKeys.detail(projectId))
    if (!current) return
    const snapshot = useHistory.getState().redo(projectId, current)
    if (!snapshot) return
    replaceState.mutate(snapshot, { onError: () => toast.error('ทำซ้ำไม่สำเร็จ') })
  }, [projectId, qc, replaceState, toast])

  // ---------------------------------------------------------------- keyboard
  const keyState = useRef({ undo, redo })
  useEffect(() => {
    keyState.current = { undo, redo }
  }, [undo, redo])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        if (isTypingTarget(e.target)) return
        e.preventDefault()
        if (e.shiftKey) keyState.current.redo()
        else keyState.current.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        if (isTypingTarget(e.target)) return
        e.preventDefault()
        keyState.current.redo()
        return
      }
      if (mod || e.altKey || isTypingTarget(e.target) || document.querySelector('[role="dialog"][aria-modal="true"]')) return
      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault()
          setAdding(true)
          break
        case '1':
          setZoom('day')
          break
        case '2':
          setZoom('week')
          break
        case '3':
          setZoom('month')
          break
        case 't':
          setScrollToken((n) => n + 1)
          break
        case 'c':
          setHighlight((v) => !v)
          break
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

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
  const s = preview.data && dragPatch ? preview.data.summary : p.schedule.summary
  const b = preview.data && dragPatch ? preview.data.buffer : p.schedule.buffer
  const zoomOptions = [
    { value: 'day' as const, label: 'วัน', title: 'คีย์ 1' },
    { value: 'week' as const, label: 'สัปดาห์', title: 'คีย์ 2' },
    { value: 'month' as const, label: 'เดือน', title: 'คีย์ 3' },
  ].filter((o) => !isMobile || o.value !== 'day') // มือถือไม่มีซูมรายวัน (ui-design §5.2)
  const effectiveZoom: Zoom = isMobile && zoom === 'day' ? 'week' : zoom
  const epics = epicsOf(p)
  const sameParent = new Set([...selectedIds].map((id) => p.tasks.find((t) => t.id === id)?.parentId ?? null)).size <= 1

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <Button size="sm" icon={<List size={16} />} onClick={() => setListOpen(true)} aria-label="รายการงาน" disabled={p.tasks.length === 0}>
          <span className={styles.todayLabel}>รายการงาน</span>
        </Button>
        <Segment<Zoom> aria-label="ระดับการซูม" variant="white" value={effectiveZoom} onChange={setZoom} options={zoomOptions} />
        <Button size="sm" className={styles.todayBtn} icon={<CalendarDays size={16} />} onClick={() => setScrollToken((n) => n + 1)} aria-label="เลื่อนไปวันนี้" title="คีย์ T">
          <span className={styles.todayLabel}>วันนี้</span>
        </Button>
        <span className={styles.cpToggle}>
          <Toggle checked={highlight} onChange={setHighlight} label="Critical path" />
        </span>
        {epics.length > 0 && (
          <span className={styles.epicFilter}>
            <Select<string>
              aria-label="กรองตาม Epic"
              value={epicFilter ?? ''}
              onChange={(v) => setParams((prev) => { const n = new URLSearchParams(prev); if (v) n.set('epic', v); else n.delete('epic'); return n }, { replace: true })}
              options={[{ value: '', label: 'ทุก Epic' }, ...epics.map((e) => ({ value: e.id, label: `Epic: ${e.name}` }))]}
            />
          </span>
        )}
        <Button size="sm" icon={<CheckSquare size={16} />} onClick={() => { setSelecting((v) => !v); setSelectedIds(new Set()) }} aria-pressed={selecting} aria-label="เลือกหลายงาน" title="เลือกหลายงานเพื่อรวมเป็น Epic หรือย้าย" disabled={p.tasks.length === 0} className={styles.todayBtn}>
          <span className={styles.todayLabel}>{selecting ? 'เลิกเลือก' : 'เลือกหลายงาน'}</span>
        </Button>
        {isMobile && p.tasks.length > 0 ? (
          <button type="button" className={styles.todayFab} onClick={() => setScrollToken((n) => n + 1)} aria-label="เลื่อนไปวันนี้ (ลอย)" data-testid="today-fab">
            <CalendarDays size={18} />
            วันนี้
          </button>
        ) : null}
        <span className={styles.undoGroup}>
          <IconButton label="เลิกทำ (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
            <Undo2 size={16} />
          </IconButton>
          <IconButton label="ทำซ้ำ (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
            <Redo2 size={16} />
          </IconButton>
        </span>
        <span className={styles.spacer} />
        <div className={styles.chips}>
          {s.taskCount > 0 && (
            <>
              <Chip tone="critical" data-testid="chip-critical">
                Critical {s.criticalCount} งาน
              </Chip>
              {s.nearCriticalCount > 0 && <Chip tone="warn">ใกล้ critical {s.nearCriticalCount}</Chip>}
              {overCount > 0 && (
                <Chip tone="warn" data-testid="chip-overallocation" title="ดูรายละเอียดในหน้าทรัพยากร">
                  เกินกำลัง {overCount} คน
                </Chip>
              )}
              {s.lateCount > 0 && (
                <Chip tone="critical" data-testid="chip-late">
                  ล่าช้า {s.lateCount} งาน
                </Chip>
              )}
              {b.days > 0 && p.schedule.releases.length === 0 && (
                <Chip
                  tone={b.status === 'red' ? 'critical' : b.status === 'yellow' ? 'warn' : 'green'}
                  data-testid="chip-buffer"
                  title={
                    p.baseline && p.baseline.bufferDays > 0
                      ? `ขนาดเผื่อล็อกไว้ตอนบันทึก baseline (สายงานหลักตอนนั้น ${p.baseline.chainDays} วัน ตอนนี้ ${s.chainDays} วัน) จึงไม่เปลี่ยนตามงาน · ถ้าต้องการคำนวณใหม่ ให้บันทึก baseline ใหม่ในหน้าตั้งค่า${b.status ? ` · ใช้เผื่อไป ${b.consumedPercent}% ขณะที่งานหลักคืบหน้า ${b.chainProgress}%` : ''}`
                      : 'เผื่อคำนวณจากสายงานหลักปัจจุบัน · บันทึก baseline เพื่อล็อกและเริ่มติดตามการใช้เวลาเผื่อ'
                  }
                >
                  {p.baseline && p.baseline.bufferDays > 0 && <Lock size={12} aria-label="ล็อกที่ baseline" />}
                  เผื่อ {b.days} วัน{b.aheadDays > 0 ? ` · ล่วงหน้า ${b.aheadDays} วัน` : b.consumedPercent !== null ? ` · ใช้ไป ${b.consumedPercent}%` : ''}
                </Chip>
              )}
              {!p.baseline && (
                <Button
                  size="sm"
                  icon={<Flag size={14} />}
                  title="บันทึก baseline: ล็อกแผนปัจจุบันไว้เทียบ เพื่อดูว่าใช้เวลาเผื่อไปเท่าไร"
                  aria-label="บันทึก baseline"
                  onClick={() =>
                    saveBaseline.mutate(undefined, {
                      onSuccess: () => toast.success('บันทึก baseline แล้ว เริ่มติดตามการใช้เวลาเผื่อ'),
                      onError: () => toast.error('บันทึก baseline ไม่สำเร็จ'),
                    })
                  }
                >
                  Baseline
                </Button>
              )}
              {p.schedule.releases.length === 0 ? (
                <Chip tone="soft" data-testid="chip-dates">
                  เสร็จตามแผน {formatThai(s.plannedEnd)} · สัญญาส่ง {formatThai(s.committedEnd)}
                </Chip>
              ) : (
                p.schedule.releases.map((r) => (
                  <Chip
                    key={r.id}
                    tone={r.status === 'red' ? 'critical' : r.status === 'yellow' ? 'warn' : 'soft'}
                    data-testid={`chip-release-${r.id}`}
                    title={`${r.name}: ${r.taskIds.length} งาน สายงาน ${r.chainDays} วัน เผื่อ ${r.days} วัน · เสร็จตามแผน ${formatThai(r.plannedEnd, { year: true })} · สัญญาส่ง ${formatThai(r.committedEnd, { year: true })}${r.consumedPercent !== null ? ` · ใช้เผื่อไป ${r.consumedPercent}% ขณะที่สายงานหลักคืบหน้า ${r.chainProgress}%` : ''}`}
                  >
                    {r.name} · ส่ง {formatThai(r.committedEnd)} · เผื่อ {r.days} วัน{r.aheadDays > 0 ? ` · ล่วงหน้า ${r.aheadDays} วัน` : r.consumedPercent !== null ? ` · ใช้ไป ${r.consumedPercent}%` : ''}
                  </Chip>
                ))
              )}
              {b.paddingWarning && (
                <Chip tone="warn" data-testid="chip-padding" title={b.paddingNote ?? undefined}>
                  เผื่ออาจซ้ำซ้อน
                </Chip>
              )}
            </>
          )}
        </div>
        <ExportMenu projectId={p.id} projectName={p.name} compact={isMobile} pngTarget={() => document.querySelector<HTMLElement>('[data-testid="gantt-chart"]')} />
        <span className={[styles.addBtn, styles.split].join(' ')}>
          <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => setAdding(true)} aria-label="เพิ่มงาน" title="คีย์ N">
            <span>เพิ่มงาน</span>
          </Button>
          <Menu
            items={[
              { label: 'เพิ่มงาน', icon: <Plus size={16} />, onSelect: () => setAdding(true) },
              { label: 'สร้าง Epic (กลุ่ม + งานข้างใน)', icon: <FolderKanban size={16} />, onSelect: () => setEpicDialog({ tab: 'manual' }) },
              { label: 'วางจาก Excel / รายการ', icon: <ClipboardPaste size={16} />, onSelect: () => setEpicDialog({ tab: 'paste' }) },
            ]}
            trigger={(props) => (
              <Button variant="primary" size="sm" aria-label="ตัวเลือกเพิ่ม" className={styles.splitCaret} {...props}>
                <ChevronDown size={16} />
              </Button>
            )}
          />
        </span>
      </div>

      <Card className={[styles.card, selectedId && p.schedule.tasks[selectedId] && styles.withPanel].filter(Boolean).join(' ')}>
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
              zoom={effectiveZoom}
              rootId={epicFilter && p.schedule.tasks[epicFilter] ? epicFilter : null}
              selectable={selecting}
              selectedIds={selectedIds}
              onToggleSelected={(id, on) => setSelectedIds((prev) => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n })}
              highlightCritical={highlight}
              selectedId={selectedId}
              onSelect={select}
              onToggleCollapse={(id, collapsed) => updateTask.mutate({ taskId: id, collapsed }, { onError: () => toast.error('บันทึกสถานะยุบ/ขยายไม่สำเร็จ') })}
              scrollToken={scrollToken}
              scrollTarget="today"
              onDragPreview={setDragPatch}
              onCommitDrag={commitDrag}
              onLink={link}
              onArrowClick={(depId, x, y) => setPopover({ depId, x, y })}
              previewSchedule={dragPatch ? preview.data : null}
              resources={resources.data ?? []}
              overloadedResourceIds={overloadedIds}
            />
            <div className={styles.legend} aria-label="คำอธิบายสัญลักษณ์">
              <span className={styles.legendItem}><span className={styles.sw} style={{ background: 'var(--critical)' }} />Critical path</span>
              <span className={styles.legendItem}><span className={styles.sw} style={{ background: 'var(--task)' }} />งานทั่วไป</span>
              <span className={styles.legendItem}><span className={styles.sw} style={{ border: '2px dashed var(--link)', background: 'transparent' }} />เลื่อนได้ (float)</span>
              <span className={styles.legendItem}><span style={{ width: 10, height: 10, background: 'var(--milestone)', transform: 'rotate(45deg)', borderRadius: 2 }} />Milestone</span>
              <span className={styles.legendItem}><span className={styles.sw} style={{ background: 'var(--ink)' }} />กลุ่มงาน</span>
              <span className={styles.legendItem}><span className={styles.sw} style={{ background: 'var(--task)', boxShadow: 'inset 0 0 0 2px var(--critical)' }} />Critical ใน Epic (สี Epic ขอบชมพู)</span>
              <span className={styles.legendItem}><span className={styles.sw} style={{ border: '2px solid var(--critical)', background: 'repeating-linear-gradient(135deg, var(--critical-bg) 0 4px, var(--surface) 4px 8px)' }} />เวลาเผื่อ</span>
              <span className={styles.legendItem}><span className={styles.sw} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }} />วันหยุด</span>
              {p.buffer.method === 'ccpm' && <span className={styles.legendItem} title="ช่องว่างที่สายงานรองควรเว้นก่อนบรรจบสายงานหลัก แดง = float ไม่พอ"><span className={styles.sw} style={{ border: '2px dotted var(--text-4)', background: 'transparent' }} />Feeding buffer</span>}
              <span className={styles.spacer} />
              <span className={styles.legendHint}>ลากแถบเพื่อเลื่อนงาน · ลากขอบขวาปรับระยะเวลา · ลากจุดกลมท้ายแถบไปอีกงานเพื่อสร้างความสัมพันธ์</span>
            </div>
          </>
        )}
        {selectedId && p.schedule.tasks[selectedId] && (p.tasks.find((t) => t.id === selectedId)?.epic ? <EpicPanel project={p} taskId={selectedId} onClose={() => select(null)} onSelect={select} /> : <TaskPanel project={p} taskId={selectedId} onClose={() => select(null)} onSelect={select} />)}
      </Card>

      <AddTaskDialog project={p} open={adding} onClose={() => setAdding(false)} onCreated={(id) => select(id)} />
      {epicDialog && (
        <CreateEpicDialog
          project={p}
          open
          initialTab={epicDialog.tab}
          initialTaskIds={epicDialog.taskIds}
          defaultName={epicDialog.taskIds?.length ? (p.tasks.find((t) => t.id === epicDialog.taskIds![0])?.name ?? '') : ''}
          onClose={() => setEpicDialog(null)}
          onCreated={(out) => {
            setSelecting(false)
            setSelectedIds(new Set())
            const created = out.tasks.find((t) => t.epic && !p.tasks.some((x) => x.id === t.id))
            if (created) select(created.id)
          }}
        />
      )}
      {selecting && (
        <div className={epicStyles.selBar} role="toolbar" aria-label="งานที่เลือก" data-testid="selection-bar">
          <span>เลือก {selectedIds.size} งาน</span>
          <button type="button" className={[epicStyles.selBtn, epicStyles.selPri].join(' ')} disabled={selectedIds.size === 0 || !sameParent} title={sameParent ? undefined : 'งานที่เลือกต้องอยู่ระดับเดียวกัน'} onClick={() => setEpicDialog({ tab: 'existing', taskIds: [...selectedIds] })}>
            <FolderKanban size={16} /> รวมเป็น Epic
          </button>
          {epics.length > 0 && (
            <>
              <Select<string> aria-label="ย้ายไป Epic" value={moveTarget} onChange={setMoveTarget} options={[{ value: '', label: 'ย้ายไป Epic…' }, ...epics.filter((e) => !selectedIds.has(e.id)).map((e) => ({ value: e.id, label: e.name }))]} className={styles.selSelect} />
              <button type="button" className={epicStyles.selBtn} disabled={!moveTarget || selectedIds.size === 0} onClick={() => addMembers.mutate({ taskId: moveTarget, taskIds: [...selectedIds] }, { onSuccess: () => { toast.success(`ย้าย ${selectedIds.size} งานแล้ว`); setSelectedIds(new Set()); setMoveTarget('') }, onError: () => toast.error('ย้ายไม่สำเร็จ') })}>
                ย้าย
              </button>
            </>
          )}
          <button type="button" className={epicStyles.selBtn} disabled={![...selectedIds].some((id) => p.tasks.find((t) => t.id === id)?.parentId)} onClick={() => { const ids = [...selectedIds]; ids.forEach((id) => { const t = p.tasks.find((x) => x.id === id); const parent = t?.parentId ? p.tasks.find((x) => x.id === t.parentId) : null; if (t && parent) moveTask.mutate({ taskId: id, parentId: parent.parentId }) }); setSelectedIds(new Set()) }}>
            เอาออกจาก Epic
          </button>
          <button type="button" className={epicStyles.selX} aria-label="เลิกเลือก" onClick={() => { setSelecting(false); setSelectedIds(new Set()) }}>
            <X size={16} />
          </button>
        </div>
      )}
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
      {popover && <DependencyPopover project={p} depId={popover.depId} x={popover.x} y={popover.y} onClose={() => setPopover(null)} />}
    </div>
  )
}


