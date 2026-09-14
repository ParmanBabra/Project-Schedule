import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import { BottomNav } from './BottomNav'
import { useUiStore } from './uiStore'

function Probe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}</div>
}

describe('BottomNav', () => {
  it('shows project tabs and the + requests Add task on the Gantt', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/p/:projectId/*" element={<><BottomNav /><Probe /></>} />
      </Routes>,
      { route: '/p/prj_a/calendar' },
    )
    expect(screen.getByRole('link', { name: 'Gantt' })).toHaveAttribute('href', '/p/prj_a/gantt')
    expect(screen.getByRole('link', { name: 'ปฏิทิน' })).toHaveAttribute('aria-current', 'page')
    const before = useUiStore.getState().addTaskRequest
    await userEvent.click(screen.getByRole('button', { name: 'เพิ่มงาน' }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/p/prj_a/gantt')
    await new Promise((r) => setTimeout(r, 5))
    expect(useUiStore.getState().addTaskRequest).toBe(before + 1)
  })

  it('shows only global tabs without a project', () => {
    renderWithProviders(
      <Routes>
        <Route path="/" element={<BottomNav />} />
      </Routes>,
      { route: '/' },
    )
    expect(screen.getByRole('link', { name: 'โปรเจกต์' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'เพิ่มงาน' })).not.toBeInTheDocument()
  })
})
