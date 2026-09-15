import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, sampleProject } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'
import { ChainDialog, DEFAULT_STEPS } from './ChainDialog'

describe('ChainDialog', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows default steps, preview from the dry run, and posts the chain', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = []
    const preview = sampleProject()
    preview.schedule.summary.plannedEnd = '2026-10-16'
    vi.stubGlobal(
      'fetch',
      vi.fn(
        mockFetch({
          'POST /projects/prj_sample/tasks/t2/chain': (init, url) => {
            calls.push({ url: url ?? '', body: JSON.parse(String(init?.body)) })
            return preview
          },
        }),
      ),
    )
    const onClose = vi.fn()
    renderWithProviders(<ChainDialog project={sampleProject()} taskId="t2" open onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: 'สร้างงานต่อจาก "ออกแบบระบบ"' })
    const list = within(dialog).getByRole('list', { name: 'ขั้นตอน' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(DEFAULT_STEPS.length)
    expect(within(dialog).getByRole('checkbox', { name: 'ใช้ขั้นตอน UAT กับผู้ใช้' })).toHaveAttribute('aria-checked', 'false')
    expect(within(dialog).getByTestId('chain-submit')).toHaveTextContent('สร้าง 5 งาน')
    // preview: FE/BE stacked, total = 3 + 5 + 3 + 1 = 12 days
    const pv = within(dialog).getByTestId('chain-preview')
    expect(pv).toHaveTextContent('5 งานใหม่ · 12 วันทำงาน')
    await waitFor(() => expect(pv).toHaveTextContent('16 ต.ค. 2569'))
    expect(calls[0].url).toContain('dryRun=true')

    // untick a step, rename another, disable grouping
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'ใช้ขั้นตอน Deploy' }))
    expect(within(dialog).getByTestId('chain-submit')).toHaveTextContent('สร้าง 4 งาน')
    const name = within(dialog).getByLabelText('ชื่อขั้นตอน 4')
    await userEvent.clear(name)
    await userEvent.type(name, 'ทดสอบระบบ')
    await userEvent.click(within(dialog).getByLabelText(/รวมงานทั้งหมดเป็นกลุ่ม/))

    await userEvent.click(within(dialog).getByTestId('chain-submit'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    const post = calls.find((c) => !c.url.includes('dryRun=true'))!
    expect(post.body.groupName).toBeNull()
    expect(post.body.prefixWithSource).toBe(true)
    expect(post.body.remember).toBe(true)
    const steps = post.body.steps as Array<{ name: string; enabled: boolean; parallel: boolean }>
    expect(steps.map((s) => s.name)).toEqual(['ออกแบบ UI', 'พัฒนา Frontend', 'พัฒนา Backend', 'ทดสอบระบบ', 'UAT กับผู้ใช้', 'Deploy'])
    expect(steps.map((s) => s.enabled)).toEqual([true, true, true, true, false, false])
    expect(steps[2].parallel).toBe(true)
  })

  it('starts from the project template when one is remembered', () => {
    vi.stubGlobal('fetch', vi.fn(mockFetch({})))
    const p = sampleProject()
    p.chainTemplates = [{ name: 'เขียนเอกสาร', duration: 2, enabled: true, parallel: false }]
    renderWithProviders(<ChainDialog project={p} taskId="t2" open onClose={() => {}} />)
    expect(screen.getByLabelText('ชื่อขั้นตอน 1')).toHaveValue('เขียนเอกสาร')
    expect(screen.getByTestId('chain-submit')).toHaveTextContent('สร้าง 1 งาน')
  })
})
