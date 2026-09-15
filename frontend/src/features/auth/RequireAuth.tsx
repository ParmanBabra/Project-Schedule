import { useEffect } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { onUnauthorized } from '@/shared/api/client'
import { Skeleton } from '@/shared/ui'
import { authKeys, useMe } from './api'

/**
 * Wraps every app route: waits for /auth/me, sends anonymous visitors to /login and
 * bounces back there whenever any later API call answers 401 (expired session).
 */
export function RequireAuth() {
  const me = useMe()
  const location = useLocation()
  const navigate = useNavigate()
  const qc = useQueryClient()

  useEffect(
    () =>
      onUnauthorized(() => {
        qc.setQueryData(authKeys.me, undefined)
        qc.removeQueries({ queryKey: authKeys.me })
        navigate('/login', { replace: true, state: { from: location.pathname + location.search } })
      }),
    [navigate, qc, location.pathname, location.search],
  )

  if (me.isPending) {
    return (
      <div style={{ padding: 'var(--page-pad)' }} aria-busy="true" data-testid="auth-loading">
        <Skeleton height={60} />
      </div>
    )
  }
  if (me.isError || !me.data) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <Outlet />
}
