import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { DatePicker, monthCells } from './DatePicker'

function Harness({ initial = '2026-09-14', min }: { initial?: string; min?: string }) {
  const [v, setV] = useState(initial)
  return (
    <>
      <DatePicker aria-label="วันเริ่ม" value={v} onChange={setV} min={min} clearable />
      <output data-testid="value">{v}</output>
    </>
  )
}

describe('DatePicker', () => {
  it('monthCells: 42 cells starting on a Monday and covering the month', () => {
    const cells = monthCells('2026-09-14')
    expect(cells).toHaveLength(42)
    expect(cells[0]).toBe('2026-08-31') // Monday before 1 Sep 2026 (Tuesday)
    expect(cells).toContain('2026-09-01')
    expect(cells).toContain('2026-09-30')
  })

  it('shows the Thai date, opens a grid, navigates months and picks a day', async () => {
    render(<Harness />)
    const control = screen.getByRole('button', { name: 'วันเริ่ม' })
    expect(control).toHaveTextContent('14 ก.ย. 2569')
    await userEvent.click(control)
    const picker = screen.getByTestId('date-picker')
    expect(within(picker).getByRole('grid')).toHaveAccessibleName('กันยายน 2569')
    expect(within(picker).getByTestId('day-2026-09-14')).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(within(picker).getByRole('button', { name: 'เดือนถัดไป' }))
    expect(within(picker).getByRole('grid')).toHaveAccessibleName('ตุลาคม 2569')
    await userEvent.click(within(picker).getByTestId('day-2026-10-06'))
    expect(screen.getByTestId('value')).toHaveTextContent('2026-10-06')
    expect(screen.queryByTestId('date-picker')).not.toBeInTheDocument()
    expect(control).toHaveTextContent('6 ต.ค. 2569')
  })

  it('respects min, closes on Escape and clears', async () => {
    render(<Harness min="2026-09-10" />)
    await userEvent.click(screen.getByRole('button', { name: 'วันเริ่ม' }))
    expect(screen.getByTestId('day-2026-09-09')).toBeDisabled()
    expect(screen.getByTestId('day-2026-09-10')).toBeEnabled()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByTestId('date-picker')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'ล้างวันที่' }))
    expect(screen.getByTestId('value')).toHaveTextContent('')
    expect(screen.getByRole('button', { name: 'วันเริ่ม' })).toHaveTextContent('เลือกวันที่')
  })
})
