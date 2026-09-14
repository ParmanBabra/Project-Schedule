import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, sampleProject } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'
import { TaskPanel } from './TaskPanel'

describe('TaskPanel', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows float, dates, predecessors, successors and CPM values', () => {
    vi.stubGlobal('fetch', vi.fn(mockFetch({})))
    const p = sampleProject()
    renderWithProviders(<TaskPanel project={p} taskId="t3" onClose={() => {}} onSelect={() => {}} />)
    expect(screen.getByLabelText('ชื่องาน')).toHaveValue('ออกแบบ UI')
    expect(screen.getByText('เลื่อนได้ 2 วัน')).toBeInTheDocument()
    expect(screen.getByLabelText('วันเริ่ม')).toHaveValue('17 ก.ย. 2569')
    expect(screen.getByTestId('pred-d2')).toHaveTextContent('รวบรวมความต้องการ')
    expect(screen.getByRole('button', { name: /พัฒนา Frontend/ })).toBeInTheDocument()
    expect(screen.getByTestId('cpm-box')).toHaveTextContent('LF24 ก.ย.')
    expect(screen.getByTestId('cpm-box')).toHaveTextContent('Total float 2 วัน')
  })

  it('autosaves duration after a short pause', async () => {
    const patch = vi.fn(() => sampleProject())
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'PATCH /projects/prj_sample/tasks/t2': patch })))
    renderWithProviders(<TaskPanel project={sampleProject()} taskId="t2" onClose={() => {}} onSelect={() => {}} />)
    const dur = screen.getByLabelText('ระยะเวลา')
    await userEvent.clear(dur)
    await userEvent.type(dur, '7')
    await waitFor(() => expect(patch).toHaveBeenCalled(), { timeout: 1500 })
    const body = JSON.parse((patch.mock.calls[0] as unknown as [RequestInit])[0].body as string)
    expect(body).toEqual({ duration: 7 })
  })

  it('adds a predecessor and surfaces cycle errors from the API', async () => {
    const post = vi
      .fn()
      .mockImplementationOnce(() => sampleProject())
      .mockImplementationOnce(
        () => new Response(JSON.stringify({ error: { code: 'cycle_detected', message: 'cycle', details: { path: [] } } }), { status: 422 }),
      )
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'POST /projects/prj_sample/dependencies': post })))
    renderWithProviders(<TaskPanel project={sampleProject()} taskId="t6" onClose={() => {}} onSelect={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'เพิ่มงานก่อนหน้า' }))
    const select = screen.getByLabelText('เลือกงานก่อนหน้า')
    // t4 and t5 are already predecessors, t6 itself excluded -> t1, t2, t3 remain
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['เลือกงาน…', '1 รวบรวมความต้องการ', '2 ออกแบบระบบ', '3 ออกแบบ UI'])
    await userEvent.selectOptions(select, 't3')
    await userEvent.click(screen.getByRole('button', { name: 'เพิ่ม' }))
    expect(JSON.parse((post.mock.calls[0] as unknown as [RequestInit])[0].body as string)).toEqual({ from: 't3', to: 't6' })

    await userEvent.click(screen.getByRole('button', { name: 'เพิ่มงานก่อนหน้า' }))
    await userEvent.selectOptions(screen.getByLabelText('เลือกงานก่อนหน้า'), 't1')
    await userEvent.click(screen.getByRole('button', { name: 'เพิ่ม' }))
    expect(await screen.findByText('สร้างวงจรไม่ได้ งานนี้จะวนกลับมาหาตัวเอง')).toBeInTheDocument()
  })

  it('changes dependency type and deletes the task after confirmation', async () => {
    const patchDep = vi.fn(() => sampleProject())
    const del = vi.fn(() => sampleProject())
    const onClose = vi.fn()
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'PATCH /projects/prj_sample/dependencies/d2': patchDep, 'DELETE /projects/prj_sample/tasks/t3': del })))
    renderWithProviders(<TaskPanel project={sampleProject()} taskId="t3" onClose={onClose} onSelect={() => {}} />)
    await userEvent.selectOptions(screen.getByLabelText('ประเภทความสัมพันธ์'), 'SS')
    expect(JSON.parse((patchDep.mock.calls[0] as unknown as [RequestInit])[0].body as string)).toEqual({ type: 'SS' })
    await userEvent.click(screen.getByRole('button', { name: 'ลบงาน' }))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ลบงาน' }))
    await waitFor(() => expect(del).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
  })
})
