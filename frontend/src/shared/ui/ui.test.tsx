import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button, Dialog, Segment, Toggle, WeekdayPicker } from './index'

describe('shared ui', () => {
  it('Button renders variants and forwards clicks', async () => {
    const onClick = vi.fn()
    render(
      <Button variant="primary" onClick={onClick}>
        เพิ่มงาน
      </Button>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'เพิ่มงาน' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('Segment behaves like a radio group', async () => {
    const onChange = vi.fn()
    render(
      <Segment
        aria-label="zoom"
        value="week"
        onChange={onChange}
        options={[
          { value: 'day', label: 'วัน' },
          { value: 'week', label: 'สัปดาห์' },
          { value: 'month', label: 'เดือน' },
        ]}
      />,
    )
    expect(screen.getByRole('radio', { name: 'สัปดาห์' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('radio', { name: 'เดือน' }))
    expect(onChange).toHaveBeenCalledWith('month')
  })

  it('Toggle and WeekdayPicker report changes', async () => {
    const onToggle = vi.fn()
    const onDays = vi.fn()
    render(
      <>
        <Toggle checked={false} onChange={onToggle} label="แสดง Critical Path" />
        <WeekdayPicker value={[1, 2, 3, 4, 5]} onChange={onDays} />
      </>,
    )
    await userEvent.click(screen.getByRole('switch', { name: 'แสดง Critical Path' }))
    expect(onToggle).toHaveBeenCalledWith(true)
    await userEvent.click(screen.getByRole('button', { name: 'ส' }))
    expect(onDays).toHaveBeenCalledWith([1, 2, 3, 4, 5, 6])
    await userEvent.click(screen.getByRole('button', { name: 'ศ' }))
    expect(onDays).toHaveBeenLastCalledWith([1, 2, 3, 4])
  })

  it('Dialog closes on Escape and on the close button', async () => {
    const onClose = vi.fn()
    render(
      <Dialog open onClose={onClose} title="ลบโปรเจกต์">
        <p>แน่ใจหรือไม่</p>
      </Dialog>,
    )
    expect(screen.getByRole('dialog', { name: 'ลบโปรเจกต์' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'ปิด' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
