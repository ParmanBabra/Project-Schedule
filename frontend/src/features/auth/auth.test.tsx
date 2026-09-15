import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/shared/api/client'
import { mockFetch } from '@/test/fixtures'
import { renderWithProviders } from '@/test/render'
import { LoginPage } from './LoginPage'
import { RequireAuth } from './RequireAuth'

function Loc() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname}</div>
}

const unauthorized = () => new Response(JSON.stringify({ error: { code: 'unauthorized', message: 'ยังไม่ได้เข้าสู่ระบบ' } }), { status: 401 })

function app() {
  return (
    <Routes>
      <Route path="/login" element={<><LoginPage /><Loc /></>} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<><div>หน้าโปรเจกต์</div><Loc /></>} />
        <Route path="/resources" element={<><div>หน้าทรัพยากร</div><Loc /></>} />
      </Route>
    </Routes>
  )
}

describe('auth', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends anonymous visitors to /login and back to where they were after logging in', async () => {
    let loggedIn = false
    const login = vi.fn((init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      if (body.password !== 'ok') return unauthorized()
      loggedIn = true
      return { username: 'somchai', authDisabled: false }
    })
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'GET /auth/me': () => (loggedIn ? { username: 'somchai', authDisabled: false } : unauthorized()), 'POST /auth/login': login })))
    renderWithProviders(app(), { route: '/resources' })
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/login'))
    expect(screen.getByRole('heading', { name: 'แผนงาน' })).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('ชื่อผู้ใช้'), 'somchai')
    await userEvent.type(screen.getByLabelText('รหัสผ่าน'), 'bad{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')

    await userEvent.clear(screen.getByLabelText('รหัสผ่าน'))
    await userEvent.type(screen.getByLabelText('รหัสผ่าน'), 'ok{Enter}')
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/resources'))
    expect(screen.getByText('หน้าทรัพยากร')).toBeInTheDocument()
    expect(login).toHaveBeenCalledTimes(2)
  })

  it('renders the app when the session is valid and redirects when a later call answers 401', async () => {
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'GET /auth/me': () => ({ username: 'somchai', authDisabled: false }), 'GET /projects': unauthorized })))
    renderWithProviders(app(), { route: '/' })
    expect(await screen.findByText('หน้าโปรเจกต์')).toBeInTheDocument()
    await expect(api('/projects')).rejects.toThrow()
    await waitFor(() => expect(screen.getByTestId('loc')).toHaveTextContent('/login'))
  })

  it('shows a throttle message on 429 and requires both fields', async () => {
    vi.stubGlobal('fetch', vi.fn(mockFetch({ 'GET /auth/me': unauthorized, 'POST /auth/login': () => new Response(JSON.stringify({ error: { code: 'too_many_attempts', message: 'x' } }), { status: 429 }) })))
    renderWithProviders(app(), { route: '/login' })
    await userEvent.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('กรอกชื่อผู้ใช้และรหัสผ่าน')
    await userEvent.type(screen.getByLabelText('ชื่อผู้ใช้'), 'a')
    await userEvent.type(screen.getByLabelText('รหัสผ่าน'), 'b{Enter}')
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('ลองผิดหลายครั้งเกินไป'))
  })
})
