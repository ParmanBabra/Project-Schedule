import { useQuery } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { projectKeys } from '@/features/projects/api'
import type { ProjectOut } from '@/features/projects/types'
import { mockFetch, sampleProject } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'
import { ChecklistSection, checklistPercent } from './ChecklistSection'
import { TaskPanel } from './TaskPanel'

function withChecklist(): ProjectOut {
  const p = sampleProject()
  const t = p.tasks.find((x) => x.id === 't2')!
  t.checklist = [
    { id: 'c1', text: 'เขียน spec', done: true },
    { id: 'c2', text: 'ทำหน้าจอ', done: false },
  ]
  t.progress = 50
  return p
}

/** Renders the section from the query cache, like the real page (mutations write the cache). */
function Host({ initial }: { initial: ProjectOut }) {
  const q = useQuery({ queryKey: projectKeys.detail(initial.id), queryFn: async () => initial, initialData: initial, staleTime: Infinity })
  return <ChecklistSection project={q.data} taskId="t2" />
}

/** PATCH mock that behaves like the server: echoes the list back with ids and derived progress. */
function echoPatch(base: () => ProjectOut, delayFirst = false) {
  let resolveFirst: (() => void) | null = null
  const fn = vi.fn((init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { checklist?: Array<{ id?: string; text: string; done: boolean }>; progressFromChecklist?: boolean }
    const p = base()
    const t = p.tasks.find((x) => x.id === 't2')!
    if (body.checklist) {
      t.checklist = body.checklist.map((c, i) => ({ id: c.id ?? `c${i}`, text: c.text, done: c.done }))
      t.progress = checklistPercent(t.checklist) ?? t.progress
    }
    if (body.progressFromChecklist !== undefined) t.progressFromChecklist = body.progressFromChecklist
    if (delayFirst && fn.mock.calls.length === 1) return new Promise<ProjectOut>((r) => (resolveFirst = () => r(p)))
    return p
  })
  return { fn, release: () => resolveFirst?.() }
}

describe('ChecklistSection', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('checklistPercent rounds done/total', () => {
    expect(checklistPercent([])).toBeNull()
    expect(checklistPercent([{ done: true }, { done: false }, { done: false }])).toBe(33)
  })

  it('adds an item with Enter and sends the whole list', async () => {
    const { fn: patch } = echoPatch(sampleProject)
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'PATCH /projects/prj_sample/tasks/t2': patch })))
    renderWithProviders(<Host initial={sampleProject()} />)
    expect(screen.queryByTestId('checklist-count')).not.toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('เพิ่มงานย่อย'), 'เขียน spec{Enter}')
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1))
    const body = JSON.parse((patch.mock.calls[0] as unknown as [RequestInit])[0].body as string)
    expect(body).toEqual({ checklist: [{ text: 'เขียน spec', done: false }] })
    expect(screen.getByLabelText('เพิ่มงานย่อย')).toHaveValue('')
    await waitFor(() => expect(screen.getByTestId('ck-c0')).toBeInTheDocument()) // server id adopted
  })

  it('serialises rapid edits: one PATCH at a time, the last one carries every item', async () => {
    const { fn: patch, release } = echoPatch(sampleProject, true)
    // mockFetch does not await promise results, so wire fetch directly for the delayed first call
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => new Response(JSON.stringify(await patch(init)), { status: 200 })))
    renderWithProviders(<Host initial={sampleProject()} />)
    await userEvent.type(screen.getByLabelText('เพิ่มงานย่อย'), 'A{Enter}B{Enter}C{Enter}')
    // first request is still pending; nothing else was sent yet, but all three show locally
    expect(patch).toHaveBeenCalledTimes(1)
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
    release()
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2))
    const last = JSON.parse((patch.mock.calls[1] as unknown as [RequestInit])[0].body as string)
    expect(last.checklist.map((c: { text: string }) => c.text)).toEqual(['A', 'B', 'C'])
    await waitFor(() => expect(screen.getByTestId('ck-c2')).toBeInTheDocument()) // ids adopted after the queue drains
    expect(screen.getAllByRole('checkbox')).toHaveLength(3)
  })

  it('ticks, renames, deletes and shows the derived percent', async () => {
    const { fn: patch } = echoPatch(withChecklist)
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'PATCH /projects/prj_sample/tasks/t2': patch })))
    renderWithProviders(<Host initial={withChecklist()} />)
    expect(screen.getByTestId('checklist-count')).toHaveTextContent('เสร็จ 1 / 2')
    expect(screen.getByTestId('checklist-note')).toHaveTextContent('1 ÷ 2 = 50%')

    await userEvent.click(screen.getByRole('checkbox', { name: 'ทำเสร็จ ทำหน้าจอ' }))
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1))
    let body = JSON.parse((patch.mock.calls[0] as unknown as [RequestInit])[0].body as string)
    expect(body.checklist.map((c: { done: boolean }) => c.done)).toEqual([true, true])
    await waitFor(() => expect(screen.getByTestId('checklist-count')).toHaveTextContent('เสร็จ 2 / 2'))
    expect(screen.getByTestId('checklist-note')).toHaveTextContent('2 ÷ 2 = 100%')

    const text = screen.getByLabelText('ข้อความงานย่อย 2')
    await userEvent.clear(text)
    await userEvent.type(text, 'ทำหน้าจอสแกน{Enter}')
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(2))
    body = JSON.parse((patch.mock.calls[1] as unknown as [RequestInit])[0].body as string)
    expect(body.checklist[1]).toMatchObject({ id: 'c2', text: 'ทำหน้าจอสแกน' })

    await userEvent.click(screen.getByRole('button', { name: 'ลบงานย่อย เขียน spec' }))
    await waitFor(() => expect(patch).toHaveBeenCalledTimes(3))
    body = JSON.parse((patch.mock.calls[2] as unknown as [RequestInit])[0].body as string)
    expect(body.checklist).toHaveLength(1)
    await waitFor(() => expect(screen.getByTestId('checklist-count')).toHaveTextContent('เสร็จ 1 / 1'))
  })

  it('switch off sends progressFromChecklist=false and the panel unlocks the % field', async () => {
    const { fn: patch } = echoPatch(withChecklist)
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'PATCH /projects/prj_sample/tasks/t2': patch })))
    renderWithProviders(<TaskPanel project={withChecklist()} taskId="t2" onClose={() => {}} onSelect={() => {}} />)
    const pct = screen.getByLabelText('ความคืบหน้า')
    expect(pct).toHaveAttribute('readonly')
    expect(pct).toHaveValue(50)
    const section = within(screen.getByTestId('checklist'))
    await userEvent.click(section.getByRole('switch', { name: 'คิด % ความคืบหน้าจากงานย่อย' }))
    await waitFor(() => expect(patch).toHaveBeenCalled())
    const body = JSON.parse((patch.mock.calls[0] as unknown as [RequestInit])[0].body as string)
    expect(body).toEqual({ progressFromChecklist: false })
  })
})
