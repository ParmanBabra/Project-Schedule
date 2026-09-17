import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { mockFetch } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'
import { AppShell, isFillRoute } from './AppShell'

function renderAt(route: string) {
  vi.stubGlobal('fetch', vi.fn(mockFetch({})))
  return renderWithProviders(
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/p/:projectId/gantt" element={<div>gantt page</div>} />
        <Route path="/p/:projectId/settings" element={<div>settings page</div>} />
      </Route>
    </Routes>,
    { route },
  )
}

describe('AppShell scroll model', () => {
  it('knows which routes are a scrolling canvas', () => {
    expect(isFillRoute('/p/prj_a/gantt')).toBe(true)
    expect(isFillRoute('/p/prj_a/calendar')).toBe(true)
    expect(isFillRoute('/p/prj_a/settings')).toBe(false)
    expect(isFillRoute('/p/prj_a/epics')).toBe(false)
    expect(isFillRoute('/')).toBe(false)
  })

  it('fills the viewport on the Gantt so the chart scrolls inside, and lets the window scroll elsewhere', () => {
    const { container, unmount } = renderAt('/p/prj_a/gantt')
    expect(screen.getByText('gantt page')).toBeInTheDocument()
    expect(container.querySelector('[data-fill="true"]')).not.toBeNull()
    unmount()
    const second = renderAt('/p/prj_a/settings')
    expect(screen.getByText('settings page')).toBeInTheDocument()
    expect(second.container.querySelector('[data-fill="true"]')).toBeNull()
  })
})
